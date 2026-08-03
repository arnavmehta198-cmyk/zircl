-- Server-side rate limiting for waitlist signups.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- 1. Per-IP counter table. Only service_role touches this, so RLS is on
--    with no policies at all — the anon key can never read or write it.
create table if not exists waitlist_rate_limit (
  ip            text primary key,
  count         integer     not null default 0,
  window_start  timestamptz not null default now()
);

alter table waitlist_rate_limit enable row level security;

-- 2. Atomic check-and-increment. SECURITY DEFINER so the Edge Function can
--    call it; the upsert is a single statement, so concurrent requests from
--    the same IP can't race past the limit.
create or replace function check_waitlist_rate_limit(
  p_ip             text,
  p_max            integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into waitlist_rate_limit as w (ip, count, window_start)
  values (p_ip, 1, now())
  on conflict (ip) do update
    set count = case
          when w.window_start < now() - make_interval(mins => p_window_minutes) then 1
          else w.count + 1
        end,
        window_start = case
          when w.window_start < now() - make_interval(mins => p_window_minutes) then now()
          else w.window_start
        end
  returning w.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function check_waitlist_rate_limit(text, integer, integer) from public, anon, authenticated;

-- 3. Close the direct-insert path. Signups must go through the Edge
--    Function, which is the only place the rate limit is enforced.
drop policy if exists "anon can insert" on waitlist;

-- waitlist now has RLS enabled with zero policies: the anon key can do
-- nothing. service_role (used only inside the Edge Function) bypasses RLS.
