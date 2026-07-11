alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.gallery enable row level security;
alter table public.announcements enable row level security;
alter table public.join_applications enable row level security;

drop policy if exists "Authenticated users can read members" on public.members;
drop policy if exists "Authenticated users can add members" on public.members;
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
drop policy if exists "Authenticated users can read signups" on public.signups;
drop policy if exists "Authenticated users can add signups" on public.signups;
drop policy if exists "Authenticated users can delete signups" on public.signups;
drop policy if exists "Signed-in users can read signups" on public.signups;
drop policy if exists "Signed-in users can add signups" on public.signups;
drop policy if exists "Admins can delete signups" on public.signups;
drop policy if exists "Authenticated users can read equipment" on public.equipment;
drop policy if exists "Authenticated users can manage equipment" on public.equipment;
drop policy if exists "Signed-in users can read equipment" on public.equipment;
drop policy if exists "Admins can manage equipment" on public.equipment;
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
        and replace(lower(member.role), ' ', '-') in ('leader', 'faculty', 'co-leader', 'moderator')
    );
$$;

create policy "Signed-in users can read members"
on public.members for select
to authenticated
using (true);

create policy "Admins can manage members"
on public.members for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Signed-in users can read events"
on public.events for select
to authenticated
using (true);

create policy "Admins can manage events"
on public.events for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Signed-in users can read signups"
on public.signups for select
to authenticated
using (true);

create policy "Signed-in users can add signups"
on public.signups for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'member')) <> 'visitor'
  and attendance_start is not null
  and attendance_end is not null
  and attendance_end > attendance_start
);

create policy "Admins can delete signups"
on public.signups for delete
to authenticated
using (public.is_admin_panel_user());

create policy "Signed-in users can read equipment"
on public.equipment for select
to authenticated
using (true);

create policy "Admins can manage equipment"
on public.equipment for all
to authenticated
using (public.is_admin_panel_user())
with check (public.is_admin_panel_user());

create policy "Signed-in users can read gallery"
on public.gallery for select
to authenticated
using (true);

create policy "Signed-in members can submit gallery projects"
on public.gallery for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'member')) <> 'visitor'
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
using (public.is_admin_panel_user());

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
with check (true);

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
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.join_applications;
exception when duplicate_object then null;
end $$;
