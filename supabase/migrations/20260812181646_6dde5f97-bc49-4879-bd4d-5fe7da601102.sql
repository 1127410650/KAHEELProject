-- 1) Real defect found during the authorisation proof run: mkt_ops_log.entity_id is
--    uuid, but the save RPC passed _user_id::text, so EVERY permission save failed
--    with 42804 before any row was written. Fixed additively (body identical otherwise).
CREATE OR REPLACE FUNCTION public.mkt_admin_save_staff_perms(_user_id uuid, _perms text[], _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  wanted text[];
  before_perms text[];
  added text[];
  removed text[];
  op_id uuid := gen_random_uuid();
  unknown_keys text[];
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'A target user is required'; END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own permissions';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(p)), '{}'::text[]) INTO wanted
    FROM unnest(COALESCE(_perms, '{}'::text[])) AS p
   WHERE btrim(COALESCE(p,'')) <> '';

  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO unknown_keys
    FROM unnest(wanted) k
   WHERE NOT EXISTS (SELECT 1 FROM public.mkt_permission_catalog c WHERE c.perm_key = k);
  IF array_length(unknown_keys, 1) > 0 THEN
    RAISE EXCEPTION 'Unknown permission key: %', unknown_keys[1];
  END IF;

  PERFORM 1 FROM public.mkt_staff_permissions WHERE user_id = _user_id FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtext('mkt_staff_perms:' || _user_id::text));

  SELECT COALESCE(array_agg(DISTINCT perm), '{}'::text[]) INTO before_perms
    FROM public.mkt_staff_permissions WHERE user_id = _user_id;

  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO added
    FROM unnest(wanted) k WHERE NOT (k = ANY (before_perms));
  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO removed
    FROM unnest(before_perms) k WHERE NOT (k = ANY (wanted));

  IF array_length(removed, 1) > 0
     AND EXISTS (SELECT 1 FROM public.mkt_platform_admins a
                  WHERE a.user_id = _user_id AND a.platform_role = 'system_owner') THEN
    RAISE EXCEPTION 'System owner permissions cannot be reduced here';
  END IF;

  IF array_length(removed, 1) > 0 THEN
    DELETE FROM public.mkt_staff_permissions
     WHERE user_id = _user_id AND perm = ANY (removed);
  END IF;

  IF array_length(added, 1) > 0 THEN
    INSERT INTO public.mkt_staff_permissions (user_id, perm, created_by)
    SELECT _user_id, k, auth.uid() FROM unnest(added) k
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.log_audit('mkt_staff_permission', 'bulk_update', _user_id,
    jsonb_build_object('perms', before_perms),
    jsonb_build_object('perms', wanted, 'added', added, 'removed', removed,
                       'operation_id', op_id),
    btrim(_reason));

  INSERT INTO public.mkt_ops_log (actor_user_id, action, unit, entity, entity_id, summary, meta)
  VALUES (auth.uid(), 'access_control.perms_updated', 'platform', 'user', _user_id,
    format('%s granted, %s revoked', COALESCE(array_length(added,1),0), COALESCE(array_length(removed,1),0)),
    jsonb_build_object('operation_id', op_id, 'before', before_perms, 'after', wanted,
                       'added', added, 'removed', removed, 'reason', btrim(_reason),
                       'actor', auth.uid()));

  PERFORM public.mkt_notify(_user_id, NULL, 'admin_role_changed', 'تم تحديث صلاحياتك الإدارية', NULL);

  RETURN jsonb_build_object('operation_id', op_id, 'before', before_perms,
                            'after', wanted, 'added', added, 'removed', removed);
END $function$;

-- 2) Deny-by-default for the remaining access-control surfaces: anon must not even
--    hold EXECUTE. The in-body checks stay exactly as they are.
REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_roles() TO authenticated;

-- 3) Re-declare the two out-of-band grant migrations so repo and live DB match.
REVOKE EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated;