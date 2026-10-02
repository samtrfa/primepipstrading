-- Disable the crypto challenge-payment verifier and make Paystack the default
-- provider for any server-created account that does not specify a provider.
SELECT cron.unschedule('verify-bsc-payment')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'verify-bsc-payment'
);

ALTER TABLE public.accounts
  ALTER COLUMN payment_provider SET DEFAULT 'paystack';

CREATE OR REPLACE FUNCTION public.reject_crypto_challenge_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_provider = 'crypto' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Crypto challenge payments are no longer supported';
    END IF;

    IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
      RAISE EXCEPTION 'Crypto challenge payments cannot activate accounts';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_crypto_challenge_payments ON public.accounts;
CREATE TRIGGER reject_crypto_challenge_payments
BEFORE INSERT OR UPDATE OF payment_provider, status ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.reject_crypto_challenge_payments();

UPDATE public.accounts
SET status = 'failed'
WHERE payment_provider = 'crypto'
  AND status = 'pending_payment';

UPDATE public.payment_orders
SET status = 'expired',
    failure_reason = COALESCE(failure_reason, 'Crypto challenge payments are no longer supported')
WHERE provider = 'crypto'
  AND status = 'pending';
