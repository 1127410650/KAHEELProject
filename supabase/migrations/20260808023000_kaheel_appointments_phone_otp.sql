-- KAHEEL Appointments customer identity boundary.
-- Customers verify their mobile through Supabase Auth OTP and keep only an
-- appointment-scoped profile. Provider creation remains restricted to users
-- that already have an active shared KAHEEL account.

CREATE UNIQUE INDEX IF NOT EXISTS appt_profiles_phone_unique
  ON public.appt_profiles (phone_e164)
  WHERE phone_e164 IS NOT NULL;

DROP POLICY IF EXISTS appt_profiles_own_insert ON public.appt_profiles;
DROP POLICY IF EXISTS appt_profiles_own_update ON public.appt_profiles;
REVOKE INSERT, UPDATE ON public.appt_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.appt_has_market_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles shared_profile
      WHERE shared_profile.user_id = auth.uid()
        AND shared_profile.is_active
    )
$$;

REVOKE ALL ON FUNCTION public.appt_has_market_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appt_has_market_account() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.appt_complete_phone_profile(_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_phone text;
  v_phone_confirmed_at timestamptz;
  v_profile public.appt_profiles;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  v_name := regexp_replace(btrim(coalesce(_display_name, '')), '\s+', ' ', 'g');
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'profile_name_required';
  END IF;

  SELECT u.phone, u.phone_confirmed_at
    INTO v_phone, v_phone_confirmed_at
  FROM auth.users u
  WHERE u.id = v_user;

  IF nullif(btrim(coalesce(v_phone, '')), '') IS NULL
     OR v_phone_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'phone_not_verified';
  END IF;
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  BEGIN
    INSERT INTO public.appt_profiles AS current_profile (
      user_id,
      display_name,
      phone_e164
    ) VALUES (
      v_user,
      v_name,
      v_phone
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      phone_e164 = EXCLUDED.phone_e164,
      updated_at = now()
    RETURNING * INTO v_profile;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'phone_already_linked';
  END;

  INSERT INTO public.appt_audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) VALUES (
    v_user,
    'appointment_profile',
    v_user,
    'verify_phone',
    jsonb_build_object('phone_verified', true)
  );

  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'phone_e164', v_profile.phone_e164,
    'locale', v_profile.locale,
    'timezone', v_profile.timezone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.appt_complete_phone_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appt_complete_phone_profile(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.appt_my_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  RETURN jsonb_build_object(
    'profile', (
      SELECT to_jsonb(p)
      FROM public.appt_profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.user_id = v_user
        AND u.phone_confirmed_at IS NOT NULL
        AND u.phone = p.phone_e164
    ),
    'provider_eligible', public.appt_has_market_account(),
    'providers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name_ar', p.name_ar,
        'name_en', p.name_en,
        'city', p.city,
        'status', p.status,
        'accepts_bookings', p.accepts_bookings,
        'role', CASE WHEN p.owner_user_id = v_user THEN 'owner' ELSE m.role END,
        'permissions', CASE WHEN p.owner_user_id = v_user
          THEN ARRAY['appointments.manage']::text[]
          ELSE coalesce(m.permissions, ARRAY[]::text[])
        END
      ) ORDER BY p.created_at DESC)
      FROM public.appt_providers p
      LEFT JOIN public.appt_provider_members m
        ON m.provider_id = p.id
       AND m.user_id = v_user
       AND m.is_active
      WHERE p.deleted_at IS NULL
        AND (p.owner_user_id = v_user OR m.user_id IS NOT NULL)
    ), '[]'::jsonb),
    'appointments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'appointment_number', a.appointment_number,
        'provider_id', a.provider_id,
        'provider_name', p.name_ar,
        'provider_slug', p.slug,
        'service_id', a.service_id,
        'service_name', s.name_ar,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'timezone', a.timezone,
        'status', a.status,
        'source', a.source,
        'customer_notes', a.customer_notes,
        'provider_notes', a.provider_notes,
        'created_at', a.created_at
      ) ORDER BY a.starts_at DESC)
      FROM public.appt_appointments a
      JOIN public.appt_providers p ON p.id = a.provider_id
      JOIN public.appt_services s ON s.id = a.service_id
      WHERE a.customer_user_id = v_user
      LIMIT 100
    ), '[]'::jsonb),
    'queues', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id,
        'provider_id', q.provider_id,
        'provider_name', p.name_ar,
        'provider_slug', p.slug,
        'service_id', q.service_id,
        'service_name', s.name_ar,
        'queue_date', q.queue_date,
        'queue_number', q.queue_number,
        'status', q.status,
        'joined_at', q.joined_at,
        'waiting_ahead', (
          SELECT count(*)
          FROM public.appt_queue_entries ahead
          WHERE ahead.provider_id = q.provider_id
            AND ahead.queue_date = q.queue_date
            AND ahead.status = 'waiting'
            AND ahead.queue_number < q.queue_number
        ),
        'estimated_wait_minutes', (
          SELECT count(*)
          FROM public.appt_queue_entries ahead
          WHERE ahead.provider_id = q.provider_id
            AND ahead.queue_date = q.queue_date
            AND ahead.status = 'waiting'
            AND ahead.queue_number < q.queue_number
        ) * (
          SELECT cfg.average_service_minutes
          FROM public.appt_provider_settings cfg
          WHERE cfg.provider_id = q.provider_id
        )
      ) ORDER BY q.joined_at DESC)
      FROM public.appt_queue_entries q
      JOIN public.appt_providers p ON p.id = q.provider_id
      JOIN public.appt_services s ON s.id = q.service_id
      WHERE q.customer_user_id = v_user
        AND q.status IN ('waiting', 'called', 'serving')
    ), '[]'::jsonb)
  );
END;
$$;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT public.appt_has_market_account() THEN
    RAISE EXCEPTION 'provider_registration_required';
  END IF;
  IF nullif(btrim(coalesce(_name_ar, '')), '') IS NULL THEN
    RAISE EXCEPTION 'provider_name_required';
  END IF;

  v_slug := lower(regexp_replace(
    coalesce(
      nullif(btrim(_slug), ''),
      nullif(btrim(_name_en), ''),
      'provider-' || substr(gen_random_uuid()::text, 1, 8)
    ),
    '[^a-zA-Z0-9_-]+',
    '-',
    'g'
  ));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'provider-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.appt_providers p
    WHERE lower(p.slug) = v_slug
      AND p.deleted_at IS NULL
  ) THEN
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.appt_providers (
    owner_user_id,
    slug,
    name_ar,
    name_en,
    city,
    timezone
  ) VALUES (
    auth.uid(),
    v_slug,
    btrim(_name_ar),
    nullif(btrim(coalesce(_name_en, '')), ''),
    nullif(btrim(coalesce(_city, '')), ''),
    coalesce(nullif(btrim(_timezone), ''), 'Asia/Riyadh')
  )
  RETURNING id INTO v_provider_id;

  INSERT INTO public.appt_provider_members (
    provider_id,
    user_id,
    role,
    permissions
  ) VALUES (
    v_provider_id,
    auth.uid(),
    'owner',
    ARRAY['appointments.manage']::text[]
  );

  INSERT INTO public.appt_provider_settings (provider_id)
  VALUES (v_provider_id);

  FOREACH v_day IN ARRAY ARRAY[0,1,2,3,4]::smallint[] LOOP
    INSERT INTO public.appt_availability (
      provider_id,
      weekday,
      starts_at,
      ends_at,
      slot_interval_minutes
    ) VALUES (
      v_provider_id,
      v_day,
      '09:00',
      '17:00',
      30
    );
  END LOOP;

  INSERT INTO public.appt_audit_log (
    provider_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) VALUES (
    v_provider_id,
    auth.uid(),
    'provider',
    v_provider_id,
    'create',
    jsonb_build_object('name_ar', btrim(_name_ar), 'slug', v_slug)
  );

  RETURN v_provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_create_appointment(
  _provider_id uuid,
  _service_id uuid,
  _starts_at timestamptz,
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _source text DEFAULT 'web',
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.appt_profiles;
  v_provider public.appt_providers;
  v_service public.appt_services;
  v_settings public.appt_provider_settings;
  v_end timestamptz;
  v_status text;
  v_idempotency text;
  v_appointment public.appt_appointments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.appt_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND u.phone_confirmed_at IS NOT NULL
    AND u.phone = p.phone_e164
    AND nullif(btrim(coalesce(p.display_name, '')), '') IS NOT NULL;
  IF v_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'appointment_profile_required';
  END IF;
  IF _source NOT IN ('web', 'mobile', 'market_link') THEN
    RAISE EXCEPTION 'invalid_source';
  END IF;

  SELECT * INTO v_provider
  FROM public.appt_providers p
  WHERE p.id = _provider_id
    AND p.status = 'published'
    AND p.accepts_bookings
    AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_unavailable';
  END IF;

  SELECT * INTO v_service
  FROM public.appt_services s
  WHERE s.id = _service_id
    AND s.provider_id = v_provider.id
    AND s.is_active
    AND s.deleted_at IS NULL
    AND s.booking_mode IN ('scheduled', 'both');
  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'service_unavailable';
  END IF;

  SELECT * INTO v_settings
  FROM public.appt_provider_settings cfg
  WHERE cfg.provider_id = v_provider.id;

  IF _starts_at < now() + make_interval(mins => v_settings.min_notice_minutes) THEN
    RAISE EXCEPTION 'notice_too_short';
  END IF;
  IF (_starts_at AT TIME ZONE v_provider.timezone)::date >
     (now() AT TIME ZONE v_provider.timezone)::date + v_settings.max_advance_days THEN
    RAISE EXCEPTION 'advance_limit_exceeded';
  END IF;

  SELECT (slot->>'ends_at')::timestamptz INTO v_end
  FROM jsonb_array_elements(public.appt_available_slots(
    v_provider.id,
    v_service.id,
    (_starts_at AT TIME ZONE v_provider.timezone)::date
  )) slot
  WHERE (slot->>'starts_at')::timestamptz = _starts_at
  LIMIT 1;
  IF v_end IS NULL THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  v_idempotency := coalesce(
    nullif(btrim(_idempotency_key), ''),
    gen_random_uuid()::text
  );
  SELECT * INTO v_appointment
  FROM public.appt_appointments a
  WHERE a.customer_user_id = auth.uid()
    AND a.idempotency_key = v_idempotency;
  IF v_appointment.id IS NOT NULL THEN
    RETURN to_jsonb(v_appointment);
  END IF;

  v_status := CASE
    WHEN v_settings.confirmation_mode = 'instant' THEN 'confirmed'
    ELSE 'requested'
  END;

  BEGIN
    INSERT INTO public.appt_appointments (
      appointment_number,
      provider_id,
      service_id,
      customer_user_id,
      customer_name,
      customer_phone,
      starts_at,
      ends_at,
      timezone,
      status,
      source,
      customer_notes,
      idempotency_key,
      confirmed_at
    ) VALUES (
      'KAP-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMM') || '-' ||
        lpad(nextval('public.appt_appointment_number_seq')::text, 6, '0'),
      v_provider.id,
      v_service.id,
      auth.uid(),
      v_profile.display_name,
      v_profile.phone_e164,
      _starts_at,
      v_end,
      v_provider.timezone,
      v_status,
      _source,
      nullif(btrim(coalesce(_notes, '')), ''),
      v_idempotency,
      CASE WHEN v_status = 'confirmed' THEN now() ELSE NULL END
    )
    RETURNING * INTO v_appointment;
  EXCEPTION WHEN exclusion_violation OR unique_violation THEN
    RAISE EXCEPTION 'slot_unavailable';
  END;

  INSERT INTO public.appt_appointment_events (
    appointment_id,
    actor_user_id,
    old_status,
    new_status,
    metadata
  ) VALUES (
    v_appointment.id,
    auth.uid(),
    NULL,
    v_status,
    jsonb_build_object('source', _source)
  );

  INSERT INTO public.appt_audit_log (
    provider_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) VALUES (
    v_provider.id,
    auth.uid(),
    'appointment',
    v_appointment.id,
    'create',
    jsonb_build_object('status', v_status, 'starts_at', _starts_at)
  );

  RETURN to_jsonb(v_appointment);
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_join_queue(
  _provider_id uuid,
  _service_id uuid,
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.appt_profiles;
  v_provider public.appt_providers;
  v_service public.appt_services;
  v_settings public.appt_provider_settings;
  v_queue_date date;
  v_number integer;
  v_waiting_ahead integer;
  v_entry public.appt_queue_entries;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.appt_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND u.phone_confirmed_at IS NOT NULL
    AND u.phone = p.phone_e164
    AND nullif(btrim(coalesce(p.display_name, '')), '') IS NOT NULL;
  IF v_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'appointment_profile_required';
  END IF;

  SELECT * INTO v_provider
  FROM public.appt_providers p
  WHERE p.id = _provider_id
    AND p.status = 'published'
    AND p.accepts_bookings
    AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_unavailable';
  END IF;

  SELECT * INTO v_service
  FROM public.appt_services s
  WHERE s.id = _service_id
    AND s.provider_id = v_provider.id
    AND s.is_active
    AND s.deleted_at IS NULL
    AND s.booking_mode IN ('queue', 'both');
  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'queue_service_unavailable';
  END IF;

  SELECT * INTO v_settings
  FROM public.appt_provider_settings cfg
  WHERE cfg.provider_id = v_provider.id
    AND cfg.queue_enabled;
  IF v_settings.provider_id IS NULL THEN
    RAISE EXCEPTION 'queue_disabled';
  END IF;

  v_queue_date := (now() AT TIME ZONE v_provider.timezone)::date;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_provider.id::text || v_queue_date::text, 0)
  );

  SELECT * INTO v_entry
  FROM public.appt_queue_entries q
  WHERE q.provider_id = v_provider.id
    AND q.queue_date = v_queue_date
    AND q.customer_user_id = auth.uid()
    AND q.status IN ('waiting', 'called', 'serving')
  LIMIT 1;

  IF v_entry.id IS NULL THEN
    SELECT coalesce(max(q.queue_number), 0) + 1 INTO v_number
    FROM public.appt_queue_entries q
    WHERE q.provider_id = v_provider.id
      AND q.queue_date = v_queue_date;

    INSERT INTO public.appt_queue_entries (
      provider_id,
      service_id,
      customer_user_id,
      customer_name,
      customer_phone,
      queue_date,
      queue_number,
      notes
    ) VALUES (
      v_provider.id,
      v_service.id,
      auth.uid(),
      v_profile.display_name,
      v_profile.phone_e164,
      v_queue_date,
      v_number,
      nullif(btrim(coalesce(_notes, '')), '')
    )
    RETURNING * INTO v_entry;

    INSERT INTO public.appt_audit_log (
      provider_id,
      actor_user_id,
      entity_type,
      entity_id,
      action,
      new_value
    ) VALUES (
      v_provider.id,
      auth.uid(),
      'queue_entry',
      v_entry.id,
      'join',
      jsonb_build_object('queue_number', v_number, 'queue_date', v_queue_date)
    );
  END IF;

  SELECT count(*) INTO v_waiting_ahead
  FROM public.appt_queue_entries q
  WHERE q.provider_id = v_provider.id
    AND q.queue_date = v_queue_date
    AND q.status = 'waiting'
    AND q.queue_number < v_entry.queue_number;

  RETURN to_jsonb(v_entry) || jsonb_build_object(
    'waiting_ahead', v_waiting_ahead,
    'estimated_wait_minutes', v_waiting_ahead * v_settings.average_service_minutes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.appt_my_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_create_provider(text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_create_appointment(uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_join_queue(uuid,uuid,text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.appt_my_context() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_create_provider(text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_create_appointment(uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_join_queue(uuid,uuid,text,text,text) TO authenticated, service_role;
