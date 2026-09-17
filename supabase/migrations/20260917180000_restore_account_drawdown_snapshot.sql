-- Restore the drawdown helper if the original migration was recorded without
-- creating the function in the remote schema.
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
  account_row public.accounts%ROWTYPE;
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
  SELECT * INTO rules
  FROM public.trading_rules(account_row.challenge_type::text, COALESCE(account_row.current_phase, 1));
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