CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 100),
  method TEXT NOT NULL CHECK (method IN ('bank_transfer', 'crypto')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payout requests"
ON public.payout_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payout requests"
ON public.payout_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
      AND accounts.status = 'funded'
  )
);

CREATE TRIGGER update_payout_requests_updated_at
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();