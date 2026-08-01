ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

UPDATE public.profiles p
   SET active_tenant_id = m.tenant_id
  FROM public.tenant_memberships m
 WHERE m.user_id = p.user_id AND m.status = 'active' AND p.active_tenant_id IS NULL;

-- Active workspace: persisted choice, else the only membership.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t uuid; n int;
BEGIN
  SELECT p.active_tenant_id INTO t
    FROM public.profiles p
   WHERE p.user_id = auth.uid();

  IF t IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m
     WHERE m.tenant_id = t AND m.user_id = auth.uid() AND m.status = 'active'
  ) THEN
    RETURN t;
  END IF;

  SELECT count(*), min(m.tenant_id) INTO n, t
    FROM public.tenant_memberships m
   WHERE m.user_id = auth.uid() AND m.status = 'active';
  IF n = 1 THEN RETURN t; END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_active_tenant(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
     WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_a_member_of_tenant';
  END IF;

  UPDATE public.profiles SET active_tenant_id = _tenant_id WHERE user_id = auth.uid();
  RETURN _tenant_id;
END $$;

REVOKE ALL ON FUNCTION public.set_active_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_tenants()
RETURNS TABLE (
  tenant_id uuid,
  name_ar text,
  name_en text,
  role text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name_ar, t.name_en, m.role::text,
         t.id = public.current_tenant_id()
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
   WHERE m.user_id = auth.uid() AND m.status = 'active'
   ORDER BY t.name_ar;
$$;

REVOKE ALL ON FUNCTION public.my_tenants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tenants() TO authenticated;