ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_status_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'expired', 'refunded', 'unmatched', 'granted'));
