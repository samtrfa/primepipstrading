-- Award referral commission for every successful first account activation,
-- including instant accounts that move directly from pending_payment to funded.
CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
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