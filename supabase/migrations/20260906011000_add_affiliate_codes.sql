CREATE TABLE public.affiliate_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,8}$'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own code"
ON public.affiliate_codes FOR SELECT
USING (auth.uid() = user_id);

ALTER TABLE public.affiliate_applications
  ADD COLUMN desired_code TEXT NOT NULL DEFAULT 'PRIME01'
  CHECK (desired_code ~ '^[A-Za-z0-9]{6,8}$');

CREATE OR REPLACE FUNCTION public.prevent_affiliate_code_collision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized_code TEXT := upper(NEW.desired_code);
BEGIN
  IF EXISTS (SELECT 1 FROM public.affiliate_codes WHERE code = normalized_code)
     OR EXISTS (SELECT 1 FROM public.coupons WHERE code = normalized_code) THEN
    RAISE EXCEPTION 'Affiliate code is already in use' USING ERRCODE = '23505';
  END IF;
  NEW.desired_code := normalized_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_affiliate_code_collision
BEFORE INSERT OR UPDATE OF desired_code ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.prevent_affiliate_code_collision();

CREATE OR REPLACE FUNCTION public.create_referral_from_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  referral_code TEXT := upper(NEW.raw_user_meta_data ->> 'referral_code');
  referrer UUID;
BEGIN
  IF referral_code IS NULL OR referral_code !~ '^[A-Z0-9]{6,8}$' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO referrer FROM public.affiliate_codes
  WHERE code = referral_code AND user_id <> NEW.id;

  IF referrer IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id)
    VALUES (referrer, NEW.id)
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_referral ON auth.users;
CREATE TRIGGER on_auth_user_created_create_referral
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.create_referral_from_signup();

CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  commission_amount DECIMAL(12,2);
  commission_referrer UUID;
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
    commission_amount := ROUND(NEW.price * 0.125, 2);

    UPDATE public.referrals AS referral
    SET commission_earned = referral.commission_earned + commission_amount,
        account_purchased = true,
        status = 'active'
    WHERE referral.referred_user_id = NEW.user_id
      AND EXISTS (SELECT 1 FROM public.affiliate_codes WHERE user_id = referral.referrer_id)
    RETURNING referral.referrer_id INTO commission_referrer;

    IF FOUND THEN
      INSERT INTO public.affiliate_balances (user_id, available)
      VALUES (commission_referrer, commission_amount)
      ON CONFLICT (user_id) DO UPDATE
      SET available = public.affiliate_balances.available + EXCLUDED.available,
          updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.coupons (code, discount_percent, challenge_types, is_active)
VALUES ('SHAKER', 90, NULL, true)
ON CONFLICT (code) DO UPDATE
SET discount_percent = 90, challenge_types = NULL, is_active = true;

DO $$
DECLARE target_user UUID;
BEGIN
  SELECT id INTO target_user FROM auth.users WHERE email = 'utiungmathias7@gmail.com';
  IF target_user IS NOT NULL THEN
    INSERT INTO public.affiliate_codes (user_id, code)
    VALUES (target_user, 'SHAKER')
    ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code;
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('affiliate', true)
    WHERE id = target_user;
  END IF;
END;
$$;
