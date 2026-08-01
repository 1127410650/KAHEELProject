-- ============================================================
-- Step 1: tenant model + safe isolation helpers + default tenant
-- Additive only. No existing table is dropped or recreated.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  tenant_type text NOT NULL DEFAULT 'company'
    CHECK (tenant_type IN ('company','establishment','property_owner','project_owner','individual','service_provider')),
  legal_name text,
  commercial_registration_number text,
  vat_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  is_default boolean NOT NULL DEFAULT false,
  is_test boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL
    CHECK (role IN ('owner','admin','accountant','employee','supervisor','service_provider','viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','ended')),
  joined_at timestamptz,
  membership_start date,
  membership_end date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One effective membership per user per tenant (a user may join many tenants).
CREATE UNIQUE INDEX IF NOT EXISTS tenant_memberships_active_uniq
  ON public.tenant_memberships (tenant_id, user_id)
  WHERE status IN ('active','invited','suspended');
CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON public.tenant_memberships (user_id, status);

GRANT SELECT, INSERT, UPDATE ON public.tenant_memberships TO authenticated;
GRANT ALL ON public.tenant_memberships TO service_role;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Remembered workspace choice (convenience only, never an authority source).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.touch_tenant_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tenants_touch ON public.tenants;
CREATE TRIGGER tenants_touch BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_updated_at();
DROP TRIGGER IF EXISTS tenant_memberships_touch ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_touch BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_updated_at();

-- ============================================================
-- Isolation helpers (SECURITY DEFINER, fixed search_path, auth.uid() only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND _tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE m.tenant_id = _tenant_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (m.membership_start IS NULL OR m.membership_start <= current_date)
      AND (m.membership_end IS NULL OR m.membership_end >= current_date)
      AND t.status = 'active'
      AND t.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.tenant_id
  FROM public.tenant_memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE auth.uid() IS NOT NULL
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND (m.membership_start IS NULL OR m.membership_start <= current_date)
    AND (m.membership_end IS NULL OR m.membership_end >= current_date)
    AND t.status = 'active'
    AND t.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND _tenant_id IS NOT NULL AND _role IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE m.tenant_id = _tenant_id
      AND m.user_id = auth.uid()
      AND m.role = _role
      AND m.status = 'active'
      AND (m.membership_start IS NULL OR m.membership_start <= current_date)
      AND (m.membership_end IS NULL OR m.membership_end >= current_date)
      AND t.status = 'active'
      AND t.deleted_at IS NULL
  );
$$;

-- Tenant-scoped permission: owner/admin/accountant inside the tenant are full
-- managers of that tenant; other members fall back to their granted permissions.
CREATE OR REPLACE FUNCTION public.has_tenant_permission(_tenant_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.is_tenant_member(_tenant_id) AND (
    public.has_tenant_role(_tenant_id, 'owner')
    OR public.has_tenant_role(_tenant_id, 'admin')
    OR public.has_tenant_role(_tenant_id, 'accountant')
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid() AND up.permission = _permission
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_tenant_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tenant_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid, text) TO authenticated;

-- ============================================================
-- RLS for the tenant model itself
-- ============================================================

DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id));

DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_tenant_role(id, 'owner') OR public.has_tenant_role(id, 'admin'))
  WITH CHECK (public.has_tenant_role(id, 'owner') OR public.has_tenant_role(id, 'admin'));

-- No INSERT/DELETE policy on purpose: self-serve tenant creation is out of scope.

DROP POLICY IF EXISTS memberships_select ON public.tenant_memberships;
CREATE POLICY memberships_select ON public.tenant_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_tenant_role(tenant_id, 'owner')
    OR public.has_tenant_role(tenant_id, 'admin')
  );

DROP POLICY IF EXISTS memberships_insert ON public.tenant_memberships;
CREATE POLICY memberships_insert ON public.tenant_memberships FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_tenant_role(tenant_id, 'owner') OR public.has_tenant_role(tenant_id, 'admin'))
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS memberships_update ON public.tenant_memberships;
CREATE POLICY memberships_update ON public.tenant_memberships FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, 'owner') OR public.has_tenant_role(tenant_id, 'admin'))
  WITH CHECK (public.has_tenant_role(tenant_id, 'owner') OR public.has_tenant_role(tenant_id, 'admin'));

-- A member can never move their own membership to another tenant or escalate role.
CREATE OR REPLACE FUNCTION public.guard_membership_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'TENANT_MOVE_FORBIDDEN';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'MEMBER_SWAP_FORBIDDEN';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenant_memberships_guard ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_guard BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_membership_changes();

-- ============================================================
-- Default tenant representing all existing production data
-- ============================================================
INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_default, legal_name)
SELECT 'الكيان الحالي — تحقّق', 'Current Entity — Tahqaq', 'company', 'active', true, 'الكيان الحالي — تحقّق'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE is_default);

-- Existing users become members of the default tenant, mapped from current roles.
INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at)
SELECT d.id,
       p.user_id,
       CASE
         WHEN p.email = 'o11339911@gmail.com' THEN 'owner'
         WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'accountant') THEN 'accountant'
         WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'supervisor') THEN 'supervisor'
         WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'employee') THEN 'employee'
         ELSE 'viewer'
       END,
       'active',
       COALESCE(p.created_at, now())
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.tenants WHERE is_default LIMIT 1) d
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = d.id AND m.user_id = p.user_id
  );