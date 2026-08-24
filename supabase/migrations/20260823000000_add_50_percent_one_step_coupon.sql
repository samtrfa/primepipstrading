INSERT INTO public.coupons (code, discount_percent, challenge_types, is_active)
VALUES ('PRIME50', 50, ARRAY['one_step']::challenge_type[], true)
ON CONFLICT (code) DO UPDATE SET
  discount_percent = EXCLUDED.discount_percent,
  challenge_types = EXCLUDED.challenge_types,
  is_active = EXCLUDED.is_active,
  updated_at = now();
