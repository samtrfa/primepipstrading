CREATE TABLE public.kyc_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_document_type TEXT,
  identity_document_path TEXT,
  identity_submitted_at TIMESTAMP WITH TIME ZONE,
  address_document_type TEXT,
  address_document_path TEXT,
  address_submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KYC record"
ON public.kyc_verifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own KYC record"
ON public.kyc_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own KYC record"
ON public.kyc_verifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_kyc_verifications_updated_at
BEFORE UPDATE ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);