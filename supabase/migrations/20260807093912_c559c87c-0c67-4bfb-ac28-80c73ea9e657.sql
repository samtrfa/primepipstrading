CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent numeric NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  challenge_types challenge_type[],
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  max_uses integer,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active coupons"
ON public.coupons FOR SELECT TO authenticated
USING (is_active = true);

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.accounts
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_percent numeric NOT NULL DEFAULT 0;

INSERT INTO public.coupons (code, discount_percent, challenge_types)
VALUES ('PRIME75', 75, ARRAY['one_step']::challenge_type[]);