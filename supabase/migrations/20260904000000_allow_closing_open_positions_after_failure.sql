-- Failed accounts cannot trade, but their existing positions must still settle.
CREATE OR REPLACE FUNCTION public.close_trade(
  p_account_id UUID, p_position_id UUID, p_exit_price NUMERIC,
  p_action TEXT DEFAULT 'close', p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a accounts%ROWTYPE; p positions%ROWTYPE; x assets%ROWTYPE; r RECORD; existing trade_history%ROWTYPE;
  pl NUMERIC; new_balance NUMERIC; equity NUMERIC; hwm NUMERIC; maxdd NUMERIC; dailydd NUMERIC; violation TEXT;
  phase_passed BOOLEAN; target NUMERIC; current_phase INTEGER;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN SELECT jsonb_build_object('position', row_to_json(pos), 'account', row_to_json(acc)) INTO r FROM positions pos JOIN accounts acc ON acc.id = pos.account_id WHERE pos.id = existing.position_id; RETURN to_jsonb(r); END IF;
  SELECT * INTO a FROM accounts WHERE id = p_account_id AND user_id = auth.uid() FOR UPDATE;
  SELECT * INTO p FROM positions WHERE id = p_position_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'open' OR a.status NOT IN ('active', 'funded', 'failed') OR p_exit_price <= 0 THEN RAISE EXCEPTION 'position cannot be closed'; END IF;
  SELECT * INTO x FROM assets WHERE id = p.asset_id;
  pl := round((CASE WHEN p.position_type = 'buy' THEN p_exit_price - p.entry_price ELSE p.entry_price - p_exit_price END) * trading_contract_size(x.symbol) * p.lot_size, 2);
  new_balance := COALESCE(a.current_balance, a.account_size) + pl;
  UPDATE positions SET status = 'closed', exit_price = p_exit_price, profit_loss = pl, closed_at = now() WHERE id = p.id;
  equity := new_balance;
  hwm := GREATEST(COALESCE(a.high_water_mark, a.account_size), equity);
  maxdd := GREATEST(0, (hwm - equity) / NULLIF(hwm, 0) * 100);
  dailydd := GREATEST(0, (COALESCE(a.daily_start_balance, a.account_size) - equity) / NULLIF(COALESCE(a.daily_start_balance, a.account_size), 0) * 100);
  SELECT * INTO r FROM trading_rules(a.challenge_type::text, COALESCE(a.current_phase, 1));
  IF maxdd >= r.max_drawdown THEN violation := 'max_drawdown'; ELSIF dailydd >= r.daily_drawdown THEN violation := 'daily_drawdown'; END IF;
  current_phase := COALESCE(a.current_phase, 1); target := r.profit_target;
  phase_passed := COALESCE(a.phase_passed, false) OR (target > 0 AND (new_balance - a.account_size) / a.account_size * 100 >= target AND violation IS NULL);
  UPDATE accounts SET current_balance = new_balance, profit_loss = COALESCE(profit_loss, 0) + pl, high_water_mark = hwm,
    max_drawdown_percent = maxdd, daily_drawdown_percent = dailydd, drawdown_violated = violation IS NOT NULL,
    violation_type = violation, phase_passed = phase_passed, status = CASE WHEN violation IS NOT NULL THEN 'failed'::account_status ELSE status END WHERE id = a.id RETURNING * INTO a;
  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, profit_loss, request_id, notes)
    VALUES (a.id, p.id, CASE WHEN p_action IN ('sl_hit', 'tp_hit') THEN p_action ELSE 'close' END, x.symbol, p.lot_size, p_exit_price, pl, p_request_id, CASE WHEN violation IS NOT NULL THEN 'Account failed: ' || violation ELSE NULL END);
  SELECT * INTO p FROM positions WHERE id = p.id;
  RETURN jsonb_build_object('position', row_to_json(p), 'account', row_to_json(a));
END; $$;

REVOKE ALL ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;