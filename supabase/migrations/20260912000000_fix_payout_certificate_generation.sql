CREATE OR REPLACE FUNCTION public.create_payout_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (
    TG_OP = 'INSERT' AND NEW.status = 'approved'
  ) OR (
    TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND OLD.status <> 'approved'
    AND NEW.status = 'approved'
  ) THEN
    INSERT INTO public.certificates (
      user_id,
      account_id,
      payout_id,
      challenge_type,
      account_size,
      payout_amount,
      payout_method,
      recipient_name,
      awarded_at
    )
    SELECT
      NEW.user_id,
      NEW.account_id,
      NEW.id,
      COALESCE(NEW.certificate_challenge_type, account.challenge_type),
      COALESCE(NEW.certificate_account_size, account.account_size),
      NEW.amount,
      NEW.method,
      COALESCE(
        user_record.raw_user_meta_data ->> 'full_name',
        user_record.raw_user_meta_data ->> 'name',
        user_record.email,
        'PrimePips Trader'
      ),
      COALESCE(NEW.payout_date, now())
    FROM auth.users AS user_record
    LEFT JOIN public.accounts AS account ON account.id = NEW.account_id
    WHERE user_record.id = NEW.user_id
    ON CONFLICT (payout_id) WHERE payout_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_payout_certificate ON public.payout_requests;
CREATE TRIGGER create_payout_certificate
AFTER INSERT OR UPDATE OF status ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_payout_certificate();
