-- KAHEEL Appointments nearby directory.
-- Customer coordinates are transient RPC parameters and are never stored.
-- Provider locations are written only to appt_providers by an authorized
-- appointment provider manager. No mkt_* table is read or changed.

ALTER TABLE public.appt_providers
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS location_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters integer;

ALTER TABLE public.appt_providers
  DROP CONSTRAINT IF EXISTS appt_providers_provider_type_ck,
  DROP CONSTRAINT IF EXISTS appt_providers_location_accuracy_ck,
  DROP CONSTRAINT IF EXISTS appt_providers_location_pair_ck;

ALTER TABLE public.appt_providers
  ADD CONSTRAINT appt_providers_provider_type_ck CHECK (provider_type IN (
    'medical_center',
    'clinic',
    'pharmacy',
    'laboratory',
    'dental',
    'radiology',
    'physiotherapy',
    'home_care',
    'veterinary',
    'beauty_wellness',
    'consulting',
    'other'
  )),
  ADD CONSTRAINT appt_providers_location_accuracy_ck CHECK (
    location_accuracy_meters IS NULL
    OR location_accuracy_meters BETWEEN 0 AND 100000
  ),
  ADD CONSTRAINT appt_providers_location_pair_ck CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );

CREATE INDEX IF NOT EXISTS appt_providers_type_idx
  ON public.appt_providers (provider_type, status, city)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS appt_providers_location_idx
  ON public.appt_providers (latitude, longitude)
  WHERE deleted_at IS NULL
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.appt_distance_km(
  _latitude_a double precision,
  _longitude_a double precision,
  _latitude_b double precision,
  _longitude_b double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT 6371.0088 * 2 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians((_latitude_b - _latitude_a) / 2)), 2)
    + cos(radians(_latitude_a))
      * cos(radians(_latitude_b))
      * power(sin(radians((_longitude_b - _longitude_a) / 2)), 2)
  ))))
$$;

CREATE OR REPLACE FUNCTION public.appt_provider_location_context(_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'provider_id', p.id,
    'provider_type', p.provider_type,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'location_confirmed_at', p.location_confirmed_at,
    'location_accuracy_meters', p.location_accuracy_meters
  ) INTO v_result
  FROM public.appt_providers p
  WHERE p.id = _provider_id
    AND p.deleted_at IS NULL;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_save_provider_location(
  _provider_id uuid,
  _provider_type text,
  _city text DEFAULT NULL,
  _district text DEFAULT NULL,
  _address_text text DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _accuracy_meters integer DEFAULT NULL,
  _clear_location boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider public.appt_providers;
  v_location_action text := 'unchanged';
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _provider_type NOT IN (
    'medical_center','clinic','pharmacy','laboratory','dental','radiology',
    'physiotherapy','home_care','veterinary','beauty_wellness','consulting','other'
  ) THEN
    RAISE EXCEPTION 'invalid_provider_type';
  END IF;

  IF NOT coalesce(_clear_location, false) THEN
    IF (_latitude IS NULL) <> (_longitude IS NULL) THEN
      RAISE EXCEPTION 'invalid_location';
    END IF;
    IF _latitude IS NOT NULL AND (_latitude < -90 OR _latitude > 90) THEN
      RAISE EXCEPTION 'invalid_location';
    END IF;
    IF _longitude IS NOT NULL AND (_longitude < -180 OR _longitude > 180) THEN
      RAISE EXCEPTION 'invalid_location';
    END IF;
    IF _accuracy_meters IS NOT NULL
       AND (_accuracy_meters < 0 OR _accuracy_meters > 100000) THEN
      RAISE EXCEPTION 'invalid_location';
    END IF;
  END IF;

  IF coalesce(_clear_location, false) THEN
    v_location_action := 'cleared';
  ELSIF _latitude IS NOT NULL AND _longitude IS NOT NULL THEN
    v_location_action := 'confirmed';
  END IF;

  UPDATE public.appt_providers p SET
    provider_type = _provider_type,
    city = nullif(btrim(coalesce(_city, '')), ''),
    district = nullif(btrim(coalesce(_district, '')), ''),
    address_text = nullif(btrim(coalesce(_address_text, '')), ''),
    latitude = CASE
      WHEN coalesce(_clear_location, false) THEN NULL
      WHEN _latitude IS NOT NULL THEN _latitude
      ELSE p.latitude
    END,
    longitude = CASE
      WHEN coalesce(_clear_location, false) THEN NULL
      WHEN _longitude IS NOT NULL THEN _longitude
      ELSE p.longitude
    END,
    location_accuracy_meters = CASE
      WHEN coalesce(_clear_location, false) THEN NULL
      WHEN _latitude IS NOT NULL THEN _accuracy_meters
      ELSE p.location_accuracy_meters
    END,
    location_confirmed_at = CASE
      WHEN coalesce(_clear_location, false) THEN NULL
      WHEN _latitude IS NOT NULL AND _longitude IS NOT NULL THEN now()
      ELSE p.location_confirmed_at
    END
  WHERE p.id = _provider_id
    AND p.deleted_at IS NULL
  RETURNING * INTO v_provider;

  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  INSERT INTO public.appt_audit_log (
    provider_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) VALUES (
    _provider_id,
    auth.uid(),
    'provider_location',
    _provider_id,
    'save',
    jsonb_build_object(
      'provider_type', _provider_type,
      'location_action', v_location_action,
      'location_accuracy_meters', CASE
        WHEN v_location_action = 'confirmed' THEN _accuracy_meters
        ELSE NULL
      END
    )
  );

  RETURN public.appt_provider_location_context(_provider_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_nearby_directory(
  _latitude double precision,
  _longitude double precision,
  _radius_km double precision DEFAULT 20,
  _provider_type text DEFAULT NULL,
  _q text DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_radius double precision := least(greatest(coalesce(_radius_km, 20), 1), 100);
  v_limit integer := least(greatest(coalesce(_limit, 30), 1), 60);
  v_result jsonb;
BEGIN
  IF _latitude IS NULL OR _latitude < -90 OR _latitude > 90
     OR _longitude IS NULL OR _longitude < -180 OR _longitude > 180 THEN
    RAISE EXCEPTION 'invalid_location';
  END IF;

  IF _provider_type IS NOT NULL AND _provider_type NOT IN (
    'medical_center','clinic','pharmacy','laboratory','dental','radiology',
    'physiotherapy','home_care','veterinary','beauty_wellness','consulting','other'
  ) THEN
    RAISE EXCEPTION 'invalid_provider_type';
  END IF;

  WITH candidates AS (
    SELECT
      p.*,
      public.appt_distance_km(
        _latitude,
        _longitude,
        p.latitude,
        p.longitude
      ) AS distance_km
    FROM public.appt_providers p
    WHERE p.status = 'published'
      AND p.accepts_bookings
      AND p.deleted_at IS NULL
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND (_provider_type IS NULL OR p.provider_type = _provider_type)
      AND (
        nullif(btrim(coalesce(_q, '')), '') IS NULL
        OR p.name_ar ILIKE '%' || btrim(_q) || '%'
        OR coalesce(p.name_en, '') ILIKE '%' || btrim(_q) || '%'
        OR EXISTS (
          SELECT 1
          FROM public.appt_services service
          WHERE service.provider_id = p.id
            AND service.is_active
            AND service.deleted_at IS NULL
            AND (
              service.name_ar ILIKE '%' || btrim(_q) || '%'
              OR coalesce(service.name_en, '') ILIKE '%' || btrim(_q) || '%'
            )
        )
      )
  ), nearby AS (
    SELECT *
    FROM candidates
    WHERE distance_km <= v_radius
    ORDER BY distance_km, created_at DESC
    LIMIT v_limit
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'name_ar', p.name_ar,
    'name_en', p.name_en,
    'bio_ar', p.bio_ar,
    'bio_en', p.bio_en,
    'logo_path', p.logo_path,
    'cover_path', p.cover_path,
    'city', p.city,
    'district', p.district,
    'address_text', p.address_text,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'provider_type', p.provider_type,
    'accepts_bookings', p.accepts_bookings,
    'timezone', p.timezone,
    'created_at', p.created_at,
    'distance_km', round(p.distance_km::numeric, 2),
    'market_profile_path', (
      SELECT CASE
        WHEN l.market_profile_path LIKE '/%'
         AND l.market_profile_path NOT LIKE '//%'
        THEN l.market_profile_path
        ELSE NULL
      END
      FROM public.appt_market_links l
      WHERE l.provider_id = p.id
        AND l.status = 'linked'
      LIMIT 1
    ),
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', service.id,
        'name_ar', service.name_ar,
        'name_en', service.name_en,
        'description_ar', service.description_ar,
        'description_en', service.description_en,
        'duration_minutes', service.duration_minutes,
        'price', service.price,
        'currency_code', service.currency_code,
        'booking_mode', service.booking_mode
      ) ORDER BY service.sort_order, service.created_at)
      FROM public.appt_services service
      WHERE service.provider_id = p.id
        AND service.is_active
        AND service.deleted_at IS NULL
    ), '[]'::jsonb)
  ) ORDER BY p.distance_km, p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM nearby p;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.appt_distance_km(double precision,double precision,double precision,double precision)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.appt_provider_location_context(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_save_provider_location(uuid,text,text,text,text,double precision,double precision,integer,boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_nearby_directory(double precision,double precision,double precision,text,text,integer)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.appt_provider_location_context(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_save_provider_location(uuid,text,text,text,text,double precision,double precision,integer,boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_nearby_directory(double precision,double precision,double precision,text,text,integer)
  TO anon, authenticated, service_role;
