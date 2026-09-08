CREATE UNIQUE INDEX IF NOT EXISTS accounts_payment_tx_hash_key
  ON public.accounts (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_crypto_reference_key
  ON public.payment_orders (provider_reference)
  WHERE provider = 'crypto';