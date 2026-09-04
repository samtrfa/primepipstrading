-- Expire unpaid accounts independently of user visits or payment verification requests.
UPDATE public.accounts
SET status = 'failed'
WHERE status = 'pending_payment'
  AND created_at <= now() - interval '30 minutes';

SELECT cron.schedule(
  'expire-pending-payment-accounts',
  '* * * * *',
  $$
    UPDATE public.accounts
    SET status = 'failed'
    WHERE status = 'pending_payment'
      AND created_at <= now() - interval '30 minutes';
  $$
);