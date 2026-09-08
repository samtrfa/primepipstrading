-- Calculate both drawdown anchors from the same account snapshot. Keeping the
-- baseline decisions together prevents daily and max drawdown from drifting.
CREATE OR REPLACE FUNCTION public.account_drawdown_snapshot(
  p_account_id UUID,
  p_equity NUMERIC
)
RETURNS TABLE (
  high_water_mark NUMERIC,
  daily_start_balance NUMERIC,
  daily_start_date DATE,
  max_drawdown_percent NUMERIC,
  daily_drawdown_percent NUMERIC,
  violation_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row accounts%ROWTYPE;
  rules RECORD;
  daily_start NUMERIC;
BEGIN
  SELECT * INTO account_row
  FROM public.accounts
  WHERE id = p_account_id;

  IF account_row.id IS NULL THEN
    RAISE EXCEPTION 'account not found';
  END IF;

  high_water_mark := GREATEST(COALESCE(account_row.high_water_mark, account_row.account_size), p_equity);

  IF account_row.daily_start_date IS NULL OR account_row.daily_start_date < CURRENT_DATE THEN
    daily_start_balance := COALESCE(account_row.current_balance, account_row.account_size);
    daily_start_date := CURRENT_DATE;
  ELSE
    daily_start_balance := CASE
      WHEN COALESCE(account_row.daily_start_balance, 0) > 0 THEN account_row.daily_start_balance
      ELSE COALESCE(account_row.current_balance, account_row.account_size)
    END;
    daily_start_date := account_row.daily_start_date;
  END IF;

  max_drawdown_percent := GREATEST(0, (high_water_mark - p_equity) / NULLIF(high_water_mark, 0) * 100);
  daily_drawdown_percent := GREATEST(0, (daily_start_balance - p_equity) / NULLIF(daily_start_balance, 0) * 100);
  SELECT * INTO rules FROM public.trading_rules(account_row.challenge_type::text, COALESCE(account_row.current_phase, 1));
  violation_type := CASE
    WHEN max_drawdown_percent >= rules.max_drawdown THEN 'max_drawdown'
    WHEN daily_drawdown_percent >= rules.daily_drawdown THEN 'daily_drawdown'
    ELSE NULL
  END;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.account_drawdown_snapshot(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_drawdown_snapshot(UUID, NUMERIC) TO authenticated, service_role;

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
  IF snapshot.violation_type IS NOT NULL THEN NEW.status := 'failed'; END IF;
  RETURN NEW;
END;
$$;