-- Retry account activation whenever the payment is confirmed, even if the
-- payment ledger was marked successful by an earlier webhook attempt.
CREATE OR REPLACE FUNCTION public.reconcile_paystack_payment(
  p_reference TEXT,
  p_status TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_provider_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'verification',
  p_refund_amount NUMERIC DEFAULT NULL,
  p_refund_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  payment public.payment_orders;
  account public.accounts;
  next_status TEXT := lower(coalesce(p_status, 'pending'));
  reason TEXT;
  activated BOOLEAN := false;
BEGIN
  SELECT * INTO payment
  FROM public.payment_orders
  WHERE provider = 'paystack' AND provider_reference = p_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payment_orders (provider, provider_reference, status, amount, currency, provider_metadata, failure_reason)
    VALUES ('paystack', p_reference, 'unmatched', coalesce(p_amount, 0), coalesce(p_currency, 'UNKNOWN'), coalesce(p_metadata, '{}'::jsonb), 'No checkout order matched this provider reference')
    ON CONFLICT (provider, provider_reference) DO NOTHING;
    RETURN jsonb_build_object('matched', false, 'status', 'unmatched');
  END IF;

  IF payment.account_id IS NOT NULL THEN
    SELECT * INTO account FROM public.accounts WHERE id = payment.account_id FOR UPDATE;
  END IF;

  IF account.id IS NULL THEN
    UPDATE public.payment_orders
    SET status = 'unmatched',
        webhook_at = CASE WHEN p_source = 'webhook' THEN now() ELSE webhook_at END,
        verified_at = CASE WHEN p_source = 'verification' THEN now() ELSE verified_at END,
        provider_metadata = payment.provider_metadata || coalesce(p_metadata, '{}'::jsonb),
        failure_reason = 'Linked account no longer exists'
    WHERE id = payment.id;
    RETURN jsonb_build_object('matched', false, 'status', 'unmatched');
  END IF;

  IF payment.user_id IS DISTINCT FROM account.user_id
     OR (p_provider_user_id IS NOT NULL AND p_provider_user_id IS DISTINCT FROM account.user_id) THEN
    reason := 'Provider ownership metadata did not match the checkout owner';
  ELSIF p_currency IS NOT NULL AND upper(p_currency) <> upper(payment.currency) THEN
    reason := 'Payment currency did not match the checkout currency';
  ELSIF p_amount IS NOT NULL AND abs(p_amount - payment.amount) > 0.01 THEN
    reason := format('Payment amount %s did not match expected amount %s', p_amount, payment.amount);
  END IF;

  IF reason IS NOT NULL THEN
    next_status := 'failed';
  ELSIF next_status IN ('success', 'failed', 'expired', 'refunded') THEN
    NULL;
  ELSE
    next_status := 'pending';
  END IF;

  UPDATE public.payment_orders
  SET status = CASE WHEN payment.status IN ('refunded', 'success') AND next_status IN ('pending', 'failed', 'expired') THEN payment.status ELSE next_status END,
      verified_at = CASE WHEN p_source = 'verification' OR next_status IN ('success', 'failed', 'expired', 'refunded') THEN coalesce(verified_at, now()) ELSE verified_at END,
      webhook_at = CASE WHEN p_source = 'webhook' THEN now() ELSE webhook_at END,
      failure_reason = coalesce(reason, CASE WHEN next_status IN ('failed', 'expired') THEN coalesce(payment.failure_reason, 'Provider reported an unsuccessful payment') ELSE NULL END),
      provider_metadata = payment.provider_metadata || coalesce(p_metadata, '{}'::jsonb),
      refund_amount = coalesce(p_refund_amount, refund_amount),
      refunded_at = CASE WHEN next_status = 'refunded' THEN coalesce(refunded_at, now()) ELSE refunded_at END,
      refund_reference = coalesce(p_refund_reference, refund_reference)
  WHERE id = payment.id;

  IF reason IS NULL AND next_status = 'success' AND account.status = 'pending_payment' THEN
    UPDATE public.accounts
    SET status = CASE WHEN challenge_type = 'instant' THEN 'funded'::account_status ELSE 'active'::account_status END,
        current_phase = CASE WHEN challenge_type = 'instant' THEN NULL ELSE 1 END,
        payment_tx_hash = coalesce(payment_tx_hash, p_reference)
    WHERE id = account.id AND status = 'pending_payment';
    activated := true;
  END IF;

  RETURN jsonb_build_object('matched', true, 'status', next_status, 'activated', activated, 'account_id', account.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_paystack_payment(TEXT, TEXT, NUMERIC, TEXT, UUID, JSONB, TEXT, NUMERIC, TEXT) TO service_role;