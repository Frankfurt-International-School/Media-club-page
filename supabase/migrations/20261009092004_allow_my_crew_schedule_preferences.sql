-- Add the personal Media Club schedule to two owner-scoped Settings allowlists.
-- Bodies originate from the observed hosted baseline; ownership, visitor guards and grants are preserved.

CREATE OR REPLACE FUNCTION public.update_own_sidebar_preferences(p_customized boolean, p_items text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where item = any(array['about','home','events','meetings','signup', 'my-crew-schedule', 'members','gallery','equipment','role-guide','crew-deployment','equipment-status','join','admin']::text[])
    group by item
  ) normalized;

  if coalesce(p_customized, false) and (
    not (clean_items && array['home','events','meetings','signup', 'my-crew-schedule', 'members']::text[])
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_own_tutorial_progress(p_progress jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  clean_completed text[];
  clean_active_tour text;
  clean_active_step integer;
  clean_dismissed_welcome boolean;
  allowed_tours constant text[] := array[
    'full','home','events','meetings','signup', 'my-crew-schedule', 'members','gallery','equipment','role-guide',
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
$function$
;
