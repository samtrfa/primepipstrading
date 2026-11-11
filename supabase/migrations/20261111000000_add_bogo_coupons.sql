ALTER TABLE public.coupons
  ADD COLUMN coupon_type text NOT NULL DEFAULT 'discount',
  ADD COLUMN pay_percent numeric,
  ADD COLUMN bonus_challenge_type public.challenge_type,
  ADD COLUMN bonus_size_mode text,
  ADD COLUMN bonus_account_size integer;

ALTER TABLE public.coupons
  DROP CONSTRAINT coupons_discount_percent_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_coupon_type_check
    CHECK (coupon_type IN ('discount', 'bogo')),
  ADD CONSTRAINT coupons_discount_percent_check
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  ADD CONSTRAINT coupons_bogo_configuration_check
    CHECK (
      (
        coupon_type = 'discount'
        AND discount_percent > 0
        AND pay_percent IS NULL
        AND bonus_challenge_type IS NULL
        AND bonus_size_mode IS NULL
        AND bonus_account_size IS NULL
      )
      OR
      (
        coupon_type = 'bogo'
        AND pay_percent IS NOT NULL
        AND pay_percent > 0
        AND pay_percent <= 100
        AND pay_percent = round(pay_percent, 2)
        AND discount_percent = 100 - pay_percent
        AND challenge_types IS NOT NULL
        AND cardinality(challenge_types) = 1
        AND bonus_challenge_type IS NOT NULL
        AND bonus_size_mode IS NOT NULL
        AND (
          (bonus_size_mode = 'same_as_primary' AND bonus_account_size IS NULL)
          OR
          (
            bonus_size_mode = 'fixed'
            AND bonus_account_size IS NOT NULL
            AND bonus_account_size IN (5000, 10000, 25000, 50000, 100000, 200000)
          )
        )
      )
    );

ALTER TABLE public.accounts
  ADD COLUMN bogo_bonus_challenge_type public.challenge_type,
  ADD COLUMN bogo_bonus_account_size integer,
  ADD COLUMN bonus_of_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_bogo_bonus_plan_check
    CHECK (
      (bogo_bonus_challenge_type IS NULL AND bogo_bonus_account_size IS NULL)
      OR
      (
        bogo_bonus_challenge_type IS NOT NULL
        AND bogo_bonus_account_size IS NOT NULL
        AND bogo_bonus_account_size IN (5000, 10000, 25000, 50000, 100000, 200000)
      )
    );

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_bogo_bonus_account_check
    CHECK (
      bonus_of_account_id IS NULL
      OR (
        price = 0
        AND coupon_code IS NULL
        AND discount_percent = 0
        AND bogo_bonus_challenge_type IS NULL
        AND bogo_bonus_account_size IS NULL
      )
    );

CREATE UNIQUE INDEX accounts_single_bogo_bonus_per_purchase
  ON public.accounts (bonus_of_account_id)
  WHERE bonus_of_account_id IS NOT NULL;

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
  next_status TEXT := CASE
    WHEN lower(coalesce(p_status, 'pending')) IN ('abandoned', 'cancelled') THEN 'failed'
    ELSE lower(coalesce(p_status, 'pending'))
  END;
  reason TEXT;
  activated BOOLEAN := false;
  deleted_pending_account BOOLEAN := false;
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
  ELSIF p_amount IS NOT NULL AND p_amount < payment.amount - 0.01 THEN
    reason := format('Payment amount %s was below expected amount %s', p_amount, payment.amount);
  END IF;

  IF reason IS NOT NULL THEN
    next_status := 'failed';
  ELSIF next_status IN ('success', 'failed', 'expired', 'refunded') THEN
    NULL;
  ELSE
    next_status := 'pending';
  END IF;

  IF payment.status = 'refunded' THEN
    next_status := 'refunded';
  END IF;

  UPDATE public.payment_orders
  SET status = CASE
        WHEN payment.status = 'refunded' THEN 'refunded'
        WHEN payment.status = 'success' AND next_status IN ('pending', 'failed', 'expired') THEN 'success'
        ELSE next_status
      END,
      verified_at = CASE WHEN p_source = 'verification' OR next_status IN ('success', 'failed', 'expired', 'refunded') THEN coalesce(verified_at, now()) ELSE verified_at END,
      webhook_at = CASE WHEN p_source = 'webhook' THEN now() ELSE webhook_at END,
      failure_reason = coalesce(reason, CASE WHEN next_status IN ('failed', 'expired') THEN coalesce(payment.failure_reason, 'Provider reported an unsuccessful payment') ELSE NULL END),
      provider_metadata = payment.provider_metadata || coalesce(p_metadata, '{}'::jsonb),
      refund_amount = coalesce(p_refund_amount, refund_amount),
      refunded_at = CASE WHEN next_status = 'refunded' THEN coalesce(refunded_at, now()) ELSE refunded_at END,
      refund_reference = coalesce(p_refund_reference, refund_reference)
  WHERE id = payment.id;

  IF reason IS NULL AND next_status = 'success' THEN
    IF payment.status NOT IN ('success', 'refunded') AND account.coupon_code IS NOT NULL THEN
      UPDATE public.coupons
      SET times_used = times_used + 1
      WHERE code = account.coupon_code;
    END IF;

    IF account.status = 'pending_payment' THEN
      UPDATE public.accounts
      SET status = CASE WHEN challenge_type = 'instant' THEN 'funded'::account_status ELSE 'active'::account_status END,
          current_phase = CASE WHEN challenge_type = 'instant' THEN NULL ELSE 1 END,
          payment_tx_hash = coalesce(payment_tx_hash, p_reference)
      WHERE id = account.id AND status = 'pending_payment';
      activated := true;
    END IF;

    IF account.status <> 'failed'
       AND account.bogo_bonus_challenge_type IS NOT NULL
       AND account.bogo_bonus_account_size IS NOT NULL THEN
      INSERT INTO public.accounts (
        user_id,
        challenge_type,
        account_size,
        price,
        status,
        current_balance,
        current_phase,
        funded_started_at,
        funded_profit_loss,
        payment_provider,
        bonus_of_account_id,
        discount_percent
      )
      VALUES (
        account.user_id,
        account.bogo_bonus_challenge_type,
        account.bogo_bonus_account_size,
        0,
        CASE WHEN account.bogo_bonus_challenge_type = 'instant' THEN 'funded'::account_status ELSE 'active'::account_status END,
        account.bogo_bonus_account_size,
        CASE WHEN account.bogo_bonus_challenge_type = 'instant' THEN NULL ELSE 1 END,
        CASE WHEN account.bogo_bonus_challenge_type = 'instant' THEN now() ELSE NULL END,
        0,
        'bogo',
        account.id,
        0
      )
      ON CONFLICT (bonus_of_account_id) WHERE bonus_of_account_id IS NOT NULL DO NOTHING;
    END IF;
  ELSIF payment.status NOT IN ('success', 'refunded')
        AND lower(coalesce(p_status, '')) IN ('failed', 'abandoned', 'cancelled')
        AND account.status = 'pending_payment' THEN
    DELETE FROM public.accounts
    WHERE id = account.id AND status = 'pending_payment';
    deleted_pending_account := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'matched', true,
    'status', next_status,
    'activated', activated,
    'deleted_pending_account', deleted_pending_account,
    'account_id', account.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_paystack_payment(TEXT, TEXT, NUMERIC, TEXT, UUID, JSONB, TEXT, NUMERIC, TEXT) TO service_role;
