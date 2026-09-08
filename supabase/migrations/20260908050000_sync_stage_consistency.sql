-- Keep the balance-change risk trigger aligned with the stage-aware consistency function.
CREATE OR REPLACE FUNCTION public.sync_account_risk_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rules RECORD;
  daily_start NUMERIC;
  equity NUMERIC;
  maxdd NUMERIC;
  dailydd NUMERIC;
  violation TEXT;
  total_profit NUMERIC;
  best_day_profit NUMERIC;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.current_phase IS DISTINCT FROM OLD.current_phase THEN
    RETURN NEW;
  END IF;
  IF NEW.current_balance IS NOT DISTINCT FROM OLD.current_balance THEN
    RETURN NEW;
  END IF;

  equity := COALESCE(NEW.current_balance, NEW.account_size);
  IF NEW.daily_start_date IS NULL OR NEW.daily_start_date < CURRENT_DATE THEN
    daily_start := COALESCE(OLD.current_balance, OLD.account_size);
    NEW.daily_start_date := CURRENT_DATE;
    NEW.daily_start_balance := daily_start;
  ELSE
    daily_start := CASE WHEN COALESCE(NEW.daily_start_balance, 0) > 0 THEN NEW.daily_start_balance ELSE COALESCE(NEW.current_balance, NEW.account_size) END;
  END IF;

  NEW.high_water_mark := GREATEST(COALESCE(OLD.high_water_mark, OLD.account_size), equity);
  maxdd := GREATEST(0, (NEW.high_water_mark - equity) / NULLIF(NEW.high_water_mark, 0) * 100);
  dailydd := GREATEST(0, (daily_start - equity) / NULLIF(daily_start, 0) * 100);
  SELECT * INTO rules FROM public.trading_rules(NEW.challenge_type::text, COALESCE(NEW.current_phase, 1));
  violation := CASE
    WHEN maxdd >= rules.max_drawdown THEN 'max_drawdown'
    WHEN dailydd >= rules.daily_drawdown THEN 'daily_drawdown'
    ELSE NULL
  END;

  SELECT COALESCE(SUM(day_profit), 0), COALESCE(MAX(day_profit), 0)
  INTO total_profit, best_day_profit
  FROM (
    SELECT (position_row.closed_at AT TIME ZONE 'UTC')::date AS trading_day,
           SUM(GREATEST(position_row.profit_loss, 0)) AS day_profit
    FROM public.positions AS position_row
    WHERE position_row.account_id = NEW.id
      AND position_row.status = 'closed'
      AND position_row.closed_at IS NOT NULL
      AND (
        NEW.status <> 'funded'
        OR NEW.funded_started_at IS NULL
        OR position_row.closed_at >= NEW.funded_started_at
      )
    GROUP BY (position_row.closed_at AT TIME ZONE 'UTC')::date
  ) AS daily_totals;

  NEW.max_drawdown_percent := maxdd;
  NEW.daily_drawdown_percent := dailydd;
  NEW.drawdown_violated := violation IS NOT NULL;
  NEW.violation_type := violation;
  NEW.consistency_score := CASE WHEN total_profit > 0 THEN best_day_profit / total_profit * 100 ELSE 0 END;
  NEW.best_trading_day_profit := best_day_profit;
  NEW.closed_profit_total := total_profit;
  IF NEW.status = 'funded' THEN
    NEW.funded_profit_loss := COALESCE(OLD.funded_profit_loss, 0) + (equity - COALESCE(OLD.current_balance, OLD.account_size));
  END IF;
  IF violation IS NOT NULL THEN NEW.status := 'failed'; END IF;
  RETURN NEW;
END;
$$;
