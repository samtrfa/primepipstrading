-- Allow users to remove only their own unvalidated pending purchases.
CREATE POLICY "Users can delete their own pending accounts"
ON public.accounts
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending_payment');
