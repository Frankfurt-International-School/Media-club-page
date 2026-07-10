create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'Member',
  email text not null unique,
  status text not null default 'active',
  joined_date date not null default current_date
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date timestamptz not null,
  location text
);

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  signup_role text,
  signed_up_at timestamptz not null default now(),
  unique (event_id, member_id)
);

alter table public.signups add column if not exists signup_role text;
create unique index if not exists signups_event_signup_role_idx
on public.signups (event_id, signup_role)
where signup_role is not null;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'available',
  assigned_to uuid references public.members(id) on delete set null,
  notes text
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

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
create index if not exists gallery_created_at_idx on public.gallery (created_at desc);
create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists join_applications_created_at_idx on public.join_applications (created_at desc);
create index if not exists join_applications_status_idx on public.join_applications (status);
