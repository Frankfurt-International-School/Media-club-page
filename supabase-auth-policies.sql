alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.signups enable row level security;
alter table public.equipment enable row level security;
alter table public.gallery enable row level security;

create policy "Authenticated users can read members"
on public.members for select
to authenticated
using (true);

create policy "Authenticated users can add members"
on public.members for insert
to authenticated
with check (true);

create policy "Authenticated users can update members"
on public.members for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete members"
on public.members for delete
to authenticated
using (true);

create policy "Authenticated users can read events"
on public.events for select
to authenticated
using (true);

create policy "Authenticated users can add events"
on public.events for insert
to authenticated
with check (true);

create policy "Authenticated users can update events"
on public.events for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete events"
on public.events for delete
to authenticated
using (true);

create policy "Authenticated users can read signups"
on public.signups for select
to authenticated
using (true);

create policy "Authenticated users can add signups"
on public.signups for insert
to authenticated
with check (true);

create policy "Authenticated users can delete signups"
on public.signups for delete
to authenticated
using (true);

create policy "Authenticated users can read equipment"
on public.equipment for select
to authenticated
using (true);

create policy "Authenticated users can manage equipment"
on public.equipment for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read gallery"
on public.gallery for select
to authenticated
using (true);

create policy "Authenticated users can manage gallery"
on public.gallery for all
to authenticated
using (true)
with check (true);
