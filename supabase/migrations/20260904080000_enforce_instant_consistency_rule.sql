ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS profit_loss NUMERIC DEFAULT 0;

CREATE OR REPLACE FUNCTION public.account_consistency_score(p_account_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profitable_positions AS (
    SELECT
      (position_row.closed_at AT TIME ZONE 'UTC')::date AS trading_day,
      position_row.profit_loss
    FROM public.positions AS position_row
    WHERE position_row.account_id = p_account_id
      AND position_row.status = 'closed'
      AND position_row.closed_at IS NOT NULL
      AND position_row.profit_loss > 0
  ),
  totals AS (
    SELECT COALESCE(SUM(daily.day_profit), 0) AS total_profit,
           COALESCE(MAX(daily.day_profit), 0) AS best_day_profit
    FROM (
      SELECT profitable_position.trading_day, SUM(profitable_position.profit_loss) AS day_profit
      FROM profitable_positions AS profitable_position
      GROUP BY profitable_position.trading_day
    ) AS daily
  )
  SELECT CASE
    WHEN total_profit > 0 THEN best_day_profit / total_profit * 100
    ELSE 0
  END
  FROM totals;
$$;

REVOKE ALL ON FUNCTION public.account_consistency_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_consistency_score(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can create KYC verified trading payout requests" ON public.payout_requests;
CREATE POLICY "Users can create KYC verified trading payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND source = 'trading_profit'
  AND account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = payout_requests.account_id
      AND accounts.user_id = auth.uid()
      AND (accounts.status = 'funded' OR (accounts.challenge_type = 'instant' AND accounts.status = 'active'))
      AND (
        accounts.challenge_type <> 'instant'
        OR public.account_consistency_score(accounts.id) < 30
      )
  )
  AND EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id = auth.uid() AND status = 'approved')
);