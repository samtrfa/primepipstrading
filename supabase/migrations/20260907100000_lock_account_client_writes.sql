-- Account state is server-authoritative. Client roles may read their own active
-- accounts, but account creation and mutation must use trusted write paths.
DROP POLICY IF EXISTS "Users can create their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own active accounts" ON public.accounts;

REVOKE INSERT, UPDATE ON public.accounts FROM anon, authenticated;
