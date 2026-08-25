-- Starter data extracted from the original hardcoded mockup in index.html.
-- Run this after the schema exists. IDs are deterministic so signups link up.

insert into public.members (id, name, role, email, status, joined_date) values
  ('00000000-0000-0000-0000-000000000001', 'Jana Stein', 'President', 'j.stein@school.de', 'Photography', '2026-05-01'),
  ('00000000-0000-0000-0000-000000000002', 'Max Krüger', 'Vice President', 'm.krueger@school.de', 'Videography', '2026-05-01'),
  ('00000000-0000-0000-0000-000000000003', 'Lena Petrov', 'Committee', 'l.petrov@school.de', 'Podcasting, Events', '2026-05-01'),
  ('00000000-0000-0000-0000-000000000004', 'Tom Adler', 'Committee', 't.adler@school.de', 'Equipment, Photography', '2026-05-01'),
  ('00000000-0000-0000-0000-000000000005', 'Sophia Bauer', 'Member', 's.bauer@school.de', 'Photography', '2026-05-01'),
  ('00000000-0000-0000-0000-000000000006', 'Kai Fischer', 'Member', 'k.fischer@school.de', 'Video, Editing', '2026-05-01')
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  email = excluded.email,
  status = excluded.status,
  joined_date = excluded.joined_date;

insert into public.events (id, title, description, date, ends_at, location) values
  ('00000000-0000-0000-0001-000000000001', 'Short film workshop', 'Learn the fundamentals of short film production with our resident directors.', '2026-05-14 15:30:00+00', '2026-05-14 17:00:00+00', 'Room B12'),
  ('00000000-0000-0000-0001-000000000002', 'Photography competition deadline', 'Submit your best photo series. Theme: urban life.', '2026-05-20 23:59:00+00', '2026-05-21 00:30:00+00', 'Online'),
  ('00000000-0000-0000-0001-000000000003', 'Podcast recording session', 'Monthly episode recording for the Media Club podcast. All welcome.', '2026-05-28 13:00:00+00', '2026-05-28 15:00:00+00', 'Studio A'),
  ('00000000-0000-0000-0001-000000000004', 'End-of-year screening night', 'Celebrate the year''s work with a screening of member films and photo exhibitions.', '2026-06-06 18:00:00+00', '2026-06-06 21:00:00+00', 'School hall')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  date = excluded.date,
  ends_at = excluded.ends_at,
  location = excluded.location;

insert into public.signups (id, event_id, member_id, signed_up_at) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', '2026-05-14 14:00:00+00'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000004', '2026-05-14 14:05:00+00'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003', '2026-05-14 14:10:00+00'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', '2026-05-14 14:15:00+00'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000005', '2026-05-20 09:00:00+00'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000006', '2026-05-20 09:30:00+00'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', '2026-05-28 13:00:00+00'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000003', '2026-05-28 13:02:00+00'),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', '2026-06-06 17:00:00+00'),
  ('00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000004', '2026-06-06 17:01:00+00')
on conflict (id) do update set
  event_id = excluded.event_id,
  member_id = excluded.member_id,
  signed_up_at = excluded.signed_up_at;

-- The original hardcoded gallery and equipment arrays were empty, so there are
-- no extracted rows for public.gallery or public.equipment.
