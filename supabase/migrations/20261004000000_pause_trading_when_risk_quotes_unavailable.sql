ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS risk_monitoring_degraded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.reject_position_when_risk_monitoring_degraded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = NEW.account_id
      AND risk_monitoring_degraded
  ) THEN
    RAISE EXCEPTION 'risk monitoring is temporarily unavailable; new trades are paused';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pause_trading_when_risk_monitoring_degraded ON public.positions;
CREATE TRIGGER pause_trading_when_risk_monitoring_degraded
  BEFORE INSERT ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_position_when_risk_monitoring_degraded();

REVOKE ALL ON FUNCTION public.reject_position_when_risk_monitoring_degraded() FROM PUBLIC;
