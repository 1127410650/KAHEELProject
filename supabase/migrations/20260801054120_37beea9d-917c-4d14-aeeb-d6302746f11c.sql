-- ============================================================
-- 1) Workspace profile fields (onboarding)
-- ============================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS usage_type text,
  ADD COLUMN IF NOT EXISTS provider_type text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ============================================================
-- 2) Invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  mobile text,
  invited_role text NOT NULL CHECK (invited_role IN ('admin','accountant','employee','supervisor','service_provider','viewer')),
  invited_permissions text[] NOT NULL DEFAULT '{}',
  project_ids uuid[] NOT NULL DEFAULT '{}',
  invitation_type text NOT NULL CHECK (invitation_type IN ('employee','accountant','supervisor','service_provider','viewer')),
  membership_type text,
  service_type text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  membership_start date,
  membership_end date,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_idx ON public.tenant_invitations(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_active_unique
  ON public.tenant_invitations(tenant_id, lower(email), invited_role)
  WHERE status = 'pending';

GRANT SELECT ON public.tenant_invitations TO authenticated;
GRANT ALL ON public.tenant_invitations TO service_role;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_select_admins ON public.tenant_invitations;
CREATE POLICY invitations_select_admins ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, 'owner') OR public.has_tenant_role(tenant_id, 'admin'));

DROP TRIGGER IF EXISTS tenant_invitations_touch ON public.tenant_invitations;
CREATE TRIGGER tenant_invitations_touch BEFORE UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) Abuse protection events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_lookup_idx ON public.rate_events(bucket, key_hash, created_at DESC);

GRANT ALL ON public.rate_events TO service_role;
ALTER TABLE public.rate_events ENABLE ROW LEVEL SECURITY;
-- No policies: reachable only through security-definer functions / service role.

CREATE OR REPLACE FUNCTION public.rate_limit_hit(_bucket text, _key text, _limit int, _window interval)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _hash text; _n int;
BEGIN
  _hash := encode(digest(coalesce(_key,''), 'sha256'), 'hex');
  DELETE FROM public.rate_events WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO _n FROM public.rate_events
   WHERE bucket = _bucket AND key_hash = _hash AND created_at > now() - _window;
  INSERT INTO public.rate_events(bucket, key_hash) VALUES (_bucket, _hash);
  RETURN _n < _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, int, interval) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, int, interval) TO service_role;

-- ============================================================
-- 4) Workspace creation (self-service onboarding)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_workspace(
  _tenant_type text,
  _name_ar text,
  _name_en text DEFAULT NULL,
  _legal_name text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _vat_number text DEFAULT NULL,
  _city text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _activity text DEFAULT NULL,
  _usage_type text DEFAULT NULL,
  _provider_type text DEFAULT NULL,
  _specialty text DEFAULT NULL,
  _contact_info jsonb DEFAULT '{}'::jsonb,
  _confirm_duplicate boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _tenant_id uuid; _dup int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _tenant_type NOT IN ('company','establishment','property_owner','project_owner','individual','service_provider') THEN
    RAISE EXCEPTION 'INVALID_TENANT_TYPE';
  END IF;
  IF coalesce(btrim(_name_ar),'') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;

  -- One self-created workspace per user in this phase (invited memberships do not count).
  IF EXISTS (
    SELECT 1 FROM public.tenants t
     WHERE t.created_by = _uid AND t.deleted_at IS NULL AND t.status <> 'archived'
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
    btrim(_name_ar), nullif(btrim(coalesce(_name_en,'')),''), _tenant_type,
    nullif(btrim(coalesce(_legal_name,'')),''), nullif(btrim(coalesce(_cr_number,'')),''),
    nullif(btrim(coalesce(_vat_number,'')),''), 'active', false,
    (btrim(_name_ar) LIKE 'TEST-SIGNUP-%'), _uid,
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
$$;
REVOKE ALL ON FUNCTION public.create_workspace(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_workspace(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_workspace_state()
RETURNS TABLE(memberships int, own_workspaces int, pending_invitations int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.tenant_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active'),
    (SELECT count(*)::int FROM public.tenants t WHERE t.created_by = auth.uid() AND t.deleted_at IS NULL AND t.status <> 'archived'),
    (SELECT count(*)::int FROM public.tenant_invitations i
      WHERE i.status = 'pending' AND i.expires_at > now()
        AND lower(i.email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
$$;
GRANT EXECUTE ON FUNCTION public.my_workspace_state() TO authenticated;

-- ============================================================
-- 5) Invitations: create / preview / accept / revoke / list
-- ============================================================
CREATE OR REPLACE FUNCTION public.invitation_create(
  _email text,
  _invited_role text,
  _invitation_type text,
  _permissions text[] DEFAULT '{}',
  _project_ids uuid[] DEFAULT '{}',
  _mobile text DEFAULT NULL,
  _membership_type text DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _membership_start date DEFAULT NULL,
  _membership_end date DEFAULT NULL
)
RETURNS TABLE(id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- An inviter can never grant a permission they do not hold themselves.
  IF _permissions IS NOT NULL THEN
    FOREACH _perm IN ARRAY _permissions LOOP
      IF NOT public.has_permission_in_tenant(_uid, _tenant, _perm) THEN
        RAISE EXCEPTION 'PERMISSION_ESCALATION';
      END IF;
    END LOOP;
  END IF;

  SELECT count(*) INTO _pending FROM public.tenant_invitations
   WHERE tenant_id = _tenant AND status = 'pending' AND expires_at > now();
  IF _pending >= 200 THEN RAISE EXCEPTION 'PENDING_LIMIT_REACHED'; END IF;

  IF NOT public.rate_limit_hit('invite_create', _tenant::text, 30, interval '1 hour') THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenant_invitations
     WHERE tenant_id = _tenant AND lower(email) = lower(btrim(_email))
       AND invited_role = _invited_role AND status = 'pending' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_INVITATION';
  END IF;

  -- Expire stale rows so the unique index does not block a fresh invitation.
  UPDATE public.tenant_invitations SET status = 'expired'
   WHERE tenant_id = _tenant AND status = 'pending' AND expires_at <= now();

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

  -- Audit never stores the raw token, only its identity.
  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant_invitation', _row.id, 'create',
          jsonb_build_object('email', _row.email, 'invited_role', _row.invited_role,
                             'invitation_type', _row.invitation_type,
                             'projects', coalesce(array_length(_row.project_ids,1),0)),
          _tenant);

  RETURN QUERY SELECT _row.id, _raw, _row.expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.invitation_create(text,text,text,text[],uuid[],text,text,text,date,date) FROM public;
GRANT EXECUTE ON FUNCTION public.invitation_create(text,text,text,text[],uuid[],text,text,text,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.invitation_preview(_token text)
RETURNS TABLE(
  state text, tenant_name_ar text, tenant_name_en text, invited_role text,
  invitation_type text, masked_email text, expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_invitations; _t public.tenants; _state text; _email text;
BEGIN
  IF coalesce(btrim(_token),'') = '' THEN
    RETURN QUERY SELECT 'invalid', NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO _row FROM public.tenant_invitations
   WHERE token_hash = encode(digest(btrim(_token),'sha256'),'hex');

  IF _row.id IS NULL THEN
    PERFORM public.rate_limit_hit('invite_lookup_fail', coalesce(auth.uid()::text, btrim(_token)), 20, interval '1 hour');
    RETURN QUERY SELECT 'invalid', NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO _t FROM public.tenants WHERE id = _row.tenant_id;

  _state := CASE
    WHEN _row.status = 'revoked' THEN 'revoked'
    WHEN _row.status = 'accepted' THEN 'accepted'
    WHEN _row.status = 'expired' OR _row.expires_at <= now() THEN 'expired'
    WHEN _t.status <> 'active' OR _t.deleted_at IS NOT NULL THEN 'invalid'
    ELSE 'valid'
  END;

  _email := split_part(_row.email,'@',1);
  _email := left(_email,2) || '***@' || split_part(_row.email,'@',2);

  RETURN QUERY SELECT _state, _t.name_ar, _t.name_en, _row.invited_role, _row.invitation_type,
                      _email, _row.expires_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.invitation_accept(_token text)
RETURNS TABLE(tenant_id uuid, activated boolean, memberships int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT public.rate_limit_hit('invite_accept', _uid::text, 15, interval '1 hour') THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  SELECT * INTO _row FROM public.tenant_invitations
   WHERE token_hash = encode(digest(btrim(coalesce(_token,'')),'sha256'),'hex')
   FOR UPDATE;

  IF _row.id IS NULL THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
  IF _row.status = 'revoked' THEN RAISE EXCEPTION 'INVITATION_REVOKED'; END IF;
  IF _row.status = 'accepted' THEN RAISE EXCEPTION 'INVITATION_USED'; END IF;
  IF _row.status = 'expired' OR _row.expires_at <= now() THEN
    UPDATE public.tenant_invitations SET status = 'expired' WHERE id = _row.id AND status = 'pending';
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF _email = '' OR _email <> lower(_row.email) THEN RAISE EXCEPTION 'EMAIL_MISMATCH'; END IF;

  SELECT * INTO _t FROM public.tenants WHERE id = _row.tenant_id;
  IF _t.id IS NULL OR _t.status <> 'active' OR _t.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, membership_start, membership_end, created_by)
  VALUES (_row.tenant_id, _uid, _row.invited_role, 'active', now(),
          coalesce(_row.membership_start, current_date), _row.membership_end, _row.invited_by)
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = excluded.role, status = 'active', joined_at = coalesce(public.tenant_memberships.joined_at, now()),
        membership_start = excluded.membership_start, membership_end = excluded.membership_end
  RETURNING id INTO _membership_id;

  -- Role + permissions live strictly inside the inviting tenant.
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
      INSERT INTO public.supervisors (name_ar, phone, email, is_active, created_by, tenant_id)
      VALUES (coalesce(nullif(btrim(_profile.full_name),''), _row.email),
              coalesce(_profile.phone, _row.mobile, ''), _row.email, true, _row.invited_by, _row.tenant_id)
      RETURNING id INTO _sup_id;
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

  SELECT count(*)::int INTO _count FROM public.tenant_memberships m
   WHERE m.user_id = _uid AND m.status = 'active';

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
$$;
REVOKE ALL ON FUNCTION public.invitation_accept(text) FROM public;
GRANT EXECUTE ON FUNCTION public.invitation_accept(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.invitation_revoke(_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_invitations;
BEGIN
  SELECT * INTO _row FROM public.tenant_invitations WHERE id = _id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.has_tenant_role(_row.tenant_id,'owner') OR public.has_tenant_role(_row.tenant_id,'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;

  UPDATE public.tenant_invitations
     SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
   WHERE id = _id;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, reason, tenant_id)
  VALUES (auth.uid(), 'tenant_invitation', _id, 'revoke',
          jsonb_build_object('email', _row.email), _reason, _row.tenant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.invitation_revoke(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_members_list()
RETURNS TABLE(
  membership_id uuid, user_id uuid, full_name text, email text, phone text,
  role text, status text, joined_at timestamptz, membership_start date, membership_end date,
  permissions text[], project_names text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tenant uuid := public.current_tenant_id();
BEGIN
  IF _tenant IS NULL THEN RETURN; END IF;
  IF NOT (public.has_tenant_role(_tenant,'owner') OR public.has_tenant_role(_tenant,'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, coalesce(p.full_name,''), p.email, p.phone, m.role, m.status,
         m.joined_at, m.membership_start, m.membership_end,
         coalesce((SELECT array_agg(up.permission) FROM public.user_permissions up
                    WHERE up.user_id = m.user_id AND up.tenant_id = _tenant), '{}'),
         coalesce((SELECT array_agg(DISTINCT pr.name_ar) FROM public.project_members pm
                    JOIN public.projects pr ON pr.id = pm.project_id
                   WHERE pm.user_id = m.user_id AND pm.tenant_id = _tenant), '{}')
    FROM public.tenant_memberships m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
   WHERE m.tenant_id = _tenant
   ORDER BY CASE m.status WHEN 'active' THEN 0 WHEN 'suspended' THEN 1 ELSE 2 END, m.joined_at DESC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tenant_members_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.membership_set_status(_membership_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_memberships;
BEGIN
  IF _status NOT IN ('active','suspended','ended') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT * INTO _row FROM public.tenant_memberships WHERE id = _membership_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.has_tenant_role(_row.tenant_id,'owner') OR public.has_tenant_role(_row.tenant_id,'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _row.role = 'owner' THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;

  UPDATE public.tenant_memberships SET status = _status WHERE id = _membership_id;

  -- Auth accounts are never deleted when a membership ends.
  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, old_value, new_value, reason, tenant_id)
  VALUES (auth.uid(), 'tenant_membership', _membership_id, 'update',
          jsonb_build_object('status', _row.status), jsonb_build_object('status', _status), _reason, _row.tenant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.membership_set_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.membership_set_access(
  _membership_id uuid,
  _role text,
  _permissions text[] DEFAULT '{}',
  _project_ids uuid[] DEFAULT NULL,
  _membership_start date DEFAULT NULL,
  _membership_end date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.tenant_memberships; _uid uuid := auth.uid(); _perm text; _pid uuid;
BEGIN
  SELECT * INTO _row FROM public.tenant_memberships WHERE id = _membership_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.has_tenant_role(_row.tenant_id,'owner') OR public.has_tenant_role(_row.tenant_id,'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _row.role = 'owner' OR _role = 'owner' THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
  IF _role NOT IN ('admin','accountant','employee','supervisor','service_provider','viewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  IF _permissions IS NOT NULL THEN
    FOREACH _perm IN ARRAY _permissions LOOP
      IF NOT public.has_permission_in_tenant(_uid, _row.tenant_id, _perm) THEN
        RAISE EXCEPTION 'PERMISSION_ESCALATION';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.tenant_memberships
     SET role = _role,
         membership_start = coalesce(_membership_start, membership_start),
         membership_end = _membership_end
   WHERE id = _membership_id;

  DELETE FROM public.user_roles WHERE user_id = _row.user_id AND tenant_id = _row.tenant_id;
  IF _role IN ('accountant','employee','supervisor') THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (_row.user_id, _role::app_role, _row.tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;

  DELETE FROM public.user_permissions WHERE user_id = _row.user_id AND tenant_id = _row.tenant_id;
  IF _permissions IS NOT NULL THEN
    FOREACH _perm IN ARRAY _permissions LOOP
      INSERT INTO public.user_permissions (user_id, permission, tenant_id)
      VALUES (_row.user_id, _perm, _row.tenant_id)
      ON CONFLICT (user_id, permission, tenant_id) DO NOTHING;
    END LOOP;
  END IF;

  IF _project_ids IS NOT NULL THEN
    DELETE FROM public.project_members WHERE user_id = _row.user_id AND tenant_id = _row.tenant_id;
    FOREACH _pid IN ARRAY _project_ids LOOP
      IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _pid AND p.tenant_id = _row.tenant_id) THEN
        INSERT INTO public.project_members (project_id, user_id, tenant_id)
        VALUES (_pid, _row.user_id, _row.tenant_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant_membership', _membership_id, 'update',
          jsonb_build_object('role', _role, 'permissions', coalesce(array_length(_permissions,1),0)), _row.tenant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.membership_set_access(uuid, text, text[], uuid[], date, date) TO authenticated;