ALTER TABLE public.accounts
  ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN archive_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.payout_requests
  ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_account_id_fkey,
  ADD CONSTRAINT payout_requests_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.certificates
  ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_account_id_fkey,
  ADD CONSTRAINT certificates_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
CREATE POLICY "Users can view their own active accounts"
ON public.accounts
FOR SELECT
USING (auth.uid() = user_id AND archived_at IS NULL);

DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
CREATE POLICY "Users can update their own active accounts"
ON public.accounts
FOR UPDATE
USING (auth.uid() = user_id AND archived_at IS NULL)
WITH CHECK (auth.uid() = user_id AND archived_at IS NULL);

CREATE INDEX accounts_archive_expires_at_idx
ON public.accounts (archive_expires_at)
WHERE archive_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.purge_expired_account_archives()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.accounts
  WHERE archived_at IS NOT NULL
    AND archive_expires_at <= now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_account_archives() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_account_archives() TO service_role;

SELECT cron.schedule(
  'purge-expired-account-archives',
  '0 * * * *',
  $$SELECT public.purge_expired_account_archives();$$
);