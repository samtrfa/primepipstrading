ALTER TABLE public.affiliate_codes
  ADD COLUMN discount_percent NUMERIC NOT NULL DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

CREATE POLICY "Authenticated users can view active affiliate codes"
ON public.affiliate_codes FOR SELECT TO authenticated
USING (is_active = true);

UPDATE public.affiliate_codes
SET discount_percent = 90
WHERE code = 'SHAKER';
