CREATE OR REPLACE FUNCTION public.mkt_assert_city_in_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _country uuid;
BEGIN
  IF NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT country_id INTO _country FROM public.mkt_cities WHERE id = NEW.city_id;
  IF NEW.country_id IS NULL OR _country IS DISTINCT FROM NEW.country_id THEN
    RAISE EXCEPTION 'city_country_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_listings_city_country ON public.mkt_listings;
CREATE TRIGGER mkt_listings_city_country
BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_listings
FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

DROP TRIGGER IF EXISTS mkt_user_profiles_city_country ON public.mkt_user_profiles;
CREATE TRIGGER mkt_user_profiles_city_country
BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_user_profiles
FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

DROP TRIGGER IF EXISTS mkt_business_profiles_city_country ON public.mkt_business_profiles;
CREATE TRIGGER mkt_business_profiles_city_country
BEFORE INSERT OR UPDATE OF country_id, city_id ON public.mkt_business_profiles
FOR EACH ROW EXECUTE FUNCTION public.mkt_assert_city_in_country();

REVOKE ALL ON FUNCTION public.mkt_assert_city_in_country() FROM PUBLIC, anon, authenticated;