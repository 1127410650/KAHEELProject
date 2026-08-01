CREATE OR REPLACE FUNCTION public.activate_account(_tenant_id uuid)
 RETURNS TABLE(tenant_id uuid, tenant_type text, role text, is_personal boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _role text; _type text; _personal boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT m.role::text, t.tenant_type, (t.personal_user_id = _uid)
    INTO _role, _type, _personal
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
   WHERE m.tenant_id = _tenant_id
     AND m.user_id = _uid
     AND m.status = 'active'
     AND (m.membership_end IS NULL OR m.membership_end >= current_date)
     AND (m.membership_start IS NULL OR m.membership_start <= current_date)
     AND t.deleted_at IS NULL
     AND t.status = 'active';

  IF _role IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP'; END IF;

  UPDATE public.profiles p
     SET active_tenant_id = _tenant_id, last_tenant_id = _tenant_id
   WHERE p.user_id = _uid;

  UPDATE public.tenant_memberships m
     SET last_seen_at = now()
   WHERE m.tenant_id = _tenant_id AND m.user_id = _uid;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant', _tenant_id, 'enter_account',
          jsonb_build_object('tenant_type', _type, 'role', _role), _tenant_id);

  RETURN QUERY SELECT _tenant_id, _type, _role, coalesce(_personal, false);
END $function$;

REVOKE ALL ON FUNCTION public.activate_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_account(uuid) TO authenticated, service_role;