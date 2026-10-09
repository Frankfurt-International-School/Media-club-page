alter table public.members enable row level security;
alter table public.user_legal_agreements enable row level security;
revoke all on table public.user_legal_agreements from anon, authenticated;
grant select on table public.user_legal_agreements to authenticated;
grant insert (auth_user_id, terms_version, privacy_version) on table public.user_legal_agreements to authenticated;
drop policy if exists "Members can read own legal agreements" on public.user_legal_agreements;
drop policy if exists "Members can record own legal agreements" on public.user_legal_agreements;
create policy "Members can read own legal agreements"
on public.user_legal_agreements for select
to authenticated
using ((select auth.uid()) = auth_user_id);
create policy "Members can record own legal agreements"
on public.user_legal_agreements for insert
to authenticated
with check ((select auth.uid()) = auth_user_id);
alter table public.member_team_memberships enable row level security;
alter table public.sac_membership_audit enable row level security;
alter table public.cas_attendance_settings enable row level security;
alter table public.events enable row level security;
alter table public.sac_events enable row level security;
alter table public.sac_meetings enable row level security;
alter table public.sac_slot_signups enable row level security;
alter table public.sac_attendance enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_reservations enable row level security;
alter table public.gallery enable row level security;
alter table public.announcements enable row level security;

-- Remove the 12 unrestricted legacy policies observed in the baseline.
-- Permissive policies combine with OR: these bypass the newer member/staff checks.
-- Approved member policies and curated public-portal RPCs stay in place.
drop policy if exists "Public read access" on public.equipment;
drop policy if exists "public read equipment" on public.equipment;
drop policy if exists "Public read access" on public.events;
drop policy if exists "public read events" on public.events;
drop policy if exists "Public read access" on public.gallery;
drop policy if exists "public read gallery" on public.gallery;
drop policy if exists "Public read access" on public.members;
drop policy if exists "public read members" on public.members;
drop policy if exists "Public can sign up for events" on public.signups;
drop policy if exists "Public read access" on public.signups;
drop policy if exists "public create signups" on public.signups;
drop policy if exists "public read signups" on public.signups;
alter table public.join_applications enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read members" on public.members;
drop policy if exists "Authenticated users can add members" on public.members;
drop policy if exists "Admins can manage members" on public.members;
drop policy if exists "Approved members can read team memberships" on public.member_team_memberships;
drop policy if exists "Admin Panel users can manage team memberships" on public.member_team_memberships;
drop policy if exists "Auth Admins can manage team memberships" on public.member_team_memberships;
drop policy if exists "Admin Panel users can add CAS memberships" on public.member_team_memberships;
drop policy if exists "Admin Panel users can remove CAS memberships" on public.member_team_memberships;
drop policy if exists "SAC managers can read membership audit" on public.sac_membership_audit;
drop policy if exists "Admin Panel users can read CAS attendance settings" on public.cas_attendance_settings;
drop policy if exists "Admin Panel users can add CAS attendance settings" on public.cas_attendance_settings;
drop policy if exists "Admin Panel users can update CAS attendance settings" on public.cas_attendance_settings;
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
drop policy if exists "Production staff can update events" on public.events;
drop policy if exists "Production staff can add events" on public.events;
drop policy if exists "Production staff can delete events" on public.events;
drop policy if exists "Eligible members can read SAC events" on public.sac_events;
drop policy if exists "SAC event creators can add events" on public.sac_events;
drop policy if exists "SAC event creators can edit events" on public.sac_events;
drop policy if exists "SAC members can read slot signups" on public.sac_slot_signups;
drop policy if exists "Eligible members can read SAC meetings" on public.sac_meetings;
drop policy if exists "SAC leaders can add meetings" on public.sac_meetings;
drop policy if exists "SAC leaders can edit meetings" on public.sac_meetings;
drop policy if exists "SAC attendance managers can read marks" on public.sac_attendance;
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
drop policy if exists "Authorized reviewers can read join applications" on public.join_applications;
drop policy if exists "Authorized reviewers can update join applications" on public.join_applications;
revoke insert on table public.join_applications from anon, authenticated;
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

create or replace function public.is_faculty()
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
      and replace(lower(member.role), ' ', '-') = 'faculty'
  );
$$;

revoke all on function public.is_faculty() from public;

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
      join public.member_team_memberships membership
        on membership.member_id = member.id and membership.team_key = 'media_club'
      where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and replace(lower(member.role), ' ', '-') in ('leader', 'co-leader', 'moderator')
    );
$$;

create or replace function public.is_athletics_gallery_custodian()
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
      join public.member_team_memberships membership
        on membership.member_id = member.id and membership.team_key = 'media_club'
      where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and replace(lower(member.role), ' ', '-') = 'leader'
    );
$$;

revoke all on function public.is_athletics_gallery_custodian() from public;
grant execute on function public.is_athletics_gallery_custodian() to authenticated;

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
    join public.member_team_memberships membership
      on membership.member_id = member.id and membership.team_key = 'media_club'
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

create or replace function public.can_access_media_club()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_auth_admin()
    or (
      public.is_approved_member()
      and exists (
        select 1 from public.member_team_memberships membership
        where membership.member_id = public.current_member_id()
          and membership.team_key = 'media_club'
      )
    );
$$;

create or replace function public.current_sac_title()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select membership.team_role
  from public.member_team_memberships membership
  where membership.member_id = public.current_member_id()
    and membership.team_key = 'sac'
  limit 1;
$$;

create or replace function public.can_manage_sac_memberships()
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
      or coalesce(public.current_sac_title(), '') in ('president', 'vice_president')
    );
$$;

create or replace function public.can_review_sac_applications()
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
      or coalesce(public.current_sac_title(), '') = 'president'
    );
$$;

create or replace function public.can_create_sac_events()
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
      or coalesce(public.current_sac_title(), '') in ('president', 'vice_president', 'attendance_manager', 'club_manager')
    );
$$;

create or replace function public.can_view_sac_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_member()
    and (
      public.is_auth_admin()
      or exists (
        select 1
        from public.members member
        where member.id = public.current_member_id()
          and (
            replace(lower(member.role), ' ', '-') = 'faculty'
            or member.grade_level ~* '(^|[^0-9])(9|10|11|12)([^0-9]|$)'
            or exists (
              select 1 from public.member_team_memberships membership
              where membership.member_id = member.id and membership.team_key = 'sac'
            )
          )
      )
    );
$$;

create or replace function public.sac_event_link_is_valid(
  p_media_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_media_event_id is null
    or (
      public.can_create_sac_events()
      and exists (
        select 1 from public.events media_event
        where media_event.id = p_media_event_id
          and media_event.category = 'Livestream'
          and media_event.archived_at is null
          and media_event.date = p_starts_at
          and media_event.ends_at = p_ends_at
      )
    );
$$;

create or replace function public.get_sac_linkable_livestreams()
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, location text)
language sql
stable
security definer
set search_path = public
as $$
  select event.id, event.title, event.date, event.ends_at, event.location
  from public.events event
  where public.can_create_sac_events()
    and event.category = 'Livestream'
    and event.archived_at is null
  order by event.date desc;
$$;

create or replace function public.set_sac_membership(
  p_member_id uuid,
  p_enabled boolean,
  p_title text default null,
  p_override_grade boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_grade text;
  normalized_title text;
  grade_is_eligible boolean;
begin
  if not public.can_manage_sac_memberships() then
    raise exception 'SAC President, SAC Vice President, or Auth Admin access is required.';
  end if;

  normalized_title := nullif(regexp_replace(lower(btrim(coalesce(p_title, ''))), '[[:space:]-]+', '_', 'g'), '');
  if normalized_title is not null and normalized_title not in ('president', 'vice_president', 'media_manager', 'attendance_manager', 'club_manager') then
    raise exception 'Invalid SAC title.';
  end if;

  select member.grade_level into target_grade
  from public.members member
  where member.id = p_member_id
  for update;

  if not found then
    raise exception 'Member not found.';
  end if;

  if not coalesce(p_enabled, false) then
    delete from public.member_team_memberships membership
    where membership.member_id = p_member_id
      and membership.team_key = 'sac';
    return found;
  end if;

  grade_is_eligible := lower(btrim(coalesce(target_grade, ''))) in ('grade 9', 'grade 10', 'grade 11', 'grade 12');
  if not grade_is_eligible and not (public.is_auth_admin() and coalesce(p_override_grade, false)) then
    raise exception 'SAC membership is limited to Grade 9–12. An Auth Admin may explicitly override this rule.';
  end if;
  if coalesce(p_override_grade, false) and not public.is_auth_admin() then
    raise exception 'Only an Auth Admin may override the SAC grade requirement.';
  end if;

  insert into public.member_team_memberships (member_id, team_key, team_role, updated_at)
  values (p_member_id, 'sac', normalized_title, now())
  on conflict (member_id, team_key) do update
  set team_role = excluded.team_role,
      updated_at = now();

  return true;
end;
$$;

create or replace function public.get_sac_membership_audit(p_member_id uuid)
returns table (
  action text,
  previous_title text,
  new_title text,
  changed_by_name text,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_sac_memberships() then
    raise exception 'SAC membership management access is required.';
  end if;

  return query
  select audit.action, audit.previous_title, audit.new_title, audit.changed_by_name, audit.changed_at
  from public.sac_membership_audit audit
  where audit.member_id = p_member_id
  order by audit.changed_at desc
  limit 30;
end;
$$;

create or replace function public.can_use_personal_camera(p_member_id uuid, p_camera_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    p_member_id = public.current_member_id()
    or public.is_admin_panel_user()
  )
  and nullif(btrim(p_camera_name), '') is not null
  and exists (
    select 1
    from public.members member
    where member.id = p_member_id
      and btrim(coalesce(member.personal_equipment_preferences ->> 'camera_name', '')) = btrim(p_camera_name)
  );
$$;

create or replace function public.is_member_of_team(p_team_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.member_team_memberships membership
      where membership.member_id = public.current_member_id()
        and membership.team_key = p_team_key
    )
    or (
      p_team_key = 'athletics'
      and exists (
        select 1
        from public.members member
        where member.id = public.current_member_id()
          and lower(coalesce(member.status, '')) ~ '(^|[[:space:]]*,[[:space:]])(athletics|athletics[[:space:]]+department)([[:space:]]*,|$)'
      )
    );
$$;

create or replace function public.can_read_sac_slot_signups()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_member()
    and (public.is_auth_admin() or public.is_member_of_team('sac'));
$$;

-- All booking writes pass through this function. Locking the event serializes
-- competing claims, and the table's exclusion constraint protects a member
-- against overlapping bookings in different SAC events.
create or replace function public.claim_sac_scoreboard_slot(
  p_event_id uuid,
  p_slot_start timestamptz,
  p_member_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.sac_events%rowtype;
  target_member public.members%rowtype;
  target_member_id uuid;
  actor_member_id uuid;
  slot_index integer;
  slot_end_time timestamptz;
  candidate_spot integer;
  saved_id uuid;
begin
  if not public.is_approved_member() then
    raise exception 'An approved Crew Center account is required.';
  end if;

  actor_member_id := public.current_member_id();
  target_member_id := coalesce(p_member_id, actor_member_id);
  if target_member_id is null then
    raise exception 'Choose an SAC member.';
  end if;
  if not public.is_auth_admin()
    and (not public.is_member_of_team('sac') or target_member_id <> actor_member_id) then
    raise exception 'Only Auth Admin can assign another SAC member.';
  end if;

  select member.* into target_member
  from public.members member
  join public.member_team_memberships membership
    on membership.member_id = member.id and membership.team_key = 'sac'
  where member.id = target_member_id;
  if not found then
    raise exception 'Only a current SAC-tagged member can claim a spot.';
  end if;

  select sac_event.* into target_event
  from public.sac_events sac_event
  where sac_event.id = p_event_id
  for update;
  if not found then
    raise exception 'SAC event not found.';
  end if;
  if p_slot_start is null or p_slot_start < target_event.starts_at or p_slot_start >= target_event.ends_at then
    raise exception 'Choose a current SAC event time slot.';
  end if;

  slot_index := floor(extract(epoch from (p_slot_start - target_event.starts_at))
    / (target_event.slot_interval_minutes * 60))::integer;
  if p_slot_start <> target_event.starts_at
      + make_interval(mins => slot_index * target_event.slot_interval_minutes) then
    raise exception 'Choose a generated SAC time slot.';
  end if;
  slot_end_time := least(
    p_slot_start + make_interval(mins => target_event.slot_interval_minutes),
    target_event.ends_at
  );
  if slot_end_time <= now() then
    raise exception 'This SAC time slot has already ended.';
  end if;
  if exists (
    select 1 from public.sac_slot_signups signup
    where signup.member_id = target_member_id
      and signup.cancelled_at is null
      and tstzrange(signup.slot_start, signup.slot_end, '[)')
        && tstzrange(p_slot_start, slot_end_time, '[)')
  ) then
    raise exception 'This member already has an overlapping SAC spot.';
  end if;

  for candidate_spot in 1..target_event.scoreboard_spots loop
    if not exists (
      select 1 from public.sac_slot_signups signup
      where signup.event_id = p_event_id
        and signup.slot_start = p_slot_start
        and signup.spot_number = candidate_spot
        and signup.cancelled_at is null
    ) then
      insert into public.sac_slot_signups (
        event_id, member_id, member_name_snapshot, slot_start, slot_end,
        spot_number, created_by_auth_user_id
      ) values (
        p_event_id, target_member_id, target_member.name, p_slot_start,
        slot_end_time, candidate_spot, auth.uid()
      ) returning id into saved_id;
      return saved_id;
    end if;
  end loop;
  raise exception 'This Scoreboard time slot is full.';
end;
$$;

create or replace function public.cancel_sac_scoreboard_slot(p_signup_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_signup public.sac_slot_signups%rowtype;
begin
  if not public.is_approved_member() then
    raise exception 'An approved Crew Center account is required.';
  end if;

  select signup.* into target_signup
  from public.sac_slot_signups signup
  where signup.id = p_signup_id
  for update;
  if not found then raise exception 'SAC signup not found.'; end if;
  if target_signup.cancelled_at is not null then return false; end if;
  if not public.is_auth_admin()
    and (not public.is_member_of_team('sac')
      or target_signup.member_id is distinct from public.current_member_id()) then
    raise exception 'You may cancel only your own SAC spot.';
  end if;

  update public.sac_slot_signups
  set cancelled_at = now(), cancelled_by_auth_user_id = auth.uid()
  where id = p_signup_id;
  return true;
end;
$$;

-- Only designated leaders see an attendance roll. Event rows come from active
-- Scoreboard bookings; meeting rows come from current SAC membership.
create or replace function public.get_sac_attendance_roll(p_kind text, p_item_id uuid)
returns table (member_id uuid, member_name text, attendance_status text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_create_sac_events() then
    raise exception 'SAC attendance management access is required.';
  end if;
  if p_kind = 'event' then
    if not exists (select 1 from public.sac_events where id = p_item_id) then
      raise exception 'SAC event not found.';
    end if;
    return query
      select booked.member_id, booked.member_name,
        mark.status
      from (
        select signup.member_id, max(coalesce(member.name, signup.member_name_snapshot)) as member_name
        from public.sac_slot_signups signup
        left join public.members member on member.id = signup.member_id
        where signup.event_id = p_item_id and signup.cancelled_at is null
          and signup.member_id is not null
        group by signup.member_id
      ) booked
      left join public.sac_attendance mark
        on mark.event_id = p_item_id and mark.member_id = booked.member_id
      order by booked.member_name;
  elsif p_kind = 'meeting' then
    if not exists (select 1 from public.sac_meetings where id = p_item_id) then
      raise exception 'SAC meeting not found.';
    end if;
    return query
      select member.id, member.name, mark.status
      from public.member_team_memberships membership
      join public.members member on member.id = membership.member_id
      left join public.sac_attendance mark
        on mark.meeting_id = p_item_id and mark.member_id = member.id
      where membership.team_key = 'sac'
      order by member.name;
  else
    raise exception 'Choose a SAC event or meeting.';
  end if;
end;
$$;

create or replace function public.mark_sac_attendance(
  p_kind text, p_item_id uuid, p_member_id uuid, p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
begin
  if not public.can_create_sac_events() then
    raise exception 'SAC attendance management access is required.';
  end if;
  if p_status not in ('present', 'late', 'absent', 'excused') or p_status is null then
    raise exception 'Choose Present, Late, Absent, or Excused.';
  end if;
  if p_kind = 'event' then
    if not exists (select 1 from public.sac_events where id = p_item_id) then
      raise exception 'SAC event not found.';
    end if;
    perform 1 from public.sac_slot_signups signup
    where signup.event_id = p_item_id and signup.member_id = p_member_id
      and signup.cancelled_at is null
    limit 1 for share;
    if not found then raise exception 'Only active Scoreboard bookings appear on this event roll.'; end if;
    select member.name into target_name from public.members member where member.id = p_member_id;
    if target_name is null then raise exception 'SAC member not found.'; end if;
    insert into public.sac_attendance (event_id, member_id, member_name_snapshot, status, marked_by_auth_user_id)
    values (p_item_id, p_member_id, target_name, p_status, auth.uid())
    on conflict on constraint sac_attendance_event_member_key do update
      set status = excluded.status, member_name_snapshot = excluded.member_name_snapshot,
        marked_at = now(), marked_by_auth_user_id = auth.uid();
  elsif p_kind = 'meeting' then
    if not exists (select 1 from public.sac_meetings where id = p_item_id) then
      raise exception 'SAC meeting not found.';
    end if;
    select member.name into target_name
    from public.members member
    join public.member_team_memberships membership
      on membership.member_id = member.id and membership.team_key = 'sac'
    where member.id = p_member_id
    for share of membership;
    if target_name is null then raise exception 'Only current SAC members appear on this meeting roll.'; end if;
    insert into public.sac_attendance (meeting_id, member_id, member_name_snapshot, status, marked_by_auth_user_id)
    values (p_item_id, p_member_id, target_name, p_status, auth.uid())
    on conflict on constraint sac_attendance_meeting_member_key do update
      set status = excluded.status, member_name_snapshot = excluded.member_name_snapshot,
        marked_at = now(), marked_by_auth_user_id = auth.uid();
  else
    raise exception 'Choose a SAC event or meeting.';
  end if;
  return true;
end;
$$;

revoke all on function public.can_read_sac_slot_signups() from public, anon, authenticated;
revoke all on function public.claim_sac_scoreboard_slot(uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.cancel_sac_scoreboard_slot(uuid) from public, anon, authenticated;
revoke all on function public.get_sac_attendance_roll(text, uuid) from public, anon, authenticated;
revoke all on function public.mark_sac_attendance(text, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.can_read_meeting(p_meeting_id uuid)
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
  if not public.can_access_media_club() then return false; end if;

  select meeting.audience, meeting.archived_at
  into target_audience, target_archived_at
  from public.meetings meeting
  where meeting.id = p_meeting_id;

  if not found then return false; end if;
  if target_archived_at is not null and not public.is_crew_operations_user() then return false; end if;
  if target_audience = 'general' then return true; end if;
  if target_audience = 'news_team' then return public.is_member_of_team('news_team'); end if;
  return target_audience = 'leadership' and public.is_crew_operations_user();
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
  if not public.can_access_media_club() then return false; end if;

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
revoke all on function public.can_access_media_club() from public;
revoke all on function public.current_sac_title() from public;
revoke all on function public.can_manage_sac_memberships() from public;
revoke all on function public.can_review_sac_applications() from public;
revoke all on function public.can_create_sac_events() from public;
revoke all on function public.can_view_sac_events() from public;
revoke all on function public.sac_event_link_is_valid(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_sac_linkable_livestreams() from public;
revoke all on function public.set_sac_membership(uuid, boolean, text, boolean) from public;
revoke all on function public.get_sac_membership_audit(uuid) from public;
revoke all on function public.can_use_personal_camera(uuid, text) from public;
revoke all on function public.is_member_of_team(text) from public;
revoke all on function public.can_read_meeting(uuid) from public;
revoke all on function public.can_rsvp_meeting(uuid) from public;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.can_access_media_club() to authenticated;
grant execute on function public.current_sac_title() to authenticated;
grant execute on function public.can_manage_sac_memberships() to authenticated;
grant execute on function public.can_review_sac_applications() to authenticated;
grant execute on function public.can_create_sac_events() to authenticated;
grant execute on function public.can_view_sac_events() to authenticated;
grant execute on function public.sac_event_link_is_valid(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_sac_linkable_livestreams() to authenticated;
grant execute on function public.set_sac_membership(uuid, boolean, text, boolean) to authenticated;
grant execute on function public.get_sac_membership_audit(uuid) to authenticated;
grant execute on function public.can_use_personal_camera(uuid, text) to authenticated;
grant execute on function public.is_member_of_team(text) to authenticated;
grant execute on function public.can_read_sac_slot_signups() to authenticated;
grant execute on function public.get_sac_attendance_roll(text, uuid) to authenticated;
grant execute on function public.mark_sac_attendance(text, uuid, uuid, text) to authenticated;
grant execute on function public.claim_sac_scoreboard_slot(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.cancel_sac_scoreboard_slot(uuid) to authenticated;
grant execute on function public.can_read_meeting(uuid) to authenticated;
grant execute on function public.can_rsvp_meeting(uuid) to authenticated;

drop function if exists public.get_member_directory();

create or replace function public.get_member_directory()
returns table (
  id uuid,
  name text,
  role text,
  email text,
  grade_level text,
  status text,
  joined_date date,
  avatar_url text,
  avatar_path text,
  sidebar_customized boolean,
  sidebar_items text[],
  notification_preferences jsonb,
  dashboard_preferences jsonb,
  tutorial_progress jsonb,
  personal_equipment_preferences jsonb,
  equipment_status_access boolean,
  team_keys text[],
  sac_title text,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    member.id,
    member.name,
    member.role,
    case when public.is_admin_panel_user() then member.email else null end,
    member.grade_level,
    member.status,
    member.joined_date,
    member.avatar_url,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.avatar_path else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.sidebar_customized else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.sidebar_items else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.notification_preferences else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.dashboard_preferences else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.tutorial_progress else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.personal_equipment_preferences else null end,
    case when lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')) then member.equipment_status_access else null end,
    coalesce((
      select array_agg(membership.team_key order by membership.team_key)
      from public.member_team_memberships membership
      where membership.member_id = member.id
    ), array[]::text[]),
    (
      select membership.team_role
      from public.member_team_memberships membership
      where membership.member_id = member.id
        and membership.team_key = 'sac'
      limit 1
    ),
    lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  from public.members member
  where public.is_approved_member()
  order by member.name;
$$;

create or replace function public.get_own_member_id()
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

create or replace function public.get_own_tutorial_progress()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select member.tutorial_progress
  from public.members member
  where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function public.get_member_directory() from public;
revoke all on function public.get_own_member_id() from public;
revoke all on function public.get_own_tutorial_progress() from public;
grant execute on function public.get_member_directory() to authenticated;
grant execute on function public.get_own_member_id() to authenticated;
grant execute on function public.get_own_tutorial_progress() to authenticated;

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
  where project.project_scope = 'showcase'
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
    where item = any(array['about','home','events','meetings','signup','my-crew-schedule','members','gallery','equipment','role-guide','crew-deployment','equipment-status','join','admin']::text[])
    group by item
  ) normalized;

  if coalesce(p_customized, false) and (
    not (clean_items && array['home','events','meetings','signup','my-crew-schedule','members']::text[])
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
    'maybe_reminders', coalesce((p_preferences ->> 'maybe_reminders')::boolean, true),
    'email_event_updates', coalesce((p_preferences ->> 'email_event_updates')::boolean, false),
    'email_meeting_updates', coalesce((p_preferences ->> 'email_meeting_updates')::boolean, false)
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
    'full','home','events','meetings','signup','my-crew-schedule','members','gallery','equipment','role-guide',
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
  if not public.can_access_media_club() then return false; end if;
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
      and (p_signup_role is null or p_signup_role = any(event.open_signup_roles))
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

create or replace function public.are_event_reserve_roles_open(
  p_event_id uuid,
  p_signup_role text,
  p_reserve_role_1 text,
  p_reserve_role_2 text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_signup_role = 'Student Supervisor' then exists (
      select 1
      from public.events event
      where event.id = p_event_id
        and p_reserve_role_1 = any(event.open_signup_roles)
        and p_reserve_role_2 = any(event.open_signup_roles)
    )
    when p_signup_role = 'MIXING' and (p_reserve_role_1 is not null or p_reserve_role_2 is not null) then exists (
      select 1
      from public.events event
      where event.id = p_event_id
        and (event.is_sports or event.is_isst)
        and (
          lower(btrim(coalesce(event.location, ''))) like '%lower field%'
          or lower(btrim(coalesce(event.location, ''))) like '%upper field%'
        )
        and 'MIXING' = any(event.open_signup_roles)
        and 'OBS' = any(event.open_signup_roles)
        and p_reserve_role_1 = 'OBS'
        and p_reserve_role_2 is null
    )
    else p_reserve_role_1 is null and p_reserve_role_2 is null
  end;
$$;

revoke all on function public.are_event_reserve_roles_open(uuid, text, text, text) from public;
grant execute on function public.are_event_reserve_roles_open(uuid, text, text, text) to authenticated;

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
  select public.can_access_media_club()
    and p_ends_at > p_starts_at
    and ((p_reservation_type = 'event' and p_event_id is not null) or (p_reservation_type = 'non_event' and p_event_id is null))
    and exists (
      select 1 from public.members member
      where member.id = p_member_id
        and lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and exists (
      select 1 from public.equipment item
      where item.id = p_equipment_id
        and item.status = 'available'
        and item.archived_at is null
        and item.category not in ('Camera', 'Recording Cameras', 'Lens')
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

create or replace function public.create_camera_kit_reservation(
  p_camera_id uuid,
  p_lens_id uuid,
  p_event_id uuid,
  p_reservation_type text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reserving_member_id uuid := public.current_member_id();
  camera_item public.equipment%rowtype;
  lens_item public.equipment%rowtype;
  target_event public.events%rowtype;
  kit_group_id uuid := gen_random_uuid();
  member_grade integer;
  result jsonb;
begin
  if not public.can_access_media_club() or reserving_member_id is null then
    raise exception 'Media Club membership is required.';
  end if;
  if p_ends_at is null or p_starts_at is null or p_ends_at <= p_starts_at then
    raise exception 'The reservation end time must be after its start time.';
  end if;
  if not (
    (p_reservation_type = 'event' and p_event_id is not null)
    or (p_reservation_type = 'non_event' and p_event_id is null and nullif(btrim(p_purpose), '') is not null)
  ) then
    raise exception 'Choose a valid event or provide a non-event purpose.';
  end if;

  if p_reservation_type = 'event' then
    select * into target_event
    from public.events event
    where event.id = p_event_id
      and event.archived_at is null;
    if not found then
      raise exception 'Choose a valid active event.';
    end if;
  end if;

  select * into camera_item
  from public.equipment item
  where item.id = p_camera_id
  for update;
  if not found or camera_item.category not in ('Camera', 'Recording Cameras') or camera_item.archived_at is not null then
    raise exception 'Choose an active camera body.';
  end if;
  if camera_item.status <> 'available' then
    raise exception 'This camera is currently unavailable.';
  end if;
  if camera_item.compatibility_group is null then
    raise exception 'This camera does not have a lens compatibility profile yet.';
  end if;

  if p_lens_id is null then
    if not public.is_faculty() then
      raise exception 'A compatible lens is required with every camera reservation.';
    end if;
  else
    select * into lens_item
    from public.equipment item
    where item.id = p_lens_id
    for update;
    if not found or lens_item.category <> 'Lens' or lens_item.archived_at is not null then
      raise exception 'Choose an active lens.';
    end if;
    if lens_item.status <> 'available' then
      raise exception 'This lens is currently unavailable.';
    end if;
    if lens_item.compatibility_group is distinct from camera_item.compatibility_group then
      raise exception 'That lens is not compatible with the selected camera.';
    end if;
  end if;

  if p_reservation_type = 'non_event' then
    select case
      when coalesce(member.grade_level, '') ~ '[0-9]+'
        then substring(member.grade_level from '[0-9]+')::integer
      else null
    end into member_grade
    from public.members member
    where member.id = reserving_member_id;
    if member_grade is null or member_grade not in (11, 12) then
      raise exception 'Only Grade 11 and Grade 12 members can borrow cameras outside an event.';
    end if;
  end if;

  if not public.is_admin_panel_user() then
    if p_reservation_type = 'event'
      and (target_event.category in ('Livestream', 'Event') or target_event.is_festival)
      and not exists (
        select 1 from public.signups signup
        where signup.event_id = p_event_id
          and signup.member_id = reserving_member_id
          and signup.signup_role = 'Photographer'
          and (
            signup.confirmation_status = 'confirmed'
            or (
              signup.confirmation_status = 'maybe'
              and (signup.confirmation_deadline is null or signup.confirmation_deadline > now())
            )
          )
          and signup.attendance_start <= p_starts_at
          and signup.attendance_end >= p_ends_at
      ) then
      raise exception 'Reserve only inside your Photographer signup time for the selected event.';
    elsif p_reservation_type = 'non_event' and exists (
      select 1
      from public.events event
      where (event.category in ('Livestream', 'Event') or event.is_festival)
        and tstzrange(
          event.date,
          coalesce(event.ends_at, (date_trunc('day', event.date at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin'),
          '[)'
        ) && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then
      raise exception 'This time overlaps an event. Choose that event and use your Photographer signup instead.';
    end if;
  end if;

  insert into public.equipment_reservations (
    reservation_group_id, equipment_id, member_id, event_id, reservation_type, purpose, starts_at, ends_at
  ) values (
    kit_group_id, camera_item.id, reserving_member_id, p_event_id, p_reservation_type, nullif(btrim(p_purpose), ''), p_starts_at, p_ends_at
  );

  if p_lens_id is not null then
    insert into public.equipment_reservations (
      reservation_group_id, equipment_id, member_id, event_id, reservation_type, purpose, starts_at, ends_at
    ) values (
      kit_group_id, lens_item.id, reserving_member_id, p_event_id, p_reservation_type, nullif(btrim(p_purpose), ''), p_starts_at, p_ends_at
    );
  end if;

  select jsonb_build_object(
    'group_id', kit_group_id,
    'reservations', jsonb_agg(jsonb_build_object(
      'id', reservation.id,
      'reservation_group_id', reservation.reservation_group_id,
      'equipment_id', reservation.equipment_id,
      'equipment_name', item.name,
      'member_id', reservation.member_id,
      'member_name', member.name,
      'event_id', reservation.event_id,
      'event_title', event.title,
      'reservation_type', reservation.reservation_type,
      'purpose', reservation.purpose,
      'starts_at', reservation.starts_at,
      'ends_at', reservation.ends_at,
      'reservation_status', reservation.reservation_status,
      'checked_out_at', reservation.checked_out_at,
      'returned_at', reservation.returned_at,
      'returned_by', reservation.returned_by,
      'returned_by_name', reservation.returned_by_name,
      'auto_released_at', reservation.auto_released_at
    ) order by case when item.category in ('Camera', 'Recording Cameras') then 0 else 1 end)
  ) into result
  from public.equipment_reservations reservation
  join public.equipment item on item.id = reservation.equipment_id
  join public.members member on member.id = reservation.member_id
  left join public.events event on event.id = reservation.event_id
  where reservation.reservation_group_id = kit_group_id;

  return result;
exception
  when exclusion_violation then
    raise exception 'The camera or lens is already reserved during that time.';
end;
$$;

revoke all on function public.create_camera_kit_reservation(uuid, uuid, uuid, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_camera_kit_reservation(uuid, uuid, uuid, text, text, timestamptz, timestamptz) to authenticated;

create or replace function public.cancel_equipment_reservation_group(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_reservation public.equipment_reservations%rowtype;
  deleted_count integer := 0;
begin
  if not public.can_access_media_club() then return false; end if;
  select * into target_reservation
  from public.equipment_reservations reservation
  where reservation.id = p_reservation_id;

  if not found
    or target_reservation.reservation_status <> 'scheduled'
    or target_reservation.starts_at <= now()
    or (not public.is_auth_admin() and target_reservation.member_id is distinct from public.current_member_id()) then
    return false;
  end if;

  delete from public.equipment_reservations reservation
  where reservation.reservation_status = 'scheduled'
    and reservation.starts_at > now()
    and (
      reservation.id = target_reservation.id
      or (
        target_reservation.reservation_group_id is not null
        and reservation.reservation_group_id = target_reservation.reservation_group_id
      )
    );
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.cancel_equipment_reservation_group(uuid) from public;
grant execute on function public.cancel_equipment_reservation_group(uuid) to authenticated;

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
  target_group_id uuid;
  affected_equipment_ids uuid[];
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

  select reservation.reservation_group_id into target_group_id
  from public.equipment_reservations reservation
  where reservation.id = p_reservation_id;

  with returned_reservations as (
    update public.equipment_reservations reservation
  set reservation_status = 'returned',
      returned_at = now(),
      returned_by = auth.uid(),
      returned_by_name = returning_member_name
    where (
        reservation.id = p_reservation_id
        or (target_group_id is not null and reservation.reservation_group_id = target_group_id)
      )
    and (
      reservation_status = 'checked_out'
      or reservation_status = 'auto_released'
      or (reservation_status = 'scheduled' and starts_at <= now())
    )
    returning equipment_id
  )
  select array_agg(equipment_id) into affected_equipment_ids from returned_reservations;

  if affected_equipment_ids is null then
    return false;
  end if;

  update public.equipment item
  set status = 'available'
  where item.id = any(affected_equipment_ids)
    and item.status = 'checked_out'
    and not exists (
      select 1 from public.equipment_reservations reservation
      where reservation.equipment_id = item.id
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
  event_ends_at timestamptz;
  marker_name text;
begin
  if not public.is_crew_schedule_user() then
    raise exception 'Auth Admin access is required.';
  end if;
  if p_attendance_status not in ('not_taken', 'present', 'late', 'absent', 'excused') then
    raise exception 'Invalid attendance status.';
  end if;

  select event.date, event.ends_at into event_starts_at, event_ends_at
  from public.signups signup
  join public.events event on event.id = signup.event_id
  where signup.id = p_signup_id;

  if event_starts_at is null then
    return false;
  end if;
  if now() < event_starts_at - interval '10 minutes' then
    raise exception 'Attendance opens 10 minutes before the event starts.';
  end if;
  if now() > event_ends_at + interval '120 hours' then
    raise exception 'Attendance closed 120 hours after the event ended.';
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

-- Direct table reads expose only columns needed by safe embedded relationships.
-- The member directory itself must use get_member_directory() so email access is
-- decided server-side for Auth Admin and Faculty accounts.
revoke select on table public.members from anon, authenticated;
grant select (id, name, role, grade_level, status, joined_date, avatar_url) on table public.members to authenticated;

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

create policy "Admin Panel users can add CAS memberships"
on public.member_team_memberships for insert
to authenticated
with check (team_key = 'cas' and public.is_admin_panel_user());

create policy "Admin Panel users can remove CAS memberships"
on public.member_team_memberships for delete
to authenticated
using (team_key = 'cas' and public.is_admin_panel_user());

revoke all on table public.sac_membership_audit from anon, authenticated;
grant select on table public.sac_membership_audit to authenticated;

create policy "SAC managers can read membership audit"
on public.sac_membership_audit for select
to authenticated
using ((select public.can_manage_sac_memberships()));

revoke all on table public.cas_attendance_settings from anon, authenticated;
grant select, insert, update on table public.cas_attendance_settings to authenticated;

create policy "Admin Panel users can read CAS attendance settings"
on public.cas_attendance_settings for select
to authenticated
using (public.is_admin_panel_user());

create policy "Admin Panel users can add CAS attendance settings"
on public.cas_attendance_settings for insert
to authenticated
with check (public.is_admin_panel_user());

create policy "Admin Panel users can update CAS attendance settings"
on public.cas_attendance_settings for update
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

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
  public.can_access_media_club()
  and (archived_at is null or public.is_crew_operations_user())
);

-- Event editors may change event details but cannot bypass the guarded archive
-- workflow by writing lifecycle columns such as archived_at directly.
revoke update on table public.events from anon, authenticated;
grant update (
  title,
  date,
  location,
  description,
  category,
  open_signup_roles,
  single_role_slot_limit,
  photographer_slot_limit,
  livestream_setup_date,
  is_sports,
  is_isst,
  game_1_start,
  game_1_end,
  game_2_start,
  game_2_end,
  game_3_start,
  game_3_end,
  game_4_start,
  game_4_end,
  is_festival,
  setup_start,
  setup_end,
  shift_1_start,
  shift_1_end,
  shift_2_start,
  shift_2_end,
  takedown_start,
  takedown_end,
  ends_at
) on table public.events to authenticated;

create policy "Production staff can update events"
on public.events for update
to authenticated
using (public.is_crew_operations_user())
with check (public.is_crew_operations_user());

create policy "Production staff can add events"
on public.events for insert
to authenticated
with check (public.is_crew_operations_user());

revoke all on table public.sac_events from anon, authenticated;
grant select, insert on table public.sac_events to authenticated;
grant update (title, description, location, starts_at, ends_at, linked_media_event_id, slot_interval_minutes, scoreboard_spots)
on table public.sac_events to authenticated;

create policy "Eligible members can read SAC events"
on public.sac_events for select
to authenticated
using ((select public.can_view_sac_events()));

create policy "SAC event creators can add events"
on public.sac_events for insert
to authenticated
with check (
  (select public.can_create_sac_events())
  and created_by_auth_user_id = (select auth.uid())
  and public.sac_event_link_is_valid(linked_media_event_id, starts_at, ends_at)
);

create policy "SAC event creators can edit events"
on public.sac_events for update
to authenticated
using ((select public.can_create_sac_events()))
with check (
  (select public.can_create_sac_events())
  and public.sac_event_link_is_valid(linked_media_event_id, starts_at, ends_at)
);

revoke all on table public.sac_meetings from anon, authenticated;
grant select, insert on table public.sac_meetings to authenticated;
grant update (title, description, location, starts_at, ends_at)
on table public.sac_meetings to authenticated;

create policy "Eligible members can read SAC meetings"
on public.sac_meetings for select
to authenticated
using ((select public.can_view_sac_events()));

create policy "SAC leaders can add meetings"
on public.sac_meetings for insert
to authenticated
with check (
  (select public.can_create_sac_events())
  and created_by_auth_user_id = (select auth.uid())
);

create policy "SAC leaders can edit meetings"
on public.sac_meetings for update
to authenticated
using ((select public.can_create_sac_events()))
with check ((select public.can_create_sac_events()));

revoke all on table public.sac_attendance from anon, authenticated;
grant select on table public.sac_attendance to authenticated;

create policy "SAC attendance managers can read marks"
on public.sac_attendance for select
to authenticated
using ((select public.can_create_sac_events()));

revoke all on table public.sac_slot_signups from anon, authenticated;
grant select on table public.sac_slot_signups to authenticated;

create policy "SAC members can read slot signups"
on public.sac_slot_signups for select
to authenticated
using ((select public.can_read_sac_slot_signups()));

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
using (public.can_access_media_club());

create policy "Signed-in users can add signups"
on public.signups for insert
to authenticated
with check (
  public.can_access_media_club()
  and attendance_start is not null
  and attendance_end is not null
  and attendance_end > attendance_start
  and attendance_status = 'not_taken'
  and attendance_marked_at is null
  and attendance_marked_by is null
  and attendance_marked_by_name is null
  and confirmation_status in ('confirmed', 'maybe')
  and public.is_valid_event_signup(event_id, signup_role, attendance_type, attendance_start, attendance_end)
  and public.are_event_reserve_roles_open(event_id, signup_role, reserve_role_1, reserve_role_2)
  and (signup_role <> 'Student Supervisor' or public.is_crew_operations_user())
  and (
    (equipment_source = 'club' and own_camera_name is null)
    or (
      equipment_source = 'own'
      and signup_role = 'Photographer'
      and public.can_use_personal_camera(signups.member_id, own_camera_name)
    )
  )
  and (
    (
      signup_role = 'Student Supervisor'
      and reserve_role_1 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
      and reserve_role_2 in ('MIXING', 'OBS', 'Robocam', 'Handheld 1', 'Handheld 2', 'Handheld 3 (optional)', 'Wireless')
      and reserve_role_1 <> reserve_role_2
    )
    or (signup_role = 'MIXING' and reserve_role_1 = 'OBS' and reserve_role_2 is null)
    or (signup_role <> 'Student Supervisor' and reserve_role_1 is null and reserve_role_2 is null)
    or (signup_role is null and reserve_role_1 is null and reserve_role_2 is null)
  )
  and (
    public.is_admin_panel_user()
    or signups.member_id = public.current_member_id()
  )
);

create policy "Users can delete own signups and Auth Admins any"
on public.signups for delete
to authenticated
using (
  public.is_auth_admin()
  or (public.can_access_media_club() and signups.member_id = public.current_member_id())
);

create policy "Members can read own notifications"
on public.notifications for select
to authenticated
using (
  notifications.member_id = public.current_member_id()
);

create policy "Signed-in users can read equipment"
on public.equipment for select
to authenticated
using (
  public.can_access_media_club()
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
using (public.can_access_media_club());

create policy "Signed-in members can reserve equipment"
on public.equipment_reservations for insert
to authenticated
with check (
  public.can_create_equipment_reservation(
    equipment_id, member_id, event_id, reservation_type, starts_at, ends_at
  )
  and (reservation_type <> 'non_event' or nullif(btrim(purpose), '') is not null)
  and reservation_group_id is null
  and reservation_status = 'scheduled'
  and checked_out_at is null
  and returned_at is null
  and returned_by is null
  and returned_by_name is null
  and auto_released_at is null
);

-- Reservation cancellation must go through cancel_equipment_reservation_group()
-- so a camera and its mandatory lens cannot be separated by a direct delete.
revoke delete on table public.equipment_reservations from anon, authenticated;

create policy "Signed-in users can read gallery"
on public.gallery for select
to authenticated
using (
  public.can_access_media_club()
  and (
    gallery.project_scope = 'showcase'
    or gallery.member_id = public.current_member_id()
    or public.is_member_of_team('athletics')
    or public.is_athletics_gallery_custodian()
  )
);

create policy "Signed-in members can submit gallery projects"
on public.gallery for insert
to authenticated
with check (
  public.can_access_media_club()
  and coalesce(nullif(btrim(image_url), ''), nullif(btrim(project_url), ''), nullif(btrim(storage_path), ''), '') <> ''
  and gallery.member_id = public.current_member_id()
  and (gallery.project_scope = 'showcase' or gallery.image_url is null)
  and (gallery.event_id is null or gallery.project_scope = 'athletics')
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
  or (public.can_access_media_club() and gallery.member_id = public.current_member_id())
);

create policy "Signed-in users can read announcements"
on public.announcements for select
to authenticated
using (public.can_access_media_club());

create policy "Admins can manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Authorized reviewers can read join applications"
on public.join_applications for select
to authenticated
using (
  public.is_auth_admin()
  or (application_target = 'media_club' and public.is_admin_panel_user())
  or (application_target = 'sac' and public.can_review_sac_applications())
);

create policy "Authorized reviewers can update join applications"
on public.join_applications for update
to authenticated
using (
  public.is_auth_admin()
  or (application_target = 'media_club' and public.is_admin_panel_user())
  or (application_target = 'sac' and public.can_review_sac_applications())
)
with check (
  public.is_auth_admin()
  or (application_target = 'media_club' and public.is_admin_panel_user())
  or (application_target = 'sac' and public.can_review_sac_applications())
);

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime drop table public.members;
  end if;
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
  alter publication supabase_realtime add table public.sac_slot_signups;
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
