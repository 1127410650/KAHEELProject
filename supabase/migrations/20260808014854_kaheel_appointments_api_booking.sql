CREATE OR REPLACE FUNCTION public.appt_save_service(
  _provider_id uuid,
  _service_id uuid DEFAULT NULL,
  _patch jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_mode text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_mode := coalesce(nullif(_patch->>'booking_mode', ''), 'scheduled');
  IF v_mode NOT IN ('scheduled','queue','both') THEN RAISE EXCEPTION 'invalid_booking_mode'; END IF;
  IF nullif(btrim(coalesce(_patch->>'name_ar', '')), '') IS NULL AND _service_id IS NULL THEN
    RAISE EXCEPTION 'service_name_required';
  END IF;

  IF _service_id IS NULL THEN
    INSERT INTO public.appt_services (
      provider_id, name_ar, name_en, description_ar, description_en,
      duration_minutes, price, currency_code, booking_mode, is_active, sort_order
    ) VALUES (
      _provider_id,
      btrim(_patch->>'name_ar'),
      nullif(btrim(coalesce(_patch->>'name_en', '')), ''),
      nullif(btrim(coalesce(_patch->>'description_ar', '')), ''),
      nullif(btrim(coalesce(_patch->>'description_en', '')), ''),
      coalesce(nullif(_patch->>'duration_minutes', '')::integer, 30),
      coalesce(nullif(_patch->>'price', '')::numeric, 0),
      coalesce(nullif(btrim(_patch->>'currency_code'), ''), 'SAR'),
      v_mode,
      coalesce((_patch->>'is_active')::boolean, true),
      coalesce(nullif(_patch->>'sort_order', '')::smallint, 0)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.appt_services s SET
      name_ar = CASE WHEN _patch ? 'name_ar' THEN coalesce(nullif(btrim(_patch->>'name_ar'), ''), s.name_ar) ELSE s.name_ar END,
      name_en = CASE WHEN _patch ? 'name_en' THEN nullif(btrim(_patch->>'name_en'), '') ELSE s.name_en END,
      description_ar = CASE WHEN _patch ? 'description_ar' THEN nullif(btrim(_patch->>'description_ar'), '') ELSE s.description_ar END,
      description_en = CASE WHEN _patch ? 'description_en' THEN nullif(btrim(_patch->>'description_en'), '') ELSE s.description_en END,
      duration_minutes = CASE WHEN _patch ? 'duration_minutes' THEN (_patch->>'duration_minutes')::integer ELSE s.duration_minutes END,
      price = CASE WHEN _patch ? 'price' THEN (_patch->>'price')::numeric ELSE s.price END,
      currency_code = CASE WHEN _patch ? 'currency_code' THEN btrim(_patch->>'currency_code') ELSE s.currency_code END,
      booking_mode = CASE WHEN _patch ? 'booking_mode' THEN v_mode ELSE s.booking_mode END,
      is_active = CASE WHEN _patch ? 'is_active' THEN (_patch->>'is_active')::boolean ELSE s.is_active END,
      sort_order = CASE WHEN _patch ? 'sort_order' THEN (_patch->>'sort_order')::smallint ELSE s.sort_order END
    WHERE s.id = _service_id AND s.provider_id = _provider_id AND s.deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'service_not_found'; END IF;
  END IF;

  INSERT INTO public.appt_audit_log (
    provider_id, actor_user_id, entity_type, entity_id, action, new_value
  ) VALUES (_provider_id, auth.uid(), 'service', v_id,
            CASE WHEN _service_id IS NULL THEN 'create' ELSE 'update' END, _patch);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_replace_availability(
  _provider_id uuid,
  _rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_count integer := 0;
  v_service_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_can_manage_provider(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN RAISE EXCEPTION 'invalid_availability'; END IF;

  DELETE FROM public.appt_availability WHERE provider_id = _provider_id;
  FOR v_row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF coalesce((v_row->>'is_active')::boolean, true) THEN
      v_service_id := nullif(v_row->>'service_id', '')::uuid;
      IF v_service_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.appt_services s
        WHERE s.id = v_service_id AND s.provider_id = _provider_id AND s.deleted_at IS NULL
      ) THEN RAISE EXCEPTION 'service_not_found'; END IF;
      INSERT INTO public.appt_availability (
        provider_id, service_id, weekday, starts_at, ends_at,
        slot_interval_minutes, is_active
      ) VALUES (
        _provider_id, v_service_id, (v_row->>'weekday')::smallint,
        (v_row->>'starts_at')::time, (v_row->>'ends_at')::time,
        coalesce(nullif(v_row->>'slot_interval_minutes', '')::integer, 30), true
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.appt_audit_log (
    provider_id, actor_user_id, entity_type, entity_id, action, new_value
  ) VALUES (_provider_id, auth.uid(), 'availability', _provider_id, 'replace',
            jsonb_build_object('count', v_count));
  RETURN v_count;
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
  v_provider public.appt_providers;
  v_service public.appt_services;
  v_settings public.appt_provider_settings;
  v_end timestamptz;
  v_status text;
  v_idempotency text;
  v_appointment public.appt_appointments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _source NOT IN ('web','mobile','market_link') THEN RAISE EXCEPTION 'invalid_source'; END IF;

  SELECT * INTO v_provider FROM public.appt_providers p
  WHERE p.id = _provider_id AND p.status = 'published'
    AND p.accepts_bookings AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN RAISE EXCEPTION 'provider_unavailable'; END IF;

  SELECT * INTO v_service FROM public.appt_services s
  WHERE s.id = _service_id AND s.provider_id = v_provider.id
    AND s.is_active AND s.deleted_at IS NULL
    AND s.booking_mode IN ('scheduled','both');
  IF v_service.id IS NULL THEN RAISE EXCEPTION 'service_unavailable'; END IF;

  SELECT * INTO v_settings FROM public.appt_provider_settings cfg
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
    v_provider.id, v_service.id, (_starts_at AT TIME ZONE v_provider.timezone)::date
  )) slot
  WHERE (slot->>'starts_at')::timestamptz = _starts_at
  LIMIT 1;
  IF v_end IS NULL THEN RAISE EXCEPTION 'slot_unavailable'; END IF;

  v_idempotency := coalesce(nullif(btrim(_idempotency_key), ''), gen_random_uuid()::text);
  SELECT * INTO v_appointment FROM public.appt_appointments a
  WHERE a.customer_user_id = auth.uid() AND a.idempotency_key = v_idempotency;
  IF v_appointment.id IS NOT NULL THEN RETURN to_jsonb(v_appointment); END IF;

  v_status := CASE WHEN v_settings.confirmation_mode = 'instant' THEN 'confirmed' ELSE 'requested' END;
  BEGIN
    INSERT INTO public.appt_appointments (
      appointment_number, provider_id, service_id, customer_user_id,
      customer_name, customer_phone, starts_at, ends_at, timezone, status,
      source, customer_notes, idempotency_key, confirmed_at
    ) VALUES (
      'KAP-' || to_char(now() AT TIME ZONE 'Asia/Riyadh','YYMM') || '-' ||
        lpad(nextval('public.appt_appointment_number_seq')::text,6,'0'),
      v_provider.id, v_service.id, auth.uid(),
      nullif(btrim(coalesce(_customer_name, '')), ''),
      nullif(btrim(coalesce(_customer_phone, '')), ''),
      _starts_at, v_end, v_provider.timezone, v_status,
      _source, nullif(btrim(coalesce(_notes, '')), ''), v_idempotency,
      CASE WHEN v_status='confirmed' THEN now() ELSE NULL END
    ) RETURNING * INTO v_appointment;
  EXCEPTION WHEN exclusion_violation OR unique_violation THEN
    RAISE EXCEPTION 'slot_unavailable';
  END;

  INSERT INTO public.appt_appointment_events (
    appointment_id, actor_user_id, old_status, new_status, metadata
  ) VALUES (v_appointment.id, auth.uid(), NULL, v_status, jsonb_build_object('source', _source));
  INSERT INTO public.appt_audit_log (
    provider_id, actor_user_id, entity_type, entity_id, action, new_value
  ) VALUES (v_provider.id, auth.uid(), 'appointment', v_appointment.id, 'create',
            jsonb_build_object('status', v_status, 'starts_at', _starts_at));
  RETURN to_jsonb(v_appointment);
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_appointment_action(
  _appointment_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.appt_appointments;
  v_old text;
  v_manager boolean;
  v_customer boolean;
  v_cancel_hours integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_appointment FROM public.appt_appointments a
  WHERE a.id = _appointment_id FOR UPDATE;
  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'appointment_not_found'; END IF;

  v_manager := public.appt_can_manage_provider(v_appointment.provider_id);
  v_customer := v_appointment.customer_user_id = auth.uid();
  IF NOT v_manager AND NOT v_customer THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_old := v_appointment.status;
  IF v_customer AND NOT v_manager THEN
    IF _action <> 'cancelled_by_customer' OR v_old NOT IN ('requested','confirmed') THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    SELECT cancellation_window_hours INTO v_cancel_hours
    FROM public.appt_provider_settings WHERE provider_id = v_appointment.provider_id;
    IF now() >= v_appointment.starts_at - make_interval(hours => coalesce(v_cancel_hours,0)) THEN
      RAISE EXCEPTION 'cancellation_window_closed';
    END IF;
  ELSE
    IF NOT (
      (v_old='requested' AND _action IN ('confirmed','rejected','cancelled_by_provider'))
      OR (v_old='confirmed' AND _action IN ('checked_in','in_service','cancelled_by_provider','no_show'))
      OR (v_old='checked_in' AND _action IN ('in_service','cancelled_by_provider','no_show'))
      OR (v_old='in_service' AND _action IN ('completed','cancelled_by_provider'))
    ) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  END IF;

  UPDATE public.appt_appointments SET
    status = _action,
    provider_notes = CASE WHEN v_manager AND nullif(btrim(coalesce(_note,'')), '') IS NOT NULL
      THEN btrim(_note) ELSE provider_notes END,
    confirmed_at = CASE WHEN _action='confirmed' THEN now() ELSE confirmed_at END,
    checked_in_at = CASE WHEN _action='checked_in' THEN now() ELSE checked_in_at END,
    started_at = CASE WHEN _action='in_service' THEN now() ELSE started_at END,
    completed_at = CASE WHEN _action='completed' THEN now() ELSE completed_at END,
    cancelled_at = CASE WHEN _action IN ('cancelled_by_customer','cancelled_by_provider','rejected')
      THEN now() ELSE cancelled_at END
  WHERE id = v_appointment.id RETURNING * INTO v_appointment;

  INSERT INTO public.appt_appointment_events (
    appointment_id, actor_user_id, old_status, new_status, note
  ) VALUES (v_appointment.id, auth.uid(), v_old, _action,
            nullif(btrim(coalesce(_note,'')), ''));
  INSERT INTO public.appt_audit_log (
    provider_id, actor_user_id, entity_type, entity_id, action, old_value, new_value, reason
  ) VALUES (v_appointment.provider_id, auth.uid(), 'appointment', v_appointment.id,
            'status_change', jsonb_build_object('status',v_old),
            jsonb_build_object('status',_action), nullif(btrim(coalesce(_note,'')),''));
  RETURN to_jsonb(v_appointment);
END;
$$;
