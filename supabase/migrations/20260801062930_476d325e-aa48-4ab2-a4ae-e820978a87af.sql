CREATE OR REPLACE FUNCTION public.invitation_create(_email text, _invited_role text, _invitation_type text, _permissions text[] DEFAULT '{}'::text[], _project_ids uuid[] DEFAULT '{}'::uuid[], _mobile text DEFAULT NULL::text, _membership_type text DEFAULT NULL::text, _service_type text DEFAULT NULL::text, _membership_start date DEFAULT NULL::date, _membership_end date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  _uid uuid := auth.uid();
  _tenant uuid := public.current_tenant_id();
  _raw text;
  _perm text;
  _pending int;
  _row public.tenant_invitations;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_WORKSPACE'; END IF;
  IF NOT (public.has_tenant_role(_tenant,'owner') OR public.has_tenant_role(_tenant,'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _invited_role = 'owner' THEN RAISE EXCEPTION 'OWNER_INVITE_FORBIDDEN'; END IF;
  IF _invited_role NOT IN ('admin','accountant','employee','supervisor','service_provider','viewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  IF coalesce(btrim(_email),'') = '' OR position('@' in _email) = 0 THEN RAISE EXCEPTION 'EMAIL_REQUIRED'; END IF;

  IF _permissions IS NOT NULL THEN
    FOREACH _perm IN ARRAY _permissions LOOP
      IF NOT public.has_permission_in_tenant(_uid, _tenant, _perm) THEN
        RAISE EXCEPTION 'PERMISSION_ESCALATION';
      END IF;
    END LOOP;
  END IF;

  SELECT count(*) INTO _pending FROM public.tenant_invitations i
   WHERE i.tenant_id = _tenant AND i.status = 'pending' AND i.expires_at > now();
  IF _pending >= 200 THEN RAISE EXCEPTION 'PENDING_LIMIT_REACHED'; END IF;

  IF NOT public.rate_limit_hit('invite_create', _tenant::text, 30, interval '1 hour') THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenant_invitations i
     WHERE i.tenant_id = _tenant AND lower(i.email) = lower(btrim(_email))
       AND i.invited_role = _invited_role AND i.status = 'pending' AND i.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_INVITATION';
  END IF;

  UPDATE public.tenant_invitations i SET status = 'expired'
   WHERE i.tenant_id = _tenant AND i.status = 'pending' AND i.expires_at <= now();

  _raw := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.tenant_invitations (
    tenant_id, email, mobile, invited_role, invited_permissions, project_ids, invitation_type,
    membership_type, service_type, token_hash, status, membership_start, membership_end,
    expires_at, invited_by
  ) VALUES (
    _tenant, lower(btrim(_email)), nullif(btrim(coalesce(_mobile,'')),''), _invited_role,
    coalesce(_permissions,'{}'), coalesce(_project_ids,'{}'), _invitation_type,
    nullif(btrim(coalesce(_membership_type,'')),''), nullif(btrim(coalesce(_service_type,'')),''),
    encode(digest(_raw,'sha256'),'hex'), 'pending', _membership_start, _membership_end,
    now() + interval '7 days', _uid
  ) RETURNING * INTO _row;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant_invitation', _row.id, 'create',
          jsonb_build_object('email', _row.email, 'invited_role', _row.invited_role,
                             'invitation_type', _row.invitation_type,
                             'projects', coalesce(array_length(_row.project_ids,1),0)),
          _tenant);

  RETURN QUERY SELECT _row.id, _raw, _row.expires_at;
END;
$function$;