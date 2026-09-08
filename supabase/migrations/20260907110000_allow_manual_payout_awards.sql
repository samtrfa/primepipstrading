ALTER TABLE public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_source_check,
  ADD CONSTRAINT payout_requests_source_check
    CHECK (source IN ('trading_profit', 'referral_commission', 'manual_award'));