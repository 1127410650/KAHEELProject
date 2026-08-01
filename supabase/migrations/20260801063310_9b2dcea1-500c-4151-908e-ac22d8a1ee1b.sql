CREATE OR REPLACE FUNCTION public.invitation_accept_by_id(_id uuid)
 RETURNS TABLE(tenant_id uuid, activated boolean, memberships integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email',''));
  _row public.tenant_invitations;
  _t public.tenants;
  _membership_id uuid;
  _perm text;
  _pid uuid;
  _sup_id uuid;
  _count int;
  _activate boolean := false;
  _profile public.profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO _row FROM public.tenant_invitations WHERE id = _id FOR UPDATE;

  IF _row.id IS NULL THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
  IF _email = '' OR _email <> lower(_row.email) THEN RAISE EXCEPTION 'EMAIL_MISMATCH'; END IF;
  IF _row.status = 'revoked' THEN RAISE EXCEPTION 'INVITATION_REVOKED'; END IF;
  IF _row.status = 'accepted' THEN RAISE EXCEPTION 'INVITATION_USED'; END IF;
  IF _row.status = 'expired' OR _row.expires_at <= now() THEN
    UPDATE public.tenant_invitations SET status = 'expired' WHERE id = _row.id AND status = 'pending';
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  SELECT * INTO _t FROM public.tenants WHERE id = _row.tenant_id;
  IF _t.id IS NULL OR _t.status <> 'active' OR _t.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  INSERT INTO public.tenant_memberships AS m
    (tenant_id, user_id, role, status, joined_at, membership_start, membership_end, created_by)
  VALUES (_row.tenant_id, _uid, _row.invited_role, 'active', now(),
          coalesce(_row.membership_start, current_date), _row.membership_end, _row.invited_by)
  ON CONFLICT (tenant_id, user_id) WHERE (status = ANY (ARRAY['active','invited','suspended'])) DO UPDATE
    SET role = excluded.role, status = 'active', joined_at = coalesce(m.joined_at, now()),
        membership_start = excluded.membership_start, membership_end = excluded.membership_end
  RETURNING m.id INTO _membership_id;

  IF _row.invited_role IN ('accountant','employee','supervisor') THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (_uid, _row.invited_role::app_role, _row.tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;

  IF _row.invited_permissions IS NOT NULL THEN
    FOREACH _perm IN ARRAY _row.invited_permissions LOOP
      INSERT INTO public.user_permissions (user_id, permission, tenant_id)
      VALUES (_uid, _perm, _row.tenant_id)
      ON CONFLICT (user_id, permission, tenant_id) DO NOTHING;
    END LOOP;
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid;

  IF _row.invited_role = 'supervisor' THEN
    _sup_id := _profile.supervisor_id;

    IF _sup_id IS NULL THEN
      SELECT s.id INTO _sup_id
        FROM public.supervisors s
       WHERE s.tenant_id = _row.tenant_id
         AND s.deleted_at IS NULL
         AND (lower(coalesce(s.email,'')) = lower(_row.email)
              OR (coalesce(_row.mobile,'') <> '' AND s.phone = _row.mobile)
              OR (coalesce(_profile.phone,'') <> '' AND s.phone = _profile.phone))
       ORDER BY (lower(coalesce(s.email,'')) = lower(_row.email)) DESC
       LIMIT 1;
    END IF;

    IF _sup_id IS NULL THEN
      INSERT INTO public.supervisors (name_ar, national_id, phone, email, is_active, created_by, tenant_id)
      VALUES (coalesce(nullif(btrim(coalesce(_profile.full_name,'')),''), _row.email),
              coalesce(nullif(btrim(coalesce(_profile.national_id,'')),''),
                       'PENDING-' || substr(replace(_uid::text,'-',''), 1, 10)),
              coalesce(nullif(btrim(coalesce(_profile.phone,'')),''), nullif(btrim(coalesce(_row.mobile,'')),''), ''),
              _row.email, true, _row.invited_by, _row.tenant_id)
      RETURNING id INTO _sup_id;
    END IF;

    IF _profile.supervisor_id IS NULL THEN
      UPDATE public.profiles SET supervisor_id = _sup_id WHERE user_id = _uid;
    END IF;

    IF _row.project_ids IS NOT NULL THEN
      FOREACH _pid IN ARRAY _row.project_ids LOOP
        IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _pid AND p.tenant_id = _row.tenant_id) THEN
          INSERT INTO public.project_supervisors (project_id, supervisor_id, membership_type, start_date, end_date, is_active, created_by, tenant_id)
          VALUES (_pid, _sup_id, coalesce(_row.membership_type,'partner'), current_date, _row.membership_end, true, _row.invited_by, _row.tenant_id)
          ON CONFLICT (project_id, supervisor_id) DO UPDATE SET is_active = true;
        END IF;
      END LOOP;
    END IF;
  ELSE
    IF _row.project_ids IS NOT NULL THEN
      FOREACH _pid IN ARRAY _row.project_ids LOOP
        IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _pid AND p.tenant_id = _row.tenant_id) THEN
          INSERT INTO public.project_members (project_id, user_id, tenant_id)
          VALUES (_pid, _uid, _row.tenant_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.tenant_invitations
     SET status = 'accepted', accepted_by = _uid, accepted_at = now(),
         token_hash = encode(digest(gen_random_bytes(32),'sha256'),'hex')
   WHERE id = _row.id;

  SELECT count(*)::int INTO _count FROM public.tenant_memberships m2
   WHERE m2.user_id = _uid AND m2.status = 'active';

  IF _count = 1 THEN
    UPDATE public.profiles SET active_tenant_id = _row.tenant_id WHERE user_id = _uid;
    _activate := true;
  END IF;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant_invitation', _row.id, 'accept',
          jsonb_build_object('invited_role', _row.invited_role, 'membership_id', _membership_id),
          _row.tenant_id);

  RETURN QUERY SELECT _row.tenant_id, _activate, _count;
END;
$function$;