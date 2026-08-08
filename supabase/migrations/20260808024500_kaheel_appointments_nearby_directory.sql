-- KAHEEL Appointments nearby directory.
-- Customer coordinates are accepted only as transient RPC parameters and are
-- never stored. Provider coordinates are saved only by an authorized provider
-- manager through appt_save_provider(). No mkt_* table is read or changed.

ALTER TABLE public.appt_providers
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS location_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters integer;

ALTER TABLE public.appt_providers
  DROP CONSTRAINT IF EXISTS appt_providers_provider_type_ck,
  DROP CONSTRAINT IF EXISTS appt_providers_location_accuracy_ck;

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
  SELECT 6371.0088 * 2 * asin(sqrt(
    power(sin(radians((_latitude_b - _latitude_a) / 2)), 2)
    + cos(radians(_latitude_a))
      * cos(radians(_latitude_b))
      * power(sin(radians((_longitude_b - _longitude_a) / 2)), 2)
  ))
$$;

REVOKE ALL ON FUNCTION public.appt_distance_km(double precision,double precision,double precision,double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appt_distance_km(double precision,double precision,double precision,double precision)
  TO service_role;

CREATE OR REPLACE FUNCTION public.appt_save_provider(
  _provider_id uuid,
  _patch jsonb,
  _settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider public.appt_providers;
  v_latitude double precision;
  v_longitude double precision;
  v_accuracy integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _patch ? 'status' AND (_patch->>'status') NOT IN ('draft','published','paused') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _patch ? 'timezone' AND nullif(btrim(_patch->>'timezone'), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_timezone';
  END IF;
  IF _patch ? 'provider_type' AND (_patch->>'provider_type') NOT IN (
    'medical_center','clinic','pharmacy','laboratory','dental','radiology',
    'physiotherapy','home_care','veterinary','beauty_wellness','consulting','other'
  ) THEN
    RAISE EXCEPTION 'invalid_provider_type';
  END IF;

  IF (_patch ? 'latitude') <> (_patch ? 'longitude') THEN
    RAISE EXCEPTION 'location_pair_required';
  END IF;

  IF _patch ? 'latitude' THEN
    v_latitude := nullif(_patch->>'latitude', '')::double precision;
    v_longitude := nullif(_patch->>'longitude', '')::double precision;
    v_accuracy := CASE
      WHEN _patch ? 'location_accuracy_meters'
        THEN nullif(_patch->>'location_accuracy_meters', '')::integer
      ELSE NULL
    END;

    IF (v_latitude IS NULL) <> (v_longitude IS NULL) THEN
      RAISE EXCEPTION 'location_pair_required';
    END IF;
    IF v_latitude IS NOT NULL AND (v_latitude < -90 OR v_latitude > 90) THEN
      RAISE EXCEPTION 'invalid_latitude';
    END IF;
    IF v_longitude IS NOT NULL AND (v_longitude < -180 OR v_longitude > 180) THEN
      RAISE EXCEPTION 'invalid_longitude';
    END IF;
    IF v_accuracy IS NOT NULL AND (v_accuracy < 0 OR v_accuracy > 100000) THEN
      RAISE EXCEPTION 'invalid_location_accuracy';
    END IF;
  END IF;

  UPDATE public.appt_providers p SET
    name_ar = CASE WHEN _patch ? 'name_ar'
      THEN coalesce(nullif(btrim(_patch->>'name_ar'), ''), p.name_ar) ELSE p.name_ar END,
    name_en = CASE WHEN _patch ? 'name_en'
      THEN nullif(btrim(_patch->>'name_en'), '') ELSE p.name_en END,
    bio_ar = CASE WHEN _patch ? 'bio_ar'
      THEN nullif(btrim(_patch->>'bio_ar'), '') ELSE p.bio_ar END,
    bio_en = CASE WHEN _patch ? 'bio_en'
      THEN nullif(btrim(_patch->>'bio_en'), '') ELSE p.bio_en END,
    city = CASE WHEN _patch ? 'city'
      THEN nullif(btrim(_patch->>'city'), '') ELSE p.city END,
    district = CASE WHEN _patch ? 'district'
      THEN nullif(btrim(_patch->>'district'), '') ELSE p.district END,
    address_text = CASE WHEN _patch ? 'address_text'
      THEN nullif(btrim(_patch->>'address_text'), '') ELSE p.address_text END,
    timezone = CASE WHEN _patch ? 'timezone'
      THEN btrim(_patch->>'timezone') ELSE p.timezone END,
    provider_type = CASE WHEN _patch ? 'provider_type'
      THEN _patch->>'provider_type' ELSE p.provider_type END,
    latitude = CASE WHEN _patch ? 'latitude' THEN v_latitude ELSE p.latitude END,
    longitude = CASE WHEN _patch ? 'longitude' THEN v_longitude ELSE p.longitude END,
    location_accuracy_meters = CASE
      WHEN _patch ? 'latitude' THEN v_accuracy ELSE p.location_accuracy_meters END,
    location_confirmed_at = CASE
      WHEN _patch ? 'latitude' THEN
        CASE WHEN v_latitude IS NOT NULL AND v_longitude IS NOT NULL THEN now() ELSE NULL END
      ELSE p.location_confirmed_at
    END,
    status = CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE p.status END,
    accepts_bookings = CASE WHEN _patch ? 'accepts_bookings'
      THEN (_patch->>'accepts_bookings')::boolean ELSE p.accepts_bookings END
  WHERE p.id = _provider_id
  RETURNING * INTO v_provider;

  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  IF _settings IS NOT NULL THEN
    UPDATE public.appt_provider_settings cfg SET
      confirmation_mode = CASE WHEN _settings ? 'confirmation_mode'
        THEN _settings->>'confirmation_mode' ELSE cfg.confirmation_mode END,
      min_notice_minutes = CASE WHEN _settings ? 'min_notice_minutes'
        THEN (_settings->>'min_notice_minutes')::integer ELSE cfg.min_notice_minutes END,
      max_advance_days = CASE WHEN _settings ? 'max_advance_days'
        THEN (_settings->>'max_advance_days')::integer ELSE cfg.max_advance_days END,
      cancellation_window_hours = CASE WHEN _settings ? 'cancellation_window_hours'
        THEN (_settings->>'cancellation_window_hours')::integer ELSE cfg.cancellation_window_hours END,
      queue_enabled = CASE WHEN _settings ? 'queue_enabled'
        THEN (_settings->>'queue_enabled')::boolean ELSE cfg.queue_enabled END,
      average_service_minutes = CASE WHEN _settings ? 'average_service_minutes'
        THEN (_settings->>'average_service_minutes')::integer ELSE cfg.average_service_minutes END
    WHERE cfg.provider_id = _provider_id;
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
    'provider',
    _provider_id,
    CASE WHEN _patch ? 'latitude' THEN 'update_location' ELSE 'update' END,
    _patch - 'latitude' - 'longitude'
      || CASE WHEN _patch ? 'latitude'
        THEN jsonb_build_object(
          'location_confirmed', v_latitude IS NOT NULL AND v_longitude IS NOT NULL,
          'location_accuracy_meters', v_accuracy
        )
        ELSE '{}'::jsonb
      END
  );

  RETURN public.appt_provider_dashboard(_provider_id, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_provider_dashboard(
  _provider_id uuid,
  _date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider public.appt_providers;
  v_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_provider
  FROM public.appt_providers p
  WHERE p.id = _provider_id
    AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;
  v_date := coalesce(_date, (now() AT TIME ZONE v_provider.timezone)::date);

  RETURN jsonb_build_object(
    'provider', jsonb_build_object(
      'id', v_provider.id,
      'slug', v_provider.slug,
      'name_ar', v_provider.name_ar,
      'name_en', v_provider.name_en,
      'city', v_provider.city,
      'district', v_provider.district,
      'address_text', v_provider.address_text,
      'latitude', v_provider.latitude,
      'longitude', v_provider.longitude,
      'provider_type', v_provider.provider_type,
      'location_confirmed_at', v_provider.location_confirmed_at,
      'location_accuracy_meters', v_provider.location_accuracy_meters,
      'timezone', v_provider.timezone,
      'status', v_provider.status,
      'accepts_bookings', v_provider.accepts_bookings
    ),
    'settings', (
      SELECT to_jsonb(cfg) - 'created_at' - 'updated_at'
      FROM public.appt_provider_settings cfg
      WHERE cfg.provider_id = v_provider.id
    ),
    'services', coalesce((
      SELECT jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' - 'deleted_at'
                       ORDER BY s.sort_order, s.created_at)
      FROM public.appt_services s
      WHERE s.provider_id = v_provider.id
        AND s.deleted_at IS NULL
    ), '[]'::jsonb),
    'availability', coalesce((
      SELECT jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at'
                       ORDER BY a.weekday, a.starts_at)
      FROM public.appt_availability a
      WHERE a.provider_id = v_provider.id
    ), '[]'::jsonb),
    'appointments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'appointment_number', a.appointment_number,
        'service_id', a.service_id,
        'service_name', s.name_ar,
        'customer_user_id', a.customer_user_id,
        'customer_name', a.customer_name,
        'customer_phone', a.customer_phone,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'timezone', a.timezone,
        'status', a.status,
        'source', a.source,
        'customer_notes', a.customer_notes,
        'provider_notes', a.provider_notes,
        'created_at', a.created_at
      ) ORDER BY a.starts_at)
      FROM public.appt_appointments a
      JOIN public.appt_services s ON s.id = a.service_id
      WHERE a.provider_id = v_provider.id
        AND (a.starts_at AT TIME ZONE v_provider.timezone)::date = v_date
    ), '[]'::jsonb),
    'queue', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id,
        'service_id', q.service_id,
        'service_name', s.name_ar,
        'customer_user_id', q.customer_user_id,
        'customer_name', q.customer_name,
        'customer_phone', q.customer_phone,
        'queue_date', q.queue_date,
        'queue_number', q.queue_number,
        'status', q.status,
        'notes', q.notes,
        'joined_at', q.joined_at,
        'called_at', q.called_at,
        'serving_at', q.serving_at
      ) ORDER BY q.queue_number)
      FROM public.appt_queue_entries q
      JOIN public.appt_services s ON s.id = q.service_id
      WHERE q.provider_id = v_provider.id
        AND q.queue_date = v_date
        AND q.status IN ('waiting','called','serving')
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'today_total', (
        SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id
          AND (a.starts_at AT TIME ZONE v_provider.timezone)::date = v_date
      ),
      'pending', (
        SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id
          AND a.status = 'requested'
      ),
      'active_queue', (
        SELECT count(*) FROM public.appt_queue_entries q
        WHERE q.provider_id = v_provider.id
          AND q.queue_date = v_date
          AND q.status IN ('waiting','called','serving')
      ),
      'completed', (
        SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id
          AND a.status = 'completed'
      )
    ),
    'market_link', (
      SELECT to_jsonb(l)
      FROM public.appt_market_links l
      WHERE l.provider_id = v_provider.id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_public_directory(
  _q text DEFAULT NULL,
  _city text DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      p.id,
      p.slug,
      p.name_ar,
      p.name_en,
      p.bio_ar,
      p.bio_en,
      p.logo_path,
      p.cover_path,
      p.city,
      p.district,
      p.address_text,
      p.latitude,
      p.longitude,
      p.provider_type,
      p.accepts_bookings,
      p.timezone,
      p.created_at,
      (
        SELECT l.market_profile_path
        FROM public.appt_market_links l
        WHERE l.provider_id = p.id
          AND l.status = 'linked'
          AND nullif(btrim(coalesce(l.market_profile_path, '')), '') IS NOT NULL
      ) AS market_profile_path,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name_ar', s.name_ar,
          'name_en', s.name_en,
          'description_ar', s.description_ar,
          'description_en', s.description_en,
          'duration_minutes', s.duration_minutes,
          'price', s.price,
          'currency_code', s.currency_code,
          'booking_mode', s.booking_mode
        ) ORDER BY s.sort_order, s.created_at)
        FROM public.appt_services s
        WHERE s.provider_id = p.id
          AND s.is_active
          AND s.deleted_at IS NULL
      ), '[]'::jsonb) AS services
    FROM public.appt_providers p
    WHERE p.status = 'published'
      AND p.accepts_bookings
      AND p.deleted_at IS NULL
      AND (
        nullif(btrim(coalesce(_q, '')), '') IS NULL
        OR p.name_ar ILIKE '%' || btrim(_q) || '%'
        OR coalesce(p.name_en, '') ILIKE '%' || btrim(_q) || '%'
        OR EXISTS (
          SELECT 1
          FROM public.appt_services s
          WHERE s.provider_id = p.id
            AND s.is_active
            AND s.deleted_at IS NULL
            AND (
              s.name_ar ILIKE '%' || btrim(_q) || '%'
              OR coalesce(s.name_en, '') ILIKE '%' || btrim(_q) || '%'
            )
        )
      )
      AND (
        nullif(btrim(coalesce(_city, '')), '') IS NULL
        OR p.city ILIKE btrim(_city)
      )
    ORDER BY p.created_at DESC
    LIMIT least(greatest(coalesce(_limit, 30), 1), 60)
  ) row_data
$$;

CREATE OR REPLACE FUNCTION public.appt_public_provider(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
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
    'market_profile_path', (
      SELECT l.market_profile_path
      FROM public.appt_market_links l
      WHERE l.provider_id = p.id
        AND l.status = 'linked'
        AND nullif(btrim(coalesce(l.market_profile_path, '')), '') IS NOT NULL
    ),
    'settings', jsonb_build_object(
      'confirmation_mode', cfg.confirmation_mode,
      'min_notice_minutes', cfg.min_notice_minutes,
      'max_advance_days', cfg.max_advance_days,
      'cancellation_window_hours', cfg.cancellation_window_hours,
      'queue_enabled', cfg.queue_enabled,
      'average_service_minutes', cfg.average_service_minutes
    ),
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name_ar', s.name_ar,
        'name_en', s.name_en,
        'description_ar', s.description_ar,
        'description_en', s.description_en,
        'duration_minutes', s.duration_minutes,
        'price', s.price,
        'currency_code', s.currency_code,
        'booking_mode', s.booking_mode
      ) ORDER BY s.sort_order, s.created_at)
      FROM public.appt_services s
      WHERE s.provider_id = p.id
        AND s.is_active
        AND s.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.appt_providers p
  JOIN public.appt_provider_settings cfg ON cfg.provider_id = p.id
  WHERE lower(p.slug) = lower(btrim(_slug))
    AND p.status = 'published'
    AND p.accepts_bookings
    AND p.deleted_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.appt_nearby_directory(
  _latitude double precision,
  _longitude double precision,
  _radius_km double precision DEFAULT 25,
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
  v_lat_delta double precision;
  v_long_delta double precision;
  v_radius double precision;
BEGIN
  IF _latitude IS NULL OR _latitude < -90 OR _latitude > 90 THEN
    RAISE EXCEPTION 'invalid_latitude';
  END IF;
  IF _longitude IS NULL OR _longitude < -180 OR _longitude > 180 THEN
    RAISE EXCEPTION 'invalid_longitude';
  END IF;

  v_radius := least(greatest(coalesce(_radius_km, 25), 1), 100);
  IF _provider_type IS NOT NULL AND _provider_type NOT IN (
    'medical_center','clinic','pharmacy','laboratory','dental','radiology',
    'physiotherapy','home_care','veterinary','beauty_wellness','consulting','other'
  ) THEN
    RAISE EXCEPTION 'invalid_provider_type';
  END IF;

  v_lat_delta := v_radius / 111.32;
  v_long_delta := v_radius / (111.32 * greatest(abs(cos(radians(_latitude))), 0.01));

  RETURN (
    WITH candidates AS (
      SELECT
        p.id,
        p.slug,
        p.name_ar,
        p.name_en,
        p.bio_ar,
        p.bio_en,
        p.logo_path,
        p.cover_path,
        p.city,
        p.district,
        p.address_text,
        p.latitude,
        p.longitude,
        p.provider_type,
        p.accepts_bookings,
        p.timezone,
        p.created_at,
        public.appt_distance_km(
          _latitude,
          _longitude,
          p.latitude,
          p.longitude
        ) AS distance_km,
        (
          SELECT l.market_profile_path
          FROM public.appt_market_links l
          WHERE l.provider_id = p.id
            AND l.status = 'linked'
            AND nullif(btrim(coalesce(l.market_profile_path, '')), '') IS NOT NULL
        ) AS market_profile_path,
        coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', s.id,
            'name_ar', s.name_ar,
            'name_en', s.name_en,
            'description_ar', s.description_ar,
            'description_en', s.description_en,
            'duration_minutes', s.duration_minutes,
            'price', s.price,
            'currency_code', s.currency_code,
            'booking_mode', s.booking_mode
          ) ORDER BY s.sort_order, s.created_at)
          FROM public.appt_services s
          WHERE s.provider_id = p.id
            AND s.is_active
            AND s.deleted_at IS NULL
        ), '[]'::jsonb) AS services
      FROM public.appt_providers p
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.latitude BETWEEN _latitude - v_lat_delta AND _latitude + v_lat_delta
        AND p.longitude BETWEEN _longitude - v_long_delta AND _longitude + v_long_delta
        AND (_provider_type IS NULL OR p.provider_type = _provider_type)
        AND (
          nullif(btrim(coalesce(_q, '')), '') IS NULL
          OR p.name_ar ILIKE '%' || btrim(_q) || '%'
          OR coalesce(p.name_en, '') ILIKE '%' || btrim(_q) || '%'
          OR EXISTS (
            SELECT 1
            FROM public.appt_services s
            WHERE s.provider_id = p.id
              AND s.is_active
              AND s.deleted_at IS NULL
              AND (
                s.name_ar ILIKE '%' || btrim(_q) || '%'
                OR coalesce(s.name_en, '') ILIKE '%' || btrim(_q) || '%'
              )
          )
        )
    ), nearby AS (
      SELECT *
      FROM candidates
      WHERE distance_km <= v_radius
      ORDER BY distance_km, created_at DESC
      LIMIT least(greatest(coalesce(_limit, 30), 1), 60)
    )
    SELECT coalesce(
      jsonb_agg(
        (to_jsonb(nearby) - 'distance_km')
        || jsonb_build_object('distance_km', round(distance_km::numeric, 2))
        ORDER BY distance_km, created_at DESC
      ),
      '[]'::jsonb
    )
    FROM nearby
  );
END;
$$;

REVOKE ALL ON FUNCTION public.appt_save_provider(uuid,jsonb,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_provider_dashboard(uuid,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_public_directory(text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appt_public_provider(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appt_nearby_directory(double precision,double precision,double precision,text,text,integer)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.appt_save_provider(uuid,jsonb,jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_provider_dashboard(uuid,date)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_public_directory(text,text,integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_public_provider(text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_nearby_directory(double precision,double precision,double precision,text,text,integer)
  TO anon, authenticated, service_role;
