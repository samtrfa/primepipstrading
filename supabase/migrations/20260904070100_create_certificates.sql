CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  challenge_type public.challenge_type NOT NULL,
  account_size INTEGER NOT NULL,
  phase_number INTEGER NOT NULL CHECK (phase_number > 0),
  phase_name TEXT NOT NULL,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account_id, phase_number)
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own certificates"
ON public.certificates FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.advance_trade_phase(p_account_id UUID, p_request_id UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a accounts%ROWTYPE; existing trade_history%ROWTYPE; result JSONB; next_phase INTEGER; total_phases INTEGER; next_status account_status; completed_phase INTEGER; completed_phase_name TEXT;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN SELECT row_to_json(acc)::jsonb INTO result FROM accounts acc WHERE acc.id = p_account_id; RETURN result; END IF;
  SELECT * INTO a FROM accounts WHERE id = p_account_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(a.phase_passed, false) OR a.status <> 'active' OR a.challenge_type = 'instant' OR EXISTS (SELECT 1 FROM positions WHERE account_id = a.id AND status = 'open') THEN RAISE EXCEPTION 'account is not ready for phase advancement'; END IF;
  total_phases := CASE a.challenge_type WHEN 'three_step' THEN 3 WHEN 'two_step' THEN 2 ELSE 1 END;
  completed_phase := COALESCE(a.current_phase, 1);
  completed_phase_name := CASE a.challenge_type WHEN 'one_step' THEN 'Evaluation' ELSE 'Phase ' || completed_phase::text END;
  next_phase := completed_phase;
  next_status := a.status;
  IF next_phase >= total_phases THEN next_status := 'funded'; ELSE next_phase := next_phase + 1; END IF;
  INSERT INTO certificates (user_id, account_id, challenge_type, account_size, phase_number, phase_name)
    VALUES (a.user_id, a.id, a.challenge_type, a.account_size, completed_phase, completed_phase_name)
    ON CONFLICT (account_id, phase_number) DO NOTHING;
  UPDATE accounts SET current_phase = next_phase, status = next_status, current_balance = account_size, profit_loss = 0,
    high_water_mark = account_size, daily_start_balance = account_size, daily_start_date = CURRENT_DATE,
    daily_drawdown_percent = 0, phase_passed = false, drawdown_violated = false, violation_type = NULL
    WHERE id = a.id RETURNING * INTO a;
  INSERT INTO trade_history(account_id, action, symbol, lot_size, price, request_id, notes)
    VALUES (a.id, 'phase_advance', '-', 0, 0, p_request_id, CASE WHEN next_status = 'funded' THEN 'Challenge completed - Account funded!' ELSE 'Advanced to next phase' END);
  RETURN row_to_json(a)::jsonb;
END; $$;

REVOKE ALL ON FUNCTION public.advance_trade_phase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_trade_phase(UUID, UUID) TO authenticated;