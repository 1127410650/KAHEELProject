-- 1) Public username: stricter server-side format + reserved words
ALTER TABLE public.mkt_user_profiles
  DROP CONSTRAINT IF EXISTS mkt_user_profiles_username_format;

ALTER TABLE public.mkt_user_profiles
  ADD CONSTRAINT mkt_user_profiles_username_format
  CHECK (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$');

ALTER TABLE public.mkt_user_profiles
  DROP CONSTRAINT IF EXISTS mkt_user_profiles_username_reserved;

ALTER TABLE public.mkt_user_profiles
  ADD CONSTRAINT mkt_user_profiles_username_reserved
  CHECK (username NOT IN (
    'admin','administrator','settings','setting','marketplace','market','support',
    'api','login','logout','register','signup','signin','auth','dashboard','me',
    'u','ads','ad','search','help','root','system','tahqaq','null','undefined',
    'about','contact','privacy','terms','static','assets','public','www'
  ));

-- 2) Changing a phone number always drops it back to unverified
CREATE OR REPLACE FUNCTION public.mkt_reset_phone_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_e164 IS DISTINCT FROM OLD.phone_e164 THEN
    NEW.phone_status := 'unverified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_mkt_reset_phone_status ON public.mkt_user_contacts;
CREATE TRIGGER aa_mkt_reset_phone_status
  BEFORE UPDATE ON public.mkt_user_contacts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_reset_phone_status();

-- 3) Safe defaults for privacy
ALTER TABLE public.mkt_user_contacts
  ALTER COLUMN phone_visibility SET DEFAULT 'hidden',
  ALTER COLUMN phone_status SET DEFAULT 'unverified';
