CREATE TABLE public.affiliate_balances (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
  reserved DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  paid DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affiliate balance"
ON public.affiliate_balances FOR SELECT
USING (auth.uid() = user_id);

-- Existing commissions have not previously been withdrawable, so seed them as available.
INSERT INTO public.affiliate_balances (user_id, available)
SELECT referrer_id, SUM(commission_earned)
FROM public.referrals
WHERE commission_earned > 0
GROUP BY referrer_id;

CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  commission_amount DECIMAL(12,2);
  commission_referrer UUID;
BEGIN
  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
    commission_amount := ROUND(NEW.price * 0.125, 2);

    UPDATE public.referrals
    SET commission_earned = commission_earned + commission_amount,
        account_purchased = true,
        status = 'active'
    WHERE referred_user_id = NEW.user_id
    RETURNING referrer_id INTO commission_referrer;

    IF FOUND THEN
      INSERT INTO public.affiliate_balances (user_id, available)
      VALUES (commission_referrer, commission_amount)
      ON CONFLICT (user_id) DO UPDATE
      SET available = affiliate_balances.available + EXCLUDED.available,
          updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.payout_requests
  ALTER COLUMN account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'trading_profit'
    CHECK (source IN ('trading_profit', 'referral_commission'));

DROP POLICY IF EXISTS "Users can create their own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create their own payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    (source = 'trading_profit' AND account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = payout_requests.account_id
        AND accounts.user_id = auth.uid()
        AND (accounts.status = 'funded' OR (accounts.challenge_type = 'instant' AND accounts.status = 'active'))
    ))
    OR (source = 'referral_commission' AND account_id IS NULL AND method = 'crypto' AND EXISTS (
      SELECT 1 FROM public.affiliate_balances
      WHERE affiliate_balances.user_id = auth.uid() AND available >= amount
    ))
  )
);

CREATE OR REPLACE FUNCTION public.create_commission_payout(
  payout_amount DECIMAL,
  payout_destination TEXT
)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  balance_row public.affiliate_balances;
  payout public.payout_requests;
BEGIN
  IF auth.uid() IS NULL OR payout_amount < 100 OR payout_destination IS NULL OR btrim(payout_destination) = '' THEN
    RAISE EXCEPTION 'Invalid commission payout request';
  END IF;

  SELECT * INTO balance_row
  FROM public.affiliate_balances
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF balance_row.user_id IS NULL OR balance_row.available < payout_amount THEN
    RAISE EXCEPTION 'Insufficient commission balance';
  END IF;

  UPDATE public.affiliate_balances
  SET available = available - payout_amount,
      reserved = reserved + payout_amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.payout_requests (user_id, account_id, amount, method, destination, source)
  VALUES (auth.uid(), NULL, payout_amount, 'crypto', btrim(payout_destination), 'referral_commission')
  RETURNING * INTO payout;

  RETURN payout;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_commission_payout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.source = 'referral_commission' AND OLD.status IN ('pending', 'approved') AND NEW.status = 'paid' THEN
    UPDATE public.affiliate_balances
    SET reserved = reserved - NEW.amount, paid = paid + NEW.amount, updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF OLD.source = 'referral_commission' AND OLD.status IN ('pending', 'approved') AND NEW.status = 'rejected' THEN
    UPDATE public.affiliate_balances
    SET reserved = reserved - NEW.amount, available = available + NEW.amount, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reconcile_commission_payout ON public.payout_requests;
CREATE TRIGGER reconcile_commission_payout
AFTER UPDATE OF status ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.reconcile_commission_payout();

REVOKE ALL ON FUNCTION public.create_commission_payout(DECIMAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commission_payout(DECIMAL, TEXT) TO authenticated;