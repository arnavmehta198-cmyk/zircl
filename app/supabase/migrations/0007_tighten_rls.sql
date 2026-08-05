-- Tighten RLS where the only thing enforcing a safety rule was React state.
--
-- Every policy below was reachable from the browser console by any signed-in
-- user. Signup is open and unverified, so "signed in" means "anyone with an
-- email address". Each fix is scoped to one behaviour so it can be reverted
-- independently if it turns out to break a flow.
--
-- Verify after applying: sign in as a normal user and confirm you can still
-- send a DM, post in a club you belong to, and accept a follow request that
-- was sent TO you.

-- 0a. Pin search_path on firebase_uid() -----------------------------------
-- Flagged by Supabase's own security advisor (0011_function_search_path_
-- mutable). Every RLS policy in this schema calls this function, so leaving
-- its search_path resolvable at call time is the wrong default even though
-- the function is not SECURITY DEFINER.

create or replace function firebase_uid() returns text
  language sql stable
  set search_path = public, pg_temp
  as $$ select auth.jwt()->>'sub' $$;

-- 0b. Only Firebase-issued tokens count as "signed in" --------------------
-- Supabase's own email provider is enabled on this project, so anyone can
-- POST /auth/v1/signup, confirm a throwaway address, and receive a valid
-- GoTrue JWT. That token has a `sub` too, so firebase_uid() returns non-null
-- for it and every `firebase_uid() is not null` policy -- including the one
-- granting SELECT on `users` -- evaluates true. That exposes every user's
-- latitude/longitude and date_of_birth to someone who never touched Firebase.
--
-- Disabling the email provider in the dashboard is the primary fix; this is
-- defence in depth so the same mistake cannot be reintroduced by a settings
-- change. RESTRICTIVE policies AND with everything else, so this narrows
-- access without granting anything.
-- https://supabase.com/docs/guides/auth/third-party/firebase-auth

create or replace function is_firebase_session() returns boolean
  language sql stable
  set search_path = public, pg_temp
  as $$
    select auth.jwt()->>'iss' = 'https://securetoken.google.com/zircl-27869'
       and auth.jwt()->>'aud' = 'zircl-27869'
  $$;

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
      'as restrictive to authenticated using (is_firebase_session())', t);
  end loop;
end $$;

-- 1. Messages: the sender must be the caller ------------------------------
-- The old policies gated on conversation/club membership but never on
-- sender_id, so a participant could insert a message attributed to anyone
-- else in the thread. Splitting FOR ALL into explicit verbs so INSERT can
-- carry its own WITH CHECK.

drop policy if exists "messages for conversation participants" on messages;
drop policy if exists "messages for club members" on messages;

drop policy if exists "messages readable by conversation participants" on messages;
create policy "messages readable by conversation participants" on messages
  for select using (
    conversation_id is not null and exists (
      select 1 from conversations c
      where c.id = conversation_id and firebase_uid() in (c.user_a, c.user_b)
    )
  );

drop policy if exists "messages insert by sender in conversation" on messages;
create policy "messages insert by sender in conversation" on messages
  for insert with check (
    sender_id = firebase_uid()
    and conversation_id is not null
    and exists (
      select 1 from conversations c
      where c.id = conversation_id and firebase_uid() in (c.user_a, c.user_b)
    )
    -- blocked in either direction: no new messages
    and not exists (
      select 1 from conversations c
      join blocks b
        on (b.blocker_id = c.user_a and b.blocked_id = c.user_b)
        or (b.blocker_id = c.user_b and b.blocked_id = c.user_a)
      where c.id = conversation_id
    )
  );

drop policy if exists "messages readable by club members" on messages;
create policy "messages readable by club members" on messages
  for select using (
    club_id is not null and exists (
      select 1 from club_members m
      where m.club_id = messages.club_id and m.user_id = firebase_uid()
        and not m.banned
    )
  );

drop policy if exists "messages insert by club member" on messages;
create policy "messages insert by club member" on messages
  for insert with check (
    sender_id = firebase_uid()
    and club_id is not null
    and exists (
      select 1 from club_members m
      where m.club_id = messages.club_id and m.user_id = firebase_uid()
        and not m.banned
        -- admin-controlled clubs: only admins may post
        and (
          m.role = 'admin'
          or not exists (
            select 1 from clubs c
            where c.id = messages.club_id and c.is_admin_controlled
          )
        )
    )
  );

-- 2. Only the author edits or deletes a message ---------------------------
-- Previously any conversation participant or club member could delete any
-- message in the thread; the UI was the only thing hiding the option.

drop policy if exists "messages update by author" on messages;
create policy "messages update by author" on messages
  for update using (sender_id = firebase_uid())
  with check (sender_id = firebase_uid());

drop policy if exists "messages delete by author" on messages;
create policy "messages delete by author" on messages
  for delete using (sender_id = firebase_uid());

-- 3. Only the recipient accepts a follow request --------------------------
-- Was `firebase_uid() in (from_uid, to_uid)`, so the sender could accept
-- their own request and appear in the target's friend list uninvited.

drop policy if exists "follow_requests update by parties" on follow_requests;
drop policy if exists "follow_requests update by recipient" on follow_requests;
create policy "follow_requests update by recipient" on follow_requests
  for update using (to_uid = firebase_uid())
  with check (to_uid = firebase_uid());

-- 4. Club membership cannot self-promote or self-unban --------------------
-- `with check (user_id = firebase_uid())` left role and banned unconstrained,
-- so anyone could insert themselves into any club as an admin, or clear their
-- own ban by deleting and re-inserting their row.

drop policy if exists "club_members self insert" on club_members;
create policy "club_members self insert" on club_members
  for insert with check (
    user_id = firebase_uid()
    and role = 'member'
    and banned = false
    and not exists (
      select 1 from club_members prior
      where prior.club_id = club_members.club_id
        and prior.user_id = firebase_uid()
        and prior.banned
    )
  );

-- 5. Account deletion actually removes the row ----------------------------
-- `users` had SELECT/INSERT/UPDATE and no DELETE policy, so the app's
-- "delete account" silently affected zero rows while reporting success.
-- Cascades let the delete through instead of tripping foreign keys.

drop policy if exists "users delete own row" on users;
create policy "users delete own row" on users
  for delete using (id = firebase_uid());

alter table impressions              drop constraint if exists impressions_uid_fkey;
alter table impressions              add constraint impressions_uid_fkey
  foreign key (uid) references users(id) on delete cascade;

alter table message_reactions        drop constraint if exists message_reactions_uid_fkey;
alter table message_reactions        add constraint message_reactions_uid_fkey
  foreign key (uid) references users(id) on delete cascade;

alter table message_poll_votes       drop constraint if exists message_poll_votes_uid_fkey;
alter table message_poll_votes       add constraint message_poll_votes_uid_fkey
  foreign key (uid) references users(id) on delete cascade;

alter table message_event_attendance drop constraint if exists message_event_attendance_uid_fkey;
alter table message_event_attendance add constraint message_event_attendance_uid_fkey
  foreign key (uid) references users(id) on delete cascade;

-- 6. Events cannot be forged in someone else's name -----------------------
-- FOR ALL/USING was satisfied by setting invitee_id to yourself, letting you
-- create an event that shows up in the victim's calendar as theirs, with
-- attacker-chosen contact details.

drop policy if exists "events for parties" on events;

drop policy if exists "events readable by parties" on events;
create policy "events readable by parties" on events
  for select using (firebase_uid() in (creator_id, invitee_id));

drop policy if exists "events insert by creator" on events;
create policy "events insert by creator" on events
  for insert with check (creator_id = firebase_uid());

drop policy if exists "events respond by invitee" on events;
create policy "events respond by invitee" on events
  for update using (invitee_id = firebase_uid())
  with check (invitee_id = firebase_uid());

-- Either party may remove the event from their own life, and account
-- deletion (purgeAllData) deletes by creator_id AND invitee_id — restricting
-- this to the creator would silently orphan rows for invitees.
drop policy if exists "events delete by parties" on events;
create policy "events delete by parties" on events
  for delete using (firebase_uid() in (creator_id, invitee_id));

-- 7. Chat media cannot be overwritten or deleted by other users -----------
-- Update/delete were gated only on "is signed in", so any signed-in user
-- could replace or wipe every attachment in the bucket.
--
-- Scoping by uploader is not available here: object keys are
-- `{conversation_id}/{uuid}.ext` or `club_{club_id}/{uuid}.ext` (see
-- app/src/services/media.ts), so the path carries no uid, and
-- storage.objects.owner_id is populated from auth.uid(), which is null under
-- Firebase third-party auth. Scoping on it would block every delete,
-- including legitimate ones.
--
-- Instead, reuse the same authorisation the messages themselves use: you may
-- touch media only in a thread you belong to. That contains the blast radius
-- to your own conversations and clubs.

drop policy if exists "message media authenticated update" on storage.objects;
drop policy if exists "message media authenticated delete" on storage.objects;

drop policy if exists "message media update within own threads" on storage.objects;
create policy "message media update within own threads" on storage.objects
  for update using (
    bucket_id = 'message-media'
    and (
      exists (
        select 1 from conversations c
        where c.id = (storage.foldername(name))[1]
          and firebase_uid() in (c.user_a, c.user_b)
      )
      or exists (
        select 1 from club_members m
        where 'club_' || m.club_id::text = (storage.foldername(name))[1]
          and m.user_id = firebase_uid() and not m.banned
      )
    )
  );

drop policy if exists "message media delete within own threads" on storage.objects;
create policy "message media delete within own threads" on storage.objects
  for delete using (
    bucket_id = 'message-media'
    and (
      exists (
        select 1 from conversations c
        where c.id = (storage.foldername(name))[1]
          and firebase_uid() in (c.user_a, c.user_b)
      )
      or exists (
        select 1 from club_members m
        where 'club_' || m.club_id::text = (storage.foldername(name))[1]
          and m.user_id = firebase_uid() and not m.banned
      )
    )
  );
