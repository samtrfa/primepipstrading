-- Price-sensitive trade RPCs are callable only by the trusted execution function.
CREATE OR REPLACE FUNCTION public.place_trade(
  p_account_id UUID, p_asset_id UUID, p_position_type TEXT, p_lot_size NUMERIC,
  p_entry_price NUMERIC, p_stop_loss NUMERIC DEFAULT NULL, p_take_profit NUMERIC DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a accounts%ROWTYPE;
  x assets%ROWTYPE;
  position positions%ROWTYPE;
  existing trade_history%ROWTYPE;
  margin NUMERIC;
  used_margin NUMERIC;
  contract NUMERIC;
  result JSONB;
  caller_role TEXT;
BEGIN
  caller_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', auth.role());
  IF caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN
    SELECT row_to_json(p)::jsonb INTO result FROM positions p WHERE p.id = existing.position_id;
    RETURN result;
  END IF;

  SELECT * INTO a FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR a.status NOT IN ('active', 'funded') OR a.drawdown_violated THEN
    RAISE EXCEPTION 'account is not available for trading';
  END IF;
  SELECT * INTO x FROM assets WHERE id = p_asset_id AND is_active FOR SHARE;
  IF NOT FOUND OR p_position_type NOT IN ('buy', 'sell') OR p_lot_size < .01 OR p_lot_size > 100
    OR mod(p_lot_size * 100, 1) <> 0 OR p_entry_price <= 0 THEN
    RAISE EXCEPTION 'invalid order';
  END IF;
  IF p_stop_loss IS NOT NULL AND (p_stop_loss <= 0
    OR (p_position_type = 'buy' AND p_stop_loss >= p_entry_price)
    OR (p_position_type = 'sell' AND p_stop_loss <= p_entry_price)) THEN
    RAISE EXCEPTION 'invalid stop loss';
  END IF;
  IF p_take_profit IS NOT NULL AND (p_take_profit <= 0
    OR (p_position_type = 'buy' AND p_take_profit <= p_entry_price)
    OR (p_position_type = 'sell' AND p_take_profit >= p_entry_price)) THEN
    RAISE EXCEPTION 'invalid take profit';
  END IF;

  contract := trading_contract_size(x.symbol);
  margin := contract * p_lot_size * p_entry_price / 20;
  SELECT COALESCE(SUM(trading_contract_size(existing_asset.symbol) * open_position.lot_size * open_position.entry_price / 20), 0)
  INTO used_margin
  FROM positions open_position
  JOIN assets existing_asset ON existing_asset.id = open_position.asset_id
  WHERE open_position.account_id = a.id AND open_position.status = 'open';
  IF margin + used_margin > COALESCE(a.current_balance, a.account_size) THEN
    RAISE EXCEPTION 'insufficient margin';
  END IF;

  INSERT INTO positions(account_id, asset_id, position_type, lot_size, entry_price, stop_loss, take_profit)
    VALUES (a.id, x.id, p_position_type, p_lot_size, p_entry_price, p_stop_loss, p_take_profit)
    RETURNING * INTO position;
  INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, request_id)
    VALUES (a.id, position.id, 'open', x.symbol, p_lot_size, p_entry_price, p_request_id);
  RETURN row_to_json(position)::jsonb;
END; $$;

REVOKE ALL ON FUNCTION public.place_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.place_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.close_trade(UUID, UUID, NUMERIC, TEXT, UUID) TO service_role;
