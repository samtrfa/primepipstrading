CREATE OR REPLACE FUNCTION public.modify_trades_by_asset(
  p_account_id UUID,
  p_position_id UUID,
  p_stop_loss NUMERIC,
  p_take_profit NUMERIC,
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  anchor_position positions%ROWTYPE;
  target_position positions%ROWTYPE;
  asset_record assets%ROWTYPE;
  existing trade_history%ROWTYPE;
  modified_count INTEGER := 0;
  history_request_id UUID;
BEGIN
  SELECT * INTO existing FROM trade_history WHERE request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('position_id', p_position_id, 'modified_count', 0);
  END IF;

  SELECT pos.* INTO anchor_position
  FROM positions pos
  JOIN accounts acc ON acc.id = pos.account_id
  WHERE pos.id = p_position_id
    AND pos.account_id = p_account_id
    AND acc.user_id = auth.uid()
    AND pos.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid position';
  END IF;

  SELECT * INTO asset_record FROM assets WHERE id = anchor_position.asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid position';
  END IF;

  FOR target_position IN
    SELECT *
    FROM positions
    WHERE account_id = p_account_id
      AND asset_id = anchor_position.asset_id
      AND status = 'open'
    FOR UPDATE
  LOOP
    IF (p_stop_loss IS NOT NULL AND ((target_position.position_type = 'buy' AND p_stop_loss >= target_position.entry_price) OR (target_position.position_type = 'sell' AND p_stop_loss <= target_position.entry_price)))
      OR (p_take_profit IS NOT NULL AND ((target_position.position_type = 'buy' AND p_take_profit <= target_position.entry_price) OR (target_position.position_type = 'sell' AND p_take_profit >= target_position.entry_price))) THEN
      RAISE EXCEPTION 'invalid position levels for %', asset_record.symbol;
    END IF;
  END LOOP;

  FOR target_position IN
    SELECT *
    FROM positions
    WHERE account_id = p_account_id
      AND asset_id = anchor_position.asset_id
      AND status = 'open'
    FOR UPDATE
  LOOP
    UPDATE positions
    SET stop_loss = p_stop_loss, take_profit = p_take_profit
    WHERE id = target_position.id;

    history_request_id := CASE WHEN modified_count = 0 THEN p_request_id ELSE gen_random_uuid() END;
    INSERT INTO trade_history(account_id, position_id, action, symbol, lot_size, price, request_id, notes)
      VALUES (p_account_id, target_position.id, 'modify', asset_record.symbol, target_position.lot_size, target_position.entry_price, history_request_id, 'position levels modified for asset');
    modified_count := modified_count + 1;
  END LOOP;

  RETURN jsonb_build_object('position_id', p_position_id, 'modified_count', modified_count);
END; $$;

REVOKE ALL ON FUNCTION public.modify_trades_by_asset(UUID, UUID, NUMERIC, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.modify_trades_by_asset(UUID, UUID, NUMERIC, NUMERIC, UUID) TO authenticated;