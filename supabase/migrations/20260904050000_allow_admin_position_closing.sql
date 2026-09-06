CREATE OR REPLACE FUNCTION public.close_trade(
  p_account_id UUID, p_position_id UUID, p_exit_price NUMERIC,
  p_action TEXT DEFAULT 'close', p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a accounts%ROWTYPE; p positions%ROWTYPE; x assets%ROWTYPE; r RECORD; existing trade_history%ROWTYPE;
  pl NUMERIC; new_balance NUMERIC; equity NUMERIC; hwm NUMERIC; maxdd NUMERIC; dailydd NUMERIC; v_violation TEXT;
  v_phase_passed BOOLEAN; target NUMERIC; current_phase INTEGER;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' AND auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN
    SELECT jsonb_build_object('position', row_to_json(pos), 'account', row_to_json(acc)) INTO r
    FROM positions pos JOIN accounts acc ON acc.id = pos.account_id WHERE pos.id = existing.position_id;
    RETURN to_jsonb(r);
  END IF;
  SELECT * INTO a FROM accounts WHERE id = p_account_id
    AND (user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') FOR UPDATE;
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
  dailydd := GREATEST(0, (COALESCE(a.daily_start_balance, a.account_size) - equity) / NULLIF(COALESCE(a.daily_start_balance, a.account_size), 0) * 100);
  SELECT * INTO r FROM trading_rules(a.challenge_type::text, COALESCE(a.current_phase, 1));
  IF maxdd >= r.max_drawdown THEN v_violation := 'max_drawdown'; ELSIF dailydd >= r.daily_drawdown THEN v_violation := 'daily_drawdown'; END IF;
  current_phase := COALESCE(a.current_phase, 1); target := r.profit_target;
  v_phase_passed := COALESCE(a.phase_passed, false) OR (target > 0 AND (new_balance - a.account_size) / a.account_size * 100 >= target AND v_violation IS NULL);
  UPDATE accounts AS account_row SET current_balance = new_balance, profit_loss = COALESCE(account_row.profit_loss, 0) + pl, high_water_mark = hwm,
    max_drawdown_percent = maxdd, daily_drawdown_percent = dailydd, drawdown_violated = v_violation IS NOT NULL,
    violation_type = v_violation, phase_passed = v_phase_passed,
    status = CASE WHEN v_violation IS NOT NULL THEN 'failed'::account_status ELSE account_row.status END
    WHERE account_row.id = a.id RETURNING account_row.* INTO a;
  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, profit_loss, request_id, notes)
    VALUES (a.id, p.id, CASE WHEN p_action IN ('sl_hit', 'tp_hit') THEN p_action ELSE 'close' END, x.symbol, p.lot_size, p_exit_price, pl, p_request_id, CASE WHEN v_violation IS NOT NULL THEN 'Account failed: ' || v_violation ELSE NULL END);
  SELECT * INTO p FROM positions WHERE id = p.id;
  RETURN jsonb_build_object('position', row_to_json(p), 'account', row_to_json(a));
END; $$;

REVOKE ALL ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;