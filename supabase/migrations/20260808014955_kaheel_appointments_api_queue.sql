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
  v_provider public.appt_providers;
  v_service public.appt_services;
  v_settings public.appt_provider_settings;
  v_queue_date date;
  v_number integer;
  v_waiting_ahead integer;
  v_entry public.appt_queue_entries;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_provider FROM public.appt_providers p
  WHERE p.id=_provider_id AND p.status='published'
    AND p.accepts_bookings AND p.deleted_at IS NULL;
  IF v_provider.id IS NULL THEN RAISE EXCEPTION 'provider_unavailable'; END IF;

  SELECT * INTO v_service FROM public.appt_services s
  WHERE s.id=_service_id AND s.provider_id=v_provider.id
    AND s.is_active AND s.deleted_at IS NULL AND s.booking_mode IN ('queue','both');
  IF v_service.id IS NULL THEN RAISE EXCEPTION 'queue_service_unavailable'; END IF;

  SELECT * INTO v_settings FROM public.appt_provider_settings cfg
  WHERE cfg.provider_id=v_provider.id AND cfg.queue_enabled;
  IF v_settings.provider_id IS NULL THEN RAISE EXCEPTION 'queue_disabled'; END IF;

  v_queue_date := (now() AT TIME ZONE v_provider.timezone)::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_provider.id::text || v_queue_date::text, 0));

  SELECT * INTO v_entry FROM public.appt_queue_entries q
  WHERE q.provider_id=v_provider.id AND q.queue_date=v_queue_date
    AND q.customer_user_id=auth.uid() AND q.status IN ('waiting','called','serving')
  LIMIT 1;
  IF v_entry.id IS NULL THEN
    SELECT coalesce(max(q.queue_number),0)+1 INTO v_number
    FROM public.appt_queue_entries q
    WHERE q.provider_id=v_provider.id AND q.queue_date=v_queue_date;
    INSERT INTO public.appt_queue_entries (
      provider_id,service_id,customer_user_id,customer_name,customer_phone,
      queue_date,queue_number,notes
    ) VALUES (
      v_provider.id,v_service.id,auth.uid(),
      nullif(btrim(coalesce(_customer_name,'')),''),
      nullif(btrim(coalesce(_customer_phone,'')),''),
      v_queue_date,v_number,nullif(btrim(coalesce(_notes,'')),'')
    ) RETURNING * INTO v_entry;
    INSERT INTO public.appt_audit_log (
      provider_id,actor_user_id,entity_type,entity_id,action,new_value
    ) VALUES (v_provider.id,auth.uid(),'queue_entry',v_entry.id,'join',
              jsonb_build_object('queue_number',v_number,'queue_date',v_queue_date));
  END IF;

  SELECT count(*) INTO v_waiting_ahead FROM public.appt_queue_entries q
  WHERE q.provider_id=v_provider.id AND q.queue_date=v_queue_date
    AND q.status='waiting' AND q.queue_number<v_entry.queue_number;
  RETURN to_jsonb(v_entry) || jsonb_build_object(
    'waiting_ahead',v_waiting_ahead,
    'estimated_wait_minutes',v_waiting_ahead*v_settings.average_service_minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_queue_action(
  _queue_entry_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry public.appt_queue_entries;
  v_old text;
  v_customer boolean;
  v_manager boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_entry FROM public.appt_queue_entries q
  WHERE q.id=_queue_entry_id FOR UPDATE;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'queue_entry_not_found'; END IF;
  v_customer := v_entry.customer_user_id=auth.uid();
  v_manager := public.appt_can_manage_provider(v_entry.provider_id);
  IF NOT v_customer AND NOT v_manager THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_old := v_entry.status;
  IF v_customer AND NOT v_manager THEN
    IF _action<>'cancelled' OR v_old NOT IN ('waiting','called') THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
  ELSE
    IF NOT (
      (v_old='waiting' AND _action IN ('called','skipped','cancelled'))
      OR (v_old='called' AND _action IN ('serving','skipped','cancelled'))
      OR (v_old='serving' AND _action IN ('done','cancelled'))
    ) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  END IF;

  UPDATE public.appt_queue_entries SET
    status=_action,
    notes=CASE WHEN nullif(btrim(coalesce(_note,'')),'') IS NOT NULL THEN btrim(_note) ELSE notes END,
    called_at=CASE WHEN _action='called' THEN now() ELSE called_at END,
    serving_at=CASE WHEN _action='serving' THEN now() ELSE serving_at END,
    completed_at=CASE WHEN _action IN ('done','skipped','cancelled') THEN now() ELSE completed_at END
  WHERE id=v_entry.id RETURNING * INTO v_entry;

  INSERT INTO public.appt_audit_log (
    provider_id,actor_user_id,entity_type,entity_id,action,old_value,new_value,reason
  ) VALUES (v_entry.provider_id,auth.uid(),'queue_entry',v_entry.id,'status_change',
            jsonb_build_object('status',v_old),jsonb_build_object('status',_action),
            nullif(btrim(coalesce(_note,'')),''));
  RETURN to_jsonb(v_entry);
END;
$$;

CREATE OR REPLACE FUNCTION public.appt_save_market_link(
  _provider_id uuid,
  _market_tenant_id uuid DEFAULT NULL,
  _market_storefront_id uuid DEFAULT NULL,
  _market_profile_path text DEFAULT NULL,
  _market_url text DEFAULT NULL,
  _status text DEFAULT 'pending'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.appt_market_links;
BEGIN
  IF auth.uid() IS NULL OR NOT public.appt_is_provider_owner(_provider_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('disconnected','pending','linked','disabled') THEN
    RAISE EXCEPTION 'invalid_link_status';
  END IF;

  INSERT INTO public.appt_market_links AS current_link (
    provider_id,market_tenant_id,market_storefront_id,market_profile_path,
    market_url,status,linked_by_user_id,linked_at
  ) VALUES (
    _provider_id,_market_tenant_id,_market_storefront_id,
    nullif(btrim(coalesce(_market_profile_path,'')),''),
    nullif(btrim(coalesce(_market_url,'')),''),
    _status,auth.uid(),CASE WHEN _status='linked' THEN now() ELSE NULL END
  ) ON CONFLICT (provider_id) DO UPDATE SET
    market_tenant_id=EXCLUDED.market_tenant_id,
    market_storefront_id=EXCLUDED.market_storefront_id,
    market_profile_path=EXCLUDED.market_profile_path,
    market_url=EXCLUDED.market_url,
    status=EXCLUDED.status,
    linked_by_user_id=auth.uid(),
    linked_at=CASE WHEN EXCLUDED.status='linked' THEN now() ELSE current_link.linked_at END
  RETURNING * INTO v_link;

  INSERT INTO public.appt_audit_log (
    provider_id,actor_user_id,entity_type,entity_id,action,new_value
  ) VALUES (_provider_id,auth.uid(),'market_link',_provider_id,'save',
            jsonb_build_object('status',_status));
  RETURN to_jsonb(v_link);
END;
$$;

REVOKE ALL ON FUNCTION public.appt_create_provider(text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_public_directory(text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appt_public_provider(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appt_available_slots(uuid,uuid,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appt_my_context() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_provider_dashboard(uuid,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_save_provider(uuid,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_save_service(uuid,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_replace_availability(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_create_appointment(uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_appointment_action(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_join_queue(uuid,uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_queue_action(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appt_save_market_link(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.appt_public_directory(text,text,integer) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.appt_public_provider(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.appt_available_slots(uuid,uuid,date) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.appt_create_provider(text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_my_context() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_provider_dashboard(uuid,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_save_provider(uuid,jsonb,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_save_service(uuid,uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_replace_availability(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_create_appointment(uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_appointment_action(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_join_queue(uuid,uuid,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_queue_action(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appt_save_market_link(uuid,uuid,uuid,text,text,text) TO authenticated,service_role;
