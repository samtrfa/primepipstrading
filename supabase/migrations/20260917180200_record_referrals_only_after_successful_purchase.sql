-- Referral rows represent completed purchases, not signup attempts.
DROP TRIGGER IF EXISTS on_auth_user_created_create_referral ON auth.users;

CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  commission_amount DECIMAL(12,2);
  commission_referrer UUID;
  code_referrer UUID;
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded')
     AND (NEW.payment_provider IS DISTINCT FROM 'crypto' OR NEW.payment_tx_hash IS NOT NULL) THEN
    IF NEW.coupon_code IS NOT NULL THEN
      SELECT user_id INTO code_referrer
      FROM public.affiliate_codes
      WHERE code = upper(NEW.coupon_code)
        AND user_id <> NEW.user_id;
    END IF;

    IF code_referrer IS NULL THEN
      SELECT affiliate.user_id INTO code_referrer
      FROM auth.users AS referred_user
      JOIN public.affiliate_codes AS affiliate
        ON affiliate.code = upper(referred_user.raw_user_meta_data ->> 'referral_code')
       AND affiliate.user_id <> referred_user.id
      WHERE referred_user.id = NEW.user_id;
    END IF;

    IF code_referrer IS NOT NULL THEN
      INSERT INTO public.referrals (referrer_id, referred_user_id, status, account_purchased)
      VALUES (code_referrer, NEW.user_id, 'pending', false)
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;

    commission_amount := ROUND(NEW.price * 0.125, 2);

    UPDATE public.referrals AS referral
    SET commission_earned = referral.commission_earned + commission_amount,
        account_purchased = true,
        status = 'active'
    WHERE referral.referred_user_id = NEW.user_id
      AND referral.account_purchased = false
      AND EXISTS (
        SELECT 1
        FROM public.affiliate_codes
        WHERE user_id = referral.referrer_id
      )
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

-- Any old signup-only rows are not referrals until a successful purchase exists.
DELETE FROM public.referrals
WHERE account_purchased = false;