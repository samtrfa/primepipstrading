ALTER TABLE public.accounts
  ADD COLUMN failed_at TIMESTAMP WITH TIME ZONE;

UPDATE public.accounts
SET failed_at = updated_at
WHERE status = 'failed'
  AND failed_at IS NULL;

CREATE INDEX accounts_failed_at_idx
ON public.accounts (failed_at)
WHERE status = 'failed';

CREATE OR REPLACE FUNCTION public.track_account_failed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.failed_at := now();
    ELSIF OLD.status IS DISTINCT FROM 'failed' THEN
      NEW.failed_at := now();
    ELSE
      NEW.failed_at := OLD.failed_at;
    END IF;
  ELSE
    NEW.failed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_track_account_failed_at
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.track_account_failed_at();

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
    AND failed_at <= now() - interval '3 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_failed_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_failed_accounts() TO service_role;

SELECT cron.schedule(
  'purge-expired-failed-accounts',
  '0 * * * *',
  $$SELECT public.purge_expired_failed_accounts();$$
);