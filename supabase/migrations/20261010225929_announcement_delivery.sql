-- Existing announcements stay in Media Club. No historical notifications are sent.
create schema if not exists crew_private;
revoke all on schema crew_private from public, anon;
grant usage on schema crew_private to authenticated;

alter table public.announcements
  add column audience text not null default 'media_club',
  add column action_label text not null default '',
  add column action_url text not null default '',
  add column pinned boolean not null default false,
  add column expires_at timestamptz,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint announcements_audience_check check (audience in ('media_club', 'sac', 'both')),
  add constraint announcements_action_check check (
    (action_label = '' and action_url = '') or
    (char_length(action_label) between 1 and 48 and char_length(action_url) <= 500
      and action_url ~ '^/(dashboard|events|meetings|signups|my-crew-schedule|sac/(events|meetings|signups|my-shifts))(\?[^#]*)?$'
      and action_url !~ '[[:cntrl:][:space:]]')
  );
create index announcements_active_audience_idx on public.announcements (audience, created_at desc) where archived_at is null;

alter table public.notifications add column related_announcement_id uuid references public.announcements(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('event_created', 'meeting_invite', 'application_approved', 'announcement'));
alter table public.notifications add constraint notifications_announcement_link_check
  check ((notification_type = 'announcement') = (related_announcement_id is not null));
create unique index notifications_announcement_member_idx on public.notifications (member_id, related_announcement_id)
  where related_announcement_id is not null;
create index notifications_announcement_idx on public.notifications (related_announcement_id) where related_announcement_id is not null;

create function crew_private.can_read_announcement(p_audience text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and not (select public.is_visitor_session())
    and ((select public.is_admin_panel_user()) or exists (
      select 1 from public.member_team_memberships membership
      where membership.member_id = (select public.current_member_id())
        and ((p_audience in ('media_club','both') and membership.team_key = 'media_club')
          or (p_audience in ('sac','both') and membership.team_key = 'sac'))
    ));
$$;
revoke all on function crew_private.can_read_announcement(text) from public, anon;
grant execute on function crew_private.can_read_announcement(text) to authenticated;

-- Replace the original Media-only reader rule; previews and visitors receive no club notices.
drop policy if exists "Signed-in users can read announcements" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Members can read active club announcements" on public.announcements for select to authenticated
  using (archived_at is null and (expires_at is null or expires_at > now()) and crew_private.can_read_announcement(audience));
create policy "Admins can manage announcements" on public.announcements for all to authenticated
  using ((select auth.uid()) is not null and not (select public.is_visitor_session()) and (select public.is_admin_panel_user()))
  with check ((select auth.uid()) is not null and not (select public.is_visitor_session()) and (select public.is_admin_panel_user()));

drop policy if exists "Members can read own notifications" on public.notifications;
create policy "Members can read own notifications" on public.notifications for select to authenticated using (
  (select auth.uid()) is not null and not (select public.is_visitor_session())
  and member_id = (select public.current_member_id())
  and (notification_type <> 'announcement' or exists (
    select 1 from public.announcements announcement where announcement.id = related_announcement_id
      and announcement.archived_at is null and (announcement.expires_at is null or announcement.expires_at > now())
      and crew_private.can_read_announcement(announcement.audience)
  ))
);

-- Trigger-only functions are not public RPCs. Pin changes serialize across both clubs.
create function crew_private.lock_announcements()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(72438121);
  return null;
end;
$$;
revoke all on function crew_private.lock_announcements() from public, anon, authenticated;
create trigger announcement_lock before insert or update on public.announcements
  for each statement execute function crew_private.lock_announcements();

create function crew_private.prepare_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.title := btrim(new.title); new.body := btrim(new.body);
  new.action_label := btrim(new.action_label); new.action_url := btrim(new.action_url);
  if char_length(new.title) not between 1 and 120 or char_length(new.body) not between 1 and 5000 then
    raise exception 'Use a title of 1–120 characters and a message of 1–5000 characters.';
  end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  if new.expires_at is not null and new.expires_at <= now()
    and (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at) then
    raise exception 'Choose an expiry time in the future.';
  end if;
  new.updated_at := now();
  if new.archived_at is not null or (new.expires_at is not null and new.expires_at <= now()) then new.pinned := false; end if;
  if new.pinned then
    update public.announcements set pinned = false
      where id <> new.id and pinned and archived_at is null
        and (audience = new.audience or audience = 'both' or new.audience = 'both');
  end if;
  return new;
end;
$$;
revoke all on function crew_private.prepare_announcement() from public, anon, authenticated;
create trigger announcement_prepare before insert or update on public.announcements
  for each row execute function crew_private.prepare_announcement();

create function crew_private.deliver_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null or (new.expires_at is not null and new.expires_at <= now()) then
    delete from public.notifications where related_announcement_id = new.id;
    return new;
  end if;
  -- A pin change or typo correction never resets read status or sends a duplicate.
  update public.notifications set title = new.title, message = left(new.body, 240)
    where related_announcement_id = new.id;
  delete from public.notifications notification where related_announcement_id = new.id and not exists (
    select 1 from public.member_team_memberships membership where membership.member_id = notification.member_id
      and ((new.audience in ('media_club','both') and membership.team_key = 'media_club')
        or (new.audience in ('sac','both') and membership.team_key = 'sac'))
  );
  if tg_op = 'INSERT' or new.audience is distinct from old.audience then
    insert into public.notifications (member_id, notification_type, title, message, page, related_announcement_id)
      select distinct membership.member_id, 'announcement', new.title, left(new.body, 240), 'home', new.id
      from public.member_team_memberships membership
      where (new.audience in ('media_club','both') and membership.team_key = 'media_club')
        or (new.audience in ('sac','both') and membership.team_key = 'sac')
      on conflict (member_id, related_announcement_id) where related_announcement_id is not null do nothing;
  end if;
  return new;
end;
$$;
revoke all on function crew_private.deliver_announcement() from public, anon, authenticated;
create trigger announcement_delivery after insert or update on public.announcements
  for each row execute function crew_private.deliver_announcement();

-- A reader acknowledges one notice, after opening it. Other accounts and notices are untouched.
create function public.mark_announcement_read(p_announcement_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_visitor_session() then return false; end if;
  if not exists (select 1 from public.announcements announcement where announcement.id = p_announcement_id
      and announcement.archived_at is null and (announcement.expires_at is null or announcement.expires_at > now())
      and crew_private.can_read_announcement(announcement.audience)) then return false; end if;
  update public.notifications set read_at = coalesce(read_at, now())
    where member_id = public.current_member_id() and related_announcement_id = p_announcement_id;
  return true;
end;
$$;
revoke all on function public.mark_announcement_read(uuid) from public, anon;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
