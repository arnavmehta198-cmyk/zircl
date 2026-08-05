-- conversationID(a,b) builds a deterministic string id ("uid1_uid2"), not a
-- uuid — every conversation/message write was failing with
-- "invalid input syntax for type uuid" (silently, since sendDirect doesn't
-- check .error). Conversations are keyed by this deterministic id on purpose
-- (mirrors the old Firestore sortedPairId scheme), so the column needs to be
-- text, not uuid.
drop policy if exists "messages for conversation participants" on messages;
alter table messages drop constraint if exists messages_conversation_id_fkey;
alter table conversations alter column id drop default;
alter table conversations alter column id type text using id::text;
alter table messages alter column conversation_id type text using conversation_id::text;
alter table messages add constraint messages_conversation_id_fkey
  foreign key (conversation_id) references conversations(id) on delete cascade;
create policy "messages for conversation participants" on messages
  for all using (
    conversation_id is not null and exists (
      select 1 from conversations c where c.id = conversation_id and firebase_uid() in (c.user_a, c.user_b)
    )
  );
