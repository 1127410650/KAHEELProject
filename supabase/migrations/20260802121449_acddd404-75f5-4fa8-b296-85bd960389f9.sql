-- Keep the individual's phone in one private place only.
INSERT INTO public.mkt_user_contacts (user_id, country_id, phone_e164, phone_visibility)
SELECT p.user_id, p.country_id, p.public_phone,
       CASE WHEN p.show_phone THEN 'public' ELSE 'hidden' END
FROM public.mkt_user_profiles p
WHERE p.public_phone IS NOT NULL
  AND p.public_phone ~ '^\+[0-9]{8,15}$'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.mkt_user_profiles
  DROP COLUMN IF EXISTS public_phone,
  DROP COLUMN IF EXISTS show_phone;