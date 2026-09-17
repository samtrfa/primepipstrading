-- Do not award referral credit for a crypto account unless its payment
-- verifier recorded the matching blockchain transaction.
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

      IF code_referrer IS NOT NULL THEN
        INSERT INTO public.referrals (referrer_id, referred_user_id)
        VALUES (code_referrer, NEW.user_id)
        ON CONFLICT (referred_user_id) DO UPDATE
        SET referrer_id = EXCLUDED.referrer_id
        WHERE public.referrals.account_purchased = false;
      END IF;
    END IF;

    commission_amount := ROUND(NEW.price * 0.125, 2);

    UPDATE public.referrals AS referral
    SET commission_earned = referral.commission_earned + commission_amount,
        account_purchased = true,
        status = 'active'
    WHERE referral.referred_user_id = NEW.user_id
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