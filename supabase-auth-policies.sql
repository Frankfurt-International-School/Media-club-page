alter table public.members enable row level security;
alter table public.member_team_memberships enable row level security;
alter table public.events enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_reservations enable row level security;
alter table public.gallery enable row level security;
alter table public.announcements enable row level security;
alter table public.join_applications enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read members" on public.members;
drop policy if exists "Authenticated users can add members" on public.members;
drop policy if exists "Admins can manage members" on public.members;
drop policy if exists "Approved members can read team memberships" on public.member_team_memberships;
drop policy if exists "Admin Panel users can manage team memberships" on public.member_team_memberships;
drop policy if exists "Auth Admins can manage team memberships" on public.member_team_memberships;
drop policy if exists "Auth Admins can add members" on public.members;
drop policy if exists "Admins can update members" on public.members;
drop policy if exists "Admins can delete members" on public.members;
drop policy if exists "Authenticated users can update members" on public.members;
drop policy if exists "Authenticated users can delete members" on public.members;
drop policy if exists "Signed-in users can read members" on public.members;
drop policy if exists "Admins can manage members" on public.members;
drop policy if exists "Authenticated users can read events" on public.events;
drop policy if exists "Authenticated users can add events" on public.events;
drop policy if exists "Authenticated users can update events" on public.events;
drop policy if exists "Authenticated users can delete events" on public.events;
drop policy if exists "Signed-in users can read events" on public.events;
drop policy if exists "Admins can manage events" on public.events;
drop policy if exists "Admins can update events" on public.events;
drop policy if exists "Production staff can add events" on public.events;
drop policy if exists "Production staff can delete events" on public.events;
drop policy if exists "Audience members can read meetings" on public.meetings;
drop policy if exists "Audience members can read meeting attendees" on public.meeting_attendees;
drop policy if exists "Approved members can read meetings" on public.meetings;
drop policy if exists "Approved members can read meeting attendees" on public.meeting_attendees;
drop policy if exists "Members can add own meeting RSVP" on public.meeting_attendees;
drop policy if exists "Members can update own meeting RSVP" on public.meeting_attendees;
drop policy if exists "Members can remove own meeting RSVP" on public.meeting_attendees;
drop policy if exists "Authenticated users can read signups" on public.signups;
drop policy if exists "Authenticated users can add signups" on public.signups;
drop policy if exists "Authenticated users can delete signups" on public.signups;
drop policy if exists "Signed-in users can read signups" on public.signups;
drop policy if exists "Signed-in users can add signups" on public.signups;
drop policy if exists "Admins can delete signups" on public.signups;
drop policy if exists "Users can delete own signups and Auth Admins any" on public.signups;
drop policy if exists "Authenticated users can read equipment" on public.equipment;
drop policy if exists "Authenticated users can manage equipment" on public.equipment;
drop policy if exists "Signed-in users can read equipment" on public.equipment;
drop policy if exists "Admins can manage equipment" on public.equipment;
drop policy if exists "Production staff can add equipment" on public.equipment;
drop policy if exists "Production staff can update equipment" on public.equipment;
drop policy if exists "Production staff can delete equipment" on public.equipment;
drop policy if exists "Signed-in users can read equipment reservations" on public.equipment_reservations;
drop policy if exists "Signed-in members can reserve equipment" on public.equipment_reservations;
drop policy if exists "Users can cancel equipment reservations" on public.equipment_reservations;
drop policy if exists "Authenticated users can read gallery" on public.gallery;
drop policy if exists "Authenticated users can manage gallery" on public.gallery;
drop policy if exists "Signed-in users can read gallery" on public.gallery;
drop policy if exists "Signed-in members can submit gallery projects" on public.gallery;
drop policy if exists "Admins can manage gallery" on public.gallery;
drop policy if exists "Admins can update gallery" on public.gallery;
drop policy if exists "Admins can delete gallery" on public.gallery;
drop policy if exists "Signed-in users can read announcements" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "Signed-in users can submit join applications" on public.join_applications;
drop policy if exists "Admins can read join applications" on public.join_applications;
drop policy if exists "Admins can manage join applications" on public.join_applications;
drop policy if exists "Members can read own notifications" on public.notifications;

create or replace function public.is_admin_panel_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from public.members member
      where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and replace(lower(member.role), ' ', '-') = 'faculty'
    );
$$;

create or replace function public.is_auth_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin';
$$;

create or replace function public.is_crew_operations_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_panel_user()
    or exists (
      select 1
      from public.members member
      where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and replace(lower(member.role), ' ', '-') in ('leader', 'co-leader', 'moderator')
    );
$$;

create or replace function public.can_create_meetings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and replace(lower(member.role), ' ', '-') in ('faculty', 'leader', 'co-leader')
  );
$$;

revoke all on function public.can_create_meetings() from public;
grant execute on function public.can_create_meetings() to authenticated;

create or replace function public.can_access_equipment_status()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_auth_admin();
$$;

revoke all on function public.can_access_equipment_status() from public;
grant execute on function public.can_access_equipment_status() to authenticated;

create or replace function public.is_crew_schedule_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_auth_admin();
$$;

create or replace function public.is_visitor_session()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or lower(coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      ''
    )) = 'visitor';
$$;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not public.is_visitor_session()
    and (
      public.is_auth_admin()
      or exists (
        select 1 from public.members member
        where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    );
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select member.id
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function public.is_member_of_team(p_team_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_team_memberships membership
    where membership.member_id = public.current_member_id()
      and membership.team_key = p_team_key
  );
$$;

create or replace function public.can_read_meeting(p_meeting_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_archived_at timestamptz;
begin
  if not public.is_approved_member() then return false; end if;

  select meeting.archived_at
  into target_archived_at
  from public.meetings meeting
  where meeting.id = p_meeting_id;

  if not found then return false; end if;
  return target_archived_at is null or public.is_crew_operations_user();
end;
$$;

create or replace function public.can_rsvp_meeting(p_meeting_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_audience text;
  target_archived_at timestamptz;
begin
  if not public.is_approved_member() then return false; end if;

  select meeting.audience, meeting.archived_at
  into target_audience, target_archived_at
  from public.meetings meeting
  where meeting.id = p_meeting_id;

  if not found or target_archived_at is not null then return false; end if;
  if target_audience = 'general' then return true; end if;
  if target_audience = 'news_team' then return public.is_member_of_team('news_team'); end if;
  return target_audience = 'leadership' and public.is_crew_operations_user();
end;
$$;

revoke all on function public.current_member_id() from public;
revoke all on function public.is_member_of_team(text) from public;
revoke all on function public.can_read_meeting(uuid) from public;
revoke all on function public.can_rsvp_meeting(uuid) from public;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.is_member_of_team(text) to authenticated;
grant execute on function public.can_read_meeting(uuid) to authenticated;
grant execute on function public.can_rsvp_meeting(uuid) to authenticated;

drop function if exists public.get_public_member_directory();

create or replace function public.get_public_events()
returns table (
  id uuid,
  title text,
  description text,
  date timestamptz,
  location text,
  category text,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.id, event.title, event.description, event.date, event.location, event.category, event.ends_at
  from public.events event
  where event.archived_at is null
  order by event.date;
$$;

create or replace function public.get_public_gallery()
returns table (
  id uuid,
  project_name text,
  project_type text,
  description text,
  image_url text,
  project_url text,
  produced_on date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    project.id, project.project_name, project.project_type, project.description,
    project.image_url, project.project_url, project.produced_on, project.created_at
  from public.gallery project
  order by project.created_at desc;
$$;

create or replace function public.get_public_equipment()
returns table (id uuid, name text, category text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select item.id, item.name, item.category, item.status
  from public.equipment item
  where item.archived_at is null
  order by item.name;
$$;

create or replace function public.get_public_announcements()
returns table (id uuid, title text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select announcement.id, announcement.title, announcement.body, announcement.created_at
  from public.announcements announcement
  order by announcement.created_at desc;
$$;

revoke all on function public.get_public_events() from public;
revoke all on function public.get_public_gallery() from public;
revoke all on function public.get_public_equipment() from public;
revoke all on function public.get_public_announcements() from public;
grant execute on function public.get_public_events() to authenticated;
grant execute on function public.get_public_gallery() to authenticated;
grant execute on function public.get_public_equipment() to authenticated;
grant execute on function public.get_public_announcements() to authenticated;

create or replace function public.set_event_archived(
  p_event_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare marker_name text;
begin
  if not public.is_crew_operations_user() then
    raise exception 'Production staff access is required.';
  end if;

  if p_archived and exists (
    select 1 from public.equipment_reservations reservation
    where reservation.event_id = p_event_id
      and reservation.reservation_status in ('scheduled', 'checked_out', 'auto_released')
      and reservation.returned_at is null
      and reservation.ends_at > now()
  ) then
    raise exception 'Cancel or complete this event''s active equipment reservations before archiving it.';
  end if;

  select member.name into marker_name
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  marker_name := coalesce(marker_name, auth.jwt() ->> 'email', 'Auth Admin');

  update public.events
  set archived_at = case when p_archived then now() else null end,
      archived_by = case when p_archived then auth.uid() else null end,
      archived_by_name = case when p_archived then marker_name else null end
  where id = p_event_id;

  return found;
end;
$$;

drop function if exists public.create_meeting(text, text, timestamptz, timestamptz, text, text, text, uuid);

create or replace function public.create_meeting(
  p_title text,
  p_agenda text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_meeting_link text,
  p_audience text,
  p_related_event_id uuid,
  p_faculty_authorized boolean
)
returns public.meetings
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  organizer_label text;
  organizer_role text;
  created_meeting public.meetings;
begin
  if not public.can_create_meetings() then
    raise exception 'Only Faculty, Leaders, and Co-Leaders can create meetings.';
  end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 120 then
    raise exception 'Meeting titles must contain between 1 and 120 characters.';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'The meeting end must be after its start.';
  end if;
  if p_audience not in ('general', 'news_team', 'leadership') then
    raise exception 'Invalid meeting audience.';
  end if;
  if nullif(btrim(p_meeting_link), '') is not null and btrim(p_meeting_link) !~ '^https://[^[:space:]<>"'']+$' then
    raise exception 'Meeting links must use a valid HTTPS address.';
  end if;

  select member.id, member.name, replace(lower(member.role), ' ', '-')
  into organizer_id, organizer_label, organizer_role
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  organizer_label := coalesce(organizer_label, 'Media Club member');

  if organizer_role in ('leader', 'co-leader') and not coalesce(p_faculty_authorized, false) then
    raise exception 'A Leader or Co-Leader must confirm Faculty authorization before creating a meeting.';
  end if;

  insert into public.meetings (
    title, agenda, starts_at, ends_at, location, meeting_link, audience,
    related_event_id, organizer_member_id, organizer_name,
    faculty_authorization_confirmed, faculty_authorization_confirmed_at,
    created_by
  ) values (
    btrim(p_title), coalesce(btrim(p_agenda), ''), p_starts_at, p_ends_at,
    coalesce(btrim(p_location), ''), nullif(btrim(p_meeting_link), ''), p_audience,
    p_related_event_id, organizer_id, organizer_label,
    organizer_role in ('leader', 'co-leader'),
    case when organizer_role in ('leader', 'co-leader') then now() else null end,
    auth.uid()
  ) returning * into created_meeting;

  return created_meeting;
end;
$$;

create or replace function public.update_meeting(
  p_meeting_id uuid,
  p_title text,
  p_agenda text,
  p_notes text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_meeting_link text,
  p_audience text,
  p_related_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crew_operations_user() then
    raise exception 'Production staff access is required.';
  end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 120 then
    raise exception 'Meeting titles must contain between 1 and 120 characters.';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'The meeting end must be after its start.';
  end if;
  if p_audience not in ('general', 'news_team', 'leadership') then
    raise exception 'Invalid meeting audience.';
  end if;
  if nullif(btrim(p_meeting_link), '') is not null and btrim(p_meeting_link) !~ '^https://[^[:space:]<>"'']+$' then
    raise exception 'Meeting links must use a valid HTTPS address.';
  end if;

  update public.meetings
  set title = btrim(p_title),
      agenda = coalesce(btrim(p_agenda), ''),
      notes = coalesce(btrim(p_notes), ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      location = coalesce(btrim(p_location), ''),
      meeting_link = nullif(btrim(p_meeting_link), ''),
      audience = p_audience,
      related_event_id = p_related_event_id,
      updated_at = now()
  where id = p_meeting_id and archived_at is null;

  return found;
end;
$$;

create or replace function public.set_meeting_archived(
  p_meeting_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare marker_name text;
begin
  if not public.is_crew_operations_user() then
    raise exception 'Production staff access is required.';
  end if;

  select member.name into marker_name
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  marker_name := coalesce(marker_name, 'Auth Admin');

  update public.meetings
  set archived_at = case when p_archived then now() else null end,
      archived_by = case when p_archived then auth.uid() else null end,
      archived_by_name = case when p_archived then marker_name else null end,
      updated_at = now()
  where id = p_meeting_id;

  return found;
end;
$$;

create or replace function public.get_meeting_delete_impact(p_meeting_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete a meeting.';
  end if;

  select jsonb_build_object(
    'id', meeting.id,
    'name', meeting.title,
    'responses', (select count(*) from public.meeting_attendees attendee where attendee.meeting_id = meeting.id)
  ) into impact
  from public.meetings meeting
  where meeting.id = p_meeting_id;

  return impact;
end;
$$;

create or replace function public.permanently_delete_meeting(
  p_meeting_id uuid,
  p_expected_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_title text;
  impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete a meeting.';
  end if;

  select title into target_title from public.meetings where id = p_meeting_id for update;
  if target_title is null then return null; end if;
  if target_title is distinct from p_expected_title then
    raise exception 'The confirmation text does not match the meeting title.';
  end if;

  impact := public.get_meeting_delete_impact(p_meeting_id);
  delete from public.meetings where id = p_meeting_id;
  return impact || jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.set_equipment_archived(
  p_equipment_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare marker_name text;
begin
  if not public.is_crew_operations_user() then
    raise exception 'Production staff access is required.';
  end if;

  if p_archived and exists (
    select 1 from public.equipment_reservations reservation
    where reservation.equipment_id = p_equipment_id
      and reservation.reservation_status in ('scheduled', 'checked_out', 'auto_released')
      and reservation.returned_at is null
  ) then
    raise exception 'Cancel or complete this equipment''s active reservations before archiving it.';
  end if;

  select member.name into marker_name
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  marker_name := coalesce(marker_name, auth.jwt() ->> 'email', 'Auth Admin');

  update public.equipment
  set archived_at = case when p_archived then now() else null end,
      archived_by = case when p_archived then auth.uid() else null end,
      archived_by_name = case when p_archived then marker_name else null end
  where id = p_equipment_id;

  return found;
end;
$$;

create or replace function public.get_event_delete_impact(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete an event.';
  end if;

  select jsonb_build_object(
    'id', event.id,
    'name', event.title,
    'signups', (select count(*) from public.signups signup where signup.event_id = event.id),
    'reservations', (select count(*) from public.equipment_reservations reservation where reservation.event_id = event.id),
    'notifications', (select count(*) from public.notifications notification where notification.related_event_id = event.id)
  ) into impact
  from public.events event
  where event.id = p_event_id;

  return impact;
end;
$$;

create or replace function public.get_equipment_delete_impact(p_equipment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete equipment.';
  end if;

  select jsonb_build_object(
    'id', equipment.id,
    'name', equipment.name,
    'reservations', (select count(*) from public.equipment_reservations reservation where reservation.equipment_id = equipment.id)
  ) into impact
  from public.equipment equipment
  where equipment.id = p_equipment_id;

  return impact;
end;
$$;

create or replace function public.permanently_delete_event(
  p_event_id uuid,
  p_expected_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_title text;
  impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete an event.';
  end if;

  select title into target_title from public.events where id = p_event_id for update;
  if target_title is null then return null; end if;
  if target_title is distinct from p_expected_title then
    raise exception 'The confirmation text does not match the event title.';
  end if;

  impact := public.get_event_delete_impact(p_event_id);
  delete from public.events where id = p_event_id;
  return impact || jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.permanently_delete_equipment(
  p_equipment_id uuid,
  p_expected_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
  impact jsonb;
begin
  if not public.is_auth_admin() then
    raise exception 'Only an Auth Admin can permanently delete equipment.';
  end if;

  select name into target_name from public.equipment where id = p_equipment_id for update;
  if target_name is null then return null; end if;
  if target_name is distinct from p_expected_name then
    raise exception 'The confirmation text does not match the equipment name.';
  end if;

  impact := public.get_equipment_delete_impact(p_equipment_id);
  delete from public.equipment where id = p_equipment_id;
  return impact || jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.set_event_archived(uuid, boolean) from public;
revoke all on function public.create_meeting(text, text, timestamptz, timestamptz, text, text, text, uuid, boolean) from public;
revoke all on function public.update_meeting(uuid, text, text, text, timestamptz, timestamptz, text, text, text, uuid) from public;
revoke all on function public.set_meeting_archived(uuid, boolean) from public;
revoke all on function public.get_meeting_delete_impact(uuid) from public;
revoke all on function public.permanently_delete_meeting(uuid, text) from public;
revoke all on function public.set_equipment_archived(uuid, boolean) from public;
revoke all on function public.get_event_delete_impact(uuid) from public;
revoke all on function public.get_equipment_delete_impact(uuid) from public;
revoke all on function public.permanently_delete_event(uuid, text) from public;
revoke all on function public.permanently_delete_equipment(uuid, text) from public;
grant execute on function public.set_event_archived(uuid, boolean) to authenticated;
grant execute on function public.create_meeting(text, text, timestamptz, timestamptz, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.update_meeting(uuid, text, text, text, timestamptz, timestamptz, text, text, text, uuid) to authenticated;
grant execute on function public.set_meeting_archived(uuid, boolean) to authenticated;
grant execute on function public.get_meeting_delete_impact(uuid) to authenticated;
grant execute on function public.permanently_delete_meeting(uuid, text) to authenticated;
grant execute on function public.set_equipment_archived(uuid, boolean) to authenticated;
grant execute on function public.get_event_delete_impact(uuid) to authenticated;
grant execute on function public.get_equipment_delete_impact(uuid) to authenticated;
grant execute on function public.permanently_delete_event(uuid, text) to authenticated;
grant execute on function public.permanently_delete_equipment(uuid, text) to authenticated;

create or replace function public.update_own_member_avatar(
  p_avatar_url text,
  p_avatar_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_visitor_session() then
    raise exception 'A signed-in member account is required.';
  end if;

  if p_avatar_url is not null and (
    p_avatar_path is distinct from (auth.uid()::text || '/avatar.webp')
    or p_avatar_url !~ '^https://[A-Za-z0-9.-]+/storage/v1/object/public/profile-pictures/'
    or p_avatar_url ~ '["''<>()[:space:]]'
  ) then
    raise exception 'Invalid profile picture location.';
  end if;

  update public.members
  set avatar_url = nullif(trim(p_avatar_url), ''),
      avatar_path = nullif(trim(p_avatar_path), '')
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return found;
end;
$$;

revoke all on function public.update_own_member_avatar(text, text) from public;
grant execute on function public.update_own_member_avatar(text, text) to authenticated;

create or replace function public.update_own_sidebar_preferences(
  p_customized boolean,
  p_items text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_items text[];
begin
  if auth.uid() is null or public.is_visitor_session() then
    raise exception 'A signed-in member account is required.';
  end if;

  select coalesce(array_agg(item order by position), array[]::text[])
  into clean_items
  from (
    select item, min(position) as position
    from unnest(coalesce(p_items, array[]::text[])) with ordinality as chosen(item, position)
    where item = any(array['about','home','events','meetings','signup','members','gallery','equipment','role-guide','crew-deployment','equipment-status','join','admin']::text[])
    group by item
  ) normalized;

  if coalesce(p_customized, false) and (
    not (clean_items && array['home','events','meetings','signup','members']::text[])
    or not (clean_items && array['gallery','equipment','role-guide']::text[])
    or not (clean_items && array['crew-deployment','equipment-status','join','about','admin']::text[])
  ) then
    raise exception 'Choose at least one sidebar page from Main, Content, and Club.';
  end if;

  update public.members
  set sidebar_customized = coalesce(p_customized, false),
      sidebar_items = clean_items
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return found;
end;
$$;

revoke all on function public.update_own_sidebar_preferences(boolean, text[]) from public;
grant execute on function public.update_own_sidebar_preferences(boolean, text[]) to authenticated;

create or replace function public.update_own_notification_preferences(p_preferences jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_preferences jsonb;
begin
  if auth.uid() is null or public.is_visitor_session() then raise exception 'A signed-in member account is required.'; end if;
  clean_preferences := jsonb_build_object(
    'event_created', coalesce((p_preferences ->> 'event_created')::boolean, true),
    'event_reminders', coalesce((p_preferences ->> 'event_reminders')::boolean, true),
    'maybe_reminders', coalesce((p_preferences ->> 'maybe_reminders')::boolean, true)
  );
  update public.members set notification_preferences = clean_preferences
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  return found;
end;
$$;

revoke all on function public.update_own_notification_preferences(jsonb) from public;
grant execute on function public.update_own_notification_preferences(jsonb) to authenticated;

create or replace function public.update_own_dashboard_preferences(p_preferences jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_stats text[];
  clean_sections text[];
begin
  if auth.uid() is null or public.is_visitor_session() then
    raise exception 'A signed-in member account is required.';
  end if;

  select coalesce(array_agg(value order by position), array[]::text[])
  into clean_stats
  from (
    select value, min(position) as position
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_preferences -> 'stats') = 'array' then p_preferences -> 'stats' else '[]'::jsonb end
    ) with ordinality as selected(value, position)
    where value = any(array[
      'members','upcoming_events','projects','available_equipment',
      'my_assignments','my_reservations','checked_out','pending_applications'
    ]::text[])
    group by value
  ) normalized;

  select coalesce(array_agg(value order by position), array[]::text[])
  into clean_sections
  from (
    select value, min(position) as position
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_preferences -> 'sections') = 'array' then p_preferences -> 'sections' else '[]'::jsonb end
    ) with ordinality as selected(value, position)
    where value = any(array['upcoming_events','announcements','my_commitments','equipment_snapshot']::text[])
    group by value
  ) normalized;

  if cardinality(clean_stats) < 2 or cardinality(clean_stats) > 4 then
    raise exception 'Choose between two and four dashboard statistics.';
  end if;
  if cardinality(clean_sections) < 1 or cardinality(clean_sections) > 3 then
    raise exception 'Choose between one and three dashboard sections.';
  end if;

  update public.members
  set dashboard_preferences = jsonb_build_object(
    'stats', to_jsonb(clean_stats),
    'sections', to_jsonb(clean_sections)
  )
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return found;
end;
$$;

revoke all on function public.update_own_dashboard_preferences(jsonb) from public;
grant execute on function public.update_own_dashboard_preferences(jsonb) to authenticated;

create or replace function public.update_own_personal_equipment_preferences(p_preferences jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_camera_name text := btrim(coalesce(p_preferences ->> 'camera_name', ''));
  clean_auto_use boolean := coalesce((p_preferences ->> 'auto_use_camera')::boolean, false);
begin
  if auth.uid() is null or public.is_visitor_session() then
    raise exception 'A signed-in member account is required.';
  end if;
  if char_length(clean_camera_name) > 80 or clean_camera_name ~ '[[:cntrl:]]' then
    raise exception 'Camera names must contain 80 characters or fewer.';
  end if;
  if clean_auto_use and clean_camera_name = '' then
    raise exception 'Add a camera before making it your Photographer default.';
  end if;

  update public.members
  set personal_equipment_preferences = jsonb_build_object(
    'camera_name', clean_camera_name,
    'auto_use_camera', clean_auto_use
  )
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return found;
end;
$$;

revoke all on function public.update_own_personal_equipment_preferences(jsonb) from public;
grant execute on function public.update_own_personal_equipment_preferences(jsonb) to authenticated;

create or replace function public.update_own_tutorial_progress(p_progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_completed text[];
  clean_active_tour text;
  clean_active_step integer;
  clean_dismissed_welcome boolean;
  allowed_tours constant text[] := array[
    'full','home','events','meetings','signup','members','gallery','equipment','role-guide',
    'crew-deployment','equipment-status','join','about','profile','admin'
  ]::text[];
begin
  if auth.uid() is null or public.is_visitor_session() then
    raise exception 'A signed-in member account is required.';
  end if;

  select coalesce(array_agg(value order by position), array[]::text[])
  into clean_completed
  from (
    select value, min(position) as position
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_progress -> 'completed') = 'array' then p_progress -> 'completed' else '[]'::jsonb end
    ) with ordinality as selected(value, position)
    where value = any(allowed_tours)
    group by value
  ) normalized;

  clean_active_tour := nullif(p_progress ->> 'active_tour', '');
  if clean_active_tour is not null and not (clean_active_tour = any(allowed_tours)) then
    clean_active_tour := null;
  end if;

  clean_active_step := case
    when coalesce(p_progress ->> 'active_step', '') ~ '^[0-9]+$'
      then least(100, greatest(0, (p_progress ->> 'active_step')::integer))
    else 0
  end;
  clean_dismissed_welcome := case
    when lower(coalesce(p_progress ->> 'dismissed_welcome', '')) in ('true', 'false')
      then (p_progress ->> 'dismissed_welcome')::boolean
    else false
  end;

  update public.members
  set tutorial_progress = jsonb_build_object(
    'version', 1,
    'completed', to_jsonb(clean_completed),
    'dismissed_welcome', clean_dismissed_welcome,
    'active_tour', to_jsonb(clean_active_tour),
    'active_step', clean_active_step
  )
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return found;
end;
$$;

revoke all on function public.update_own_tutorial_progress(jsonb) from public;
grant execute on function public.update_own_tutorial_progress(jsonb) to authenticated;

create or replace function public.confirm_own_maybe_signup(p_signup_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signups signup
  set confirmation_status = 'confirmed', confirmed_at = now()
  where signup.id = p_signup_id
    and signup.confirmation_status = 'maybe'
    and signup.confirmation_deadline > now()
    and exists (
      select 1 from public.members member
      where member.id = signup.member_id
        and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
  return found;
end;
$$;

revoke all on function public.confirm_own_maybe_signup(uuid) from public;
grant execute on function public.confirm_own_maybe_signup(uuid) to authenticated;

create or replace function public.mark_own_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare updated_count integer;
begin
  update public.notifications notification set read_at = now()
  where notification.read_at is null and exists (
    select 1 from public.members member
    where member.id = notification.member_id
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_own_notifications_read() from public;
grant execute on function public.mark_own_notifications_read() to authenticated;

create or replace function public.is_valid_event_signup(
  p_event_id uuid,
  p_signup_role text,
  p_attendance_type text,
  p_attendance_start timestamptz,
  p_attendance_end timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events event
    where event.id = p_event_id
      and p_attendance_end > p_attendance_start
      and (p_attendance_start at time zone 'Europe/Berlin')::date = (event.date at time zone 'Europe/Berlin')::date
      and (p_attendance_end at time zone 'Europe/Berlin')::date = (event.date at time zone 'Europe/Berlin')::date
      and (
        (
          event.is_festival
          and case p_attendance_type
            when 'setup' then p_signup_role is null
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.setup_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.setup_end
            when 'shift_1' then p_signup_role is not null
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.shift_1_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.shift_1_end
            when 'shift_2' then p_signup_role is not null
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.shift_2_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.shift_2_end
            when 'takedown' then p_signup_role is null
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.takedown_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.takedown_end
            when 'custom' then p_signup_role is not null
              and (p_attendance_start at time zone 'Europe/Berlin')::time >= event.setup_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time <= event.takedown_end
            else false
          end
        )
        or (
          not event.is_festival
          and p_signup_role is not null
          and (
            (
              p_attendance_type = 'whole'
              and p_attendance_start = event.date
              and p_attendance_end = coalesce(
                event.ends_at,
                (((event.date at time zone 'Europe/Berlin')::date + time '23:59') at time zone 'Europe/Berlin')
              )
            )
            or (
              p_attendance_type = 'game_1'
              and (event.is_sports or event.is_isst)
              and p_attendance_start = (((event.date at time zone 'Europe/Berlin')::date + event.game_1_start) at time zone 'Europe/Berlin')
              and p_attendance_end = (((event.date at time zone 'Europe/Berlin')::date + event.game_1_end) at time zone 'Europe/Berlin')
            )
            or (
              p_attendance_type = 'game_2'
              and (event.is_sports or event.is_isst)
              and p_attendance_start = (((event.date at time zone 'Europe/Berlin')::date + event.game_2_start) at time zone 'Europe/Berlin')
              and p_attendance_end = (((event.date at time zone 'Europe/Berlin')::date + event.game_2_end) at time zone 'Europe/Berlin')
            )
            or (
              p_attendance_type = 'custom'
              and p_attendance_start >= event.date
              and p_attendance_end <= coalesce(
                event.ends_at,
                (((event.date at time zone 'Europe/Berlin')::date + time '23:59') at time zone 'Europe/Berlin')
              )
            )
            or (
              p_attendance_type = 'game_3'
              and event.is_isst
              and p_attendance_start = (((event.date at time zone 'Europe/Berlin')::date + event.game_3_start) at time zone 'Europe/Berlin')
              and p_attendance_end = (((event.date at time zone 'Europe/Berlin')::date + event.game_3_end) at time zone 'Europe/Berlin')
            )
            or (
              p_attendance_type = 'game_4'
              and event.is_isst
              and event.game_4_start is not null
              and p_attendance_start = (((event.date at time zone 'Europe/Berlin')::date + event.game_4_start) at time zone 'Europe/Berlin')
              and p_attendance_end = (((event.date at time zone 'Europe/Berlin')::date + event.game_4_end) at time zone 'Europe/Berlin')
            )
          )
        )
      )
  );
$$;

create or replace function public.can_create_equipment_reservation(
  p_equipment_id uuid,
  p_member_id uuid,
  p_event_id uuid,
  p_reservation_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.is_visitor_session()
    and p_ends_at > p_starts_at
    and ((p_reservation_type = 'event' and p_event_id is not null) or (p_reservation_type = 'non_event' and p_event_id is null))
    and exists (
      select 1 from public.members member
      where member.id = p_member_id
        and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and exists (
      select 1 from public.equipment item
      where item.id = p_equipment_id and item.status = 'available'
    )
    and not exists (
      select 1
      from public.members member
      join public.equipment item on item.id = p_equipment_id
      where member.id = p_member_id
        and p_reservation_type = 'non_event'
        and item.category in ('Camera', 'Recording Cameras')
        and case
          when coalesce(member.grade_level, '') ~ '[0-9]+'
            then substring(member.grade_level from '[0-9]+')::integer not in (11, 12)
          else true
        end
    )
    and (
      public.is_admin_panel_user()
      or not exists (
        select 1
        from public.events event
        join public.equipment item on item.id = p_equipment_id
        where item.category in ('Camera', 'Recording Cameras')
          and (event.category in ('Livestream', 'Event') or event.is_festival)
          and tstzrange(
                event.date,
                coalesce(event.ends_at, (date_trunc('day', event.date at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin'),
                '[)'
              )
              && tstzrange(p_starts_at, p_ends_at, '[)')
          and not exists (
            select 1 from public.signups signup
            where signup.event_id = event.id
              and signup.member_id = p_member_id
              and signup.signup_role = 'Photographer'
              and signup.attendance_start <= p_starts_at
              and signup.attendance_end >= p_ends_at
          )
      )
    );
$$;

create or replace function public.set_equipment_operational_status(
  p_equipment_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_equipment_status() then
    raise exception 'Equipment Status access is required.';
  end if;

  if p_status not in ('available', 'unavailable') then
    raise exception 'Unsupported equipment status.';
  end if;

  update public.equipment item
  set status = p_status
  where item.id = p_equipment_id
    and not exists (
      select 1 from public.equipment_reservations reservation
      where reservation.equipment_id = item.id
        and reservation.reservation_status = 'checked_out'
    );

  return found;
end;
$$;

revoke all on function public.set_equipment_operational_status(uuid, text) from public;
grant execute on function public.set_equipment_operational_status(uuid, text) to authenticated;

create or replace function public.mark_equipment_reservation_returned(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_equipment_id uuid;
  returning_member_name text;
begin
  if not public.can_access_equipment_status() then
    raise exception 'Equipment Status access is required.';
  end if;

  select member.name into returning_member_name
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  returning_member_name := coalesce(returning_member_name, auth.jwt() ->> 'email', 'Auth Admin');

  update public.equipment_reservations
  set reservation_status = 'returned',
      returned_at = now(),
      returned_by = auth.uid(),
      returned_by_name = returning_member_name
  where id = p_reservation_id
    and (
      reservation_status = 'checked_out'
      or reservation_status = 'auto_released'
      or (reservation_status = 'scheduled' and starts_at <= now())
    )
  returning equipment_id into affected_equipment_id;

  if affected_equipment_id is null then
    return false;
  end if;

  update public.equipment
  set status = 'available'
  where id = affected_equipment_id
    and status = 'checked_out'
    and not exists (
      select 1 from public.equipment_reservations reservation
      where reservation.equipment_id = affected_equipment_id
        and reservation.reservation_status = 'checked_out'
    );

  return true;
end;
$$;

revoke all on function public.mark_equipment_reservation_returned(uuid) from public;
grant execute on function public.mark_equipment_reservation_returned(uuid) to authenticated;

create or replace function public.mark_signup_attendance(
  p_signup_id uuid,
  p_attendance_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  event_starts_at timestamptz;
  marker_name text;
begin
  if not public.is_crew_schedule_user() then
    raise exception 'Auth Admin access is required.';
  end if;
  if p_attendance_status not in ('not_taken', 'present', 'late', 'absent', 'excused') then
    raise exception 'Invalid attendance status.';
  end if;

  select event.date into event_starts_at
  from public.signups signup
  join public.events event on event.id = signup.event_id
  where signup.id = p_signup_id;

  if event_starts_at is null then
    return false;
  end if;
  if now() < event_starts_at - interval '10 minutes' then
    raise exception 'Attendance opens 10 minutes before the event starts.';
  end if;

  select member.name into marker_name
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
  marker_name := coalesce(marker_name, auth.jwt() ->> 'email', 'Auth Admin');

  update public.signups
  set attendance_status = p_attendance_status,
      attendance_marked_at = case when p_attendance_status = 'not_taken' then null else now() end,
      attendance_marked_by = case when p_attendance_status = 'not_taken' then null else auth.uid() end,
      attendance_marked_by_name = case when p_attendance_status = 'not_taken' then null else marker_name end
  where id = p_signup_id;

  return found;
end;
$$;

revoke all on function public.mark_signup_attendance(uuid, text) from public;
grant execute on function public.mark_signup_attendance(uuid, text) to authenticated;

create policy "Signed-in users can read members"
on public.members for select
to authenticated
using (public.is_approved_member());

create policy "Approved members can read team memberships"
on public.member_team_memberships for select
to authenticated
using (public.is_approved_member());

create policy "Auth Admins can manage team memberships"
on public.member_team_memberships for all
to authenticated
using (public.is_auth_admin())
with check (public.is_auth_admin());

create policy "Auth Admins can add members"
on public.members for insert
to authenticated
with check (
  public.is_auth_admin()
  and (
    public.is_fis_alias_email(email)
    or (replace(lower(role), ' ', '-') = 'faculty' and public.is_fis_school_email(email))
  )
);

create policy "Admins can update members"
on public.members for update
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Admins can delete members"
on public.members for delete
to authenticated
using (public.is_admin_panel_user());

create policy "Signed-in users can read events"
on public.events for select
to authenticated
using (
  not public.is_visitor_session()
  and (archived_at is null or public.is_crew_operations_user())
);

create policy "Admins can update events"
on public.events for update
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Production staff can add events"
on public.events for insert
to authenticated
with check (public.is_crew_operations_user());

create policy "Approved members can read meetings"
on public.meetings for select
to authenticated
using (public.can_read_meeting(id));

create policy "Approved members can read meeting attendees"
on public.meeting_attendees for select
to authenticated
using (public.can_read_meeting(meeting_id));

create policy "Members can add own meeting RSVP"
on public.meeting_attendees for insert
to authenticated
with check (
  member_id = public.current_member_id()
  and public.can_rsvp_meeting(meeting_id)
  and exists (
    select 1 from public.meetings meeting
    where meeting.id = meeting_attendees.meeting_id
      and meeting.archived_at is null
      and meeting.ends_at > now()
  )
);

create policy "Members can update own meeting RSVP"
on public.meeting_attendees for update
to authenticated
using (
  member_id = public.current_member_id()
  and public.can_rsvp_meeting(meeting_id)
)
with check (
  member_id = public.current_member_id()
  and public.can_rsvp_meeting(meeting_id)
  and exists (
    select 1 from public.meetings meeting
    where meeting.id = meeting_attendees.meeting_id
      and meeting.archived_at is null
      and meeting.ends_at > now()
  )
);

create policy "Members can remove own meeting RSVP"
on public.meeting_attendees for delete
to authenticated
using (
  member_id = public.current_member_id()
  and public.can_rsvp_meeting(meeting_id)
  and exists (
    select 1 from public.meetings meeting
    where meeting.id = meeting_attendees.meeting_id
      and meeting.archived_at is null
      and meeting.ends_at > now()
  )
);

create policy "Signed-in users can read signups"
on public.signups for select
to authenticated
using (public.is_approved_member());

create policy "Signed-in users can add signups"
on public.signups for insert
to authenticated
with check (
  not public.is_visitor_session()
  and attendance_start is not null
  and attendance_end is not null
  and attendance_end > attendance_start
  and attendance_status = 'not_taken'
  and attendance_marked_at is null
  and attendance_marked_by is null
  and attendance_marked_by_name is null
  and confirmation_status in ('confirmed', 'maybe')
  and public.is_valid_event_signup(event_id, signup_role, attendance_type, attendance_start, attendance_end)
  and (signup_role <> 'Student Supervisor' or public.is_crew_operations_user())
  and (
    (equipment_source = 'club' and own_camera_name is null)
    or (
      equipment_source = 'own'
      and signup_role = 'Photographer'
      and exists (
        select 1
        from public.members camera_owner
        where camera_owner.id = signups.member_id
          and btrim(coalesce(camera_owner.personal_equipment_preferences ->> 'camera_name', '')) = own_camera_name
      )
    )
  )
  and (
    (
      signup_role = 'Student Supervisor'
      and reserve_role_1 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
      and reserve_role_2 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
      and reserve_role_1 <> reserve_role_2
    )
    or (signup_role <> 'Student Supervisor' and reserve_role_1 is null and reserve_role_2 is null)
    or (signup_role is null and reserve_role_1 is null and reserve_role_2 is null)
  )
  and (
    public.is_admin_panel_user()
    or exists (
      select 1
      from public.members member
      where member.id = signups.member_id
        and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

create policy "Users can delete own signups and Auth Admins any"
on public.signups for delete
to authenticated
using (
  public.is_auth_admin()
  or exists (
    select 1
    from public.members member
    where member.id = signups.member_id
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Members can read own notifications"
on public.notifications for select
to authenticated
using (
  exists (
    select 1 from public.members member
    where member.id = notifications.member_id
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Signed-in users can read equipment"
on public.equipment for select
to authenticated
using (
  not public.is_visitor_session()
  and (archived_at is null or public.is_crew_operations_user())
);

create policy "Production staff can add equipment"
on public.equipment for insert
to authenticated
with check (public.is_crew_operations_user());

create policy "Production staff can update equipment"
on public.equipment for update
to authenticated
using (public.is_crew_operations_user())
with check (public.is_crew_operations_user());

create policy "Signed-in users can read equipment reservations"
on public.equipment_reservations for select
to authenticated
using (public.is_approved_member());

create policy "Signed-in members can reserve equipment"
on public.equipment_reservations for insert
to authenticated
with check (
  public.can_create_equipment_reservation(
    equipment_id, member_id, event_id, reservation_type, starts_at, ends_at
  )
  and (reservation_type <> 'non_event' or nullif(btrim(purpose), '') is not null)
  and reservation_status = 'scheduled'
  and checked_out_at is null
  and returned_at is null
  and returned_by is null
  and returned_by_name is null
  and auto_released_at is null
);

create policy "Users can cancel equipment reservations"
on public.equipment_reservations for delete
to authenticated
using (
  reservation_status = 'scheduled'
  and starts_at > now()
  and (
    public.is_auth_admin()
    or exists (
      select 1 from public.members member
      where member.id = equipment_reservations.member_id
        and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

create policy "Signed-in users can read gallery"
on public.gallery for select
to authenticated
using (not public.is_visitor_session());

create policy "Signed-in members can submit gallery projects"
on public.gallery for insert
to authenticated
with check (
  not public.is_visitor_session()
  and coalesce(nullif(btrim(image_url), ''), nullif(btrim(project_url), ''), '') <> ''
  and exists (
    select 1
    from public.members member
    where member.id = gallery.member_id
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Admins can update gallery"
on public.gallery for update
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Admins can delete gallery"
on public.gallery for delete
to authenticated
using (
  lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
  or exists (
    select 1
    from public.members member
    where member.id = gallery.member_id
      and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Signed-in users can read announcements"
on public.announcements for select
to authenticated
using (not public.is_visitor_session());

create policy "Admins can manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Signed-in users can submit join applications"
on public.join_applications for insert
to authenticated
with check (public.is_fis_alias_email(email));

create policy "Admins can read join applications"
on public.join_applications for select
to authenticated
using (public.is_admin_panel_user());

create policy "Admins can manage join applications"
on public.join_applications for update
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

do $$
begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.member_team_memberships;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meetings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_attendees;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.signups;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.gallery;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.equipment;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.equipment_reservations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.join_applications;
exception when duplicate_object then null;
end $$;
