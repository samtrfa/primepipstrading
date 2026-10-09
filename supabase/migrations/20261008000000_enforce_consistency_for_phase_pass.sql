-- A phase cannot be marked passed until the best-day share is below 30%.
CREATE OR REPLACE FUNCTION public.enforce_consistency_for_phase_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase_passed IS TRUE
    AND NEW.challenge_type <> 'instant'
    AND public.account_consistency_score(NEW.id) >= 30
  THEN
    NEW.phase_passed := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_consistency_for_phase_pass ON public.accounts;
CREATE TRIGGER enforce_consistency_for_phase_pass
BEFORE UPDATE OF phase_passed ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_consistency_for_phase_pass();