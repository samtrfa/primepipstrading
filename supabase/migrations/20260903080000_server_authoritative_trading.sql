-- Trading state is changed only by these transactional, authenticated functions.
ALTER TABLE public.trade_history
  DROP CONSTRAINT IF EXISTS trade_history_action_check;

ALTER TABLE public.trade_history
  ADD CONSTRAINT trade_history_action_check
  CHECK (action IN ('open', 'close', 'modify', 'sl_hit', 'tp_hit', 'account_failed', 'phase_advance'));

ALTER TABLE public.trade_history
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS trade_history_request_id_key
  ON public.trade_history (request_id)
  WHERE request_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can create positions for their accounts" ON public.positions;
DROP POLICY IF EXISTS "Users can update their own positions" ON public.positions;
DROP POLICY IF EXISTS "Users can create trade history for their accounts" ON public.trade_history;

CREATE OR REPLACE FUNCTION public.trading_contract_size(p_symbol TEXT)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE regexp_replace(upper(p_symbol), 'USD[TC]?$', '')
    WHEN 'BTC' THEN 1 WHEN 'ETH' THEN 1
    WHEN 'BCH' THEN 10 WHEN 'LTC' THEN 10 WHEN 'SOL' THEN 10 WHEN 'AAVE' THEN 10
    WHEN 'ETC' THEN 100 WHEN 'LINK' THEN 100 WHEN 'AVAX' THEN 100 WHEN 'DOT' THEN 100
    WHEN 'UNI' THEN 100 WHEN 'NEAR' THEN 100 WHEN 'ATOM' THEN 100
    WHEN 'XTZ' THEN 1000 WHEN 'ADA' THEN 1000 WHEN 'XRP' THEN 1000
    WHEN 'ALGO' THEN 1000 WHEN 'SAND' THEN 1000
    WHEN 'DOGE' THEN 10000 WHEN 'XLM' THEN 10000 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.trading_pip_size(p_symbol TEXT, p_db_pip NUMERIC)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE regexp_replace(upper(p_symbol), 'USD[TC]?$', '')
    WHEN 'BTC' THEN .01 WHEN 'ETH' THEN .01 WHEN 'BCH' THEN .01 WHEN 'LTC' THEN .01
    WHEN 'SOL' THEN .01 WHEN 'AAVE' THEN .01 WHEN 'ETC' THEN .001 WHEN 'LINK' THEN .001
    WHEN 'AVAX' THEN .001 WHEN 'DOT' THEN .001 WHEN 'UNI' THEN .001 WHEN 'NEAR' THEN .001
    WHEN 'ATOM' THEN .001 WHEN 'XTZ' THEN .0001 WHEN 'ADA' THEN .0001 WHEN 'XRP' THEN .0001
    WHEN 'ALGO' THEN .0001 WHEN 'SAND' THEN .0001 WHEN 'DOGE' THEN .00001 WHEN 'XLM' THEN .00001
    ELSE COALESCE(NULLIF(p_db_pip, 0), .01) END;
$$;

CREATE OR REPLACE FUNCTION public.trading_rules(p_type TEXT, p_phase INTEGER)
RETURNS TABLE(profit_target NUMERIC, daily_drawdown NUMERIC, max_drawdown NUMERIC)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_type = 'instant' THEN RETURN QUERY SELECT 0::NUMERIC, 5::NUMERIC, 10::NUMERIC;
  ELSIF p_type = 'one_step' THEN RETURN QUERY SELECT 10::NUMERIC, 4::NUMERIC, 6::NUMERIC;
  ELSIF p_phase = 1 THEN RETURN QUERY SELECT 8::NUMERIC, 5::NUMERIC, 10::NUMERIC;
  ELSE RETURN QUERY SELECT 5::NUMERIC, 5::NUMERIC, 10::NUMERIC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_trade(
  p_account_id UUID, p_asset_id UUID, p_position_type TEXT, p_lot_size NUMERIC,
  p_entry_price NUMERIC, p_stop_loss NUMERIC DEFAULT NULL, p_take_profit NUMERIC DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a accounts%ROWTYPE; x assets%ROWTYPE; position positions%ROWTYPE; existing trade_history%ROWTYPE;
  margin NUMERIC; contract NUMERIC; result JSONB;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN SELECT row_to_json(p)::jsonb INTO result FROM positions p WHERE p.id = existing.position_id; RETURN result; END IF;
  SELECT * INTO a FROM accounts WHERE id = p_account_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR a.status NOT IN ('active', 'funded') OR a.drawdown_violated THEN RAISE EXCEPTION 'account is not available for trading'; END IF;
  SELECT * INTO x FROM assets WHERE id = p_asset_id AND is_active FOR SHARE;
  IF NOT FOUND OR p_position_type NOT IN ('buy', 'sell') OR p_lot_size < .01 OR p_lot_size > 100 OR mod(p_lot_size * 100, 1) <> 0 OR p_entry_price <= 0 THEN RAISE EXCEPTION 'invalid order'; END IF;
  IF p_stop_loss IS NOT NULL AND (p_stop_loss <= 0 OR (p_position_type = 'buy' AND p_stop_loss >= p_entry_price) OR (p_position_type = 'sell' AND p_stop_loss <= p_entry_price)) THEN RAISE EXCEPTION 'invalid stop loss'; END IF;
  IF p_take_profit IS NOT NULL AND (p_take_profit <= 0 OR (p_position_type = 'buy' AND p_take_profit <= p_entry_price) OR (p_position_type = 'sell' AND p_take_profit >= p_entry_price)) THEN RAISE EXCEPTION 'invalid take profit'; END IF;
  contract := trading_contract_size(x.symbol);
  margin := contract * p_lot_size * p_entry_price / 20;
  IF margin > COALESCE(a.current_balance, a.account_size) THEN RAISE EXCEPTION 'insufficient margin'; END IF;
  INSERT INTO positions(account_id, asset_id, position_type, lot_size, entry_price, stop_loss, take_profit)
    VALUES (a.id, x.id, p_position_type, p_lot_size, p_entry_price, p_stop_loss, p_take_profit) RETURNING * INTO position;
  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, request_id)
    VALUES (a.id, position.id, 'open', x.symbol, p_lot_size, p_entry_price, p_request_id);
  RETURN row_to_json(position)::jsonb;
END; $$;

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
  IF NOT FOUND OR p.status <> 'open' OR a.status NOT IN ('active', 'funded') OR p_exit_price <= 0 THEN RAISE EXCEPTION 'position cannot be closed'; END IF;
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

CREATE OR REPLACE FUNCTION public.modify_trade(p_account_id UUID, p_position_id UUID, p_stop_loss NUMERIC, p_take_profit NUMERIC, p_request_id UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p positions%ROWTYPE; x assets%ROWTYPE; existing trade_history%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN RETURN jsonb_build_object('position_id', existing.position_id); END IF;
  SELECT pos.* INTO p FROM positions pos JOIN accounts acc ON acc.id = pos.account_id WHERE pos.id = p_position_id AND pos.account_id = p_account_id AND acc.user_id = auth.uid() FOR UPDATE;
  SELECT ass.* INTO x FROM assets ass WHERE ass.id = p.asset_id;
  IF NOT FOUND OR p.status <> 'open' OR (p_stop_loss IS NOT NULL AND ((p.position_type = 'buy' AND p_stop_loss >= p.entry_price) OR (p.position_type = 'sell' AND p_stop_loss <= p.entry_price))) OR (p_take_profit IS NOT NULL AND ((p.position_type = 'buy' AND p_take_profit <= p.entry_price) OR (p.position_type = 'sell' AND p_take_profit >= p.entry_price))) THEN RAISE EXCEPTION 'invalid position levels'; END IF;
  UPDATE positions SET stop_loss = p_stop_loss, take_profit = p_take_profit WHERE id = p_position_id;
  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, request_id, notes) VALUES (p_account_id, p_position_id, 'modify', x.symbol, p.lot_size, p.entry_price, p_request_id, 'position levels modified');
  RETURN jsonb_build_object('position_id', p_position_id);
END; $$;

CREATE OR REPLACE FUNCTION public.advance_trade_phase(p_account_id UUID, p_request_id UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a accounts%ROWTYPE; existing trade_history%ROWTYPE; result JSONB; next_phase INTEGER; total_phases INTEGER; next_status account_status;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN SELECT row_to_json(acc)::jsonb INTO result FROM accounts acc WHERE acc.id = p_account_id; RETURN result; END IF;
  SELECT * INTO a FROM accounts WHERE id = p_account_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(a.phase_passed, false) OR a.status <> 'active' OR a.challenge_type = 'instant' OR EXISTS (SELECT 1 FROM positions WHERE account_id = a.id AND status = 'open') THEN RAISE EXCEPTION 'account is not ready for phase advancement'; END IF;
  total_phases := CASE a.challenge_type WHEN 'three_step' THEN 3 WHEN 'two_step' THEN 2 ELSE 1 END;
  next_phase := COALESCE(a.current_phase, 1);
  next_status := a.status;
  IF next_phase >= total_phases THEN next_status := 'funded'; ELSE next_phase := next_phase + 1; END IF;
  UPDATE accounts SET current_phase = next_phase, status = next_status, current_balance = account_size, profit_loss = 0,
    high_water_mark = account_size, daily_start_balance = account_size, daily_start_date = CURRENT_DATE,
    max_drawdown_percent = 0, daily_drawdown_percent = 0, phase_passed = false, drawdown_violated = false, violation_type = NULL
    WHERE id = a.id RETURNING * INTO a;
  INSERT INTO trade_history(account_id, action, symbol, lot_size, price, request_id, notes)
    VALUES (a.id, 'phase_advance', '-', 0, 0, p_request_id, CASE WHEN next_status = 'funded' THEN 'Challenge completed - Account funded!' ELSE 'Advanced to next phase' END);
  RETURN row_to_json(a)::jsonb;
END; $$;

REVOKE ALL ON FUNCTION public.place_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.modify_trade(UUID, UUID, NUMERIC, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_trade_phase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_trade(UUID, UUID, NUMERIC, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_trade_phase(UUID, UUID) TO authenticated;