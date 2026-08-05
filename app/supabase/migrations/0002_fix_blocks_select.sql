-- blockedEitherDirection() needs to see rows where the caller is either side.
drop policy if exists "blocks owner" on blocks;
create policy "blocks owner write" on blocks
  for insert with check (blocker_id = firebase_uid());
create policy "blocks owner delete" on blocks
  for delete using (blocker_id = firebase_uid());
create policy "blocks visible to either side" on blocks
  for select using (firebase_uid() in (blocker_id, blocked_id));

-- follow_requests: "for all using" also gates inserts, which let a caller
-- forge from_uid = someone else as long as to_uid = self. Split it so only
-- the sender can create the edge.
drop policy if exists "follow_requests for parties" on follow_requests;
create policy "follow_requests visible to parties" on follow_requests
  for select using (firebase_uid() in (from_uid, to_uid));
create policy "follow_requests insert by sender" on follow_requests
  for insert with check (from_uid = firebase_uid());
create policy "follow_requests update by parties" on follow_requests
  for update using (firebase_uid() in (from_uid, to_uid));
create policy "follow_requests delete by parties" on follow_requests
  for delete using (firebase_uid() in (from_uid, to_uid));
