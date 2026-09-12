-- Attribute successful purchases made with an affiliate code, including buyers
-- who did not use the affiliate link during registration.
CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  commission_amount DECIMAL(12,2);
  commission_referrer UUID;
  code_referrer UUID;
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
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

-- Recover successful code-based purchases that were activated before this fix.
DO $$
DECLARE
  account_row RECORD;
  code_referrer UUID;
  commission_amount DECIMAL(12,2);
BEGIN
  FOR account_row IN
    SELECT a.user_id, a.price, a.coupon_code
    FROM public.accounts AS a
    JOIN public.affiliate_codes AS ac ON ac.code = upper(a.coupon_code)
    WHERE a.status IN ('active', 'funded')
      AND a.coupon_code IS NOT NULL
      AND ac.user_id <> a.user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.referrals AS r
        WHERE r.referred_user_id = a.user_id
      )
  LOOP
    SELECT user_id INTO code_referrer
    FROM public.affiliate_codes
    WHERE code = upper(account_row.coupon_code)
      AND user_id <> account_row.user_id;

    commission_amount := ROUND(account_row.price * 0.125, 2);
    INSERT INTO public.referrals (referrer_id, referred_user_id, status, commission_earned, account_purchased)
    VALUES (code_referrer, account_row.user_id, 'active', 0, true)
    ON CONFLICT (referred_user_id) DO NOTHING;

    UPDATE public.referrals
    SET commission_earned = commission_earned + commission_amount,
        account_purchased = true,
        status = 'active'
    WHERE referred_user_id = account_row.user_id
      AND referrer_id = code_referrer;

    INSERT INTO public.affiliate_balances (user_id, available)
    VALUES (code_referrer, commission_amount)
    ON CONFLICT (user_id) DO UPDATE
    SET available = public.affiliate_balances.available + EXCLUDED.available,
        updated_at = now();
  END LOOP;
END;
$$;