CREATE OR REPLACE FUNCTION public.create_workspace(_tenant_type text, _name_ar text, _name_en text DEFAULT NULL::text, _legal_name text DEFAULT NULL::text, _cr_number text DEFAULT NULL::text, _vat_number text DEFAULT NULL::text, _city text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _activity text DEFAULT NULL::text, _usage_type text DEFAULT NULL::text, _provider_type text DEFAULT NULL::text, _specialty text DEFAULT NULL::text, _contact_info jsonb DEFAULT '{}'::jsonb, _confirm_duplicate boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _tenant_id uuid; _dup int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _tenant_type NOT IN ('company','establishment','property_owner','project_owner','individual','service_provider') THEN
    RAISE EXCEPTION 'INVALID_TENANT_TYPE';
  END IF;
  IF coalesce(btrim(_name_ar),'') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenants t
     WHERE t.created_by = _uid AND t.deleted_at IS NULL AND t.status <> 'archived'
       AND t.personal_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'WORKSPACE_LIMIT_REACHED';
  END IF;

  IF coalesce(btrim(_cr_number),'') <> '' OR coalesce(btrim(_vat_number),'') <> '' THEN
    SELECT count(*) INTO _dup FROM public.tenants t
     WHERE t.deleted_at IS NULL AND t.status = 'active'
       AND ((coalesce(btrim(_cr_number),'') <> '' AND t.commercial_registration_number = btrim(_cr_number))
         OR (coalesce(btrim(_vat_number),'') <> '' AND t.vat_number = btrim(_vat_number)));
    IF _dup > 0 AND NOT _confirm_duplicate THEN
      RAISE EXCEPTION 'DUPLICATE_REGISTRATION';
    END IF;
  END IF;

  INSERT INTO public.tenants (
    name_ar, name_en, tenant_type, legal_name, commercial_registration_number, vat_number,
    status, is_default, is_test, created_by, city, phone, email, activity, usage_type,
    provider_type, specialty, contact_info, onboarding_completed_at
  ) VALUES (
    btrim(_name_ar),
    coalesce(nullif(btrim(coalesce(_name_en,'')),''), btrim(_name_ar)),
    _tenant_type,
    nullif(btrim(coalesce(_legal_name,'')),''), nullif(btrim(coalesce(_cr_number,'')),''),
    nullif(btrim(coalesce(_vat_number,'')),''), 'active', false,
    (btrim(_name_ar) LIKE 'TEST-SIGNUP-%' OR btrim(_name_ar) LIKE 'TEST-FINAL-ACCOUNT-%'), _uid,
    nullif(btrim(coalesce(_city,'')),''), nullif(btrim(coalesce(_phone,'')),''),
    nullif(btrim(coalesce(_email,'')),''), nullif(btrim(coalesce(_activity,'')),''),
    nullif(btrim(coalesce(_usage_type,'')),''), nullif(btrim(coalesce(_provider_type,'')),''),
    nullif(btrim(coalesce(_specialty,'')),''), coalesce(_contact_info,'{}'::jsonb), now()
  ) RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, membership_start, created_by)
  VALUES (_tenant_id, _uid, 'owner', 'active', now(), current_date, _uid);

  UPDATE public.profiles SET active_tenant_id = _tenant_id WHERE user_id = _uid;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant', _tenant_id, 'create',
          jsonb_build_object('tenant_type', _tenant_type, 'name_ar', btrim(_name_ar), 'role', 'owner'),
          _tenant_id);

  RETURN _tenant_id;
END;
$function$;