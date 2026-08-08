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
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.appt_profiles p WHERE p.user_id = v_user),
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
          THEN ARRAY['appointments.manage']::text[] ELSE coalesce(m.permissions, ARRAY[]::text[]) END
      ) ORDER BY p.created_at DESC)
      FROM public.appt_providers p
      LEFT JOIN public.appt_provider_members m
        ON m.provider_id = p.id AND m.user_id = v_user AND m.is_active
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
          SELECT count(*) FROM public.appt_queue_entries ahead
          WHERE ahead.provider_id = q.provider_id
            AND ahead.queue_date = q.queue_date
            AND ahead.status = 'waiting'
            AND ahead.queue_number < q.queue_number
        ),
        'estimated_wait_minutes', (
          SELECT count(*) FROM public.appt_queue_entries ahead
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
  SELECT * INTO v_provider FROM public.appt_providers p
  WHERE p.id = _provider_id AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN RAISE EXCEPTION 'provider_not_found'; END IF;
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
      'timezone', v_provider.timezone,
      'status', v_provider.status,
      'accepts_bookings', v_provider.accepts_bookings
    ),
    'settings', (SELECT to_jsonb(cfg) - 'created_at' - 'updated_at'
                 FROM public.appt_provider_settings cfg WHERE cfg.provider_id = v_provider.id),
    'services', coalesce((
      SELECT jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' - 'deleted_at'
                       ORDER BY s.sort_order, s.created_at)
      FROM public.appt_services s
      WHERE s.provider_id = v_provider.id AND s.deleted_at IS NULL
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
        AND q.status IN ('waiting', 'called', 'serving')
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'today_total', (SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id
          AND (a.starts_at AT TIME ZONE v_provider.timezone)::date = v_date),
      'pending', (SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id AND a.status = 'requested'),
      'active_queue', (SELECT count(*) FROM public.appt_queue_entries q
        WHERE q.provider_id = v_provider.id AND q.queue_date = v_date
          AND q.status IN ('waiting', 'called', 'serving')),
      'completed', (SELECT count(*) FROM public.appt_appointments a
        WHERE a.provider_id = v_provider.id AND a.status = 'completed')
    ),
    'market_link', (SELECT to_jsonb(l) FROM public.appt_market_links l
                    WHERE l.provider_id = v_provider.id)
  );
END;
$$;

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

  UPDATE public.appt_providers p SET
    name_ar = CASE WHEN _patch ? 'name_ar' THEN coalesce(nullif(btrim(_patch->>'name_ar'), ''), p.name_ar) ELSE p.name_ar END,
    name_en = CASE WHEN _patch ? 'name_en' THEN nullif(btrim(_patch->>'name_en'), '') ELSE p.name_en END,
    bio_ar = CASE WHEN _patch ? 'bio_ar' THEN nullif(btrim(_patch->>'bio_ar'), '') ELSE p.bio_ar END,
    bio_en = CASE WHEN _patch ? 'bio_en' THEN nullif(btrim(_patch->>'bio_en'), '') ELSE p.bio_en END,
    city = CASE WHEN _patch ? 'city' THEN nullif(btrim(_patch->>'city'), '') ELSE p.city END,
    district = CASE WHEN _patch ? 'district' THEN nullif(btrim(_patch->>'district'), '') ELSE p.district END,
    address_text = CASE WHEN _patch ? 'address_text' THEN nullif(btrim(_patch->>'address_text'), '') ELSE p.address_text END,
    timezone = CASE WHEN _patch ? 'timezone' THEN btrim(_patch->>'timezone') ELSE p.timezone END,
    status = CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE p.status END,
    accepts_bookings = CASE WHEN _patch ? 'accepts_bookings' THEN (_patch->>'accepts_bookings')::boolean ELSE p.accepts_bookings END
  WHERE p.id = _provider_id
  RETURNING * INTO v_provider;

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
    provider_id, actor_user_id, entity_type, entity_id, action, new_value
  ) VALUES (_provider_id, auth.uid(), 'provider', _provider_id, 'update', _patch);

  RETURN public.appt_provider_dashboard(_provider_id, NULL);
END;
$$;
