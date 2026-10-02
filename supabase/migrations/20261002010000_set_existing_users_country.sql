-- Existing customers have confirmed Nigeria as their country of residence.
-- Merge the country code without replacing names, referrals, or other metadata.
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('country', 'NG')
WHERE raw_user_meta_data->>'country' IS DISTINCT FROM 'NG';
