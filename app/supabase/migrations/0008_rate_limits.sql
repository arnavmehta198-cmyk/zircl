-- Server-side abuse limits.
--
-- The app has caps in src/services/usage.ts, but they do nothing right now:
-- isPremium() returns true unconditionally, so consume() returns before it
-- ever touches the counter. And even with the paywall on, consume() runs in
-- the browser -- anyone could skip it from the devtools console. So today
-- there is no limit on how fast an account can send messages, fire follow
-- requests, or create events.
--
-- These triggers run inside Postgres on INSERT, so they apply to the REST
-- API, the JS client, and a hand-rolled curl loop alike. There is no client
-- path around them.
--
-- The numbers below are deliberately ABUSE limits, not the monetisation caps
-- in FreePlanLimits (5 messages/day). A busy real user should never notice
-- these; a script trying to blast the platform hits them immediately. Tune
-- by editing the trigger arguments at the bottom.

create or replace function enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    text := firebase_uid();
  v_metric text := tg_argv[0];
  v_limit  int  := tg_argv[1]::int;
  v_scope  text := tg_argv[2];          -- 'day' | 'month'
  v_period text;
  v_count  int;
begin
  -- No verified session (service_role maintenance, migrations): don't limit.
  if v_uid is null then
    return new;
  end if;

  v_period := case
    when v_scope = 'month' then to_char(now() at time zone 'utc', 'YYYY-MM')
    else to_char(now() at time zone 'utc', 'YYYY-MM-DD')
  end;

  -- Atomic: the increment and the read are one statement, so two concurrent
  -- inserts cannot both observe an under-limit count. This is the part the
  -- client-side version could never get right.
  insert into usage (uid, metric, period, count)
  values (v_uid, 'rl_' || v_metric, v_period, 1)
  on conflict (uid, metric, period)
    do update set count = usage.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception
      'rate limit exceeded: % (max % per %)', v_metric, v_limit, v_scope
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- Counters are written by the trigger under SECURITY DEFINER, so no user
-- needs direct write access to the usage table for this to work.
--
-- Revoke EXECUTE from the client roles. Postgres already refuses a direct
-- call ("trigger functions can only be called as triggers", SQLSTATE 0A000),
-- so this is not closing a live hole -- but a SECURITY DEFINER function that
-- anon can see in the catalogue is the wrong shape, and Supabase's advisor
-- flags it. Triggers fire regardless of the caller's EXECUTE privilege.

revoke all on function enforce_rate_limit() from public, anon, authenticated;

drop trigger if exists messages_rate_limit on messages;
create trigger messages_rate_limit
  before insert on messages
  for each row execute function enforce_rate_limit('messages', '300', 'day');

drop trigger if exists follow_requests_rate_limit on follow_requests;
create trigger follow_requests_rate_limit
  before insert on follow_requests
  for each row execute function enforce_rate_limit('follow_requests', '100', 'day');

drop trigger if exists events_rate_limit on events;
create trigger events_rate_limit
  before insert on events
  for each row execute function enforce_rate_limit('events', '60', 'month');

drop trigger if exists clubs_rate_limit on clubs;
create trigger clubs_rate_limit
  before insert on clubs
  for each row execute function enforce_rate_limit('clubs', '20', 'day');

drop trigger if exists reports_rate_limit on reports;
create trigger reports_rate_limit
  before insert on reports
  for each row execute function enforce_rate_limit('reports', '50', 'day');

-- Stale counter rows accumulate one per user per metric per period. Cheap to
-- clear out; run periodically (pg_cron) or ignore until the table is large.
-- delete from usage where metric like 'rl\_%' and period < to_char(now() - interval '60 days', 'YYYY-MM-DD');
