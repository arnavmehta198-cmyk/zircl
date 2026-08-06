-- Stop handing every signed-in user the whole user base's home coordinates.
--
-- `users readable by any signed-in user` grants SELECT * on `users`, and the
-- row carries `latitude`/`longitude` at full float precision plus
-- `date_of_birth` to the day. Any account could page through listUsersPage
-- and harvest exact home locations for everyone. For an app whose premise is
-- meeting strangers nearby, that is the worst thing in the schema.
--
-- The app never needs the raw values: feed.ts turns them into a distance and
-- an age and discards the rest. So compute both server-side and never send
-- the originals.
--
-- After this:
--   * you can still read YOUR OWN row in full (needed for map centring and
--     for the distance maths' origin point)
--   * everyone else reaches you only through public_profiles(), which returns
--     a rounded distance and an integer age
--
-- Verify: sign in, confirm the feed still shows "N miles away" and ages, then
-- confirm `select latitude from users where id <> <you>` returns no rows.

-- 1. Derived, non-reversible view of another user ---------------------------

create or replace function public_profiles(
  p_ids    text[]      default null,
  p_cursor timestamptz default null,
  p_limit  int         default 50
)
returns table (
  id                  text,
  name                text,
  bio                 text,
  photo_url           text,
  hobbies             text[],
  age                 int,
  distance_miles      double precision,
  onboarding_complete boolean,
  plan                text,
  created_at          timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select u.latitude as lat, u.longitude as lon
    from users u
    where u.id = firebase_uid()
  )
  select
    u.id,
    u.name,
    coalesce(u.bio, ''),
    u.photo_url,
    coalesce(u.hobbies, '{}'),
    case
      when u.date_of_birth is null then null
      else extract(year from age(current_date, u.date_of_birth))::int
    end,
    case
      when u.latitude is null or u.longitude is null
        or (select lat from me) is null or (select lon from me) is null
      then null
      -- Haversine, miles. Rounded to 1dp: enough for "2.4 miles away",
      -- far too coarse to trilaterate a home address back out of.
      else round((
        3958.7613 * 2 * asin(sqrt(
            power(sin(radians(u.latitude - (select lat from me)) / 2), 2)
          + cos(radians((select lat from me))) * cos(radians(u.latitude))
          * power(sin(radians(u.longitude - (select lon from me)) / 2), 2)
        ))
      )::numeric, 1)::double precision
    end,
    u.onboarding_complete,
    u.plan::text,
    u.created_at
  from users u
  where firebase_uid() is not null          -- never serve anonymous callers
    and u.id <> firebase_uid()
    and (p_ids is null or u.id = any (p_ids))
    and (p_cursor is null or u.created_at < p_cursor)
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all     on function public_profiles(text[], timestamptz, int) from public, anon;
grant  execute on function public_profiles(text[], timestamptz, int) to authenticated;

-- 2. The raw row becomes self-only ------------------------------------------
-- SECURITY DEFINER on public_profiles() means it still reads the table
-- normally; only direct client SELECTs are narrowed.

drop policy if exists "users readable by any signed-in user" on users;
drop policy if exists "users readable self only" on users;
create policy "users readable self only" on users
  for select using (id = firebase_uid());
