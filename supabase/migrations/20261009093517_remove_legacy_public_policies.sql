-- Remove the 12 unrestricted legacy policies observed in the baseline.
-- Permissive policies combine with OR: these bypass the newer member/staff checks.
-- Approved member policies and curated public-portal RPCs stay in place.
drop policy if exists "Public read access" on public.equipment;
drop policy if exists "public read equipment" on public.equipment;
drop policy if exists "Public read access" on public.events;
drop policy if exists "public read events" on public.events;
drop policy if exists "Public read access" on public.gallery;
drop policy if exists "public read gallery" on public.gallery;
drop policy if exists "Public read access" on public.members;
drop policy if exists "public read members" on public.members;
drop policy if exists "Public can sign up for events" on public.signups;
drop policy if exists "Public read access" on public.signups;
drop policy if exists "public create signups" on public.signups;
drop policy if exists "public read signups" on public.signups;
