-- Run this in Supabase SQL Editor to make one existing Auth user a visitor.
-- Replace the email below with the account you want to limit.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'visitor')
where email = 'visitor@example.com';

-- Optional check: this shows the account and its current app role.
select email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where email = 'visitor@example.com';
