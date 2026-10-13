-- Private, individually revocable feeds. Store only SHA-256 digests, never link secrets.
create schema if not exists crew_private;
revoke all on schema crew_private from public, anon;
grant usage on schema crew_private to authenticated, service_role;

create table crew_private.media_calendar_subscriptions (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('personal', 'events')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (auth_user_id, kind)
);
alter table crew_private.media_calendar_subscriptions enable row level security;
create index media_calendar_subscriptions_member_id_idx on crew_private.media_calendar_subscriptions(member_id);
revoke all on crew_private.media_calendar_subscriptions from public, anon, authenticated, service_role;
-- Access is through the narrowly scoped functions below, not table policies.
create function crew_private.revoke_removed_media_calendar_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.team_key = 'media_club' and (tg_op = 'DELETE' or new.team_key <> 'media_club' or new.member_id <> old.member_id) then
    delete from crew_private.media_calendar_subscriptions where member_id = old.member_id;
  end if;
  return null;
end;
$$;
revoke all on function crew_private.revoke_removed_media_calendar_membership() from public, anon, authenticated, service_role;
create trigger revoke_removed_media_calendar_membership after delete or update on public.member_team_memberships
for each row execute function crew_private.revoke_removed_media_calendar_membership();

create function crew_private.manage_own_media_calendar_subscription(p_kind text, p_action text, p_expected_user_id uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  owner_member uuid;
  subscription crew_private.media_calendar_subscriptions%rowtype;
begin
  -- Use the trusted Auth row; neither client member IDs nor user_metadata confer access.
  select m.id into owner_member from public.members m
  join auth.users u on lower(u.email) = lower(m.email)
  join public.member_team_memberships t on t.member_id = m.id and t.team_key = 'media_club'
  where u.id = actor and not coalesce(u.is_anonymous, false)
    and coalesce(u.raw_app_meta_data->>'role', '') <> 'visitor'
    and (u.banned_until is null or u.banned_until <= now());
  if owner_member is null or p_expected_user_id is distinct from actor then raise exception 'A signed-in Media Club member is required.' using errcode = '42501'; end if;
  if p_kind not in ('personal', 'events') or p_kind is null
    or p_action not in ('status', 'create', 'replace', 'revoke') or p_action is null then
    raise exception 'Invalid calendar request.' using errcode = '22023';
  end if;
  -- Serialize each owner's actions, including first creation where no row exists to lock.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_kind, 0));
  if p_action in ('create', 'replace') then
    if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid calendar secret digest.' using errcode = '22023';
    end if;
    if p_action = 'create' and exists(select 1 from crew_private.media_calendar_subscriptions s where s.auth_user_id = actor and s.kind = p_kind) then
      raise exception 'A link is already active. Replace it explicitly.' using errcode = '23505';
    end if;
    insert into crew_private.media_calendar_subscriptions(auth_user_id, member_id, kind, token_hash)
    values(actor, owner_member, p_kind, p_token_hash)
    on conflict(auth_user_id, kind) do update set member_id = excluded.member_id, token_hash = excluded.token_hash, created_at = now();
  elsif p_action = 'revoke' then
    delete from crew_private.media_calendar_subscriptions s where s.auth_user_id = actor and s.kind = p_kind;
  end if;
  select * into subscription from crew_private.media_calendar_subscriptions s where s.auth_user_id = actor and s.kind = p_kind;
  return jsonb_build_object('kind', p_kind, 'active', subscription.auth_user_id is not null, 'created_at', subscription.created_at);
end;
$$;
revoke all on function crew_private.manage_own_media_calendar_subscription(text,text,uuid,text) from public, anon, service_role;
grant execute on function crew_private.manage_own_media_calendar_subscription(text,text,uuid,text) to authenticated;
create function public.manage_own_media_calendar_subscription(p_kind text, p_action text, p_expected_user_id uuid, p_token_hash text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select crew_private.manage_own_media_calendar_subscription(p_kind, p_action, p_expected_user_id, p_token_hash);
$$;
revoke all on function public.manage_own_media_calendar_subscription(text,text,uuid,text) from public, anon, service_role;
grant execute on function public.manage_own_media_calendar_subscription(text,text,uuid,text) to authenticated;

-- Calendar clients cannot send a login JWT. The Edge Function hashes their secret and
-- invokes this service-only reader. Recheck account and membership on EVERY request.
create function crew_private.read_media_calendar_feed(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  subscription crew_private.media_calendar_subscriptions%rowtype;
  entries jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select s.* into subscription from crew_private.media_calendar_subscriptions s
  join auth.users u on u.id = s.auth_user_id
  join public.members m on m.id = s.member_id and lower(m.email) = lower(u.email)
  join public.member_team_memberships t on t.member_id = m.id and t.team_key = 'media_club'
  where s.token_hash = p_token_hash and not coalesce(u.is_anonymous, false)
    and coalesce(u.raw_app_meta_data->>'role', '') <> 'visitor'
    and (u.banned_until is null or u.banned_until <= now());
  if subscription.auth_user_id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'location', e.location,
    'start', case when subscription.kind = 'personal' then coalesce(s.attendance_start, e.date) else e.date end,
    'end', case when subscription.kind = 'personal' then coalesce(s.attendance_end, e.ends_at) else e.ends_at end,
    'updated', greatest(e.updated_at, s.signed_up_at, s.confirmed_at),
    'role', case when subscription.kind = 'personal' then s.signup_role else null end,
    'tentative', subscription.kind = 'personal' and s.confirmation_status = 'maybe'
  ) order by e.date, e.id), '[]'::jsonb) into entries
  from public.events e
  left join public.signups s on subscription.kind = 'personal' and s.event_id = e.id and s.member_id = subscription.member_id
  where e.archived_at is null and e.ends_at > now() - interval '180 days'
    and e.date < now() + interval '2 years'
    and (subscription.kind = 'events' or (s.id is not null and s.confirmation_status <> 'expired'
      and (s.confirmation_status <> 'maybe' or s.confirmation_deadline > now())));
  -- Deliberately omit names, emails, descriptions, attendance, rosters and loan details.
  return jsonb_build_object('kind', subscription.kind, 'entries', entries);
end;
$$;
revoke all on function crew_private.read_media_calendar_feed(text) from public, anon, authenticated;
grant execute on function crew_private.read_media_calendar_feed(text) to service_role;
create function public.read_media_calendar_feed(p_token_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select crew_private.read_media_calendar_feed(p_token_hash);
$$;
revoke all on function public.read_media_calendar_feed(text) from public, anon, authenticated;
grant execute on function public.read_media_calendar_feed(text) to service_role;
