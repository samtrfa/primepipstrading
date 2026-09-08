-- The legacy trigger can overwrite the daily baseline before the authoritative
-- risk trigger calculates the account metrics. Keep one owner for this state.
DROP TRIGGER IF EXISTS track_account_drawdown ON public.accounts;

-- Repair active accounts whose baseline was never initialized or belongs to a
-- previous trading day. Failed accounts keep their failure state.
UPDATE public.accounts
SET daily_start_balance = COALESCE(current_balance, account_size),
    daily_start_date = CURRENT_DATE,
    daily_drawdown_percent = 0
WHERE status IN ('active', 'funded')
  AND (daily_start_date IS NULL OR daily_start_date < CURRENT_DATE OR COALESCE(daily_start_balance, 0) <= 0);