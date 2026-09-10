-- Reconcile stale drawdown failures and restore accounts that were marked failed
-- without actually breaching the configured thresholds.
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
  IF NEW.current_balance IS NOT DISTINCT FROM OLD.current_balance THEN
    RETURN NEW;
  END IF;

  equity := COALESCE(NEW.current_balance, NEW.account_size);
  SELECT * INTO snapshot FROM public.account_drawdown_snapshot(NEW.id, equity);

  NEW.high_water_mark := snapshot.high_water_mark;
  NEW.daily_start_balance := snapshot.daily_start_balance;
  NEW.daily_start_date := snapshot.daily_start_date;
  NEW.max_drawdown_percent := snapshot.max_drawdown_percent;
  NEW.daily_drawdown_percent := snapshot.daily_drawdown_percent;

  NEW.drawdown_violated := snapshot.violation_type IS NOT NULL;
  NEW.violation_type := snapshot.violation_type;

  -- False-positive failures must be cleared if the current risk snapshot is below
  -- the configured thresholds, even when the account was previously marked failed.
  IF NEW.status = 'failed' AND snapshot.violation_type IS NULL THEN
    NEW.status := CASE WHEN NEW.challenge_type = 'instant' THEN 'funded'::account_status ELSE 'active'::account_status END;
    NEW.drawdown_violated := FALSE;
    NEW.violation_type := NULL;
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

  IF snapshot.violation_type IS NOT NULL THEN
    NEW.status := 'failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_risk_metrics ON public.accounts;
CREATE TRIGGER sync_account_risk_metrics
BEFORE UPDATE OF current_balance ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_risk_metrics();

-- Repair any existing false-failure records by recalculating the live drawdown
-- snapshot and reactivating accounts that are below the configured limits.
CREATE OR REPLACE FUNCTION public.reconcile_false_failed_accounts()
RETURNS TABLE(
  account_id UUID,
  previous_status public.account_status,
  new_status public.account_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.accounts%ROWTYPE;
  snapshot RECORD;
BEGIN
  FOR account_row IN
    SELECT *
    FROM public.accounts
    WHERE status = 'failed'
      AND EXISTS (
        SELECT 1
        FROM public.positions
        WHERE positions.account_id = accounts.id
      )
    FOR UPDATE
  LOOP
    SELECT * INTO snapshot
    FROM public.account_drawdown_snapshot(account_row.id, COALESCE(account_row.current_balance, account_row.account_size));

    previous_status := account_row.status;

    IF snapshot.violation_type IS NULL THEN
      UPDATE public.accounts
      SET status = CASE WHEN challenge_type = 'instant' THEN 'funded'::public.account_status ELSE 'active'::public.account_status END,
          drawdown_violated = false,
          violation_type = NULL,
          high_water_mark = snapshot.high_water_mark,
          daily_start_balance = snapshot.daily_start_balance,
          daily_start_date = snapshot.daily_start_date,
          max_drawdown_percent = snapshot.max_drawdown_percent,
          daily_drawdown_percent = snapshot.daily_drawdown_percent
      WHERE id = account_row.id;

      new_status := CASE WHEN account_row.challenge_type = 'instant' THEN 'funded'::public.account_status ELSE 'active'::public.account_status END;
    ELSE
      new_status := account_row.status;
    END IF;

    account_id := account_row.id;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_false_failed_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_false_failed_accounts() TO service_role;
