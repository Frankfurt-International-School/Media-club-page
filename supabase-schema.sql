create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'Member',
  email text not null unique,
  grade_level text,
  status text not null default 'active',
  joined_date date not null default current_date
);

alter table public.members add column if not exists grade_level text;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date timestamptz not null,
  location text,
  category text not null default 'Event' check (category in ('Livestream', 'Recording (live cut)', 'Event', 'Other')),
  livestream_setup_date date,
  is_sports boolean not null default false,
  game_1_start time,
  game_1_end time,
  game_2_start time,
  game_2_end time,
  ends_at timestamptz
);

alter table public.events add column if not exists category text not null default 'Event';
alter table public.events add column if not exists livestream_setup_date date;
alter table public.events add column if not exists is_sports boolean not null default false;
alter table public.events add column if not exists game_1_start time;
alter table public.events add column if not exists game_1_end time;
alter table public.events add column if not exists game_2_start time;
alter table public.events add column if not exists game_2_end time;
alter table public.events add column if not exists ends_at timestamptz;

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  signup_role text,
  attendance_type text not null default 'whole' check (attendance_type in ('whole', 'game_1', 'game_2', 'custom')),
  attendance_start timestamptz,
  attendance_end timestamptz,
  signed_up_at timestamptz not null default now(),
  unique (event_id, member_id)
);

alter table public.signups add column if not exists signup_role text;
alter table public.signups add column if not exists attendance_type text not null default 'whole';
alter table public.signups add column if not exists attendance_start timestamptz;
alter table public.signups add column if not exists attendance_end timestamptz;
drop index if exists public.signups_event_signup_role_idx;
alter table public.signups drop constraint if exists signups_role_attendance_no_overlap;
alter table public.signups add constraint signups_role_attendance_no_overlap
exclude using gist (
  event_id with =,
  signup_role with =,
  tstzrange(attendance_start, attendance_end, '[)') with &&
)
where (signup_role is not null and attendance_start is not null and attendance_end is not null);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  status text not null default 'available',
  assigned_to uuid references public.members(id) on delete set null,
  notes text
);

alter table public.equipment add column if not exists category text not null default 'Other';

create table if not exists public.equipment_reservations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  reservation_type text not null check (reservation_type in ('event', 'non_event')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.equipment_reservations drop constraint if exists equipment_reservations_no_overlap;
alter table public.equipment_reservations add constraint equipment_reservations_no_overlap
exclude using gist (
  equipment_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  project_type text not null default 'Photo' check (project_type in ('Photo', 'Video', 'Podcast', 'Design')),
  member_id uuid references public.members(id) on delete set null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.gallery add column if not exists project_type text not null default 'Photo';
alter table public.gallery add column if not exists member_id uuid references public.members(id) on delete set null;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.join_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  year_group text,
  experience_level text,
  interests text[] not null default '{}',
  why text not null,
  work_link text,
  status text not null default 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.join_applications add column if not exists rejection_reason text;
alter table public.join_applications add column if not exists reviewed_at timestamptz;
alter table public.join_applications add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists events_date_idx on public.events (date);
create index if not exists signups_event_id_idx on public.signups (event_id);
create index if not exists signups_member_id_idx on public.signups (member_id);
create index if not exists equipment_assigned_to_idx on public.equipment (assigned_to);
create index if not exists equipment_reservations_member_id_idx on public.equipment_reservations (member_id);
create index if not exists equipment_reservations_event_id_idx on public.equipment_reservations (event_id);
create index if not exists gallery_created_at_idx on public.gallery (created_at desc);
create index if not exists gallery_member_id_idx on public.gallery (member_id);
create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists join_applications_created_at_idx on public.join_applications (created_at desc);
create index if not exists join_applications_status_idx on public.join_applications (status);
create unique index if not exists join_applications_one_pending_email_idx
on public.join_applications (lower(btrim(email)))
where status = 'pending';
