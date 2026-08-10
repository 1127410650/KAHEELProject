-- 1) Real distance in metres (haversine), immutable so it can be used in ORDER BY.
CREATE OR REPLACE FUNCTION public.mkt_distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371000.0 * 2 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )))
  END
$$;

GRANT EXECUTE ON FUNCTION public.mkt_distance_m(double precision, double precision, double precision, double precision) TO anon, authenticated, service_role;

-- 2) Spatial (bounding-box) indexes on every coordinate pair we sort by.
CREATE INDEX IF NOT EXISTS mkt_listings_geo_idx
  ON public.mkt_listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_listings_geo_public_idx
  ON public.mkt_listings (latitude_public, longitude_public)
  WHERE latitude_public IS NOT NULL AND longitude_public IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_storefronts_geo_idx
  ON public.mkt_storefronts (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_store_branches_geo_idx
  ON public.mkt_store_branches (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_guide_places_geo_idx
  ON public.mkt_guide_places (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_syria_directory_geo_idx
  ON public.mkt_syria_directory_entries (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 3) Nearest-first listing ids. Filtering, distance and ordering all happen here.
CREATE OR REPLACE FUNCTION public.mkt_nearby_listings(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT NULL,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0,
  _country_id uuid DEFAULT NULL,
  _city_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _subcategory_id uuid DEFAULT NULL,
  _type_code text DEFAULT NULL,
  _deal text DEFAULT NULL,
  _min_price numeric DEFAULT NULL,
  _max_price numeric DEFAULT NULL,
  _q text DEFAULT NULL,
  _advertiser text DEFAULT NULL,
  _with_image boolean DEFAULT false,
  _has_price boolean DEFAULT false,
  _featured_only boolean DEFAULT false
) RETURNS TABLE (id uuid, distance_m double precision)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.id,
         public.mkt_distance_m(_lat, _lng,
           COALESCE(l.latitude, l.latitude_public),
           COALESCE(l.longitude, l.longitude_public)) AS distance_m
  FROM public.mkt_listings l
  WHERE l.status = 'published'
    AND l.deleted_at IS NULL
    AND (_country_id IS NULL OR l.country_id = _country_id)
    AND (_city_id IS NULL OR l.city_id = _city_id)
    AND (_category_id IS NULL OR l.category_id = _category_id)
    AND (_subcategory_id IS NULL OR l.subcategory_id = _subcategory_id)
    AND (_type_code IS NULL OR l.type_code = _type_code)
    AND (_deal IS NULL OR l.deal_kind = _deal)
    AND (_min_price IS NULL OR l.price >= _min_price)
    AND (_max_price IS NULL OR l.price <= _max_price)
    AND (_advertiser IS NULL OR l.advertiser_type = _advertiser)
    AND (NOT _with_image OR l.cover_image_url IS NOT NULL)
    AND (NOT _has_price OR l.price IS NOT NULL)
    AND (NOT _featured_only OR (l.is_featured AND l.featured_until > now()))
    AND (
      _q IS NULL OR _q = '' OR
      l.title ILIKE '%' || _q || '%' OR
      COALESCE(l.summary, '') ILIKE '%' || _q || '%' OR
      COALESCE(l.description, '') ILIKE '%' || _q || '%'
    )
    AND (
      _radius_km IS NULL
      OR COALESCE(l.latitude, l.latitude_public) IS NULL
      OR public.mkt_distance_m(_lat, _lng,
           COALESCE(l.latitude, l.latitude_public),
           COALESCE(l.longitude, l.longitude_public)) <= _radius_km * 1000
    )
  ORDER BY distance_m ASC NULLS LAST, l.published_at DESC NULLS LAST, l.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  OFFSET GREATEST(0, COALESCE(_offset, 0))
$$;

GRANT EXECUTE ON FUNCTION public.mkt_nearby_listings(double precision, double precision, double precision, integer, integer, uuid, uuid, uuid, uuid, text, text, numeric, numeric, text, text, boolean, boolean, boolean) TO anon, authenticated, service_role;

-- 4) Nearest-first published storefronts (own point, else primary branch point).
CREATE OR REPLACE FUNCTION public.mkt_nearby_storefronts(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT NULL,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0,
  _country_id uuid DEFAULT NULL,
  _city_id uuid DEFAULT NULL,
  _store_type text DEFAULT NULL,
  _q text DEFAULT NULL
) RETURNS TABLE (id uuid, distance_m double precision)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH points AS (
    SELECT s.id,
           COALESCE(s.latitude, b.latitude) AS lat,
           COALESCE(s.longitude, b.longitude) AS lng,
           s.created_at
    FROM public.mkt_storefronts s
    LEFT JOIN LATERAL (
      SELECT br.latitude, br.longitude
      FROM public.mkt_store_branches br
      WHERE br.storefront_id = s.id
        AND br.deleted_at IS NULL
        AND br.latitude IS NOT NULL
      ORDER BY br.is_primary DESC, br.created_at ASC
      LIMIT 1
    ) b ON true
    WHERE s.status = 'published'
      AND (_country_id IS NULL OR s.country_id = _country_id)
      AND (_city_id IS NULL OR s.city_id = _city_id)
      AND (_store_type IS NULL OR s.store_type = _store_type)
      AND (_q IS NULL OR _q = '' OR s.name_ar ILIKE '%' || _q || '%' OR COALESCE(s.name_en, '') ILIKE '%' || _q || '%')
  )
  SELECT p.id, public.mkt_distance_m(_lat, _lng, p.lat, p.lng) AS distance_m
  FROM points p
  WHERE _radius_km IS NULL
     OR p.lat IS NULL
     OR public.mkt_distance_m(_lat, _lng, p.lat, p.lng) <= _radius_km * 1000
  ORDER BY distance_m ASC NULLS LAST, p.created_at DESC, p.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  OFFSET GREATEST(0, COALESCE(_offset, 0))
$$;

GRANT EXECUTE ON FUNCTION public.mkt_nearby_storefronts(double precision, double precision, double precision, integer, integer, uuid, uuid, text, text) TO anon, authenticated, service_role;

-- 5) Nearest-first guide places.
CREATE OR REPLACE FUNCTION public.mkt_nearby_guide_places(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0,
  _country_iso2 text DEFAULT NULL,
  _sector text DEFAULT NULL,
  _governorate text DEFAULT NULL,
  _category text DEFAULT NULL,
  _subcategory text DEFAULT NULL,
  _q text DEFAULT NULL
) RETURNS TABLE (id uuid, distance_m double precision)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT g.id, public.mkt_distance_m(_lat, _lng, g.latitude, g.longitude) AS distance_m
  FROM public.mkt_guide_places g
  WHERE g.is_published = true
    AND (_country_iso2 IS NULL OR g.country_iso2 = _country_iso2)
    AND (_sector IS NULL OR _sector = '' OR g.sector = _sector)
    AND (_governorate IS NULL OR _governorate = '' OR g.governorate = _governorate)
    AND (_category IS NULL OR _category = '' OR g.category = _category)
    AND (_subcategory IS NULL OR _subcategory = '' OR g.subcategory = _subcategory)
    AND (
      _q IS NULL OR _q = '' OR
      g.name_ar ILIKE '%' || _q || '%' OR
      COALESCE(g.name_en, '') ILIKE '%' || _q || '%' OR
      COALESCE(g.city, '') ILIKE '%' || _q || '%' OR
      COALESCE(g.address, '') ILIKE '%' || _q || '%' OR
      COALESCE(g.subcategory, '') ILIKE '%' || _q || '%'
    )
    AND (
      _radius_km IS NULL
      OR g.latitude IS NULL
      OR public.mkt_distance_m(_lat, _lng, g.latitude, g.longitude) <= _radius_km * 1000
    )
  ORDER BY distance_m ASC NULLS LAST, g.governorate ASC NULLS LAST, g.completeness DESC NULLS LAST, g.name_ar ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 24), 100))
  OFFSET GREATEST(0, COALESCE(_offset, 0))
$$;

GRANT EXECUTE ON FUNCTION public.mkt_nearby_guide_places(double precision, double precision, double precision, integer, integer, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- 6) Nearest-first national directory entries.
CREATE OR REPLACE FUNCTION public.mkt_nearby_directory(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0,
  _sector text DEFAULT NULL,
  _governorate text DEFAULT NULL,
  _q text DEFAULT NULL
) RETURNS TABLE (id uuid, distance_m double precision)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d.id, public.mkt_distance_m(_lat, _lng, d.latitude, d.longitude) AS distance_m
  FROM public.mkt_syria_directory_entries d
  WHERE d.publication_status = 'published'
    AND (_sector IS NULL OR _sector = '' OR d.sector = _sector)
    AND (_governorate IS NULL OR _governorate = '' OR d.governorate = _governorate)
    AND (_q IS NULL OR _q = '' OR d.search_text ILIKE '%' || _q || '%' OR d.name_ar ILIKE '%' || _q || '%')
    AND (
      _radius_km IS NULL
      OR d.latitude IS NULL
      OR public.mkt_distance_m(_lat, _lng, d.latitude, d.longitude) <= _radius_km * 1000
    )
  ORDER BY distance_m ASC NULLS LAST, d.governorate ASC NULLS LAST, d.completeness_score DESC NULLS LAST, d.name_ar ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 24), 100))
  OFFSET GREATEST(0, COALESCE(_offset, 0))
$$;

GRANT EXECUTE ON FUNCTION public.mkt_nearby_directory(double precision, double precision, double precision, integer, integer, text, text, text) TO anon, authenticated, service_role;