create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.is_fis_alias_email(candidate_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(coalesce(candidate_email, ''))) ~ '^[a-z]{2}[0-9]{4,}@fis[.]edu$';
$$;

create or replace function public.is_fis_school_email(candidate_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(coalesce(candidate_email, ''))) ~ '^[^[:space:]@]+@fis[.]edu$';
$$;

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
alter table public.members add column if not exists avatar_url text;
alter table public.members add column if not exists avatar_path text;
alter table public.members add column if not exists sidebar_customized boolean not null default false;
alter table public.members add column if not exists sidebar_items text[] not null default array['home','events','meetings','signup','members','gallery','equipment','role-guide','crew-deployment','equipment-status','join','about','admin']::text[];
alter table public.members alter column sidebar_items set default array['home','events','meetings','signup','members','gallery','equipment','role-guide','crew-deployment','equipment-status','join','about','admin']::text[];
alter table public.members add column if not exists notification_preferences jsonb not null default '{"event_created":true,"event_reminders":true,"maybe_reminders":true,"email_event_updates":false,"email_meeting_updates":false}'::jsonb;
alter table public.members alter column notification_preferences set default '{"event_created":true,"event_reminders":true,"maybe_reminders":true,"email_event_updates":false,"email_meeting_updates":false}'::jsonb;
alter table public.members add column if not exists dashboard_preferences jsonb not null default '{"stats":[],"sections":[]}'::jsonb;
alter table public.members add column if not exists tutorial_progress jsonb not null default '{"version":1,"completed":[],"dismissed_welcome":false,"active_tour":null,"active_step":0}'::jsonb;
alter table public.members add column if not exists personal_equipment_preferences jsonb not null default '{"camera_name":"","auto_use_camera":false}'::jsonb;
alter table public.members add column if not exists equipment_status_access boolean not null default true;

create table if not exists public.member_team_memberships (
  member_id uuid not null references public.members(id) on delete cascade,
  team_key text not null check (team_key in ('news_team', 'athletics', 'cas')),
  joined_at timestamptz not null default now(),
  primary key (member_id, team_key)
);

alter table public.member_team_memberships drop constraint if exists member_team_memberships_team_key_check;
alter table public.member_team_memberships add constraint member_team_memberships_team_key_check
check (team_key in ('news_team', 'athletics', 'cas'));

create index if not exists member_team_memberships_team_idx
on public.member_team_memberships (team_key, member_id);

insert into public.member_team_memberships (member_id, team_key)
select member.id, 'news_team'
from public.members member
where lower(coalesce(member.status, '')) ~ '(^|[[:space:]]*,[[:space:]])(student[[:space:]]+)?news[[:space:]]+team([[:space:]]*,|$)'
on conflict (member_id, team_key) do nothing;

insert into public.member_team_memberships (member_id, team_key)
select member.id, 'athletics'
from public.members member
where lower(coalesce(member.status, '')) ~ '(^|[[:space:]]*,[[:space:]])(athletics|athletics[[:space:]]+department)([[:space:]]*,|$)'
on conflict (member_id, team_key) do nothing;

insert into public.member_team_memberships (member_id, team_key)
select member.id, 'cas'
from public.members member
where lower(coalesce(member.status, '')) ~ '(^|[[:space:]]*,[[:space:]])cas([[:space:]]*,|$)'
on conflict (member_id, team_key) do nothing;

create table if not exists public.cas_attendance_settings (
  id smallint primary key default 1 check (id = 1),
  school_year_label text not null default '2026–2027' check (char_length(btrim(school_year_label)) between 1 and 30),
  school_year_start date not null default date '2026-09-30',
  school_year_end date not null default date '2027-05-31',
  fall_start date not null default date '2026-09-30',
  fall_end date not null default date '2026-11-15',
  winter_start date,
  winter_end date,
  spring_start date,
  spring_end date,
  updated_at timestamptz not null default now(),
  check (school_year_end >= school_year_start),
  check (fall_end >= fall_start and fall_start >= school_year_start and fall_end <= school_year_end),
  check ((winter_start is null and winter_end is null) or (winter_start is not null and winter_end is not null and winter_end >= winter_start and winter_start >= school_year_start and winter_end <= school_year_end)),
  check ((spring_start is null and spring_end is null) or (spring_start is not null and spring_end is not null and spring_end >= spring_start and spring_start >= school_year_start and spring_end <= school_year_end))
);

insert into public.cas_attendance_settings (id)
values (1)
on conflict (id) do nothing;

-- New member email rules are enforced by the Auth Admin insert policy. Keeping
-- this as a table CHECK would prevent approved legacy/test accounts from later
-- updating their profile preferences or avatar.
alter table public.members drop constraint if exists members_fis_alias_email_check;

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
  is_isst boolean not null default false,
  game_3_start time,
  game_3_end time,
  game_4_start time,
  game_4_end time,
  open_signup_roles text[] not null default array['Adult Supervisor', 'Student Supervisor', 'MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless', 'Photographer']::text[],
  single_role_slot_limit smallint not null default 1,
  photographer_slot_limit smallint not null default 1,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_event_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_event_updated_at() from public;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_event_updated_at();

alter table public.events add column if not exists category text not null default 'Event';
update public.events set category = 'Event' where category = 'World Fest';
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
check (category in ('Livestream', 'Recording (live cut)', 'Event', 'Other'));
alter table public.events add column if not exists livestream_setup_date date;
alter table public.events add column if not exists is_sports boolean not null default false;
alter table public.events add column if not exists game_1_start time;
alter table public.events add column if not exists game_1_end time;
alter table public.events add column if not exists game_2_start time;
alter table public.events add column if not exists game_2_end time;
alter table public.events add column if not exists is_isst boolean not null default false;
alter table public.events add column if not exists game_3_start time;
alter table public.events add column if not exists game_3_end time;
alter table public.events add column if not exists game_4_start time;
alter table public.events add column if not exists game_4_end time;
alter table public.events add column if not exists open_signup_roles text[] not null default array['Adult Supervisor', 'Student Supervisor', 'MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless', 'Photographer']::text[];
alter table public.events add column if not exists single_role_slot_limit smallint not null default 1;
alter table public.events add column if not exists photographer_slot_limit smallint not null default 1;
update public.events
set photographer_slot_limit = single_role_slot_limit,
    single_role_slot_limit = 1
where category in ('Event', 'Recording (live cut)')
  and cardinality(open_signup_roles) = 1
  and 'Photographer' = any(open_signup_roles)
  and photographer_slot_limit = 1
  and single_role_slot_limit > 1;
alter table public.events drop constraint if exists events_open_signup_roles_check;
alter table public.events add constraint events_open_signup_roles_check check (
  cardinality(open_signup_roles) between 1 and 10
  and open_signup_roles <@ array['Adult Supervisor', 'Student Supervisor', 'MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless', 'Photographer']::text[]
);
alter table public.events drop constraint if exists events_single_role_slot_limit_check;
alter table public.events add constraint events_single_role_slot_limit_check check (single_role_slot_limit between 1 and 20);
alter table public.events drop constraint if exists events_photographer_slot_limit_check;
alter table public.events add constraint events_photographer_slot_limit_check check (photographer_slot_limit between 1 and 20);
alter table public.events add column if not exists ends_at timestamptz;
alter table public.events add column if not exists is_festival boolean not null default false;
alter table public.events add column if not exists setup_start time;
alter table public.events add column if not exists setup_end time;
alter table public.events add column if not exists shift_1_start time;
alter table public.events add column if not exists shift_1_end time;
alter table public.events add column if not exists shift_2_start time;
alter table public.events add column if not exists shift_2_end time;
alter table public.events add column if not exists takedown_start time;
alter table public.events add column if not exists takedown_end time;
alter table public.events add column if not exists archived_at timestamptz;
alter table public.events add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.events add column if not exists archived_by_name text;
update public.events event
set ends_at = (
  (event.date at time zone 'Europe/Berlin')::date
  + coalesce(
      case
        when event.is_festival then event.takedown_end
        when event.is_isst then coalesce(event.game_4_end, event.game_3_end)
        when event.is_sports then event.game_2_end
        else null
      end,
      time '23:59'
    )
) at time zone 'Europe/Berlin'
where event.ends_at is null;
update public.events
set ends_at = date + interval '1 hour'
where ends_at <= date;
alter table public.events alter column ends_at set not null;
alter table public.events drop constraint if exists events_end_window_check;
alter table public.events add constraint events_end_window_check check (ends_at > date);
update public.events set category = 'Event' where is_festival;
alter table public.events drop constraint if exists events_isst_schedule_check;
alter table public.events add constraint events_isst_schedule_check check (
  not is_isst
  or (
    category = 'Livestream'
    and not is_sports
    and not is_festival
    and game_1_start is not null and game_1_end is not null
    and game_2_start is not null and game_2_end is not null
    and game_3_start is not null and game_3_end is not null
    and game_1_start < game_1_end
    and game_1_end <= game_2_start and game_2_start < game_2_end
    and game_2_end <= game_3_start and game_3_start < game_3_end
    and (
      (game_4_start is null and game_4_end is null)
      or (game_4_start is not null and game_4_end is not null and game_3_end <= game_4_start and game_4_start < game_4_end)
    )
  )
);
alter table public.events drop constraint if exists events_festival_schedule_check;
alter table public.events add constraint events_festival_schedule_check check (
  not is_festival
  or (
    category = 'Event'
    and not is_sports
    and not is_isst
    and setup_start is not null and setup_end is not null
    and shift_1_start is not null and shift_1_end is not null
    and shift_2_start is not null and shift_2_end is not null
    and takedown_start is not null and takedown_end is not null
    and setup_start < setup_end
    and setup_end <= shift_1_start and shift_1_start < shift_1_end
    and shift_1_end <= shift_2_start and shift_2_start < shift_2_end
    and shift_2_end <= takedown_start and takedown_start < takedown_end
  )
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  agenda text not null default '',
  notes text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  meeting_link text,
  audience text not null default 'general' check (audience in ('general', 'news_team', 'leadership')),
  related_event_id uuid references public.events(id) on delete set null,
  organizer_member_id uuid references public.members(id) on delete set null,
  organizer_name text not null default 'Media Club',
  faculty_authorization_confirmed boolean not null default false,
  faculty_authorization_confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_by_name text,
  check (ends_at > starts_at),
  check (meeting_link is null or meeting_link ~ '^https://[^[:space:]<>"'']+$')
);

alter table public.meetings add column if not exists faculty_authorization_confirmed boolean not null default false;
alter table public.meetings add column if not exists faculty_authorization_confirmed_at timestamptz;

create index if not exists meetings_starts_at_idx on public.meetings (starts_at);
create index if not exists meetings_audience_starts_idx on public.meetings (audience, starts_at);

create table if not exists public.schedule_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('event', 'meeting')),
  resource_id uuid not null,
  action text not null check (action in ('created', 'updated')),
  resource_version timestamptz not null,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (resource_type, resource_id, action, resource_version)
);

alter table public.schedule_email_dispatches add column if not exists last_attempt_at timestamptz not null default now();

create table if not exists public.schedule_email_resource_states (
  resource_type text not null check (resource_type in ('event', 'meeting')),
  resource_id uuid not null,
  resource_version timestamptz not null,
  resource_snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (resource_type, resource_id)
);

insert into public.schedule_email_resource_states (resource_type, resource_id, resource_version, resource_snapshot)
select 'event', event.id, event.updated_at, jsonb_build_object(
  'title', event.title,
  'start', event.date,
  'end', event.ends_at,
  'location', coalesce(event.location, ''),
  'detail', coalesce(event.description, ''),
  'audience', ''
)
from public.events event
on conflict (resource_type, resource_id) do nothing;

insert into public.schedule_email_resource_states (resource_type, resource_id, resource_version, resource_snapshot)
select 'meeting', meeting.id, meeting.updated_at, jsonb_build_object(
  'title', meeting.title,
  'start', meeting.starts_at,
  'end', meeting.ends_at,
  'location', coalesce(meeting.location, ''),
  'detail', coalesce(meeting.agenda, ''),
  'audience', meeting.audience
)
from public.meetings meeting
on conflict (resource_type, resource_id) do nothing;

create table if not exists public.schedule_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.schedule_email_dispatches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dispatch_id, member_id)
);

create index if not exists schedule_email_deliveries_dispatch_status_idx
on public.schedule_email_deliveries (dispatch_id, status);

alter table public.schedule_email_dispatches enable row level security;
alter table public.schedule_email_deliveries enable row level security;
alter table public.schedule_email_resource_states enable row level security;
revoke all on table public.schedule_email_dispatches from anon, authenticated;
revoke all on table public.schedule_email_deliveries from anon, authenticated;
revoke all on table public.schedule_email_resource_states from anon, authenticated;

create table if not exists public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  response text not null check (response in ('attending', 'maybe', 'declined')),
  responded_at timestamptz not null default now(),
  unique (meeting_id, member_id)
);

create index if not exists meeting_attendees_meeting_response_idx
on public.meeting_attendees (meeting_id, response);

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  signup_role text,
  role_slot smallint not null default 1,
  reserve_role_1 text,
  reserve_role_2 text,
  equipment_source text not null default 'club',
  own_camera_name text,
  attendance_type text not null default 'whole' check (attendance_type in ('whole', 'game_1', 'game_2', 'game_3', 'game_4', 'custom')),
  attendance_start timestamptz,
  attendance_end timestamptz,
  attendance_status text not null default 'not_taken',
  attendance_marked_at timestamptz,
  attendance_marked_by uuid references auth.users(id) on delete set null,
  attendance_marked_by_name text,
  signed_up_at timestamptz not null default now(),
  unique (event_id, member_id)
);

alter table public.signups add column if not exists signup_role text;
alter table public.signups add column if not exists role_slot smallint not null default 1;
alter table public.signups drop constraint if exists signups_role_slot_check;
alter table public.signups add constraint signups_role_slot_check check (role_slot between 1 and 20);
alter table public.signups add column if not exists reserve_role_1 text;
alter table public.signups add column if not exists reserve_role_2 text;
alter table public.signups add column if not exists equipment_source text not null default 'club';
alter table public.signups add column if not exists own_camera_name text;
alter table public.signups add column if not exists attendance_type text not null default 'whole';
alter table public.signups add column if not exists attendance_start timestamptz;
alter table public.signups add column if not exists attendance_end timestamptz;
alter table public.signups add column if not exists attendance_status text not null default 'not_taken';
alter table public.signups add column if not exists attendance_marked_at timestamptz;
alter table public.signups add column if not exists attendance_marked_by uuid references auth.users(id) on delete set null;
alter table public.signups add column if not exists attendance_marked_by_name text;
alter table public.signups add column if not exists confirmation_status text not null default 'confirmed';
alter table public.signups add column if not exists confirmation_deadline timestamptz;
alter table public.signups add column if not exists confirmed_at timestamptz;
alter table public.signups drop constraint if exists signups_confirmation_status_check;
alter table public.signups add constraint signups_confirmation_status_check check (confirmation_status in ('confirmed', 'maybe', 'expired'));
update public.signups set confirmed_at = coalesce(confirmed_at, signed_up_at) where confirmation_status = 'confirmed';
alter table public.signups drop constraint if exists signups_attendance_status_check;
alter table public.signups add constraint signups_attendance_status_check
check (attendance_status in ('not_taken', 'present', 'late', 'absent', 'excused'));
alter table public.signups drop constraint if exists signups_attendance_type_check;
alter table public.signups add constraint signups_attendance_type_check
check (attendance_type in ('whole', 'game_1', 'game_2', 'game_3', 'game_4', 'setup', 'shift_1', 'shift_2', 'takedown', 'custom'));
alter table public.signups drop constraint if exists signups_student_supervisor_reserves_check;
alter table public.signups add constraint signups_student_supervisor_reserves_check check (
  (
    signup_role = 'Student Supervisor'
    and reserve_role_1 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
    and reserve_role_2 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
    and reserve_role_1 <> reserve_role_2
  )
  or (reserve_role_1 is null and reserve_role_2 is null)
) not valid;
do $$
begin
  if not exists (
    select 1
    from public.signups
    where signup_role = 'Student Supervisor'
      and (reserve_role_1 = 'Photographer' or reserve_role_2 = 'Photographer')
  ) then
    alter table public.signups validate constraint signups_student_supervisor_reserves_check;
  end if;
end $$;
alter table public.signups drop constraint if exists signups_photographer_equipment_check;
alter table public.signups add constraint signups_photographer_equipment_check check (
  (
    equipment_source = 'own'
    and signup_role = 'Photographer'
    and own_camera_name is not null
    and own_camera_name = btrim(own_camera_name)
    and char_length(own_camera_name) between 1 and 80
    and own_camera_name !~ '[[:cntrl:]]'
  )
  or (equipment_source = 'club' and own_camera_name is null)
);
drop index if exists public.signups_event_signup_role_idx;
alter table public.signups drop constraint if exists signups_role_attendance_no_overlap;
alter table public.signups add constraint signups_role_attendance_no_overlap
exclude using gist (
  event_id with =,
  signup_role with =,
  role_slot with =,
  tstzrange(attendance_start, attendance_end, '[)') with &&
)
where (confirmation_status <> 'expired' and signup_role is not null and signup_role <> 'Student Supervisor' and attendance_start is not null and attendance_end is not null);

alter table public.signups drop constraint if exists signups_student_supervisor_attendance_no_overlap;
alter table public.signups add constraint signups_student_supervisor_attendance_no_overlap
exclude using gist (
  event_id with =,
  signup_role with =,
  role_slot with =,
  tstzrange(attendance_start, attendance_end, '[)') with &&
)
where (confirmation_status <> 'expired' and signup_role = 'Student Supervisor' and attendance_start is not null and attendance_end is not null);

create or replace function public.assign_signup_role_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  slot_limit integer := 1;
  candidate_slot integer;
begin
  if new.signup_role is null then
    new.role_slot := 1;
    return new;
  end if;

  select * into target_event
  from public.events event
  where event.id = new.event_id
  for update;

  if not found then
    raise exception 'Event not found.';
  end if;

  if not new.signup_role = any(target_event.open_signup_roles) then
    raise exception 'This role is not open for the selected event.';
  end if;
  if new.signup_role = 'Photographer' then
    slot_limit := target_event.photographer_slot_limit;
  elsif cardinality(target_event.open_signup_roles) = 1 then
    slot_limit := target_event.single_role_slot_limit;
  end if;

  for candidate_slot in 1..slot_limit loop
    if not exists (
      select 1
      from public.signups signup
      where signup.event_id = new.event_id
        and signup.signup_role = new.signup_role
        and signup.role_slot = candidate_slot
        and signup.confirmation_status <> 'expired'
        and signup.attendance_start is not null
        and signup.attendance_end is not null
        and tstzrange(signup.attendance_start, signup.attendance_end, '[)')
          && tstzrange(new.attendance_start, new.attendance_end, '[)')
    ) then
      new.role_slot := candidate_slot;
      return new;
    end if;
  end loop;

  raise exception 'No signup slots are available for this role during the selected time.';
end;
$$;

revoke all on function public.assign_signup_role_slot() from public;
drop trigger if exists signups_assign_role_slot_before_insert on public.signups;
create trigger signups_assign_role_slot_before_insert
before insert on public.signups
for each row execute function public.assign_signup_role_slot();

alter table public.signups drop constraint if exists signups_member_cross_event_no_overlap;
alter table public.signups add constraint signups_member_cross_event_no_overlap
exclude using gist (
  member_id with =,
  tstzrange(attendance_start, attendance_end, '[)') with &&
)
where (confirmation_status <> 'expired' and signup_role is distinct from 'Adult Supervisor' and attendance_start is not null and attendance_end is not null);

alter table public.signups drop constraint if exists signups_event_id_member_id_key;
create unique index if not exists signups_active_event_member_idx on public.signups (event_id, member_id) where confirmation_status <> 'expired';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  notification_type text not null check (notification_type in ('event_created', 'meeting_invite')),
  title text not null,
  message text not null,
  page text not null default 'events',
  related_event_id uuid references public.events(id) on delete cascade,
  related_meeting_id uuid references public.meetings(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, notification_type, related_event_id)
);

alter table public.notifications add column if not exists related_meeting_id uuid references public.meetings(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
check (notification_type in ('event_created', 'meeting_invite'));

create index if not exists notifications_member_created_idx on public.notifications (member_id, created_at desc);
create unique index if not exists notifications_member_meeting_invite_idx
on public.notifications (member_id, notification_type, related_meeting_id)
where notification_type = 'meeting_invite' and related_meeting_id is not null;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.notify_members_of_new_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (member_id, notification_type, title, message, page, related_event_id)
  select member.id, 'event_created', 'New event available', new.title || ' is open for signups.', 'signup', new.id
  from public.members member
  where lower(coalesce(member.status, 'active')) <> 'inactive'
    and coalesce((member.notification_preferences ->> 'event_created')::boolean, true)
  on conflict (member_id, notification_type, related_event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists events_notify_members_after_insert on public.events;
create trigger events_notify_members_after_insert after insert on public.events for each row execute function public.notify_members_of_new_event();

create or replace function public.sync_news_team_meeting_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications notification
  where notification.notification_type = 'meeting_invite'
    and notification.related_meeting_id = new.id;

  if new.audience <> 'news_team' or new.archived_at is not null or new.ends_at <= now() then
    return new;
  end if;

  insert into public.notifications (
    member_id, notification_type, title, message, page, related_meeting_id
  )
  select
    membership.member_id,
    'meeting_invite',
    'News Team meeting invitation',
    new.title || ' is scheduled for '
      || to_char(new.starts_at at time zone 'Europe/Berlin', 'FMDD Mon YYYY, HH24:MI')
      || ' Berlin time'
      || case when nullif(btrim(new.location), '') is null then '' else ' at ' || btrim(new.location) end
      || '. Open Meetings to RSVP.',
    'meetings',
    new.id
  from public.member_team_memberships membership
  where membership.team_key = 'news_team'
  on conflict (member_id, notification_type, related_meeting_id)
    where notification_type = 'meeting_invite' and related_meeting_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.sync_news_team_meeting_notifications() from public;

drop trigger if exists meetings_sync_news_team_notifications on public.meetings;
create trigger meetings_sync_news_team_notifications
after insert or update of audience, title, starts_at, ends_at, location, archived_at
on public.meetings
for each row execute function public.sync_news_team_meeting_notifications();

create or replace function public.sync_news_team_membership_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.team_key = 'news_team' then
      delete from public.notifications notification
      where notification.member_id = old.member_id
        and notification.notification_type = 'meeting_invite';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.team_key = 'news_team'
    and (old.member_id <> new.member_id or old.team_key <> new.team_key) then
    delete from public.notifications notification
    where notification.member_id = old.member_id
      and notification.notification_type = 'meeting_invite';
  end if;

  if new.team_key <> 'news_team' then return new; end if;
  target_member_id := new.member_id;

  insert into public.notifications (
    member_id, notification_type, title, message, page, related_meeting_id
  )
  select
    target_member_id,
    'meeting_invite',
    'News Team meeting invitation',
    meeting.title || ' is scheduled for '
      || to_char(meeting.starts_at at time zone 'Europe/Berlin', 'FMDD Mon YYYY, HH24:MI')
      || ' Berlin time'
      || case when nullif(btrim(meeting.location), '') is null then '' else ' at ' || btrim(meeting.location) end
      || '. Open Meetings to RSVP.',
    'meetings',
    meeting.id
  from public.meetings meeting
  where meeting.audience = 'news_team'
    and meeting.archived_at is null
    and meeting.ends_at > now()
  on conflict (member_id, notification_type, related_meeting_id)
    where notification_type = 'meeting_invite' and related_meeting_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.sync_news_team_membership_notifications() from public;

drop trigger if exists news_team_memberships_sync_notifications on public.member_team_memberships;
create trigger news_team_memberships_sync_notifications
after insert or update or delete on public.member_team_memberships
for each row execute function public.sync_news_team_membership_notifications();

insert into public.notifications (
  member_id, notification_type, title, message, page, related_meeting_id
)
select
  membership.member_id,
  'meeting_invite',
  'News Team meeting invitation',
  meeting.title || ' is scheduled for '
    || to_char(meeting.starts_at at time zone 'Europe/Berlin', 'FMDD Mon YYYY, HH24:MI')
    || ' Berlin time'
    || case when nullif(btrim(meeting.location), '') is null then '' else ' at ' || btrim(meeting.location) end
    || '. Open Meetings to RSVP.',
  'meetings',
  meeting.id
from public.meetings meeting
join public.member_team_memberships membership on membership.team_key = 'news_team'
where meeting.audience = 'news_team'
  and meeting.archived_at is null
  and meeting.ends_at > now()
on conflict (member_id, notification_type, related_meeting_id)
  where notification_type = 'meeting_invite' and related_meeting_id is not null
do nothing;

create or replace function public.expire_unconfirmed_signups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.signups
  set confirmation_status = 'expired'
  where confirmation_status = 'maybe'
    and confirmation_deadline is not null
    and confirmation_deadline <= now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_unconfirmed_signups() from public;

create or replace function public.prepare_signup_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare event_start timestamptz;
begin
  select event.date into event_start from public.events event where event.id = new.event_id;
  if new.confirmation_status = 'maybe' then
    new.confirmation_deadline := event_start - interval '2 hours';
    new.confirmed_at := null;
    if new.confirmation_deadline <= now() then raise exception 'Maybe signups close two hours before the event starts.'; end if;
  else
    new.confirmation_status := 'confirmed';
    new.confirmation_deadline := null;
    new.confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists signups_prepare_confirmation_before_insert on public.signups;
create trigger signups_prepare_confirmation_before_insert before insert on public.signups for each row execute function public.prepare_signup_confirmation();

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  compatibility_group text,
  status text not null default 'available',
  assigned_to uuid references public.members(id) on delete set null,
  notes text
);

alter table public.equipment add column if not exists category text not null default 'Other';
alter table public.equipment add column if not exists compatibility_group text;
alter table public.equipment drop constraint if exists equipment_compatibility_group_check;
alter table public.equipment add constraint equipment_compatibility_group_check check (
  compatibility_group is null or compatibility_group in ('canon-r6', 'lumix-gh6', 'canon-aps-c')
);
alter table public.equipment add column if not exists archived_at timestamptz;
alter table public.equipment add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.equipment add column if not exists archived_by_name text;

update public.equipment set compatibility_group = 'canon-r6'
where compatibility_group is null and category in ('Camera', 'Recording Cameras') and lower(name) ~ '(^|[^a-z0-9])(eos[[:space:]]*)?r[[:space:]]*6([^0-9]|$)';
update public.equipment set compatibility_group = 'lumix-gh6'
where compatibility_group is null and category in ('Camera', 'Recording Cameras') and lower(name) ~ '(^|[^a-z0-9])gh[[:space:]]*6([^0-9]|$)';
update public.equipment set compatibility_group = 'canon-aps-c'
where compatibility_group is null and category in ('Camera', 'Recording Cameras') and lower(name) ~ '(^|[^0-9])(450|600|700|70)[[:space:]]*d([^0-9]|$)';

insert into public.equipment (name, category, compatibility_group, status, notes)
select seed.name, 'Lens', seed.compatibility_group, 'available', seed.notes
from (values
  ('Canon EF-S 18–55mm f/3.5–5.6 IS II', 'canon-aps-c', 'Everyday wide-to-standard zoom · image stabilisation · Canon APS-C DSLR kit'),
  ('Canon EF-S 18–135mm f/3.5–5.6 IS USM', 'canon-aps-c', 'All-round event zoom · flexible framing · Canon APS-C DSLR kit'),
  ('Canon EF-S 24mm f/2.8 STM', 'canon-aps-c', 'Compact wide prime · brighter indoor option · Canon APS-C DSLR kit'),
  ('Canon EF-S 50mm f/1.8 STM', 'canon-aps-c', 'Fast portrait prime · shallow depth and low light · Canon APS-C DSLR kit'),
  ('Canon EF-S 55–250mm f/4–5.6 IS STM', 'canon-aps-c', 'Telephoto reach · sports and distant action · Canon APS-C DSLR kit'),
  ('Canon EF-S 55–250mm f/4–5.6 IS STM · Unit 2', 'canon-aps-c', 'Second telephoto unit · sports and distant action · Canon APS-C DSLR kit'),
  ('Sigma 24–70mm f/2.8 DG DN Art', 'canon-r6', 'Fast standard zoom · event and low-light coverage · Canon R6 kit only'),
  ('Leica DG Vario-Elmarit 12–60mm f/2.8–4', 'lumix-gh6', 'Versatile wide-to-tele zoom · run-and-gun coverage · Lumix GH6 kit only'),
  ('Olympus M.Zuiko Digital ED 40–150mm f/2.8 PRO', 'lumix-gh6', 'Fast telephoto zoom · sports and stage coverage · Lumix GH6 kit only')
) as seed(name, compatibility_group, notes)
where not exists (
  select 1 from public.equipment item where lower(item.name) = lower(seed.name)
);

create table if not exists public.equipment_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_group_id uuid,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  reservation_type text not null check (reservation_type in ('event', 'non_event')),
  purpose text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reservation_status text not null default 'scheduled',
  checked_out_at timestamptz,
  returned_at timestamptz,
  returned_by uuid references auth.users(id) on delete set null,
  returned_by_name text,
  auto_released_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.equipment_reservations add column if not exists purpose text;
alter table public.equipment_reservations add column if not exists reservation_group_id uuid;
create index if not exists equipment_reservations_group_idx on public.equipment_reservations (reservation_group_id) where reservation_group_id is not null;
alter table public.equipment_reservations add column if not exists reservation_status text not null default 'scheduled';
alter table public.equipment_reservations add column if not exists checked_out_at timestamptz;
alter table public.equipment_reservations add column if not exists returned_at timestamptz;
alter table public.equipment_reservations add column if not exists returned_by uuid references auth.users(id) on delete set null;
alter table public.equipment_reservations add column if not exists returned_by_name text;
alter table public.equipment_reservations add column if not exists auto_released_at timestamptz;
alter table public.equipment_reservations drop constraint if exists equipment_reservations_status_check;
alter table public.equipment_reservations add constraint equipment_reservations_status_check
check (reservation_status in ('scheduled', 'checked_out', 'returned', 'auto_released'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'equipment_reservations_non_event_purpose_check'
  ) then
    alter table public.equipment_reservations
      add constraint equipment_reservations_non_event_purpose_check
      check (reservation_type <> 'non_event' or nullif(btrim(purpose), '') is not null) not valid;
  end if;
end $$;

alter table public.equipment_reservations drop constraint if exists equipment_reservations_no_overlap;
alter table public.equipment_reservations add constraint equipment_reservations_no_overlap
exclude using gist (
  equipment_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
);

create or replace function public.refresh_equipment_checkout_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.equipment_reservations
  set reservation_status = 'auto_released',
      checked_out_at = coalesce(checked_out_at, starts_at),
      auto_released_at = coalesce(auto_released_at, ends_at + interval '15 minutes')
  where reservation_status in ('scheduled', 'checked_out')
    and returned_at is null
    and now() >= ends_at + interval '15 minutes';

  update public.equipment_reservations
  set reservation_status = 'checked_out',
      checked_out_at = coalesce(checked_out_at, starts_at)
  where reservation_status = 'scheduled'
    and now() >= starts_at
    and now() < ends_at + interval '15 minutes';

  update public.equipment item
  set status = 'checked_out'
  where exists (
    select 1 from public.equipment_reservations reservation
    where reservation.equipment_id = item.id
      and reservation.reservation_status = 'checked_out'
  );

  update public.equipment item
  set status = 'available'
  where item.status = 'checked_out'
    and not exists (
      select 1 from public.equipment_reservations reservation
      where reservation.equipment_id = item.id
        and reservation.reservation_status = 'checked_out'
    );
end;
$$;

revoke all on function public.refresh_equipment_checkout_statuses() from public;

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  project_type text not null default 'Photo' check (project_type in ('Photo', 'Video', 'Podcast', 'Design')),
  member_id uuid references public.members(id) on delete set null,
  description text,
  image_url text,
  project_url text,
  storage_path text,
  project_scope text not null default 'showcase' check (project_scope in ('showcase', 'athletics')),
  produced_on date,
  created_at timestamptz not null default now()
);

alter table public.gallery add column if not exists project_type text not null default 'Photo';
alter table public.gallery add column if not exists member_id uuid references public.members(id) on delete set null;
alter table public.gallery add column if not exists project_url text;
alter table public.gallery add column if not exists storage_path text;
alter table public.gallery add column if not exists project_scope text not null default 'showcase';
alter table public.gallery drop constraint if exists gallery_project_scope_check;
alter table public.gallery add constraint gallery_project_scope_check
check (project_scope in ('showcase', 'athletics'));
alter table public.gallery add column if not exists produced_on date;
update public.gallery set project_url = image_url where project_url is null and image_url is not null;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'join_applications_fis_alias_email_check'
  ) then
    alter table public.join_applications
      add constraint join_applications_fis_alias_email_check
      check (public.is_fis_alias_email(email)) not valid;
  end if;
end $$;

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
