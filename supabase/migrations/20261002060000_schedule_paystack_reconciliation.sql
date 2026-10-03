ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payment_orders_pending_paystack_poll_idx
  ON public.payment_orders (checkout_at, last_polled_at)
  WHERE provider = 'paystack' AND status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_pending_paystack_payments(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(id UUID, provider_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT payment.id
    FROM public.payment_orders AS payment
    WHERE payment.provider = 'paystack'
      AND payment.status = 'pending'
      AND payment.checkout_at <= now() - interval '5 minutes'
      AND (
        payment.last_polled_at IS NULL
        OR payment.last_polled_at <= now() - interval '15 minutes'
      )
    ORDER BY payment.checkout_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
  )
  UPDATE public.payment_orders AS payment
  SET last_polled_at = now()
  FROM candidates
  WHERE payment.id = candidates.id
  RETURNING payment.id, payment.provider_reference;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_paystack_payments(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_paystack_payments(INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('reconcile-pending-paystack')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reconcile-pending-paystack'
);

SELECT cron.schedule(
  'reconcile-pending-paystack',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/reconcile-pending-paystack',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'paystack_reconciliation_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
  $$
);
