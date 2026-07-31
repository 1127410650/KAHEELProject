-- fix search_path on helper functions
ALTER FUNCTION public.request_stage_order() SET search_path = public;
ALTER FUNCTION public.request_progress(text) SET search_path = public;
ALTER FUNCTION public.request_can_transition(text, text) SET search_path = public;

-- attachments: allow request-scoped access even without a project
DROP POLICY IF EXISTS attachments_select_allowed ON public.attachments;
CREATE POLICY attachments_select_allowed ON public.attachments FOR SELECT TO authenticated
  USING (
    public.is_accountant()
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
    OR (entity_type = 'request' AND public.can_access_request(entity_id))
  );

DROP POLICY IF EXISTS attachments_insert_allowed ON public.attachments;
CREATE POLICY attachments_insert_allowed ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_accountant()
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
    OR (entity_type = 'request' AND public.can_access_request(entity_id))
  );

-- history / reminders visibility follows request access
DROP POLICY IF EXISTS request_history_select_allowed ON public.request_status_history;
CREATE POLICY request_history_select_allowed ON public.request_status_history FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

DROP POLICY IF EXISTS "reminders read" ON public.request_reminders;
CREATE POLICY request_reminders_read ON public.request_reminders FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

-- requests: direct edits are accountant-only; everyone else goes through RPCs
DROP POLICY IF EXISTS requests_update_allowed ON public.requests;
CREATE POLICY requests_update_allowed ON public.requests FOR UPDATE TO authenticated
  USING (public.is_accountant()) WITH CHECK (public.is_accountant());

DROP POLICY IF EXISTS requests_select_allowed ON public.requests;
DROP POLICY IF EXISTS "requests supervisor insert" ON public.requests;
DROP POLICY IF EXISTS requests_insert_allowed ON public.requests;
CREATE POLICY requests_insert_allowed ON public.requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_accountant()
    OR (created_by = auth.uid() AND status IN ('new','awaiting_reply')
        AND (project_id IS NULL OR public.can_access_project(project_id))
        AND public.has_perm('requests.create'))
  );

-- no anonymous execution of any workflow function
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;