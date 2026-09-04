CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  commission_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  account_purchased BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_user_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals they made"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE OR REPLACE FUNCTION public.create_referral_from_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  referral_code TEXT := NEW.raw_user_meta_data ->> 'referral_code';
  referrer UUID;
BEGIN
  IF referral_code IS NULL OR referral_code !~ '^[a-f0-9]{8}$' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO referrer FROM auth.users
  WHERE LEFT(id::TEXT, 8) = referral_code AND id <> NEW.id LIMIT 1;

  IF referrer IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id)
    VALUES (referrer, NEW.id)
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_create_referral
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.create_referral_from_signup();

CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.referrals
    SET commission_earned = commission_earned +
          (NEW.price * CASE WHEN account_purchased THEN 0.05 ELSE 0.10 END),
        account_purchased = true,
        status = 'active'
    WHERE referred_user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_account_activated_award_referral
AFTER UPDATE OF status ON public.accounts FOR EACH ROW
EXECUTE FUNCTION public.award_referral_commission();