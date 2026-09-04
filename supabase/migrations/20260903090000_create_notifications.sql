CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT notifications_user_event_key UNIQUE (user_id, event_key)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX notifications_user_created_at_idx
ON public.notifications (user_id, created_at DESC);

CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_event_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_event_key IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, event_key, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_event_key, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, event_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_account_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_key TEXT;
  max_drawdown_limit NUMERIC;
  daily_drawdown_limit NUMERIC;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending_payment' AND NEW.status IN ('active', 'funded') THEN
    PERFORM public.create_notification(NEW.user_id, 'payment_confirmation', 'Payment confirmed', 'Your trading account payment has been confirmed.', 'account:' || NEW.id || ':payment', jsonb_build_object('account_id', NEW.id));
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('active', 'funded') THEN
    PERFORM public.create_notification(NEW.user_id, 'account_activation', 'Account activated', 'Your trading account is ready to trade.', 'account:' || NEW.id || ':activation', jsonb_build_object('account_id', NEW.id));
  END IF;

  IF COALESCE(OLD.phase_passed, false) = false AND COALESCE(NEW.phase_passed, false) = true THEN
    PERFORM public.create_notification(NEW.user_id, 'phase_completion', 'Phase completed', 'You reached the target for your current trading phase.', 'account:' || NEW.id || ':phase:' || COALESCE(NEW.current_phase, 1), jsonb_build_object('account_id', NEW.id, 'phase', NEW.current_phase));
  END IF;

  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_notification(NEW.user_id, 'account_failure', 'Account failed', 'Your trading account has breached its rules. Review your account details for more information.', 'account:' || NEW.id || ':failure', jsonb_build_object('account_id', NEW.id, 'violation_type', NEW.violation_type));
  END IF;

  IF NEW.status IN ('active', 'funded') AND (NEW.max_drawdown_percent IS DISTINCT FROM OLD.max_drawdown_percent OR NEW.daily_drawdown_percent IS DISTINCT FROM OLD.daily_drawdown_percent) THEN
    SELECT max_drawdown, daily_drawdown INTO max_drawdown_limit, daily_drawdown_limit FROM public.trading_rules(NEW.challenge_type::text, COALESCE(NEW.current_phase, 1));
    IF (max_drawdown_limit > 0 AND NEW.max_drawdown_percent >= max_drawdown_limit * 0.8)
      OR (daily_drawdown_limit > 0 AND NEW.daily_drawdown_percent >= daily_drawdown_limit * 0.8) THEN
      event_key := 'account:' || NEW.id || ':drawdown:' || COALESCE(NEW.daily_start_date::text, CURRENT_DATE::text);
      PERFORM public.create_notification(NEW.user_id, 'drawdown_warning', 'Drawdown warning', 'Your account is approaching its drawdown limit. Review your risk immediately.', event_key, jsonb_build_object('account_id', NEW.id, 'max_drawdown_percent', NEW.max_drawdown_percent, 'daily_drawdown_percent', NEW.daily_drawdown_percent));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_account_events
AFTER UPDATE OF status, phase_passed, current_phase, max_drawdown_percent, daily_drawdown_percent ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.notify_account_event();

CREATE OR REPLACE FUNCTION public.notify_payout_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(NEW.user_id, 'payout_submitted', 'Payout submitted', 'Your payout request has been submitted for review.', 'payout:' || NEW.id || ':submitted', jsonb_build_object('payout_id', NEW.id, 'amount', NEW.amount));
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_notification(NEW.user_id, 'payout_status', 'Payout ' || NEW.status, 'Your payout request status changed to ' || NEW.status || '.', 'payout:' || NEW.id || ':status:' || NEW.status, jsonb_build_object('payout_id', NEW.id, 'status', NEW.status, 'amount', NEW.amount));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_payout_events
AFTER INSERT OR UPDATE OF status ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_payout_event();

CREATE OR REPLACE FUNCTION public.notify_kyc_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.create_notification(NEW.user_id, 'kyc_' || NEW.status, 'KYC ' || NEW.status, CASE WHEN NEW.status = 'approved' THEN 'Your identity verification has been approved.' ELSE 'Your identity verification was rejected. Review the reason and resubmit your documents.' END, 'kyc:' || NEW.id || ':' || NEW.status, jsonb_build_object('kyc_id', NEW.id, 'status', NEW.status, 'rejection_reason', NEW.rejection_reason));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_kyc_events
AFTER UPDATE OF status ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_event();

CREATE OR REPLACE FUNCTION public.notify_affiliate_application_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.create_notification(NEW.user_id, 'affiliate_' || NEW.status, 'Affiliate application ' || NEW.status, CASE WHEN NEW.status = 'approved' THEN 'Your affiliate application has been approved.' ELSE 'Your affiliate application was rejected. Review the application details for more information.' END, 'affiliate-application:' || NEW.id || ':' || NEW.status, jsonb_build_object('application_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_affiliate_application_events
AFTER UPDATE OF status ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_affiliate_application_event();

CREATE OR REPLACE FUNCTION public.notify_referral_commission_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_earned > COALESCE(OLD.commission_earned, 0) THEN
    PERFORM public.create_notification(NEW.referrer_id, 'affiliate_commission', 'Commission earned', 'You earned a new affiliate commission of $' || to_char(NEW.commission_earned - COALESCE(OLD.commission_earned, 0), 'FM999999990.00') || '.', 'referral:' || NEW.id || ':commission:' || NEW.commission_earned::text, jsonb_build_object('referral_id', NEW.id, 'commission', NEW.commission_earned - COALESCE(OLD.commission_earned, 0)));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_referral_commission_events
AFTER UPDATE OF commission_earned ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_commission_event();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;
