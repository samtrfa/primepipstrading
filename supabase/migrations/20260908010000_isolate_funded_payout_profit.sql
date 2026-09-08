-- Evaluation profits must never be eligible for funded-stage payouts.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS funded_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS funded_profit_loss NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Existing funded accounts start with a clean funded-stage payout ledger.
UPDATE public.accounts
SET funded_started_at = COALESCE(funded_started_at, created_at),
    funded_profit_loss = COALESCE(funded_profit_loss, 0)
WHERE status = 'funded' OR challenge_type = 'instant';

CREATE OR REPLACE FUNCTION public.mark_funded_stage_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'funded' AND (OLD.status IS DISTINCT FROM 'funded') THEN
    NEW.funded_started_at := now();
    NEW.funded_profit_loss := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_funded_stage_start ON public.accounts;
CREATE TRIGGER mark_funded_stage_start
BEFORE UPDATE OF status ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.mark_funded_stage_start();

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
    OR a.status <> 'active'
    OR a.challenge_type = 'instant'
    OR EXISTS (SELECT 1 FROM positions WHERE account_id = a.id AND status = 'open')
  THEN
    RAISE EXCEPTION 'account is not ready for phase advancement';
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
      ELSE 'Advanced to next phase'
    END
  );

  RETURN row_to_json(a)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_trade(
  p_account_id UUID,
  p_position_id UUID,
  p_exit_price NUMERIC,
  p_action TEXT DEFAULT 'close',
  p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a accounts%ROWTYPE;
  p positions%ROWTYPE;
  x assets%ROWTYPE;
  r RECORD;
  existing trade_history%ROWTYPE;
  pl NUMERIC;
  new_balance NUMERIC;
  equity NUMERIC;
  hwm NUMERIC;
  maxdd NUMERIC;
  dailydd NUMERIC;
  daily_start NUMERIC;
  violation TEXT;
  phase_passed_value BOOLEAN;
  consistency_ok BOOLEAN;
  target NUMERIC;
  current_phase INTEGER;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', auth.role()) NOT IN ('admin', 'service_role') AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN
    SELECT jsonb_build_object('position', row_to_json(pos), 'account', row_to_json(acc)) INTO r
    FROM positions pos JOIN accounts acc ON acc.id = pos.account_id
    WHERE pos.id = existing.position_id;
    RETURN to_jsonb(r);
  END IF;

  SELECT * INTO a FROM accounts
  WHERE id = p_account_id AND (user_id = auth.uid() OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', auth.role()) IN ('admin', 'service_role'))
  FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'account is not available'; END IF;

  SELECT * INTO p FROM positions WHERE id = p_position_id AND account_id = p_account_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'position cannot be closed'; END IF;
  IF p.status = 'closed' THEN RETURN jsonb_build_object('position', row_to_json(p), 'account', row_to_json(a)); END IF;
  IF p.status <> 'open' OR p_exit_price IS NULL OR p_exit_price <= 0 THEN RAISE EXCEPTION 'position cannot be closed'; END IF;

  SELECT * INTO x FROM assets WHERE id = p.asset_id;
  IF x.id IS NULL THEN RAISE EXCEPTION 'position asset not found'; END IF;

  pl := round((CASE WHEN p.position_type = 'buy' THEN p_exit_price - p.entry_price ELSE p.entry_price - p_exit_price END) * trading_contract_size(x.symbol) * p.lot_size, 2);
  new_balance := COALESCE(a.current_balance, a.account_size) + pl;

  UPDATE positions SET status = 'closed', exit_price = p_exit_price, profit_loss = pl, closed_at = now() WHERE id = p.id;

  equity := new_balance;
  hwm := GREATEST(COALESCE(a.high_water_mark, a.account_size), equity);
  maxdd := GREATEST(0, (hwm - equity) / NULLIF(hwm, 0) * 100);
  IF a.daily_start_date IS NULL OR a.daily_start_date < CURRENT_DATE THEN
    daily_start := COALESCE(a.current_balance, a.account_size);
  ELSE
    daily_start := COALESCE(a.daily_start_balance, a.account_size);
  END IF;
  dailydd := GREATEST(0, (daily_start - equity) / NULLIF(daily_start, 0) * 100);
  SELECT * INTO r FROM trading_rules(a.challenge_type::text, COALESCE(a.current_phase, 1));
  IF maxdd >= r.max_drawdown THEN violation := 'max_drawdown'; ELSIF dailydd >= r.daily_drawdown THEN violation := 'daily_drawdown'; END IF;

  current_phase := COALESCE(a.current_phase, 1);
  target := r.profit_target;
  consistency_ok := a.challenge_type <> 'one_step' OR public.account_consistency_score(a.id) < 30;
  phase_passed_value := CASE
    WHEN a.challenge_type = 'one_step' THEN consistency_ok AND (COALESCE(a.phase_passed, false) OR (target > 0 AND (new_balance - a.account_size) / a.account_size * 100 >= target AND violation IS NULL))
    ELSE COALESCE(a.phase_passed, false) OR (target > 0 AND (new_balance - a.account_size) / a.account_size * 100 >= target AND violation IS NULL)
  END;

  UPDATE accounts AS account_row
  SET current_balance = new_balance,
      profit_loss = COALESCE(account_row.profit_loss, 0) + pl,
      funded_profit_loss = CASE WHEN account_row.status = 'funded' THEN COALESCE(account_row.funded_profit_loss, 0) + pl ELSE account_row.funded_profit_loss END,
      high_water_mark = hwm,
      daily_start_balance = daily_start,
      daily_start_date = CURRENT_DATE,
      max_drawdown_percent = maxdd,
      daily_drawdown_percent = dailydd,
      drawdown_violated = violation IS NOT NULL,
      violation_type = violation,
      phase_passed = phase_passed_value,
      status = CASE WHEN violation IS NOT NULL THEN 'failed'::account_status ELSE account_row.status END
  WHERE account_row.id = a.id
  RETURNING account_row.* INTO a;

  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, profit_loss, request_id, notes)
  VALUES (a.id, p.id, CASE WHEN p_action IN ('sl_hit', 'tp_hit') THEN p_action ELSE 'close' END, x.symbol, p.lot_size, p_exit_price, pl, p_request_id, CASE WHEN violation IS NOT NULL THEN 'Account failed: ' || violation ELSE NULL END);

  SELECT * INTO p FROM positions WHERE id = p.id;
  RETURN jsonb_build_object('position', row_to_json(p), 'account', row_to_json(a));
END;
$$;

REVOKE ALL ON FUNCTION public.advance_trade_phase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_trade_phase(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can create KYC verified trading payout requests" ON public.payout_requests;
CREATE POLICY "Users can create KYC verified trading payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND source = 'trading_profit'
  AND account_id IS NOT NULL
  AND amount >= 100
  AND EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = payout_requests.account_id
      AND accounts.user_id = auth.uid()
      AND accounts.status = 'funded'
      AND COALESCE(accounts.funded_profit_loss, 0) >= 100
      AND amount <= COALESCE(accounts.funded_profit_loss, 0)
      AND public.account_consistency_score(accounts.id) < 30
  )
  AND EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id = auth.uid() AND status = 'approved')
);
