-- Instant accounts skip evaluation phases and are funded as soon as payment is confirmed.
UPDATE public.accounts
SET status = 'funded', current_phase = NULL
WHERE challenge_type = 'instant' AND status = 'active';

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

DROP TRIGGER IF EXISTS normalize_account_phase_state ON public.accounts;
CREATE TRIGGER normalize_account_phase_state
BEFORE INSERT OR UPDATE OF challenge_type, status, current_phase ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_account_phase_state();

DROP POLICY IF EXISTS "Users can create their own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create their own payout requests"
ON public.payout_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
      AND (
        accounts.status = 'funded'
        OR (accounts.challenge_type = 'instant' AND accounts.status = 'active')
      )
  )
);