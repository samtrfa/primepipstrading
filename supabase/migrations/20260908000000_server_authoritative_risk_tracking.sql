-- Keep account risk metrics authoritative on the server.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS consistency_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_trading_day_profit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_profit_total numeric DEFAULT 0;

GRANT EXECUTE ON FUNCTION public.account_consistency_score(UUID) TO service_role;
