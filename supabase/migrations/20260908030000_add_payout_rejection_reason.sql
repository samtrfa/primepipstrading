ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
