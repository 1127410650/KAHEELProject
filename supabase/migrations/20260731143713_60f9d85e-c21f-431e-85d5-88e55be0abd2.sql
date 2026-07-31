DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated, anon, PUBLIC', f.sig);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.notify_request(uuid, text, text, text, uuid) FROM authenticated;