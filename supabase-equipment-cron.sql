-- Enable Supabase Cron in Dashboard > Integrations before running this file.
-- Refreshes check-out state and auto-releases unconfirmed equipment every minute.
select cron.schedule(
  'refresh-equipment-checkout-statuses',
  '* * * * *',
  'select public.refresh_equipment_checkout_statuses();'
);
