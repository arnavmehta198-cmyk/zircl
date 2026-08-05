alter table clubs add column last_message text;
alter table clubs add column last_sender_id text references users(id);
alter table clubs add column is_admin_controlled boolean not null default false;

-- Clubs need to be browsable (discovery, recommendations) before joining —
-- membership-gated select was too strict, and matches the "any authenticated
-- reader" pattern the rest of the schema uses for browse surfaces.
drop policy if exists "clubs readable by members" on clubs;
create policy "clubs readable by any signed-in user" on clubs
  for select using (auth.role() = 'authenticated');

drop policy if exists "club_members readable by members" on club_members;
create policy "club_members readable by any signed-in user" on club_members
  for select using (auth.role() = 'authenticated');
