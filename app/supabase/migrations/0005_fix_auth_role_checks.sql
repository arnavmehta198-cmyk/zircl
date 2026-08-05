-- Firebase-issued JWTs (Third-Party Auth) don't carry Supabase's own "role"
-- claim, so every policy written as `auth.role() = 'authenticated'` was
-- silently blocking everyone — confirmed live: a real Firebase-authenticated
-- select on `users` came back empty. Swap all of them for a check that
-- actually reflects a verified Firebase session: firebase_uid() is not null.

drop policy if exists "users readable by any signed-in user" on users;
create policy "users readable by any signed-in user" on users
  for select using (firebase_uid() is not null);

drop policy if exists "reactions readable" on message_reactions;
create policy "reactions readable" on message_reactions
  for select using (firebase_uid() is not null);

drop policy if exists "poll votes readable" on message_poll_votes;
create policy "poll votes readable" on message_poll_votes
  for select using (firebase_uid() is not null);

drop policy if exists "attendance readable" on message_event_attendance;
create policy "attendance readable" on message_event_attendance
  for select using (firebase_uid() is not null);

drop policy if exists "clubs readable by any signed-in user" on clubs;
create policy "clubs readable by any signed-in user" on clubs
  for select using (firebase_uid() is not null);

drop policy if exists "club_members readable by any signed-in user" on club_members;
create policy "club_members readable by any signed-in user" on club_members
  for select using (firebase_uid() is not null);

drop policy if exists "message media authenticated write" on storage.objects;
create policy "message media authenticated write" on storage.objects
  for insert with check (bucket_id = 'message-media' and firebase_uid() is not null);
drop policy if exists "message media authenticated update" on storage.objects;
create policy "message media authenticated update" on storage.objects
  for update using (bucket_id = 'message-media' and firebase_uid() is not null);
drop policy if exists "message media authenticated delete" on storage.objects;
create policy "message media authenticated delete" on storage.objects
  for delete using (bucket_id = 'message-media' and firebase_uid() is not null);
