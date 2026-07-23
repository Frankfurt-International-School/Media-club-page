-- Enable Supabase Cron in Dashboard > Integrations before running this file.
-- Releases unconfirmed "Maybe" signups as soon as their two-hour deadline passes.
select cron.schedule(
  'expire-unconfirmed-signups',
  '* * * * *',
  'select public.expire_unconfirmed_signups();'
);
