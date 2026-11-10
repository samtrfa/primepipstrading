CREATE OR REPLACE FUNCTION public.track_account_failed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.failed_at := now();
      NEW.archived_at := COALESCE(NEW.archived_at, now());
      NEW.archive_expires_at := COALESCE(NEW.archive_expires_at, NEW.archived_at + interval '30 days');
    ELSIF OLD.status IS DISTINCT FROM 'failed' THEN
      NEW.failed_at := now();
      NEW.archived_at := COALESCE(NEW.archived_at, now());
      NEW.archive_expires_at := COALESCE(NEW.archive_expires_at, NEW.archived_at + interval '30 days');
    ELSE
      NEW.failed_at := OLD.failed_at;
    END IF;
  ELSE
    NEW.failed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.accounts
SET archived_at = COALESCE(archived_at, COALESCE(failed_at, updated_at, now())),
    archive_expires_at = COALESCE(
      archive_expires_at,
      COALESCE(failed_at, updated_at, now()) + interval '30 days'
    )
WHERE status = 'failed';
