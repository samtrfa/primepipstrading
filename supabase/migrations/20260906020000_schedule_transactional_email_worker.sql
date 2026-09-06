-- The worker is scheduled in Supabase so database triggers remain the source
-- of truth and no service-role key is exposed to the frontend.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('send-primepips-transactional-emails')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-primepips-transactional-emails'
);

SELECT cron.schedule(
  'send-primepips-transactional-emails',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);