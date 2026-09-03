ALTER TABLE public.payment_orders
  DROP CONSTRAINT payment_orders_status_check,
  ADD CONSTRAINT payment_orders_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'expired', 'refunded', 'unmatched', 'granted'));

INSERT INTO public.payment_orders (
  user_id,
  account_id,
  provider,
  provider_reference,
  amount,
  currency,
  status,
  verified_at,
  provider_metadata
)
SELECT
  account.user_id,
  account.id,
  'admin',
  'grant-' || account.id,
  0,
  'USD',
  'granted',
  account.created_at,
  jsonb_build_object('granted_by_admin', true, 'backfilled', true)
FROM public.accounts AS account
WHERE account.price = 0
  AND account.status IN ('active', 'funded', 'passed')
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_orders AS payment
    WHERE payment.account_id = account.id
  );
