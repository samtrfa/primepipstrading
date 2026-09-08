-- Every evaluation phase transition requires the consistency rule to pass.
-- The score must be strictly below 30%; reaching the profit target alone is insufficient.
CREATE OR REPLACE FUNCTION public.advance_trade_phase(
  p_account_id UUID,
  p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a accounts%ROWTYPE;
  existing trade_history%ROWTYPE;
  result JSONB;
  next_phase INTEGER;
  total_phases INTEGER;
  next_status account_status;
  completed_phase INTEGER;
  completed_phase_name TEXT;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN
    SELECT row_to_json(acc)::jsonb INTO result FROM accounts acc WHERE acc.id = p_account_id;
    RETURN result;
  END IF;

  SELECT * INTO a
  FROM accounts
  WHERE id = p_account_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND
    OR NOT COALESCE(a.phase_passed, false)
    OR public.account_consistency_score(a.id) >= 30
    OR a.status <> 'active'
    OR a.challenge_type = 'instant'
    OR EXISTS (SELECT 1 FROM positions WHERE account_id = a.id AND status = 'open')
  THEN
    RAISE EXCEPTION 'account is not ready for phase advancement: consistency must be below 30% and all phase rules must be passed';
  END IF;

  total_phases := CASE a.challenge_type
    WHEN 'three_step' THEN 3
    WHEN 'two_step' THEN 2
    ELSE 1
  END;
  completed_phase := COALESCE(a.current_phase, 1);
  completed_phase_name := CASE a.challenge_type
    WHEN 'one_step' THEN 'Evaluation'
    ELSE 'Phase ' || completed_phase::text
  END;
  next_phase := completed_phase;
  next_status := a.status;

  IF next_phase >= total_phases THEN
    next_status := 'funded';
  ELSE
    next_phase := next_phase + 1;
  END IF;

  INSERT INTO certificates (user_id, account_id, challenge_type, account_size, phase_number, phase_name)
  VALUES (a.user_id, a.id, a.challenge_type, a.account_size, completed_phase, completed_phase_name)
  ON CONFLICT (account_id, phase_number) DO NOTHING;

  UPDATE accounts
  SET current_phase = next_phase,
      status = next_status,
      current_balance = account_size,
      profit_loss = 0,
      funded_started_at = CASE WHEN next_status = 'funded' THEN now() ELSE funded_started_at END,
      funded_profit_loss = CASE WHEN next_status = 'funded' THEN 0 ELSE funded_profit_loss END,
      high_water_mark = account_size,
      daily_start_balance = account_size,
      daily_start_date = CURRENT_DATE,
      max_drawdown_percent = 0,
      daily_drawdown_percent = 0,
      consistency_score = 0,
      best_trading_day_profit = 0,
      closed_profit_total = 0,
      phase_passed = false,
      drawdown_violated = false,
      violation_type = NULL
  WHERE id = a.id
  RETURNING * INTO a;

  INSERT INTO trade_history(account_id, action, symbol, lot_size, price, request_id, notes)
  VALUES (
    a.id,
    'phase_advance',
    '-',
    0,
    0,
    p_request_id,
    CASE WHEN next_status = 'funded'
      THEN 'Challenge completed - funded stage started with a clean payout ledger.'
      ELSE 'Advanced to next phase after passing profit, drawdown, and consistency rules.'
    END
  );

  RETURN row_to_json(a)::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_trade_phase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_trade_phase(UUID, UUID) TO authenticated;
