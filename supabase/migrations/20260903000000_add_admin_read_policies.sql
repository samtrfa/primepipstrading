-- Admin access is controlled by Supabase Auth app_metadata, which users cannot edit.
-- Keep the policy explicit so direct reads are protected as well as the admin function.
CREATE POLICY "Admins can view all accounts"
ON public.accounts FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can view all positions"
ON public.positions FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can view all trade history"
ON public.trade_history FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can view all payout requests"
ON public.payout_requests FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can view all KYC records"
ON public.kyc_verifications FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');