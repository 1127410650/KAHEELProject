CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t uuid; n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT p.active_tenant_id INTO t
    FROM public.profiles p
   WHERE p.user_id = auth.uid();

  IF t IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m
     WHERE m.tenant_id = t AND m.user_id = auth.uid() AND m.status = 'active'
  ) THEN
    RETURN t;
  END IF;

  SELECT count(*) INTO n
    FROM public.tenant_memberships m
   WHERE m.user_id = auth.uid() AND m.status = 'active';

  IF n = 1 THEN
    SELECT m.tenant_id INTO t
      FROM public.tenant_memberships m
     WHERE m.user_id = auth.uid() AND m.status = 'active'
     LIMIT 1;
    RETURN t;
  END IF;

  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;