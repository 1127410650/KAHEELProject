-- 1. Roles / enums ---------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. profiles --------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_national_id_key
  ON public.profiles (national_id) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_supervisor_id_key
  ON public.profiles (supervisor_id) WHERE supervisor_id IS NOT NULL;

-- 3. permissions -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own permissions" ON public.user_permissions;
CREATE POLICY "read own permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_accountant());

CREATE OR REPLACE FUNCTION public.current_supervisor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT supervisor_id FROM public.profiles WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_perm(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'accountant')
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND up.permission = _perm)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT public.current_supervisor_id() IS NOT NULL $$;

REVOKE ALL ON FUNCTION public.has_perm(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_supervisor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_supervisor_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_perm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_supervisor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supervisor_user() TO authenticated;

-- 4. access helpers extended for supervisor portal --------------------------
CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
  SELECT public.has_role(auth.uid(), 'accountant')
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.user_id = auth.uid())
    OR (public.current_supervisor_id() IS NOT NULL AND (
         EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.supervisor_id = public.current_supervisor_id())
      OR EXISTS (SELECT 1 FROM public.project_supervisors ps WHERE ps.project_id = _project_id AND ps.supervisor_id = public.current_supervisor_id())
    ));
$$;

CREATE OR REPLACE FUNCTION public.can_access_supervisor(_supervisor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_accountant()
    OR _supervisor_id = public.current_supervisor_id()
    OR EXISTS (
      SELECT 1 FROM public.project_supervisors ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id
      WHERE ps.supervisor_id = _supervisor_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.supervisor_id = _supervisor_id AND pm.user_id = auth.uid()
    )
  );
$$;

-- 5. requests workflow columns ---------------------------------------------
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS requester_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_by uuid,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reassign_reason text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS created_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS requests_requester_idx ON public.requests (requester_id);
CREATE INDEX IF NOT EXISTS requests_assigned_idx ON public.requests (assigned_to);

-- supervisors may create their own requests
DROP POLICY IF EXISTS "requests supervisor insert" ON public.requests;
CREATE POLICY "requests supervisor insert" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND (
      public.is_accountant()
      OR (public.current_supervisor_id() IS NOT NULL
          AND supervisor_id = public.current_supervisor_id()
          AND requester_id = auth.uid()
          AND status = 'new')
      OR public.has_perm('requests.create')
    )
  );

-- protect immutable ownership fields + execution once
CREATE OR REPLACE FUNCTION public.enforce_request_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requester_id IS NULL THEN NEW.requester_id := auth.uid(); END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_accountant() THEN
    IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      RAISE EXCEPTION 'OWNERSHIP_LOCKED';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.executed_by IS DISTINCT FROM OLD.executed_by
       OR NEW.executed_at IS DISTINCT FROM OLD.executed_at THEN
      RAISE EXCEPTION 'WORKFLOW_LOCKED';
    END IF;
  END IF;

  IF OLD.executed_at IS NOT NULL AND NEW.executed_at IS DISTINCT FROM OLD.executed_at THEN
    RAISE EXCEPTION 'ALREADY_EXECUTED';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS requests_enforce_ownership ON public.requests;
CREATE TRIGGER requests_enforce_ownership
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_request_ownership();

-- 6. custody link to request (single execution) ----------------------------
ALTER TABLE public.custody_transactions
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS custody_transactions_request_key
  ON public.custody_transactions (request_id) WHERE request_id IS NOT NULL;

-- 7. reminders -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.request_reminders TO authenticated;
GRANT ALL ON public.request_reminders TO service_role;
ALTER TABLE public.request_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders read" ON public.request_reminders;
CREATE POLICY "reminders read" ON public.request_reminders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND public.can_access_project(r.project_id)));

CREATE OR REPLACE FUNCTION public.send_request_reminder(_request_id uuid, _message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_id uuid; v_last timestamptz; v_project uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT project_id INTO v_project FROM public.requests WHERE id = _request_id AND deleted_at IS NULL;
  IF v_project IS NULL OR NOT public.can_access_project(v_project) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF NOT public.is_accountant() THEN
    SELECT max(created_at) INTO v_last FROM public.request_reminders
      WHERE request_id = _request_id AND actor_id = auth.uid();
    IF v_last IS NOT NULL AND v_last > now() - interval '24 hours' THEN
      RAISE EXCEPTION 'REMINDER_THROTTLED';
    END IF;
  END IF;

  INSERT INTO public.request_reminders (request_id, actor_id, message)
  VALUES (_request_id, auth.uid(), _message) RETURNING id INTO v_id;

  INSERT INTO public.request_status_history (request_id, actor_id, from_status, to_status, note)
  SELECT _request_id, auth.uid(), r.status, r.status, coalesce('تذكير: ' || _message, 'تذكير')
  FROM public.requests r WHERE r.id = _request_id;

  PERFORM public.log_audit('request', 'update', _request_id, NULL,
    jsonb_build_object('reminder', true, 'message', _message), 'reminder');
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.send_request_reminder(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_request_reminder(uuid, text) TO authenticated;

-- 8. approve / reject / execute -------------------------------------------
CREATE OR REPLACE FUNCTION public.request_decide(_request_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _decision = 'approve' AND NOT public.has_perm('requests.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision = 'reject' AND NOT public.has_perm('requests.reject') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision = 'reopen' AND NOT public.has_perm('requests.reopen') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF r.requester_id = auth.uid() AND _decision IN ('approve') THEN RAISE EXCEPTION 'SELF_APPROVAL_FORBIDDEN'; END IF;

  UPDATE public.requests SET
    status = CASE _decision WHEN 'approve' THEN 'approved'::request_status
                            WHEN 'reject' THEN 'rejected'::request_status
                            ELSE 'processing'::request_status END,
    status_note = _note,
    approved_by = CASE WHEN _decision = 'approve' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN _decision = 'approve' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = _request_id;

  PERFORM public.log_audit('request', _decision, _request_id, jsonb_build_object('status', r.status),
    jsonb_build_object('decision', _decision), _note);
END $$;
REVOKE ALL ON FUNCTION public.request_decide(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_decide(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_execute(_request_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE r public.requests; v_txn uuid; v_project uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  IF r.executed_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
  IF r.requester_id = auth.uid() THEN RAISE EXCEPTION 'SELF_EXECUTION_FORBIDDEN'; END IF;

  IF r.kind = 'custody_topup' THEN
    IF NOT public.has_perm('custody.execute_topup') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date, status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'add', r.amount, current_date, 'approved', coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'payment' THEN
    IF NOT public.has_perm('payment.execute') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date, status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'deduction', r.amount, current_date, 'approved', coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'project_create' THEN
    IF NOT public.has_perm('project.approve_create') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.created_project_id IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
    INSERT INTO public.projects (name_ar, code, supervisor_id, status, created_by, description_ar)
    VALUES (coalesce(nullif(btrim(r.notes_ar), ''), 'مشروع مقترح ' || r.request_no),
            'REQ-' || r.request_no, r.supervisor_id, 'draft', auth.uid(), r.notes_ar)
    RETURNING id INTO v_project;
    UPDATE public.requests SET created_project_id = v_project WHERE id = r.id;
    v_result := jsonb_build_object('project_id', v_project);

  ELSE
    IF NOT public.has_perm('requests.process') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    v_result := jsonb_build_object('ok', true);
  END IF;

  UPDATE public.requests
  SET executed_by = auth.uid(), executed_at = now(), status = 'completed', status_note = _note, updated_at = now()
  WHERE id = r.id;

  PERFORM public.log_audit('request', 'approve', r.id, NULL,
    jsonb_build_object('executed', true, 'kind', r.kind, 'result', v_result), coalesce(_note, 'execute'));
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.request_execute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_execute(uuid, text) TO authenticated;

-- document approval
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE OR REPLACE FUNCTION public.approve_attachment(_attachment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF NOT public.has_perm('documents.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.attachments SET approved_at = now(), approved_by = auth.uid()
  WHERE id = _attachment_id AND deleted_at IS NULL AND approved_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND_OR_APPROVED'; END IF;
  PERFORM public.log_audit('attachment', 'approve', _attachment_id, NULL, jsonb_build_object('approved', true), NULL);
END $$;
REVOKE ALL ON FUNCTION public.approve_attachment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_attachment(uuid) TO authenticated;

-- 9. reassignment ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_reassign(_request_id uuid, _assignee uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF NOT public.has_perm('requests.assign') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  UPDATE public.requests SET assigned_to = _assignee, reassign_reason = _reason, updated_at = now()
  WHERE id = _request_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM public.log_audit('request', 'update', _request_id, NULL,
    jsonb_build_object('assigned_to', _assignee), _reason);
END $$;
REVOKE ALL ON FUNCTION public.request_reassign(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_reassign(uuid, uuid, text) TO authenticated;

-- 10. login identity resolution + lockout (server-only) -------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
  identifier text PRIMARY KEY,
  fail_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resolve_login_identity(_identifier text)
RETURNS TABLE (email text, is_active boolean, locked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_key text := lower(btrim(_identifier)); v_locked boolean := false;
BEGIN
  SELECT coalesce(la.locked_until > now(), false) INTO v_locked
  FROM public.login_attempts la WHERE la.identifier = v_key;

  RETURN QUERY
  SELECT p.email, p.is_active, coalesce(v_locked, false)
  FROM public.profiles p
  WHERE lower(coalesce(p.email, '')) = v_key
     OR regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') = regexp_replace(v_key, '\D', '', 'g')
     OR (length(regexp_replace(v_key, '\D', '', 'g')) >= 9
         AND right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9)
           = right(regexp_replace(v_key, '\D', '', 'g'), 9))
  LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.resolve_login_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_identity(text) FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.register_login_result(_identifier text, _success boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_key text := lower(btrim(_identifier)); v_count int;
BEGIN
  IF _success THEN
    DELETE FROM public.login_attempts WHERE identifier = v_key;
    RETURN false;
  END IF;
  INSERT INTO public.login_attempts (identifier, fail_count, updated_at)
  VALUES (v_key, 1, now())
  ON CONFLICT (identifier) DO UPDATE
    SET fail_count = public.login_attempts.fail_count + 1, updated_at = now()
  RETURNING fail_count INTO v_count;

  IF v_count >= 5 THEN
    UPDATE public.login_attempts SET locked_until = now() + interval '15 minutes'
    WHERE identifier = v_key;
    RETURN true;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.register_login_result(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_login_result(text, boolean) FROM authenticated, anon;

-- 11. supervisor-scoped visibility ----------------------------------------
DROP POLICY IF EXISTS "supervisors self read" ON public.supervisors;
CREATE POLICY "supervisors self read" ON public.supervisors
  FOR SELECT TO authenticated
  USING (public.can_access_supervisor(id));

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_accountant());
