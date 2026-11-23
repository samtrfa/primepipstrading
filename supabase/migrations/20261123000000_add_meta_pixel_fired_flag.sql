ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS pixel_fired BOOLEAN NOT NULL DEFAULT false;

