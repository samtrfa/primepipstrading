-- Consistency is stage-specific. Evaluation trades must not dilute or inflate
-- the funded-stage consistency score used for payouts.
CREATE OR REPLACE FUNCTION public.account_consistency_score(p_account_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH account_state AS (
    SELECT status, funded_started_at
    FROM public.accounts
    WHERE id = p_account_id
  ),
  profitable_positions AS (
    SELECT
      (position_row.closed_at AT TIME ZONE 'UTC')::date AS trading_day,
      position_row.profit_loss
    FROM public.positions AS position_row
    CROSS JOIN account_state
    WHERE position_row.account_id = p_account_id
      AND position_row.status = 'closed'
      AND position_row.closed_at IS NOT NULL
      AND position_row.profit_loss > 0
      AND (
        account_state.status <> 'funded'
        OR account_state.funded_started_at IS NULL
        OR position_row.closed_at >= account_state.funded_started_at
      )
  ),
  daily_totals AS (
    SELECT trading_day, SUM(profit_loss) AS day_profit
    FROM profitable_positions
    GROUP BY trading_day
  )
  SELECT CASE
    WHEN COALESCE(SUM(day_profit), 0) > 0
      THEN COALESCE(MAX(day_profit), 0) / SUM(day_profit) * 100
    ELSE 0
  END
  FROM daily_totals;
$$;

REVOKE ALL ON FUNCTION public.account_consistency_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_consistency_score(UUID) TO authenticated, service_role;
