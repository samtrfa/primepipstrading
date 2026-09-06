CREATE OR REPLACE FUNCTION public.admin_reset_account(
  p_account_id UUID,
  p_user_id UUID
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.accounts;
BEGIN
  SELECT * INTO account_row
  FROM public.accounts
  WHERE id = p_account_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  UPDATE public.positions
  SET status = 'closed', closed_at = now()
  WHERE account_id = p_account_id AND status = 'open';

  DELETE FROM public.trade_history WHERE account_id = p_account_id;
  DELETE FROM public.positions WHERE account_id = p_account_id;

  UPDATE public.accounts
  SET status = CASE WHEN challenge_type = 'instant' THEN 'funded'::public.account_status ELSE 'active'::public.account_status END,
      current_balance = account_size,
      profit_loss = 0,
      current_phase = CASE WHEN challenge_type = 'instant' THEN NULL ELSE 1 END,
      high_water_mark = account_size,
      daily_start_balance = account_size,
      daily_start_date = CURRENT_DATE,
      max_drawdown_percent = 0,
      daily_drawdown_percent = 0,
      drawdown_violated = false,
      violation_type = NULL,
      phase_passed = false
  WHERE id = p_account_id
  RETURNING * INTO account_row;

  DELETE FROM public.notifications
  WHERE user_id = p_user_id
    AND metadata ->> 'account_id' = p_account_id::text;

  DELETE FROM public.email_events
  WHERE user_id = p_user_id
    AND metadata ->> 'account_id' = p_account_id::text;

  RETURN account_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_account(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_account(UUID, UUID) TO service_role;