CREATE TABLE public.affiliate_commission_reversals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_order_id UUID NOT NULL UNIQUE REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_commission_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own commission reversals"
ON public.affiliate_commission_reversals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.referrals
  WHERE referrals.id = affiliate_commission_reversals.referral_id
    AND referrals.referrer_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.reverse_refunded_affiliate_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.accounts;
  referral_row public.referrals;
  reversal_id UUID;
  commission_amount DECIMAL(12,2);
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'refunded' AND NEW.account_id IS NOT NULL THEN
    SELECT * INTO account_row FROM public.accounts WHERE id = NEW.account_id;
    SELECT * INTO referral_row
    FROM public.referrals
    WHERE referred_user_id = account_row.user_id
      AND commission_earned > 0
    LIMIT 1;

    IF referral_row.id IS NOT NULL THEN
      commission_amount := ROUND(account_row.price * 0.125, 2);
      INSERT INTO public.affiliate_commission_reversals (payment_order_id, referral_id, amount)
      VALUES (NEW.id, referral_row.id, commission_amount)
      ON CONFLICT (payment_order_id) DO NOTHING
      RETURNING id INTO reversal_id;

      IF reversal_id IS NOT NULL THEN
        UPDATE public.referrals
        SET commission_earned = GREATEST(0, commission_earned - commission_amount)
        WHERE id = referral_row.id;

        UPDATE public.affiliate_balances
        SET available = GREATEST(0, available - commission_amount),
            updated_at = now()
        WHERE user_id = referral_row.referrer_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reverse_refunded_affiliate_commission ON public.payment_orders;
CREATE TRIGGER reverse_refunded_affiliate_commission
AFTER UPDATE OF status ON public.payment_orders
FOR EACH ROW
EXECUTE FUNCTION public.reverse_refunded_affiliate_commission();
