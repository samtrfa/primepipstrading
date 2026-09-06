CREATE TABLE public.kyc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kyc_id UUID NOT NULL REFERENCES public.kyc_verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('identity', 'address')),
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (kyc_id, storage_path)
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own archived KYC documents"
ON public.kyc_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view archived KYC documents"
ON public.kyc_documents FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.archive_kyc_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.identity_document_path IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.identity_document_path IS DISTINCT FROM OLD.identity_document_path)
  THEN
    INSERT INTO public.kyc_documents (kyc_id, user_id, document_kind, document_type, storage_path, submitted_at)
    VALUES (NEW.id, NEW.user_id, 'identity', COALESCE(NEW.identity_document_type, 'unknown'), NEW.identity_document_path, COALESCE(NEW.identity_submitted_at, now()))
    ON CONFLICT (kyc_id, storage_path) DO NOTHING;
  END IF;

  IF NEW.address_document_path IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.address_document_path IS DISTINCT FROM OLD.address_document_path)
  THEN
    INSERT INTO public.kyc_documents (kyc_id, user_id, document_kind, document_type, storage_path, submitted_at)
    VALUES (NEW.id, NEW.user_id, 'address', COALESCE(NEW.address_document_type, 'unknown'), NEW.address_document_path, COALESCE(NEW.address_submitted_at, now()))
    ON CONFLICT (kyc_id, storage_path) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER archive_kyc_documents_on_submission
AFTER INSERT OR UPDATE OF identity_document_path, address_document_path ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.archive_kyc_documents();

INSERT INTO public.kyc_documents (kyc_id, user_id, document_kind, document_type, storage_path, submitted_at)
SELECT id, user_id, 'identity', COALESCE(identity_document_type, 'unknown'), identity_document_path, COALESCE(identity_submitted_at, created_at)
FROM public.kyc_verifications
WHERE identity_document_path IS NOT NULL
ON CONFLICT (kyc_id, storage_path) DO NOTHING;

INSERT INTO public.kyc_documents (kyc_id, user_id, document_kind, document_type, storage_path, submitted_at)
SELECT id, user_id, 'address', COALESCE(address_document_type, 'unknown'), address_document_path, COALESCE(address_submitted_at, created_at)
FROM public.kyc_verifications
WHERE address_document_path IS NOT NULL
ON CONFLICT (kyc_id, storage_path) DO NOTHING;