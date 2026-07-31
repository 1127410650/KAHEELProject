DO $audit_policies$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_log', policy_row.policyname);
  END LOOP;
END
$audit_policies$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.audit_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text)
TO authenticated, service_role;