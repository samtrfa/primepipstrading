ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.track_account_failed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.failed_at := COALESCE(NEW.failed_at, now());
      NEW.archived_at := COALESCE(NEW.archived_at, NEW.failed_at);
      NEW.archive_expires_at := NEW.failed_at + interval '3 days';
    ELSIF OLD.status IS DISTINCT FROM 'failed' THEN
      NEW.failed_at := now();
      NEW.archived_at := COALESCE(NEW.archived_at, NEW.failed_at);
      NEW.archive_expires_at := NEW.failed_at + interval '3 days';
    ELSE
      NEW.failed_at := COALESCE(OLD.failed_at, NEW.failed_at, now());
      IF OLD.archived_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
        NEW.archive_expires_at := NEW.failed_at + interval '3 days';
      END IF;
    END IF;
  ELSE
    NEW.failed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_track_account_failed_at ON public.accounts;
CREATE TRIGGER zz_track_account_failed_at
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.track_account_failed_at();

UPDATE public.accounts
SET failed_at = COALESCE(failed_at, archived_at, updated_at, now()),
    archived_at = COALESCE(archived_at, failed_at, updated_at, now()),
    archive_expires_at = COALESCE(failed_at, archived_at, updated_at, now()) + interval '3 days'
WHERE status = 'failed';

DROP POLICY IF EXISTS "Users can view their own archived failed accounts" ON public.accounts;
CREATE POLICY "Users can view their own archived failed accounts"
ON public.accounts
FOR SELECT
USING (
  auth.uid() = user_id
  AND status = 'failed'
  AND archived_at IS NOT NULL
  AND archive_expires_at > now()
);

CREATE OR REPLACE FUNCTION public.purge_expired_failed_accounts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.accounts
  WHERE status = 'failed'
    AND archived_at IS NOT NULL
    AND archive_expires_at <= now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_failed_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_failed_accounts() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('purge-expired-failed-accounts', 'purge-expired-account-archives');

SELECT cron.schedule(
  'purge-expired-failed-accounts',
  '*/1 * * * *',
  $$SELECT public.purge_expired_failed_accounts();$$
);

SELECT cron.schedule(
  'purge-expired-account-archives',
  '*/1 * * * *',
  $$SELECT public.purge_expired_account_archives();$$
);
