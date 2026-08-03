ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'crypto',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_amount_local numeric;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_payment_reference_key ON public.accounts (payment_reference) WHERE payment_reference IS NOT NULL;