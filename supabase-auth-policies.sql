alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.gallery enable row level security;
alter table public.announcements enable row level security;

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
drop policy if exists "Admins can manage gallery" on public.gallery;
drop policy if exists "Signed-in users can read announcements" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;

create policy "Signed-in users can read members"
on public.members for select
to authenticated
using (true);

create policy "Admins can manage members"
on public.members for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Signed-in users can read events"
on public.events for select
to authenticated
using (true);

create policy "Admins can manage events"
on public.events for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Signed-in users can read signups"
on public.signups for select
to authenticated
using (true);

create policy "Signed-in users can add signups"
on public.signups for insert
to authenticated
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'member') <> 'visitor');

create policy "Admins can delete signups"
on public.signups for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Signed-in users can read equipment"
on public.equipment for select
to authenticated
using (true);

create policy "Admins can manage equipment"
on public.equipment for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Signed-in users can read gallery"
on public.gallery for select
to authenticated
using (true);

create policy "Admins can manage gallery"
on public.gallery for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Signed-in users can read announcements"
on public.announcements for select
to authenticated
using (true);

create policy "Admins can manage announcements"
on public.announcements for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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
