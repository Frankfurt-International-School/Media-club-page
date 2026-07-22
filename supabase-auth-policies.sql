alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_reservations enable row level security;
alter table public.gallery enable row level security;
alter table public.announcements enable row level security;
alter table public.join_applications enable row level security;

drop policy if exists "Authenticated users can read members" on public.members;
drop policy if exists "Authenticated users can add members" on public.members;
drop policy if exists "Admins can manage members" on public.members;
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
drop policy if exists "Production staff can add events" on public.events;
drop policy if exists "Production staff can delete events" on public.events;
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
            p_attendance_type in ('whole', 'game_1', 'game_2', 'custom')
            or (
              p_attendance_type = 'game_3'
              and event.is_isst
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.game_3_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.game_3_end
            )
            or (
              p_attendance_type = 'game_4'
              and event.is_isst
              and event.game_4_start is not null
              and (p_attendance_start at time zone 'Europe/Berlin')::time = event.game_4_start
              and (p_attendance_end at time zone 'Europe/Berlin')::time = event.game_4_end
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
  if not public.is_crew_operations_user() then
    raise exception 'Moderator-or-above access is required.';
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
  if not public.is_crew_operations_user() then
    raise exception 'Moderator-or-above access is required.';
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
using (true);

create policy "Auth Admins can add members"
on public.members for insert
to authenticated
with check (public.is_auth_admin());

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
using (true);

create policy "Admins can manage events"
on public.events for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Production staff can add events"
on public.events for insert
to authenticated
with check (public.is_crew_operations_user());

create policy "Production staff can delete events"
on public.events for delete
to authenticated
using (public.is_crew_operations_user());

create policy "Signed-in users can read signups"
on public.signups for select
to authenticated
using (true);

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
  and public.is_valid_event_signup(event_id, signup_role, attendance_type, attendance_start, attendance_end)
  and (signup_role <> 'Student Supervisor' or public.is_crew_operations_user())
  and (
    (signup_role = 'Student Supervisor' and reserve_role_1 is not null and reserve_role_2 is not null and reserve_role_1 <> reserve_role_2)
    or (signup_role <> 'Student Supervisor' and reserve_role_1 is null and reserve_role_2 is null)
    or (signup_role is null and reserve_role_1 is null and reserve_role_2 is null)
  )
  and (
    public.is_crew_operations_user()
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

create policy "Signed-in users can read equipment"
on public.equipment for select
to authenticated
using (true);

create policy "Admins can manage equipment"
on public.equipment for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Production staff can add equipment"
on public.equipment for insert
to authenticated
with check (public.is_crew_operations_user());

create policy "Production staff can update equipment"
on public.equipment for update
to authenticated
using (public.is_crew_operations_user())
with check (public.is_crew_operations_user());

create policy "Production staff can delete equipment"
on public.equipment for delete
to authenticated
using (public.is_crew_operations_user());

create policy "Signed-in users can read equipment reservations"
on public.equipment_reservations for select
to authenticated
using (true);

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
    public.is_admin_panel_user()
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
using (true);

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
using (true);

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
  alter publication supabase_realtime add table public.events;
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
