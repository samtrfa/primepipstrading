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
    IF OLD.status = 'pending_payment' THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'payment_failed_or_expired',
        'Payment not completed',
        'This account purchase expired or was declined before payment was confirmed. You can retry purchase from the checkout page.',
        'account:' || NEW.id || ':payment-failed',
        jsonb_build_object('account_id', NEW.id, 'payment_reference', NEW.payment_reference, 'retry_url', '/purchase-account')
      );
    ELSE
      PERFORM public.create_notification(
        NEW.user_id,
        'account_failure',
        'Account failed',
        'Your trading account has breached its rules. Review your account details for more information.',
        'account:' || NEW.id || ':failure',
        jsonb_build_object('account_id', NEW.id, 'violation_type', NEW.violation_type)
      );
    END IF;
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
