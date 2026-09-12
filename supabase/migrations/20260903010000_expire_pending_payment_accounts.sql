-- Remove abandoned unpaid purchases instead of leaving a failed placeholder in the accounts list.
DELETE FROM public.accounts
WHERE status = 'pending_payment'
  AND created_at <= now() - interval '30 minutes';

SELECT cron.schedule(
  'expire-pending-payment-accounts',
  '* * * * *',
  $$
    DELETE FROM public.accounts
    WHERE status = 'pending_payment'
      AND created_at <= now() - interval '30 minutes';
  $$
);