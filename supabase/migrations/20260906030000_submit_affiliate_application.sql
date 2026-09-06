CREATE OR REPLACE FUNCTION public.submit_affiliate_application(
  p_phone TEXT,
  p_country TEXT,
  p_website TEXT,
  p_instagram TEXT,
  p_tiktok TEXT,
  p_youtube TEXT,
  p_x_handle TEXT,
  p_audience_size TEXT,
  p_promotion_channels TEXT,
  p_affiliate_experience TEXT,
  p_promotion_plan TEXT,
  p_desired_code TEXT
)
RETURNS public.affiliate_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  application_row public.affiliate_applications;
  normalized_code TEXT := upper(btrim(p_desired_code));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_applications WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You already have an affiliate application';
  END IF;
  IF normalized_code !~ '^[A-Z0-9]{6,8}$' THEN
    RAISE EXCEPTION 'Affiliate code must contain 6-8 letters or numbers';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_codes WHERE code = normalized_code)
     OR EXISTS (SELECT 1 FROM public.coupons WHERE code = normalized_code)
     OR EXISTS (SELECT 1 FROM public.affiliate_applications WHERE upper(desired_code) = normalized_code AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'Affiliate code is already in use';
  END IF;

  INSERT INTO public.affiliate_applications (
    user_id, phone, country, website, instagram, tiktok, youtube, x_handle,
    audience_size, promotion_channels, affiliate_experience, promotion_plan, desired_code
  ) VALUES (
    auth.uid(), btrim(p_phone), btrim(p_country), NULLIF(btrim(p_website), ''),
    NULLIF(btrim(p_instagram), ''), NULLIF(btrim(p_tiktok), ''), NULLIF(btrim(p_youtube), ''),
    NULLIF(btrim(p_x_handle), ''), btrim(p_audience_size), btrim(p_promotion_channels),
    NULLIF(btrim(p_affiliate_experience), ''), btrim(p_promotion_plan), normalized_code
  ) RETURNING * INTO application_row;

  RETURN application_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_affiliate_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_affiliate_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;