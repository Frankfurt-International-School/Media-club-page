-- Student identity minimization. IDs, account emails, roles and memberships stay stable.
-- The temporary redaction dictionary is dropped before commit: no surname archive is kept.
begin;

create or replace function crew_private.student_display_name(value text)
returns text language sql immutable set search_path = '' as $$
  with cleaned as (select regexp_replace(btrim(coalesce(value, '')), '[[:space:]]+', ' ', 'g') as name)
  select case when name !~ ' ' then name
    else split_part(name, ' ', 1) || ' ' || left(upper(left(regexp_replace(name, '^.* ', ''), 1)), 1) || '.' end
  from cleaned;
$$;
revoke all on function crew_private.student_display_name(text) from public, anon, authenticated;

create or replace function crew_private.identity_display_name(value text, member_id uuid default null, account_id uuid default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare person public.members; label text;
begin
  if member_id is not null then
    select * into person from public.members m where m.id = member_id;
  elsif account_id is not null then
    select m.* into person from public.members m join auth.users u on lower(u.email) = lower(m.email) where u.id = account_id;
  end if;
  if person.id is not null then
    return case when person.role = 'Faculty' then person.name else crew_private.student_display_name(person.name) end;
  end if;
  label := btrim(coalesce(value, ''));
  -- Legacy staff snapshots and non-person system labels can remain readable.
  if exists(select 1 from public.members m where m.role = 'Faculty' and m.name = label)
    or label in ('System','Auth Admin','Club administrator','Removed member','Unknown member','Media Club','Media Club member','SAC member','Student Athletic Council') then return label; end if;
  if label like '%@%' then return 'Club administrator'; end if;
  return crew_private.student_display_name(value);
end;
$$;
revoke all on function crew_private.identity_display_name(text,uuid,uuid) from public, anon, authenticated;

create temporary table student_name_redactions(old_name text primary key, display_name text not null) on commit drop;
insert into student_name_redactions
select name, crew_private.student_display_name(name) from (
  select name from public.members where role is distinct from 'Faculty'
  union select name from public.join_applications
  union select value from auth.users u cross join lateral jsonb_each_text(u.raw_user_meta_data) p(key,value)
    where p.key in ('full_name','name','display_name','fullName','displayName')
      and not exists(select 1 from public.members m where lower(m.email) = lower(u.email) and m.role = 'Faculty')
) names where name is not null and name <> crew_private.student_display_name(name)
on conflict do nothing;

create function pg_temp.redact_student_text(value text) returns text language plpgsql as $$
declare item record; result text := value; pattern text;
begin
  if value is null then return null; end if;
  for item in select * from pg_temp.student_name_redactions order by length(old_name) desc loop
    pattern := '\m' || regexp_replace(item.old_name, '([\[\]().*+?^$|{}\\])', '\\\1', 'g') || '\M';
    result := regexp_replace(result, pattern, item.display_name, 'gi');
  end loop;
  return result;
end;
$$;
create function pg_temp.redact_student_json(value jsonb) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  case jsonb_typeof(value)
    when 'string' then return to_jsonb(pg_temp.redact_student_text(value #>> '{}'));
    when 'object' then select coalesce(jsonb_object_agg(key, pg_temp.redact_student_json(v)), '{}') into result from jsonb_each(value) e(key,v);
    when 'array' then select coalesce(jsonb_agg(pg_temp.redact_student_json(v) order by ordinal), '[]') into result from jsonb_array_elements(value) with ordinality e(v,ordinal);
    else return value;
  end case;
  return result;
end;
$$;

-- Only human-readable content is rewritten; no addresses, URLs, object keys or IDs.
do $$ declare field record; begin
  for field in select * from (values
    ('announcements','title'),('announcements','body'),('announcements','action_label'),
    ('equipment','notes'),('equipment_reservations','purpose'),
    ('events','title'),('events','description'),('events','location'),
    ('gallery','project_name'),('gallery','description'),
    ('join_applications','why'),('join_applications','rejection_reason'),
    ('meetings','title'),('meetings','agenda'),('meetings','notes'),('meetings','location'),
    ('members','status'),('notifications','title'),('notifications','message'),
    ('sac_events','title'),('sac_events','description'),('sac_events','location'),
    ('sac_meetings','title'),('sac_meetings','description'),('sac_meetings','location'),
    ('schedule_email_deliveries','error_message'),('schedule_email_dispatches','error_message'),
    ('signups','own_camera_name')
  ) fields(table_name,column_name) loop
    execute format('update public.%I set %I = pg_temp.redact_student_text(%I) where %I is distinct from pg_temp.redact_student_text(%I)', field.table_name,field.column_name,field.column_name,field.column_name,field.column_name);
  end loop;
end $$;
update public.schedule_email_resource_states set resource_snapshot = pg_temp.redact_student_json(resource_snapshot)
where resource_snapshot is distinct from pg_temp.redact_student_json(resource_snapshot);
update public.members set personal_equipment_preferences = pg_temp.redact_student_json(personal_equipment_preferences)
where personal_equipment_preferences is distinct from pg_temp.redact_student_json(personal_equipment_preferences);

create or replace function crew_private.minimize_person_name_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare data jsonb := to_jsonb(new); field text;
begin
  if tg_table_name = 'members' then
    if new.role is distinct from 'Faculty' then new.name := crew_private.student_display_name(new.name); end if;
    return new;
  elsif tg_table_name = 'join_applications' then
    -- Public applications cannot establish verified staff status.
    new.name := crew_private.student_display_name(new.name);
    return new;
  end if;
  foreach field in array tg_argv loop
    -- Preserve NULL, including clearing an attendance mark.
    if data->>field is null then continue; end if;
    data := jsonb_set(data, array[field], to_jsonb(crew_private.identity_display_name(data->>field,
      case field when 'member_name_snapshot' then (data->>'member_id')::uuid
        when 'member_name' then (data->>'member_id')::uuid
        when 'organizer_name' then (data->>'organizer_member_id')::uuid
        when 'changed_by_name' then (data->>'changed_by_member_id')::uuid else null end,
      case field when 'attendance_marked_by_name' then (data->>'attendance_marked_by')::uuid
        when 'returned_by_name' then (data->>'returned_by')::uuid
        when 'archived_by_name' then (data->>'archived_by')::uuid
        when 'changed_by_name' then (data->>'changed_by_auth_user_id')::uuid else null end)));
  end loop;
  new := jsonb_populate_record(new, data);
  return new;
end;
$$;
revoke all on function crew_private.minimize_person_name_fields() from public, anon, authenticated;
do $$ declare item record; begin
  for item in select * from (values
    ('members', '''name'''),('join_applications', '''name'''),
    ('signups', '''attendance_marked_by_name'''),('equipment_reservations', '''returned_by_name'''),
    ('equipment', '''archived_by_name'''),('events', '''archived_by_name'''),
    ('meetings', '''organizer_name'',''archived_by_name'''),
    ('sac_attendance', '''member_name_snapshot'''),('sac_slot_signups', '''member_name_snapshot'''),
    ('sac_membership_audit', '''member_name'',''changed_by_name''')
  ) targets(table_name,fields) loop
    execute format('create trigger minimize_person_name_fields before insert or update on public.%I for each row execute function crew_private.minimize_person_name_fields(%s)',item.table_name,item.fields);
  end loop;
end $$;

update public.members set name = name where role is distinct from 'Faculty';
update public.join_applications set name = name;
update public.signups set attendance_marked_by_name = attendance_marked_by_name where attendance_marked_by_name is not null;
update public.equipment_reservations set returned_by_name = returned_by_name where returned_by_name is not null;
update public.equipment set archived_by_name = archived_by_name where archived_by_name is not null;
update public.events set archived_by_name = archived_by_name where archived_by_name is not null;
update public.meetings set organizer_name = organizer_name, archived_by_name = archived_by_name;
update public.sac_attendance set member_name_snapshot = member_name_snapshot;
update public.sac_slot_signups set member_name_snapshot = member_name_snapshot;
update public.sac_membership_audit set member_name = member_name, changed_by_name = changed_by_name;

alter table public.members add constraint members_student_display_name_check
  check (role = 'Faculty' or name !~ '[[:space:]]' or name ~ '^[^[:space:]]+ [^[:space:]]\.$');
alter table public.join_applications add constraint applications_display_name_check
  check (name !~ '[[:space:]]' or name ~ '^[^[:space:]]+ [^[:space:]]\.$');

create or replace function crew_private.minimize_auth_name_metadata(metadata jsonb, account_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare field text; result jsonb := coalesce(metadata,'{}'); value text;
begin
  -- Only a trusted member row can establish the staff exception; user metadata cannot.
  if exists(select 1 from public.members m where lower(m.email) = lower(account_email) and m.role = 'Faculty') then return result; end if;
  foreach field in array array['full_name','name','display_name','fullName','displayName','last_name','family_name','surname','lastName','familyName','first_name','given_name','firstName','givenName'] loop
    if result->>field is null then continue; end if;
    value := result->>field;
    if field in ('last_name','family_name','surname','lastName','familyName') then value := left(upper(left(btrim(value),1)),1);
    elsif field in ('first_name','given_name','firstName','givenName') then value := split_part(regexp_replace(btrim(value),'[[:space:]]+',' ','g'),' ',1);
    else value := crew_private.student_display_name(value); end if;
    result := jsonb_set(result,array[field],to_jsonb(value));
  end loop;
  return result;
end;
$$;
revoke all on function crew_private.minimize_auth_name_metadata(jsonb,text) from public, anon, authenticated;
create or replace function crew_private.minimize_auth_names()
returns trigger language plpgsql security definer set search_path = '' as $$
declare account_email text;
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := crew_private.minimize_auth_name_metadata(new.raw_user_meta_data,new.email);
  else
    select email into account_email from auth.users where id = new.user_id;
    new.identity_data := crew_private.minimize_auth_name_metadata(new.identity_data,account_email);
  end if;
  return new;
end;
$$;
revoke all on function crew_private.minimize_auth_names() from public, anon, authenticated;
create trigger minimize_auth_names before insert or update of raw_user_meta_data,email on auth.users
for each row execute function crew_private.minimize_auth_names();
create trigger minimize_auth_names before insert or update of identity_data on auth.identities
for each row execute function crew_private.minimize_auth_names();
update auth.users set raw_user_meta_data = crew_private.minimize_auth_name_metadata(raw_user_meta_data,email)
where raw_user_meta_data is distinct from crew_private.minimize_auth_name_metadata(raw_user_meta_data,email);
update auth.identities i set identity_data = crew_private.minimize_auth_name_metadata(i.identity_data,u.email)
from auth.users u where u.id = i.user_id
and i.identity_data is distinct from crew_private.minimize_auth_name_metadata(i.identity_data,u.email);

-- Keep denormalized identity labels safe when a member is renamed or loses staff status.
create or replace function crew_private.sync_minimized_member_names()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sac_slot_signups set member_name_snapshot = new.name where member_id = new.id and member_name_snapshot is distinct from new.name;
  update public.sac_attendance set member_name_snapshot = new.name where member_id = new.id and member_name_snapshot is distinct from new.name;
  update public.sac_membership_audit set member_name = new.name where member_id = new.id and member_name is distinct from new.name;
  update public.sac_membership_audit set changed_by_name = new.name where changed_by_member_id = new.id and changed_by_name is distinct from new.name;
  update public.meetings set organizer_name = new.name where organizer_member_id = new.id and organizer_name is distinct from new.name;
  update public.signups set attendance_marked_by_name = new.name
    where attendance_marked_by in (select u.id from auth.users u where lower(u.email) = lower(new.email)) and attendance_marked_by_name is distinct from new.name;
  update public.equipment_reservations set returned_by_name = new.name
    where returned_by in (select u.id from auth.users u where lower(u.email) = lower(new.email)) and returned_by_name is distinct from new.name;
  update public.events set archived_by_name = new.name
    where archived_by in (select u.id from auth.users u where lower(u.email) = lower(new.email)) and archived_by_name is distinct from new.name;
  update public.equipment set archived_by_name = new.name
    where archived_by in (select u.id from auth.users u where lower(u.email) = lower(new.email)) and archived_by_name is distinct from new.name;
  update public.meetings set archived_by_name = new.name
    where archived_by in (select u.id from auth.users u where lower(u.email) = lower(new.email)) and archived_by_name is distinct from new.name;
  update auth.users set raw_user_meta_data = crew_private.minimize_auth_name_metadata(raw_user_meta_data,email)
    where lower(email) = lower(new.email) and raw_user_meta_data is distinct from crew_private.minimize_auth_name_metadata(raw_user_meta_data,email);
  update auth.identities i set identity_data = crew_private.minimize_auth_name_metadata(i.identity_data,u.email)
    from auth.users u where u.id = i.user_id and lower(u.email) = lower(new.email)
      and i.identity_data is distinct from crew_private.minimize_auth_name_metadata(i.identity_data,u.email);
  return new;
end;
$$;
revoke all on function crew_private.sync_minimized_member_names() from public, anon, authenticated;
create trigger sync_minimized_member_names after update of name,role on public.members
for each row when (old.name is distinct from new.name or old.role is distinct from new.role)
execute function crew_private.sync_minimized_member_names();

drop function pg_temp.redact_student_json(jsonb);
drop function pg_temp.redact_student_text(text);
drop table pg_temp.student_name_redactions;
commit;
