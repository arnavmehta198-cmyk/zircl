-- Zircl: Firestore -> Supabase schema + RLS.
-- Run in Supabase SQL editor. Requires Firebase configured as a Third-Party
-- Auth issuer (Authentication > Third Party Auth > Firebase) so
-- auth.jwt()->>'sub' resolves to the Firebase uid.

create extension if not exists "pgcrypto";

create or replace function firebase_uid() returns text
  language sql stable as $$ select auth.jwt()->>'sub' $$;

-- users -----------------------------------------------------------------
create table users (
  id text primary key,
  name text not null,
  date_of_birth date,
  bio text,
  photo_url text,
  hobbies text[] not null default '{}',
  latitude double precision,
  longitude double precision,
  notifications_enabled boolean not null default true,
  onboarding_complete boolean not null default false,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  billing_provider text,
  billing_subscription_id text,
  created_at timestamptz not null default now()
);
alter table users enable row level security;
create policy "users readable by any signed-in user" on users
  for select using (auth.role() = 'authenticated');
create policy "users write own row" on users
  for insert with check (id = firebase_uid());
create policy "users update own row" on users
  for update using (id = firebase_uid());

-- conversations -----------------------------------------------------------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a text not null references users(id),
  user_b text not null references users(id),
  last_message text,
  last_sender_id text references users(id),
  last_message_at timestamptz,
  user_a_last_read_at timestamptz,
  user_b_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);
alter table conversations enable row level security;
create policy "conversations for participants" on conversations
  for all using (firebase_uid() in (user_a, user_b));

-- clubs / club_members ----------------------------------------------------
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hobby text not null,
  creator_id text not null references users(id),
  created_at timestamptz not null default now()
);
alter table clubs enable row level security;

create table club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id text not null references users(id),
  role text not null default 'member' check (role in ('member', 'admin')),
  banned boolean not null default false,
  primary key (club_id, user_id)
);
alter table club_members enable row level security;

create policy "clubs readable by members" on clubs
  for select using (
    exists (select 1 from club_members m where m.club_id = id and m.user_id = firebase_uid())
  );
create policy "clubs insert by creator" on clubs
  for insert with check (creator_id = firebase_uid());
create policy "clubs update by admin" on clubs
  for update using (
    exists (select 1 from club_members m where m.club_id = id and m.user_id = firebase_uid() and m.role = 'admin')
  );

create policy "club_members readable by members" on club_members
  for select using (
    exists (select 1 from club_members m where m.club_id = club_members.club_id and m.user_id = firebase_uid())
  );
create policy "club_members self insert" on club_members
  for insert with check (user_id = firebase_uid());
create policy "club_members admin manage" on club_members
  for update using (
    exists (select 1 from club_members m where m.club_id = club_members.club_id and m.user_id = firebase_uid() and m.role = 'admin')
  );
create policy "club_members admin delete" on club_members
  for delete using (
    user_id = firebase_uid()
    or exists (select 1 from club_members m where m.club_id = club_members.club_id and m.user_id = firebase_uid() and m.role = 'admin')
  );

-- messages ------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  club_id uuid references clubs(id) on delete cascade,
  sender_id text not null references users(id),
  kind text not null,
  text text,
  photo_url text,
  gif_url text,
  sticker text,
  video_url text,
  file_name text,
  file_size bigint,
  file_url text,
  audio_url text,
  audio_duration_sec numeric,
  poll_options text[],
  event_title text,
  event_location text,
  event_date timestamptz,
  reply_to_message_id uuid references messages(id),
  reply_sender_id text,
  reply_sender_name text,
  reply_preview text,
  created_at timestamptz not null default now(),
  check ((conversation_id is not null) <> (club_id is not null))
);
alter table messages enable row level security;
create policy "messages for conversation participants" on messages
  for all using (
    conversation_id is not null and exists (
      select 1 from conversations c where c.id = conversation_id and firebase_uid() in (c.user_a, c.user_b)
    )
  );
create policy "messages for club members" on messages
  for all using (
    club_id is not null and exists (
      select 1 from club_members m where m.club_id = messages.club_id and m.user_id = firebase_uid()
    )
  );

create table message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  uid text not null references users(id),
  emoji text not null,
  primary key (message_id, uid, emoji)
);
alter table message_reactions enable row level security;
create policy "reactions self" on message_reactions for all using (uid = firebase_uid());
create policy "reactions readable" on message_reactions for select using (auth.role() = 'authenticated');

create table message_poll_votes (
  message_id uuid not null references messages(id) on delete cascade,
  uid text not null references users(id),
  option text not null,
  primary key (message_id, uid)
);
alter table message_poll_votes enable row level security;
create policy "poll votes self" on message_poll_votes for all using (uid = firebase_uid());
create policy "poll votes readable" on message_poll_votes for select using (auth.role() = 'authenticated');

create table message_event_attendance (
  message_id uuid not null references messages(id) on delete cascade,
  uid text not null references users(id),
  status text not null,
  primary key (message_id, uid)
);
alter table message_event_attendance enable row level security;
create policy "attendance self" on message_event_attendance for all using (uid = firebase_uid());
create policy "attendance readable" on message_event_attendance for select using (auth.role() = 'authenticated');

-- follow_requests / blocks / reports -----------------------------------------
create table follow_requests (
  id uuid primary key default gen_random_uuid(),
  from_uid text not null references users(id),
  to_uid text not null references users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (from_uid, to_uid)
);
alter table follow_requests enable row level security;
create policy "follow_requests for parties" on follow_requests
  for all using (firebase_uid() in (from_uid, to_uid));

create table blocks (
  blocker_id text not null references users(id),
  blocked_id text not null references users(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "blocks owner" on blocks for all using (blocker_id = firebase_uid());

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null references users(id),
  reported_id text not null references users(id),
  reason text not null,
  context text,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table reports enable row level security;
create policy "reports owner insert" on reports for insert with check (reporter_id = firebase_uid());
create policy "reports owner read" on reports for select using (reporter_id = firebase_uid());

-- events ----------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references users(id),
  creator_first_name text,
  creator_last_name text,
  creator_email text,
  creator_phone text,
  invitee_id text not null references users(id),
  invitee_name text,
  hobby text,
  location_name text,
  date timestamptz,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
alter table events enable row level security;
create policy "events for parties" on events
  for all using (firebase_uid() in (creator_id, invitee_id));

-- usage / impressions -----------------------------------------------------
create table usage (
  uid text not null references users(id),
  metric text not null,
  period text not null,
  count int not null default 0,
  primary key (uid, metric, period)
);
alter table usage enable row level security;
create policy "usage owner" on usage for all using (uid = firebase_uid());

create table impressions (
  id uuid primary key default gen_random_uuid(),
  uid text not null references users(id),
  profile_id text,
  gender text,
  age int,
  dwell numeric,
  liked boolean,
  created_at timestamptz not null default now()
);
alter table impressions enable row level security;
create policy "impressions owner" on impressions for all using (uid = firebase_uid());

-- realtime ------------------------------------------------------------------
alter publication supabase_realtime add table users, conversations, messages, clubs, club_members;
