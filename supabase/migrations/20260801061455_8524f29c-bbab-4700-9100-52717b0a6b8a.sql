ALTER FUNCTION public.invitation_preview(text) SET search_path = public, extensions;
ALTER FUNCTION public.invitation_accept(text) SET search_path = public, extensions;
ALTER FUNCTION public.invitation_accept_by_id(uuid) SET search_path = public, extensions;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('invitation_create','invitation_revoke')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
  END LOOP;
END $$;