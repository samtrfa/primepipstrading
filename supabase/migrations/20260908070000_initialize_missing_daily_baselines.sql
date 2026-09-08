-- Legacy accounts without a daily baseline must start from their current balance,
-- not the original account size, otherwise daily drawdown can remain at zero
-- while the account is above its initial balance.
UPDATE public.accounts
SET daily_start_balance = CASE
      WHEN COALESCE(daily_start_balance, 0) > 0 THEN daily_start_balance
      ELSE COALESCE(current_balance, account_size)
    END,
    daily_start_date = COALESCE(daily_start_date, CURRENT_DATE)
WHERE COALESCE(daily_start_balance, 0) <= 0 OR daily_start_date IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_account_phase_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('active', 'funded') THEN
    NEW.current_balance := COALESCE(NEW.current_balance, NEW.account_size);
    NEW.profit_loss := COALESCE(NEW.profit_loss, 0);
    NEW.high_water_mark := COALESCE(NEW.high_water_mark, NEW.current_balance);
    NEW.daily_start_balance := COALESCE(NEW.daily_start_balance, NEW.current_balance);
    NEW.daily_start_date := COALESCE(NEW.daily_start_date, CURRENT_DATE);
    NEW.max_drawdown_percent := COALESCE(NEW.max_drawdown_percent, 0);
    NEW.daily_drawdown_percent := COALESCE(NEW.daily_drawdown_percent, 0);
    NEW.drawdown_violated := COALESCE(NEW.drawdown_violated, FALSE);
    NEW.phase_passed := COALESCE(NEW.phase_passed, FALSE);
  END IF;

  IF NEW.challenge_type = 'instant' AND NEW.status IN ('active', 'funded') THEN
    NEW.status := 'funded';
    NEW.current_phase := NULL;
    NEW.phase_passed := FALSE;
  ELSIF NEW.challenge_type <> 'instant' AND NEW.status IN ('active', 'passed') THEN
    NEW.current_phase := COALESCE(NEW.current_phase, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;