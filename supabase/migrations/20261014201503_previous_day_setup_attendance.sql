-- Setup roster tables. No existing signup or game-attendance rows are changed.
alter table public.events add column if not exists livestream_setup_start time not null default '15:15';
alter table public.events add column if not exists livestream_setup_end time not null default '16:15';
alter table public.events drop constraint if exists events_livestream_setup_window_check;
alter table public.events add constraint events_livestream_setup_window_check check (livestream_setup_end > livestream_setup_start);

create schema if not exists crew_private;
create table if not exists public.event_setup_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  setup_starts_at timestamptz not null,
  setup_ends_at timestamptz not null check (setup_ends_at > setup_starts_at),
  attendance_status text not null check (attendance_status in ('not_taken','present','late','absent','excused')),
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists event_setup_attendance_member_idx on public.event_setup_attendance(member_id);
create table if not exists crew_private.event_setup_attendance_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  previous_status text,
  attendance_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table public.event_setup_attendance enable row level security;
alter table crew_private.event_setup_attendance_history enable row level security;
revoke all on public.event_setup_attendance from public, anon, authenticated;
grant select on public.event_setup_attendance to authenticated;
grant all on public.event_setup_attendance to service_role;
revoke all on crew_private.event_setup_attendance_history from public, anon, authenticated;

-- Setup roster access. Attendance authority remains Auth Admin-only.
grant update (livestream_setup_start,livestream_setup_end) on public.events to authenticated;
drop policy if exists "Read setup attendance" on public.event_setup_attendance;
create policy "Read setup attendance" on public.event_setup_attendance for select to authenticated
using (not public.is_visitor_session() and auth.uid() is not null
  and (public.is_admin_panel_user() or member_id = public.current_member_id()));

create or replace function crew_private.record_event_setup_attendance(p_event_id uuid, p_member_ids uuid[], p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  production public.events%rowtype;
  previous public.event_setup_attendance%rowtype;
  person uuid;
  starts_at timestamptz;
  ends_at timestamptz;
  result jsonb := '[]'::jsonb;
  saved public.event_setup_attendance%rowtype;
begin
  if auth.uid() is null or public.is_visitor_session() or not coalesce(public.is_crew_schedule_user(),false) then
    raise exception 'Auth Admin access is required to record setup attendance.';
  end if;
  if p_status is null or p_status not in ('not_taken','present','late','absent','excused') then raise exception 'Invalid setup attendance status.'; end if;
  if p_member_ids is null or cardinality(p_member_ids) not between 1 and 50
    or exists (select 1 from unnest(p_member_ids) id where id is null)
    or (select count(distinct id) from unnest(p_member_ids) id) <> cardinality(p_member_ids) then
    raise exception 'Choose between 1 and 50 distinct members.';
  end if;
  -- Serialise batches for one production and make duplicate requests idempotent.
  select * into production from public.events where id = p_event_id for update;
  if not found or production.archived_at is not null or production.category <> 'Livestream' then
    raise exception 'An active Livestream event is required.';
  end if;
  foreach person in array p_member_ids loop
    select * into previous from public.event_setup_attendance where event_id=p_event_id and member_id=person;
    if found then
      starts_at := previous.setup_starts_at; ends_at := previous.setup_ends_at;
    else
      if production.livestream_setup_date is null
        or production.livestream_setup_date <> (production.date at time zone 'Europe/Berlin')::date - 1 then
        raise exception 'Setup must be scheduled on the day before the game.';
      end if;
      starts_at := (production.livestream_setup_date + production.livestream_setup_start) at time zone 'Europe/Berlin';
      ends_at := (production.livestream_setup_date + production.livestream_setup_end) at time zone 'Europe/Berlin';
      if not exists (select 1 from public.members m join public.member_team_memberships t on t.member_id=m.id
        where m.id=person and t.team_key='media_club' and lower(coalesce(m.status,'')) <> 'inactive') then
        raise exception 'Choose a current Media Club member.';
      end if;
    end if;
    if now() < starts_at or now() > ends_at + interval '120 hours' then
      raise exception 'Setup attendance opens when setup starts and closes 120 hours after it ends.';
    end if;
    if previous.event_id is null or previous.attendance_status <> p_status then
      insert into public.event_setup_attendance(event_id,member_id,setup_starts_at,setup_ends_at,attendance_status,marked_by,marked_at)
      values(p_event_id,person,starts_at,ends_at,p_status,auth.uid(),now())
      on conflict(event_id,member_id) do update set attendance_status=excluded.attendance_status,marked_by=excluded.marked_by,marked_at=excluded.marked_at
      returning * into saved;
      insert into crew_private.event_setup_attendance_history(event_id,member_id,previous_status,attendance_status,actor_id)
      values(p_event_id,person,previous.attendance_status,p_status,auth.uid());
    else saved := previous;
    end if;
    result := result || jsonb_build_array(to_jsonb(saved));
  end loop;
  return result;
end;
$$;
revoke all on function crew_private.record_event_setup_attendance(uuid,uuid[],text) from public, anon, authenticated;
grant usage on schema crew_private to authenticated;
grant execute on function crew_private.record_event_setup_attendance(uuid,uuid[],text) to authenticated;
create or replace function public.record_event_setup_attendance(p_event_id uuid, p_member_ids uuid[], p_status text)
returns jsonb language sql security invoker set search_path = '' as $$
  select crew_private.record_event_setup_attendance(p_event_id,p_member_ids,p_status);
$$;
revoke all on function public.record_event_setup_attendance(uuid,uuid[],text) from public, anon, authenticated;
grant execute on function public.record_event_setup_attendance(uuid,uuid[],text) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_setup_attendance') then
    alter publication supabase_realtime add table public.event_setup_attendance;
  end if;
end $$;
