ALTER TABLE public.certificates
  ALTER COLUMN account_id DROP NOT NULL,
  ALTER COLUMN challenge_type DROP NOT NULL,
  ALTER COLUMN account_size DROP NOT NULL,
  ALTER COLUMN phase_number DROP NOT NULL,
  ALTER COLUMN phase_name DROP NOT NULL;

ALTER TABLE public.certificates
  ADD COLUMN payout_id UUID REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  ADD COLUMN payout_amount DECIMAL(12, 2),
  ADD COLUMN payout_method TEXT,
  ADD COLUMN recipient_name TEXT;

CREATE UNIQUE INDEX certificates_payout_id_idx
  ON public.certificates (payout_id)
  WHERE payout_id IS NOT NULL;

ALTER TABLE public.payout_requests
  ADD COLUMN certificate_account_size INTEGER,
  ADD COLUMN certificate_challenge_type public.challenge_type,
  ADD COLUMN payout_date TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.create_payout_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.status <> 'approved' AND NEW.status = 'approved' THEN
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
    WHERE user_record.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_payout_certificate
AFTER UPDATE OF status ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_payout_certificate();