
DO $$
DECLARE sa uuid;
BEGIN
  SELECT id INTO sa FROM public.mkt_countries WHERE iso2 = 'SA';

  ALTER TABLE public.mkt_listings DISABLE TRIGGER USER;
  UPDATE public.mkt_listings SET country_id = sa WHERE country_id IS NULL;
  UPDATE public.mkt_listings l SET city_id = c.id
  FROM public.mkt_cities c
  WHERE c.country_id = sa AND l.city_id IS NULL
    AND c.name_ar = CASE WHEN btrim(l.city) = 'جيزان' THEN 'جازان' ELSE btrim(l.city) END;
  ALTER TABLE public.mkt_listings ENABLE TRIGGER USER;

  ALTER TABLE public.mkt_user_profiles DISABLE TRIGGER USER;
  UPDATE public.mkt_user_profiles SET country_id = sa WHERE country_id IS NULL;
  UPDATE public.mkt_user_profiles p SET city_id = c.id
  FROM public.mkt_cities c
  WHERE c.country_id = sa AND p.city_id IS NULL AND c.name_ar = btrim(p.city);
  ALTER TABLE public.mkt_user_profiles ENABLE TRIGGER USER;

  ALTER TABLE public.mkt_business_profiles DISABLE TRIGGER USER;
  UPDATE public.mkt_business_profiles SET country_id = sa WHERE country_id IS NULL;
  UPDATE public.mkt_business_profiles b SET city_id = c.id
  FROM public.mkt_cities c
  WHERE c.country_id = sa AND b.city_id IS NULL AND c.name_ar = btrim(b.city);
  ALTER TABLE public.mkt_business_profiles ENABLE TRIGGER USER;
END $$;
