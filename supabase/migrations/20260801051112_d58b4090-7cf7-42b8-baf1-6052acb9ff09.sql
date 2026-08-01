-- 1) tenant scoping columns
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2) backfill from real memberships only (single active membership per user today)
UPDATE public.user_roles ur
   SET tenant_id = m.tenant_id
  FROM public.tenant_memberships m
 WHERE m.user_id = ur.user_id AND m.status = 'active' AND ur.tenant_id IS NULL;

UPDATE public.user_permissions up
   SET tenant_id = m.tenant_id
  FROM public.tenant_memberships m
 WHERE m.user_id = up.user_id AND m.status = 'active' AND up.tenant_id IS NULL;

-- orphans (archived test users with no membership anywhere) must not keep global grants
DELETE FROM public.user_roles WHERE tenant_id IS NULL;
DELETE FROM public.user_permissions WHERE tenant_id IS NULL;

ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_permissions ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_permission_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_tenant_user_role_key ON public.user_roles(tenant_id, user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS user_permissions_tenant_user_perm_key ON public.user_permissions(tenant_id, user_id, permission);
CREATE INDEX IF NOT EXISTS user_roles_tenant_user_idx ON public.user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS user_permissions_tenant_user_idx ON public.user_permissions(tenant_id, user_id);

-- 3) membership is the source of truth: no grant may exist without an active membership
CREATE OR REPLACE FUNCTION public.require_tenant_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
     WHERE m.tenant_id = NEW.tenant_id
       AND m.user_id = NEW.user_id
       AND m.status = 'active'
       AND (m.membership_end IS NULL OR m.membership_end >= current_date)
  ) THEN
    RAISE EXCEPTION 'no_active_membership_in_tenant';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_roles_require_membership ON public.user_roles;
CREATE TRIGGER user_roles_require_membership
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.require_tenant_membership();

DROP TRIGGER IF EXISTS user_permissions_require_membership ON public.user_permissions;
CREATE TRIGGER user_permissions_require_membership
  BEFORE INSERT OR UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.require_tenant_membership();

-- ending a membership revokes that tenant's grants only
CREATE OR REPLACE FUNCTION public.revoke_grants_on_membership_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    DELETE FROM public.user_roles WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;
    DELETE FROM public.user_permissions WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS memberships_revoke_grants ON public.tenant_memberships;
CREATE TRIGGER memberships_revoke_grants
  AFTER UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.revoke_grants_on_membership_end();

-- 4) tenant-scoped permission functions
CREATE OR REPLACE FUNCTION public.is_active_member(_tenant_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT _tenant_id IS NOT NULL AND _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE m.tenant_id = _tenant_id AND m.user_id = _user_id
      AND m.status = 'active'
      AND (m.membership_start IS NULL OR m.membership_start <= current_date)
      AND (m.membership_end IS NULL OR m.membership_end >= current_date)
      AND t.status = 'active' AND t.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id uuid, _tenant_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.is_active_member(_tenant_id, _user_id) AND EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = _user_id AND r.tenant_id = _tenant_id AND r.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_in_tenant(_user_id uuid, _tenant_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.is_active_member(_tenant_id, _user_id) AND (
    public.has_role_in_tenant(_user_id, _tenant_id, 'accountant')
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
       WHERE m.tenant_id = _tenant_id AND m.user_id = _user_id
         AND m.status = 'active' AND m.role IN ('owner','admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permissions p
       WHERE p.user_id = _user_id AND p.tenant_id = _tenant_id AND p.permission = _permission
    )
  );
$$;

-- global-looking helpers keep their signatures but are now tenant-bound
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.has_role_in_tenant(_user_id, public.current_tenant_id(), _role);
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.has_role_in_tenant(auth.uid(), public.current_tenant_id(), 'accountant')
      OR public.has_tenant_role(public.current_tenant_id(), 'owner')
      OR public.has_tenant_role(public.current_tenant_id(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.is_accountant()
      OR public.has_role_in_tenant(auth.uid(), public.current_tenant_id(), 'employee');
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.has_permission_in_tenant(auth.uid(), public.current_tenant_id(), _perm);
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_permission(_tenant_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.has_permission_in_tenant(auth.uid(), _tenant_id, _permission);
$$;

-- 5) grants + tenant-scoped RLS on the two grant tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.user_permissions TO service_role;

DROP POLICY IF EXISTS user_roles_manage_accountant ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self_or_accountant ON public.user_roles;
DROP POLICY IF EXISTS "read own permissions" ON public.user_permissions;

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (user_id = auth.uid() OR public.is_accountant()));

CREATE POLICY user_roles_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_accountant() AND tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_accountant() AND tenant_id = public.current_tenant_id());

CREATE POLICY user_permissions_select ON public.user_permissions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (user_id = auth.uid() OR public.is_accountant()));

CREATE POLICY user_permissions_manage ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_accountant() AND tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_accountant() AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS user_roles_tenant_isolation ON public.user_roles;
CREATE POLICY user_roles_tenant_isolation ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS user_permissions_tenant_isolation ON public.user_permissions;
CREATE POLICY user_permissions_tenant_isolation ON public.user_permissions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- tenant_id itself must be immutable on grant rows
CREATE OR REPLACE FUNCTION public.freeze_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id_immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_roles_freeze_tenant ON public.user_roles;
CREATE TRIGGER user_roles_freeze_tenant BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();
DROP TRIGGER IF EXISTS user_permissions_freeze_tenant ON public.user_permissions;
CREATE TRIGGER user_permissions_freeze_tenant BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;