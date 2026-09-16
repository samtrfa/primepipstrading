-- Recompute account risk whenever a relevant account-state field changes rather than
-- only when current_balance changes. This prevents stale drawdown and phase state
-- from surviving status and phase transitions.
CREATE OR REPLACE FUNCTION public.sync_account_risk_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot RECORD;
  equity NUMERIC;
  total_profit NUMERIC;
  best_day_profit NUMERIC;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('active', 'funded', 'failed') THEN
    RETURN NEW;
  END IF;

  IF NEW.current_balance IS NOT DISTINCT FROM OLD.current_balance
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.current_phase IS NOT DISTINCT FROM OLD.current_phase
    AND NEW.phase_passed IS NOT DISTINCT FROM OLD.phase_passed
    AND NEW.drawdown_violated IS NOT DISTINCT FROM OLD.drawdown_violated
    AND NEW.high_water_mark IS NOT DISTINCT FROM OLD.high_water_mark
    AND NEW.daily_start_balance IS NOT DISTINCT FROM OLD.daily_start_balance
    AND NEW.daily_start_date IS NOT DISTINCT FROM OLD.daily_start_date
    AND NEW.funded_started_at IS NOT DISTINCT FROM OLD.funded_started_at
  THEN
    RETURN NEW;
  END IF;

  equity := COALESCE(NEW.current_balance, NEW.account_size);
  SELECT * INTO snapshot
  FROM public.account_drawdown_snapshot(NEW.id, equity);

  NEW.high_water_mark := snapshot.high_water_mark;
  NEW.daily_start_balance := snapshot.daily_start_balance;
  NEW.daily_start_date := snapshot.daily_start_date;
  NEW.max_drawdown_percent := snapshot.max_drawdown_percent;
  NEW.daily_drawdown_percent := snapshot.daily_drawdown_percent;
  NEW.drawdown_violated := snapshot.violation_type IS NOT NULL;
  NEW.violation_type := snapshot.violation_type;

  IF snapshot.violation_type IS NULL THEN
    IF NEW.status = 'failed' THEN
      NEW.status := CASE
        WHEN NEW.challenge_type = 'instant' THEN 'funded'::public.account_status
        ELSE 'active'::public.account_status
      END;
      NEW.drawdown_violated := FALSE;
      NEW.violation_type := NULL;
    END IF;
  ELSE
    NEW.status := 'failed'::public.account_status;
  END IF;

  SELECT COALESCE(SUM(day_profit), 0), COALESCE(MAX(day_profit), 0)
  INTO total_profit, best_day_profit
  FROM (
    SELECT (position_row.closed_at AT TIME ZONE 'UTC')::date AS trading_day,
           SUM(GREATEST(position_row.profit_loss, 0)) AS day_profit
    FROM public.positions AS position_row
    WHERE position_row.account_id = NEW.id
      AND position_row.status = 'closed'
      AND position_row.closed_at IS NOT NULL
      AND (NEW.status <> 'funded' OR NEW.funded_started_at IS NULL OR position_row.closed_at >= NEW.funded_started_at)
    GROUP BY (position_row.closed_at AT TIME ZONE 'UTC')::date
  ) AS daily_totals;

  NEW.consistency_score := CASE WHEN total_profit > 0 THEN best_day_profit / total_profit * 100 ELSE 0 END;
  NEW.best_trading_day_profit := best_day_profit;
  NEW.closed_profit_total := total_profit;

  IF NEW.status = 'funded' THEN
    NEW.funded_profit_loss := COALESCE(OLD.funded_profit_loss, 0) + (equity - COALESCE(OLD.current_balance, OLD.account_size));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_risk_metrics ON public.accounts;
CREATE TRIGGER sync_account_risk_metrics
BEFORE UPDATE OF current_balance, status, current_phase, phase_passed, drawdown_violated, high_water_mark, daily_start_balance, daily_start_date, funded_started_at
ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_risk_metrics();
