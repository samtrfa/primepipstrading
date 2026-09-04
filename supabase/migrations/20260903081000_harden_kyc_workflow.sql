ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users can create their own KYC record" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Users can update their own KYC record" ON public.kyc_verifications;

CREATE OR REPLACE FUNCTION public.submit_kyc(
  p_identity_document_type TEXT,
  p_identity_document_path TEXT,
  p_address_document_type TEXT,
  p_address_document_path TEXT
)
RETURNS public.kyc_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submitted public.kyc_verifications;
BEGIN
  IF auth.uid() IS NULL
    OR p_identity_document_type NOT IN ('passport', 'national_id', 'drivers_license')
    OR p_address_document_type NOT IN ('utility_bill', 'bank_statement', 'government_letter')
    OR p_identity_document_path IS NULL
    OR p_address_document_path IS NULL
    OR split_part(p_identity_document_path, '/', 1) <> auth.uid()::text
    OR split_part(p_address_document_path, '/', 1) <> auth.uid()::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'kyc-documents' AND name = p_identity_document_path
        AND (metadata ->> 'mimetype') IN ('application/pdf', 'image/jpeg', 'image/png')
        AND COALESCE((metadata ->> 'size')::bigint, 0) <= 10485760
    )
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'kyc-documents' AND name = p_address_document_path
        AND (metadata ->> 'mimetype') IN ('application/pdf', 'image/jpeg', 'image/png')
        AND COALESCE((metadata ->> 'size')::bigint, 0) <= 10485760
    )
  THEN
    RAISE EXCEPTION 'Both valid KYC documents are required';
  END IF;

  INSERT INTO public.kyc_verifications (
    user_id, identity_document_type, identity_document_path, identity_submitted_at,
    address_document_type, address_document_path, address_submitted_at,
    status, rejection_reason, reviewed_at, reviewed_by
  ) VALUES (
    auth.uid(), p_identity_document_type, p_identity_document_path, now(),
    p_address_document_type, p_address_document_path, now(),
    'pending', NULL, NULL, NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    identity_document_type = EXCLUDED.identity_document_type,
    identity_document_path = EXCLUDED.identity_document_path,
    identity_submitted_at = EXCLUDED.identity_submitted_at,
    address_document_type = EXCLUDED.address_document_type,
    address_document_path = EXCLUDED.address_document_path,
    address_submitted_at = EXCLUDED.address_submitted_at,
    status = 'pending', rejection_reason = NULL, reviewed_at = NULL, reviewed_by = NULL
  RETURNING * INTO submitted;

  RETURN submitted;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_kyc(
  p_kyc_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS public.kyc_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewed public.kyc_verifications;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin'
    OR p_status NOT IN ('approved', 'rejected')
    OR (p_status = 'rejected' AND NULLIF(btrim(p_rejection_reason), '') IS NULL)
  THEN
    RAISE EXCEPTION 'Unauthorized or invalid KYC review';
  END IF;

  UPDATE public.kyc_verifications
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_kyc_id AND status = 'pending'
  RETURNING * INTO reviewed;

  IF reviewed.id IS NULL THEN RAISE EXCEPTION 'KYC application is not pending'; END IF;
  RETURN reviewed;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_kyc(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_kyc(TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.review_kyc(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_kyc(UUID, TEXT, TEXT) TO authenticated;

CREATE POLICY "Admins can view KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can create their own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can create their own trading payout requests" ON public.payout_requests;
CREATE POLICY "Users can create KYC verified trading payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND source = 'trading_profit'
  AND account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = payout_requests.account_id
      AND accounts.user_id = auth.uid()
      AND (accounts.status = 'funded' OR (accounts.challenge_type = 'instant' AND accounts.status = 'active'))
  )
  AND EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id = auth.uid() AND status = 'approved')
);