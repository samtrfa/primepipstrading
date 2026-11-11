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
      IF NEW.archived_at IS NULL THEN
        NEW.archive_expires_at := NULL;
      ELSIF NEW.archive_expires_at IS NULL THEN
        NEW.archive_expires_at := NEW.failed_at + interval '3 days';
      END IF;
    END IF;
  ELSE
    NEW.failed_at := NULL;
    IF TG_OP = 'UPDATE'
      AND OLD.status = 'failed'
      AND OLD.archived_at IS NOT DISTINCT FROM OLD.failed_at
      AND NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at
      AND NEW.archive_expires_at IS NOT DISTINCT FROM OLD.archive_expires_at
    THEN
      -- Remove only the failure-created archive marker; preserve explicit archives.
      NEW.archived_at := NULL;
      NEW.archive_expires_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
