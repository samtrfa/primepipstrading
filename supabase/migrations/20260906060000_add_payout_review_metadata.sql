ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS payout_requests_reviewed_at_idx
  ON public.payout_requests (reviewed_at DESC);