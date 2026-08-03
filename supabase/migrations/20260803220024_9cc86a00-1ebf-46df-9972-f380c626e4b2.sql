
CREATE OR REPLACE FUNCTION public.shares_active_tenant(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
     WHERE m.user_id = _user_id
       AND m.tenant_id = public.current_tenant_id()
       AND coalesce(m.status,'active') = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.shares_active_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_active_tenant(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_accountant" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_accountant" ON public.profiles;

CREATE POLICY "profiles_select_self_or_tenant_admin" ON public.profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (public.is_accountant() AND public.shares_active_tenant(user_id)));

CREATE POLICY "profiles_update_self_or_tenant_admin" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR (public.is_accountant() AND public.shares_active_tenant(user_id)))
WITH CHECK (user_id = auth.uid() OR (public.is_accountant() AND public.shares_active_tenant(user_id)));

REVOKE ALL ON FUNCTION public.mkt_admin_listing_reports(text,text,text,text,uuid,timestamptz,timestamptz,boolean,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_reports(text,text,text,text,uuid,timestamptz,timestamptz,boolean,integer,integer) TO authenticated, service_role;
