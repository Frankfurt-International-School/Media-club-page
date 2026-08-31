-- Apply this once after deploying the Turnstile-protected submit-application
-- Edge Function. Public applications then use the service role inside the
-- function; browsers no longer write to join_applications directly.

alter table public.join_applications enable row level security;

drop policy if exists "Signed-in users can submit join applications"
on public.join_applications;

revoke insert on table public.join_applications from anon, authenticated;

-- The old anonymous visitor session used these narrow RPCs. The public portal
-- is now a static preview, so even a stale visitor token cannot call them.
revoke execute on function public.get_public_events() from anon, authenticated;
revoke execute on function public.get_public_gallery() from anon, authenticated;
revoke execute on function public.get_public_equipment() from anon, authenticated;
revoke execute on function public.get_public_announcements() from anon, authenticated;
