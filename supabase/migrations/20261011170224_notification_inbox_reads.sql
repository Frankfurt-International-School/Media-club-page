-- A single acknowledgement must not mark unrelated or newly arrived updates as read.
create function crew_private.mark_own_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  owned_notice record;
begin
  if auth.uid() is null or public.is_visitor_session() then return false; end if;
  select id, notification_type, related_announcement_id into owned_notice
    from public.notifications where id = p_notification_id and member_id = public.current_member_id();
  if not found then return false; end if;
  if owned_notice.notification_type = 'announcement' then
    return public.mark_announcement_read(owned_notice.related_announcement_id);
  end if;
  update public.notifications set read_at = coalesce(read_at, now())
    where id = owned_notice.id and member_id = public.current_member_id();
  return true;
end;
$$;
revoke all on function crew_private.mark_own_notification_read(uuid) from public, anon, authenticated;
grant execute on function crew_private.mark_own_notification_read(uuid) to authenticated;

create function public.mark_own_notification_read(p_notification_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select crew_private.mark_own_notification_read(p_notification_id);
$$;
revoke all on function public.mark_own_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_own_notification_read(uuid) to authenticated;
