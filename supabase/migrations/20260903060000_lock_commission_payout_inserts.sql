DROP POLICY IF EXISTS "Users can create their own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create their own trading payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND source = 'trading_profit'
  AND account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = payout_requests.account_id
      AND accounts.user_id = auth.uid()
      AND (accounts.status = 'funded' OR (accounts.challenge_type = 'instant' AND accounts.status = 'active'))
  )
);