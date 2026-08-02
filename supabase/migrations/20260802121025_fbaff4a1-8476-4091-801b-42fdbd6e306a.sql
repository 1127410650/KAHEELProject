-- 1) Browsing market preference: name the columns for what they are.
ALTER TABLE public.mkt_user_market_preferences RENAME COLUMN country_id TO browsing_country_id;
ALTER TABLE public.mkt_user_market_preferences RENAME COLUMN city_id TO browsing_city_id;

-- 2) Private contact details live apart from the public profile.
ALTER TABLE public.mkt_user_profiles DROP COLUMN IF EXISTS phone_e164;
ALTER TABLE public.mkt_user_profiles DROP COLUMN IF EXISTS phone_visibility;

CREATE TABLE public.mkt_user_contacts (
  user_id uuid PRIMARY KEY,
  country_id uuid REFERENCES public.mkt_countries(id),
  phone_e164 text,
  phone_status text NOT NULL DEFAULT 'unverified',
  phone_visibility text NOT NULL DEFAULT 'hidden',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_user_contacts_status_chk CHECK (phone_status IN ('unverified','verified')),
  CONSTRAINT mkt_user_contacts_visibility_chk CHECK (phone_visibility IN ('hidden','on_request','public')),
  CONSTRAINT mkt_user_contacts_phone_chk CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

GRANT SELECT, INSERT, UPDATE ON public.mkt_user_contacts TO authenticated;
GRANT ALL ON public.mkt_user_contacts TO service_role;
ALTER TABLE public.mkt_user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_user_contacts_own ON public.mkt_user_contacts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER mkt_user_contacts_touch
  BEFORE UPDATE ON public.mkt_user_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only an explicit "public" choice reveals a phone number to anyone else.
CREATE OR REPLACE FUNCTION public.mkt_public_phone(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.phone_e164
  FROM public.mkt_user_contacts c
  WHERE c.user_id = _user_id
    AND c.phone_visibility = 'public'
    AND c.phone_e164 IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.mkt_public_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_public_phone(uuid) TO anon, authenticated;

-- 3) A city must belong to the country stored beside it.
CREATE OR REPLACE FUNCTION public.mkt_assert_city_in_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.city_id IS NOT NULL THEN
    IF NEW.country_id IS NULL THEN
      RAISE EXCEPTION 'GEO_COUNTRY_REQUIRED';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_cities c
      WHERE c.id = NEW.city_id AND c.country_id = NEW.country_id
    ) THEN
      RAISE EXCEPTION 'GEO_CITY_COUNTRY_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_listings_geo_match
  BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

CREATE TRIGGER mkt_user_profiles_geo_match
  BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

CREATE TRIGGER mkt_business_profiles_geo_match
  BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

-- 4) New listings always carry a location; the currency follows that country.
CREATE OR REPLACE FUNCTION public.mkt_listings_geo_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_currency text;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.country_id IS NULL OR NEW.city_id IS NULL) THEN
    RAISE EXCEPTION 'GEO_LOCATION_REQUIRED';
  END IF;
  IF NEW.country_id IS NOT NULL THEN
    SELECT currency_code INTO v_currency FROM public.mkt_countries WHERE id = NEW.country_id;
    IF v_currency IS NOT NULL THEN
      NEW.currency := v_currency;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_listings_geo_currency_sync
  BEFORE INSERT OR UPDATE OF country_id ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listings_geo_currency();

-- 5) Countries and cities are curated by platform admins; disable, never delete.
CREATE POLICY mkt_countries_admin_read ON public.mkt_countries
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());
CREATE POLICY mkt_countries_admin_write ON public.mkt_countries
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_cities_admin_read ON public.mkt_cities
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());
CREATE POLICY mkt_cities_admin_insert ON public.mkt_cities
  FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY mkt_cities_admin_update ON public.mkt_cities
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

GRANT UPDATE ON public.mkt_countries TO authenticated;
GRANT INSERT, UPDATE ON public.mkt_cities TO authenticated;

CREATE POLICY mkt_city_suggestions_admin_update ON public.mkt_city_suggestions
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());
GRANT UPDATE ON public.mkt_city_suggestions TO authenticated;
