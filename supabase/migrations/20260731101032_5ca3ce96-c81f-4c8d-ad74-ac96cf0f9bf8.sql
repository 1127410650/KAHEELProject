-- =========================================================
-- 1) AUDIT LOG: no direct client writes; insert only via secure function
-- =========================================================
DROP POLICY IF EXISTS audit_insert_authenticated ON public.audit_log;
DROP POLICY IF EXISTS audit_select_accountant ON public.audit_log;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.audit_log FROM authenticated, anon;
GRANT SELECT ON public.audit_log TO authenticated;

CREATE POLICY audit_select_accountant
ON public.audit_log FOR SELECT TO authenticated
USING (public.is_accountant());

-- immutability triggers (function already exists)
DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

CREATE OR REPLACE FUNCTION public.log_audit(
  _entity_type text,
  _action text,
  _entity_id uuid DEFAULT NULL,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _entity_type IS NULL OR btrim(_entity_type) = '' OR _action IS NULL OR btrim(_action) = '' THEN
    RAISE EXCEPTION 'entity_type and action are required';
  END IF;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, old_value, new_value, reason, created_at)
  VALUES (auth.uid(), _entity_type, _entity_id, _action, _old_value, _new_value, _reason, now())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text) IS
  'SECURITY DEFINER: only trusted path to write the immutable audit log. Actor and timestamp are derived server-side from auth.uid()/now(); clients cannot supply them.';

REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text) TO authenticated, service_role;

-- =========================================================
-- 2) SUPERVISORS: restrict reads to accountants or linked-project members
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_access_supervisor(_supervisor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_accountant()
    OR EXISTS (
      SELECT 1
      FROM public.project_supervisors ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id
      WHERE ps.supervisor_id = _supervisor_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.supervisor_id = _supervisor_id AND pm.user_id = auth.uid()
    )
  );
$$;

COMMENT ON FUNCTION public.can_access_supervisor(uuid) IS
  'SECURITY DEFINER: reads project_supervisors/project_members inside RLS policies without recursive policy evaluation. Returns true only for accountants or members of a project linked to the supervisor.';

REVOKE ALL ON FUNCTION public.can_access_supervisor(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_supervisor(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS supervisors_select_authenticated ON public.supervisors;
CREATE POLICY supervisors_select_allowed
ON public.supervisors FOR SELECT TO authenticated
USING (public.can_access_supervisor(id));

-- =========================================================
-- 3) APP SETTINGS: split public vs sensitive
-- =========================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_settings.is_public IS
  'true only for non-sensitive display settings (app name, locale, date format, currency, logo). Never store secrets in this table.';

DROP POLICY IF EXISTS settings_select_authenticated ON public.app_settings;
CREATE POLICY settings_select_allowed
ON public.app_settings FOR SELECT TO authenticated
USING (public.is_accountant() OR is_public = true);

UPDATE public.app_settings
SET is_public = true
WHERE key IN ('app_name', 'app_name_ar', 'app_name_en', 'default_locale', 'date_format', 'time_format', 'currency', 'timezone', 'logo_url');

-- =========================================================
-- 4) SECURITY DEFINER hardening: search_path, grants, comments
-- =========================================================
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_accountant() SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access_project(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access_attachment_object(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.block_audit_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.lock_approved_custody() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS
  'SECURITY DEFINER: reads user_roles for RLS checks without recursive policy evaluation. Internal helper only; not executable by clients.';
COMMENT ON FUNCTION public.is_accountant() IS
  'SECURITY DEFINER: role check for RLS policies; scoped to auth.uid() only and cannot escalate privileges.';
COMMENT ON FUNCTION public.can_access_project(uuid) IS
  'SECURITY DEFINER: project membership check for RLS policies; returns true only for accountants or members of that project.';
COMMENT ON FUNCTION public.can_access_attachment_object(text) IS
  'SECURITY DEFINER: derives project_id from the storage object path and authorises attachment file access for accountants or project members only.';
COMMENT ON FUNCTION public.handle_new_user() IS
  'SECURITY DEFINER: auth trigger that seeds profile and default role rows. Not callable by clients.';

-- helper used only inside other definer functions: clients do not need EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_mutation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_approved_custody() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;

-- functions referenced directly inside RLS policies must stay executable by authenticated
REVOKE ALL ON FUNCTION public.is_accountant() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_accountant() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_access_attachment_object(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_object(text) TO authenticated, service_role;