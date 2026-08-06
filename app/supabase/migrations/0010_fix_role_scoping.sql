-- Fix two role-scoping mistakes in 0007 and 0009.
--
-- Supabase's Firebase Third-Party Auth does NOT swap the Postgres role.
-- A Firebase JWT carries no `role` claim, so PostgREST keeps the request on
-- `anon` and identity is carried purely by the JWT (which is why every policy
-- here is written against firebase_uid(), not against the role). Migration
-- 0005 wrote this down; 0007 and 0009 then both ignored it.
--
-- Consequences, both confirmed against production:
--
--   0009  revoked EXECUTE on public_profiles() from anon, so the very calls
--         the app makes were rejected with 42501 and no user could load
--         anyone else's profile.
--
--   0007  created its RESTRICTIVE issuer-pin policies `to authenticated`.
--         Requests arrive as anon, so those policies never applied to
--         anything -- the Firebase issuer pin has not been in force at all.
--
-- Both are fixed by dropping the role restriction. Security does not come
-- from the role here; it comes from firebase_uid() and is_firebase_session(),
-- which are both derived from the verified JWT. An unauthenticated caller has
-- no JWT, so firebase_uid() is null and every policy still denies them.
-- service_role is unaffected either way: it bypasses RLS entirely.

-- 1. Let the app actually call the function -------------------------------
-- Safe: public_profiles() begins with `where firebase_uid() is not null`, so
-- a genuinely anonymous caller gets zero rows regardless of the grant.

grant execute on function public_profiles(text[], timestamptz, int) to anon, authenticated;

-- 2. Make the issuer pin real ---------------------------------------------
-- Recreated without `to authenticated` so it applies to every role that goes
-- through RLS. A token minted by anything other than the Firebase project
-- fails is_firebase_session() and is refused.

do $$
declare t text;
begin
  foreach t in array array[
    'users','conversations','messages','clubs','club_members','events',
    'blocks','reports','follow_requests','impressions','usage',
    'message_reactions','message_poll_votes','message_event_attendance'
  ] loop
    execute format(
      'drop policy if exists "firebase issued tokens only" on %I', t);
    execute format(
      'create policy "firebase issued tokens only" on %I '
      'as restrictive using (is_firebase_session())', t);
  end loop;
end $$;
