-- Pay a flat 12.5% commission for every successful referred account sale.
CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
    UPDATE public.referrals
    SET commission_earned = commission_earned + (NEW.price * 0.125),
        account_purchased = true,
        status = 'active'
    WHERE referred_user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;