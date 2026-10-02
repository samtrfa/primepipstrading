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

  DELETE FROM public.kyc_documents WHERE kyc_id = p_kyc_id;

  UPDATE public.kyc_verifications
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      identity_document_path = NULL,
      address_document_path = NULL
  WHERE id = p_kyc_id AND status = 'pending'
  RETURNING * INTO reviewed;

  IF reviewed.id IS NULL THEN RAISE EXCEPTION 'KYC application is not pending'; END IF;
  RETURN reviewed;
END;
$$;

REVOKE ALL ON FUNCTION public.review_kyc(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_kyc(UUID, TEXT, TEXT) TO authenticated;