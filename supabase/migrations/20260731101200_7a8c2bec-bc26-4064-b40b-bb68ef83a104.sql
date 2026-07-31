REVOKE ALL ON public.audit_log FROM anon;
REVOKE TRIGGER, MAINTAIN ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
DROP TRIGGER IF EXISTS audit_immutable ON public.audit_log;