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
  IF auth.uid() IS NULL OR payout_amount < 50 OR payout_destination IS NULL OR btrim(payout_destination) = '' THEN
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
