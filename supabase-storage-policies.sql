-- Run after supabase-schema.sql and supabase-auth-policies.sql.
-- Public reads are intentional: gallery covers are displayed on the visitor-accessible gallery page.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-media',
  'gallery-media',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can upload gallery media" on storage.objects;
drop policy if exists "Owners and Auth Admins can delete gallery media" on storage.objects;

create policy "Members can upload gallery media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gallery-media'
  and not public.is_visitor_session()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Owners and Auth Admins can delete gallery media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gallery-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_auth_admin()
  )
);

-- Profile pictures are publicly readable, while writes stay inside the owner's Auth UID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their profile picture" on storage.objects;
drop policy if exists "Users can replace their profile picture" on storage.objects;
drop policy if exists "Users can delete their profile picture" on storage.objects;

create policy "Users can upload their profile picture"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and not public.is_visitor_session()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "Users can replace their profile picture"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their profile picture"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = auth.uid()::text);
