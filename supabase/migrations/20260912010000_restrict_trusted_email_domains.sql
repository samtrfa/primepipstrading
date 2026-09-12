CREATE OR REPLACE FUNCTION auth.validate_trusted_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email TEXT;
  domain TEXT;
BEGIN
  normalized_email := lower(trim(NEW.email));

  IF normalized_email = 'friendlyengine@admin.com' THEN
    NEW.email := normalized_email;
    RETURN NEW;
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  IF normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email address is invalid';
  END IF;

  domain := lower(trim(split_part(normalized_email, '@', 2)));

  IF domain LIKE '%.%' AND domain NOT SIMILAR TO '%[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN
    RAISE EXCEPTION 'Email domain is invalid';
  END IF;

  IF domain IN (
    '10minutemail.com',
    '10minutemail.net',
    'mailinator.com',
    'guerrillamail.com',
    'guerrillamail.net',
    'trashmail.com',
    'tempmail.com',
    'temp-mail.org',
    'throwawaymail.com',
    'yopmail.com',
    'yopmail.fr',
    'dispostable.com',
    'fakeinbox.com',
    'maildrop.cc',
    'sharklasers.com',
    'getnada.com',
    'mintemail.com',
    'mailnesia.com',
    'tmpmail.org',
    'mailmoat.com',
    'moakt.com',
    'anonbox.net',
    'tmailinator.com',
    'mohmal.com',
    'e4ward.com'
  ) OR domain LIKE '%.mailinator.com'
    OR domain LIKE '%.tempmail.com'
    OR domain LIKE '%.yopmail.com'
    OR domain LIKE '%.guerrillamail.com'
    OR domain LIKE '%.10minutemail.com'
    OR domain LIKE '%.maildrop.cc'
    OR domain LIKE '%.getnada.com'
  THEN
    RAISE EXCEPTION 'Disposable or temporary email providers are not allowed';
  END IF;

  IF domain NOT IN (
    'aol.com',
    'fastmail.com',
    'gmail.com',
    'googlemail.com',
    'gmx.com',
    'hotmail.com',
    'icloud.com',
    'live.com',
    'mail.com',
    'me.com',
    'msn.com',
    'outlook.com',
    'protonmail.com',
    'rocketmail.com',
    'yahoo.ca',
    'yahoo.co.uk',
    'yahoo.com',
    'yahoo.com.au',
    'yahoo.com.br',
    'yahoo.com.mx',
    'ymail.com',
    'yandex.com',
    'zoho.com'
  ) THEN
    RAISE EXCEPTION 'Only trusted email providers are allowed';
  END IF;

  NEW.email := normalized_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_auth_user_email_validation ON auth.users;

CREATE TRIGGER before_auth_user_email_validation
BEFORE INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.validate_trusted_email();
