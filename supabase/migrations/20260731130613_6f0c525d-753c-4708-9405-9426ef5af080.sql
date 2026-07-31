CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('accountant','employee')
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DROP POLICY IF EXISTS suppliers_select_staff ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_staff ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_staff ON public.suppliers;

CREATE POLICY suppliers_select_staff ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY suppliers_insert_staff ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY suppliers_update_staff ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());