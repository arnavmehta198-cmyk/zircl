-- Supabase Storage buckets replacing Firebase Storage. Both are public
-- (matches the app's actual exposure today: profile photos are public reads,
-- and message media was "any authenticated user can read" in storage.rules —
-- there's no meaningfully different privacy boundary once a URL exists either
-- way, so public buckets keep this simple).
insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('message-media', 'message-media', true)
  on conflict (id) do nothing;

create policy "profile photos owner write" on storage.objects
  for insert with check (bucket_id = 'profile-photos' and name = firebase_uid() || '.jpg');
create policy "profile photos owner update" on storage.objects
  for update using (bucket_id = 'profile-photos' and name = firebase_uid() || '.jpg');
create policy "profile photos owner delete" on storage.objects
  for delete using (bucket_id = 'profile-photos' and name = firebase_uid() || '.jpg');

create policy "message media authenticated write" on storage.objects
  for insert with check (bucket_id = 'message-media' and auth.role() = 'authenticated');
create policy "message media authenticated update" on storage.objects
  for update using (bucket_id = 'message-media' and auth.role() = 'authenticated');
create policy "message media authenticated delete" on storage.objects
  for delete using (bucket_id = 'message-media' and auth.role() = 'authenticated');
