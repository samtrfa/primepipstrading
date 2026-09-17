-- Keep Admin recovery of a paid pending account atomic inside the database.
CREATE OR REPLACE FUNCTION public.admin_activate_pending_account(
  p_account_id UUID
)
RETURNS public.accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  account_row public.accounts;
  payment_row public.payment_orders;
  reconciliation JSONB;
BEGIN
  SELECT * INTO account_row
  FROM public.accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF account_row.status IN ('active', 'funded') THEN
    RETURN account_row;
  END IF;

  IF account_row.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Account is not awaiting payment';
  END IF;

  SELECT * INTO payment_row
  FROM public.payment_orders
  WHERE account_id = p_account_id
    AND provider = 'paystack'
  ORDER BY checkout_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Paystack payment order is linked to this account';
  END IF;

  reconciliation := public.reconcile_paystack_payment(
    payment_row.provider_reference,
    'success',
    payment_row.amount,
    payment_row.currency,
    NULL,
    jsonb_build_object('source', 'admin-account-recovery'),
    'admin'
  );

  IF (reconciliation ->> 'activated')::boolean IS DISTINCT FROM true THEN
    UPDATE public.payment_orders
    SET status = 'success',
        verified_at = COALESCE(verified_at, now()),
        failure_reason = NULL,
        provider_metadata = provider_metadata || jsonb_build_object('source', 'admin-account-recovery')
    WHERE id = payment_row.id;

    UPDATE public.accounts
    SET status = CASE WHEN challenge_type = 'instant' THEN 'funded'::public.account_status ELSE 'active'::public.account_status END,
        current_phase = CASE WHEN challenge_type = 'instant' THEN NULL ELSE COALESCE(current_phase, 1) END,
        payment_tx_hash = COALESCE(payment_tx_hash, payment_row.provider_reference)
    WHERE id = account_row.id AND status = 'pending_payment';
  END IF;

  SELECT * INTO account_row
  FROM public.accounts
  WHERE id = p_account_id;

  IF account_row.status NOT IN ('active', 'funded') THEN
    RAISE EXCEPTION 'Payment reconciliation did not activate the account';
  END IF;

  RETURN account_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_pending_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_pending_account(UUID) TO service_role;
