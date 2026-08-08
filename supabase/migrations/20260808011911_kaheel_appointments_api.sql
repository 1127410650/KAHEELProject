-- KAHEEL Appointments standalone API
-- No function in this migration reads or writes any mkt_* object.

ALTER TABLE public.appt_appointments
  ADD CONSTRAINT appt_appointments_no_overlap
  EXCLUDE USING gist (
    provider_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('requested','confirmed','checked_in','in_service'));

CREATE OR REPLACE FUNCTION public.appt_create_provider(
  _name_ar text,
  _name_en text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _city text DEFAULT NULL,
  _timezone text DEFAULT 'Asia/Riyadh'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_slug text;
  v_day smallint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF nullif(btrim(coalesce(_name_ar, '')), '') IS NULL THEN
    RAISE EXCEPTION 'provider_name_required';
  END IF;

  v_slug := lower(regexp_replace(
    coalesce(
      nullif(btrim(_slug), ''),
      nullif(btrim(_name_en), ''),
      'provider-' || substr(gen_random_uuid()::text, 1, 8)
    ),
    '[^a-zA-Z0-9_-]+', '-', 'g'
  ));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'provider-' || substr(gen_random_uuid()::text, 1, 8); END IF;
  IF EXISTS (
    SELECT 1 FROM public.appt_providers p
    WHERE lower(p.slug) = v_slug AND p.deleted_at IS NULL
  ) THEN
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.appt_providers (
    owner_user_id, slug, name_ar, name_en, city, timezone
  ) VALUES (
    auth.uid(), v_slug, btrim(_name_ar), nullif(btrim(coalesce(_name_en, '')), ''),
    nullif(btrim(coalesce(_city, '')), ''),
    coalesce(nullif(btrim(_timezone), ''), 'Asia/Riyadh')
  ) RETURNING id INTO v_provider_id;

  INSERT INTO public.appt_provider_members (provider_id, user_id, role, permissions)
  VALUES (v_provider_id, auth.uid(), 'owner', ARRAY['appointments.manage']::text[]);

  INSERT INTO public.appt_provider_settings (provider_id)
  VALUES (v_provider_id);

  FOREACH v_day IN ARRAY ARRAY[0,1,2,3,4]::smallint[] LOOP
    INSERT INTO public.appt_availability (
      provider_id, weekday, starts_at, ends_at, slot_interval_minutes
    ) VALUES (v_provider_id, v_day, '09:00', '17:00', 30);
  END LOOP;

  INSERT INTO public.appt_audit_log (
    provider_id, actor_user_id, entity_type, entity_id, action, new_value
  ) VALUES (
    v_provider_id, auth.uid(), 'provider', v_provider_id, 'create',
    jsonb_build_object('name_ar', btrim(_name_ar), 'slug', v_slug)
  );

  RETURN v_provider_id;
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
  SELECT coalesce(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at DESC), '[]'::jsonb)
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
      p.timezone,
      p.created_at,
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
        WHERE s.provider_id = p.id AND s.is_active AND s.deleted_at IS NULL
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
          SELECT 1 FROM public.appt_services s
          WHERE s.provider_id = p.id
            AND s.is_active AND s.deleted_at IS NULL
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
    'timezone', p.timezone,
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
      WHERE s.provider_id = p.id AND s.is_active AND s.deleted_at IS NULL
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

CREATE OR REPLACE FUNCTION public.appt_available_slots(
  _provider_id uuid,
  _service_id uuid,
  _date date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH context AS (
    SELECT
      p.id AS provider_id,
      p.timezone,
      s.id AS service_id,
      s.duration_minutes,
      cfg.min_notice_minutes,
      cfg.max_advance_days
    FROM public.appt_providers p
    JOIN public.appt_services s ON s.provider_id = p.id
    JOIN public.appt_provider_settings cfg ON cfg.provider_id = p.id
    WHERE p.id = _provider_id
      AND s.id = _service_id
      AND p.status = 'published'
      AND p.accepts_bookings
      AND p.deleted_at IS NULL
      AND s.is_active
      AND s.deleted_at IS NULL
      AND s.booking_mode IN ('scheduled', 'both')
  ), windows AS (
    SELECT c.*, a.starts_at AS window_start, a.ends_at AS window_end,
           a.slot_interval_minutes
    FROM context c
    JOIN public.appt_availability a ON a.provider_id = c.provider_id
    WHERE a.is_active
      AND (a.service_id IS NULL OR a.service_id = c.service_id)
      AND a.weekday = extract(dow from _date)::smallint
      AND _date >= (now() AT TIME ZONE c.timezone)::date
      AND _date <= (now() AT TIME ZONE c.timezone)::date + c.max_advance_days
  ), generated AS (
    SELECT DISTINCT
      w.provider_id,
      w.service_id,
      w.timezone,
      slot_start,
      slot_start + make_interval(mins => w.duration_minutes) AS slot_end
    FROM windows w
    CROSS JOIN LATERAL generate_series(
      ((_date + w.window_start) AT TIME ZONE w.timezone),
      ((_date + w.window_end) AT TIME ZONE w.timezone) - make_interval(mins => w.duration_minutes),
      make_interval(mins => w.slot_interval_minutes)
    ) slot_start
    WHERE slot_start >= now() + make_interval(mins => w.min_notice_minutes)
  ), available AS (
    SELECT g.*
    FROM generated g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.appt_time_off t
      WHERE t.provider_id = g.provider_id
        AND tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(g.slot_start, g.slot_end, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.appt_appointments a
      WHERE a.provider_id = g.provider_id
        AND a.status IN ('requested', 'confirmed', 'checked_in', 'in_service')
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(g.slot_start, g.slot_end, '[)')
    )
    ORDER BY g.slot_start
    LIMIT 200
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'starts_at', slot_start,
    'ends_at', slot_end,
    'timezone', timezone
  ) ORDER BY slot_start), '[]'::jsonb)
  FROM available
$$;
