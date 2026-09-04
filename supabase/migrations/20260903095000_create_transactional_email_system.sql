CREATE TABLE public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their email preferences"
ON public.email_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their email preferences"
ON public.email_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their email preferences"
ON public.email_preferences FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their email delivery history"
ON public.email_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX email_events_pending_idx ON public.email_events (status, created_at)
WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.enqueue_email_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  user_email TEXT;
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL OR p_idempotency_key IS NULL THEN RETURN; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
  IF user_email IS NULL OR btrim(user_email) = '' THEN RETURN; END IF;

  INSERT INTO public.email_events (user_id, event_type, idempotency_key, recipient, metadata)
  VALUES (p_user_id, p_event_type, p_idempotency_key, user_email, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_events(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.email_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claimed public.email_events;
BEGIN
  FOR claimed IN
    SELECT * FROM public.email_events
    WHERE status = 'pending'
      OR (status = 'failed' AND attempts < 5 AND updated_at < now() - interval '1 minute')
      OR (status = 'processing' AND updated_at < now() - interval '15 minutes')
    ORDER BY created_at
    LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.email_events
    SET status = 'processing', attempts = attempts + 1, updated_at = now()
    WHERE id = claimed.id
    RETURNING * INTO claimed;
    RETURN NEXT claimed;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_email_event_result(
  p_id UUID,
  p_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.email_events
  SET status = p_status,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      error_message = p_error_message,
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_welcome_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_email_event(NEW.id, 'account_created', 'user:' || NEW.id || ':welcome',
    jsonb_build_object('dashboard_url', '/dashboard'));
  INSERT INTO public.email_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enqueue_welcome_email
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email();

CREATE OR REPLACE FUNCTION public.enqueue_account_email_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_date TEXT := COALESCE(NEW.daily_start_date::text, CURRENT_DATE::text);
  max_limit NUMERIC;
  daily_limit NUMERIC;
  remaining_limit NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending_payment' THEN
    PERFORM public.enqueue_email_event(NEW.user_id, 'purchase_initiated', 'account:' || NEW.id || ':purchase-initiated', jsonb_build_object('account_id', NEW.id, 'challenge_type', NEW.challenge_type, 'account_size', NEW.account_size, 'amount', NEW.price, 'payment_reference', NEW.payment_reference));
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
      PERFORM public.enqueue_email_event(NEW.user_id, 'purchase_successful', 'account:' || NEW.id || ':purchase-successful', jsonb_build_object('account_id', NEW.id, 'challenge_type', NEW.challenge_type, 'account_size', NEW.account_size, 'amount', NEW.price, 'payment_reference', NEW.payment_reference));
      PERFORM public.enqueue_email_event(NEW.user_id, 'account_activated', 'account:' || NEW.id || ':activation', jsonb_build_object('account_id', NEW.id, 'challenge_type', NEW.challenge_type, 'account_size', NEW.account_size, 'dashboard_url', '/dashboard', 'rules_url', '/how-it-works'));
    ELSIF OLD.status = 'pending_payment' AND NEW.status = 'failed' THEN
      PERFORM public.enqueue_email_event(NEW.user_id, 'payment_failed_or_expired', 'account:' || NEW.id || ':payment-failed', jsonb_build_object('account_id', NEW.id, 'payment_reference', NEW.payment_reference, 'retry_url', '/purchase-account'));
    END IF;
    IF COALESCE(OLD.phase_passed, false) = false AND COALESCE(NEW.phase_passed, false) = true THEN
      PERFORM public.enqueue_email_event(NEW.user_id, 'phase_passed', 'account:' || NEW.id || ':phase:' || COALESCE(NEW.current_phase, 1), jsonb_build_object('account_id', NEW.id, 'phase', NEW.current_phase, 'performance', NEW.profit_loss));
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'failed' AND OLD.status <> 'pending_payment' THEN
      PERFORM public.enqueue_email_event(NEW.user_id, 'account_breached', 'account:' || NEW.id || ':breach', jsonb_build_object('account_id', NEW.id, 'breach_type', NEW.violation_type, 'metric', NEW.max_drawdown_percent, 'threshold', (public.trading_rules(NEW.challenge_type::text, COALESCE(NEW.current_phase, 1))).max_drawdown, 'timestamp', now(), 'status', NEW.status));
    END IF;
    IF NEW.status IN ('active', 'funded') AND (NEW.max_drawdown_percent IS DISTINCT FROM OLD.max_drawdown_percent OR NEW.daily_drawdown_percent IS DISTINCT FROM OLD.daily_drawdown_percent) THEN
      SELECT max_drawdown, daily_drawdown INTO max_limit, daily_limit FROM public.trading_rules(NEW.challenge_type::text, COALESCE(NEW.current_phase, 1));
      IF (max_limit > 0 AND NEW.max_drawdown_percent >= max_limit * 0.8) OR (daily_limit > 0 AND NEW.daily_drawdown_percent >= daily_limit * 0.8) THEN
        remaining_limit := least(NULLIF(max_limit - NEW.max_drawdown_percent, max_limit), NULLIF(daily_limit - NEW.daily_drawdown_percent, daily_limit));
        PERFORM public.enqueue_email_event(NEW.user_id, 'drawdown_warning', 'account:' || NEW.id || ':drawdown:' || event_date, jsonb_build_object('account_id', NEW.id, 'current_drawdown', greatest(NEW.max_drawdown_percent, NEW.daily_drawdown_percent), 'remaining_allowance', greatest(0, COALESCE(remaining_limit, 0)), 'rule', 'Review the maximum and daily drawdown limits in your dashboard.'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enqueue_account_email_events
AFTER INSERT OR UPDATE OF status, phase_passed, current_phase, max_drawdown_percent, daily_drawdown_percent ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_account_email_events();

CREATE OR REPLACE FUNCTION public.enqueue_payout_email_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_email_event(NEW.user_id, 'payout_submitted', 'payout:' || NEW.id || ':submitted', jsonb_build_object('payout_id', NEW.id, 'amount', NEW.amount, 'method', NEW.method, 'account_id', NEW.account_id, 'submitted_at', NEW.created_at));
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.enqueue_email_event(NEW.user_id, 'payout_' || NEW.status, 'payout:' || NEW.id || ':status:' || NEW.status, jsonb_build_object('payout_id', NEW.id, 'amount', NEW.amount, 'method', NEW.method, 'account_id', NEW.account_id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enqueue_payout_email_events
AFTER INSERT OR UPDATE OF status ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_payout_email_events();

CREATE OR REPLACE FUNCTION public.enqueue_kyc_email_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.enqueue_email_event(NEW.user_id, 'kyc_submitted', 'kyc:' || NEW.id || ':submitted', jsonb_build_object('kyc_id', NEW.id, 'submitted_at', COALESCE(NEW.identity_submitted_at, NEW.address_submitted_at, now())));
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.enqueue_email_event(NEW.user_id, 'kyc_' || NEW.status, 'kyc:' || NEW.id || ':' || NEW.status, jsonb_build_object('kyc_id', NEW.id, 'status', NEW.status, 'rejection_reason', NEW.rejection_reason));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enqueue_kyc_email_events
AFTER INSERT OR UPDATE OF status ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_kyc_email_events();