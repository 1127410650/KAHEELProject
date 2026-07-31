-- 0) BACKUP -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS backup_20260731;
REVOKE ALL ON SCHEMA backup_20260731 FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_20260731.requests AS SELECT * FROM public.requests;
CREATE TABLE IF NOT EXISTS backup_20260731.request_messages AS SELECT * FROM public.request_messages;
CREATE TABLE IF NOT EXISTS backup_20260731.project_supervisors AS SELECT * FROM public.project_supervisors;
CREATE TABLE IF NOT EXISTS backup_20260731.projects AS SELECT * FROM public.projects;
CREATE TABLE IF NOT EXISTS backup_20260731.user_permissions AS SELECT * FROM public.user_permissions;

-- 1) PROJECT SUPERVISOR MEMBERSHIPS -------------------------------------
ALTER TABLE public.project_supervisors
  ADD COLUMN IF NOT EXISTS membership_type text NOT NULL DEFAULT 'partner',
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS ended_by uuid,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.project_supervisors DROP CONSTRAINT IF EXISTS project_supervisors_type_chk;
ALTER TABLE public.project_supervisors ADD CONSTRAINT project_supervisors_type_chk
  CHECK (membership_type IN ('primary','partner','site','followup'));

-- backfill legacy single supervisor as the primary membership
INSERT INTO public.project_supervisors (project_id, supervisor_id, membership_type, created_by)
SELECT p.id, p.supervisor_id, 'primary', p.created_by
FROM public.projects p
WHERE p.supervisor_id IS NOT NULL
ON CONFLICT (project_id, supervisor_id) DO UPDATE
  SET membership_type = 'primary', is_active = true, end_date = NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_supervisors_one_primary
  ON public.project_supervisors (project_id)
  WHERE membership_type = 'primary' AND is_active;

CREATE INDEX IF NOT EXISTS project_supervisors_supervisor_idx
  ON public.project_supervisors (supervisor_id) WHERE is_active;

GRANT SELECT ON public.project_supervisors TO authenticated;
GRANT ALL ON public.project_supervisors TO service_role;
ALTER TABLE public.project_supervisors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_supervisors_read ON public.project_supervisors;
CREATE POLICY project_supervisors_read ON public.project_supervisors
  FOR SELECT TO authenticated USING (public.can_access_project(project_id));

DROP TRIGGER IF EXISTS project_supervisors_touch ON public.project_supervisors;
CREATE TRIGGER project_supervisors_touch BEFORE UPDATE ON public.project_supervisors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) REQUEST SCOPE ------------------------------------------------------
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS request_scope text;
UPDATE public.requests SET request_scope = CASE
    WHEN kind = 'custody_topup' THEN 'custody'
    WHEN kind = 'payment' THEN 'payment'
    WHEN kind IN ('general','project_create') THEN 'general'
    WHEN project_id IS NOT NULL THEN 'project'
    ELSE 'general' END
  WHERE request_scope IS NULL;
ALTER TABLE public.requests ALTER COLUMN request_scope SET DEFAULT 'general';
ALTER TABLE public.requests ALTER COLUMN request_scope SET NOT NULL;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_scope_chk;
ALTER TABLE public.requests ADD CONSTRAINT requests_scope_chk
  CHECK (request_scope IN ('general','project','custody','payment'));

CREATE OR REPLACE FUNCTION public.set_request_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_scope IS NULL THEN
    NEW.request_scope := CASE
      WHEN NEW.kind = 'custody_topup' THEN 'custody'
      WHEN NEW.kind = 'payment' THEN 'payment'
      WHEN NEW.kind IN ('general','project_create') THEN 'general'
      WHEN NEW.project_id IS NOT NULL THEN 'project'
      ELSE 'general' END;
  END IF;
  IF NEW.request_scope = 'project' AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS requests_set_scope ON public.requests;
CREATE TRIGGER requests_set_scope BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_scope();

-- 3) MESSAGE VISIBILITY -------------------------------------------------
ALTER TABLE public.request_messages
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'shared';
ALTER TABLE public.request_messages DROP CONSTRAINT IF EXISTS request_messages_visibility_chk;
ALTER TABLE public.request_messages ADD CONSTRAINT request_messages_visibility_chk
  CHECK (visibility IN ('shared','internal','requester_only'));

-- 4) ACCESS FUNCTIONS ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT public.is_accountant()
    OR EXISTS (SELECT 1 FROM public.project_members pm
                WHERE pm.project_id = _project_id AND pm.user_id = auth.uid())
    OR (public.current_supervisor_id() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.project_supervisors ps
           WHERE ps.project_id = _project_id
             AND ps.supervisor_id = public.current_supervisor_id()
             AND ps.is_active
             AND ps.start_date <= current_date
             AND (ps.end_date IS NULL OR ps.end_date >= current_date)));
$$;

CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (
        public.is_accountant()
        OR r.requester_id = auth.uid()
        OR r.created_by = auth.uid()
        OR r.assigned_to = auth.uid()
        OR (r.supervisor_id IS NOT NULL AND r.supervisor_id = public.current_supervisor_id()
            AND r.request_scope IN ('custody','payment','general','project'))
        OR (public.is_staff() AND (
              r.request_scope IN ('general','custody','payment')
                AND (public.has_perm('general_requests.view_assigned')
                     OR public.has_perm('general_requests.manage'))
              OR (r.project_id IS NOT NULL AND public.can_access_project(r.project_id))))
        OR (r.request_scope = 'project' AND r.project_id IS NOT NULL
            AND public.has_perm('project_requests.view')
            AND public.can_access_project(r.project_id))
      )
  );
$$;

-- requests list policy mirrors can_access_request (scope isolation included)
DROP POLICY IF EXISTS requests_select ON public.requests;
CREATE POLICY requests_select ON public.requests FOR SELECT TO authenticated
  USING (public.can_access_request(id));

-- message read policy honours visibility
DROP POLICY IF EXISTS request_messages_read ON public.request_messages;
CREATE POLICY request_messages_read ON public.request_messages
  FOR SELECT TO authenticated USING (
    public.can_access_request(request_id)
    AND (is_draft = false OR author_id = auth.uid())
    AND (
      visibility = 'shared'
      OR author_id = auth.uid()
      OR (visibility = 'internal' AND public.is_staff())
      OR (visibility = 'requester_only' AND (
            public.is_staff()
            OR EXISTS (SELECT 1 FROM public.requests r
                        WHERE r.id = request_id
                          AND (r.requester_id = auth.uid() OR r.created_by = auth.uid()))))
    )
  );

-- 5) POST MESSAGE WITH VISIBILITY --------------------------------------
DROP FUNCTION IF EXISTS public.request_post_message(uuid, text, uuid, text, text, boolean);
CREATE OR REPLACE FUNCTION public.request_post_message(
  _request_id uuid, _body text, _reply_to uuid DEFAULT NULL::uuid,
  _client_token text DEFAULT NULL::text, _msg_kind text DEFAULT 'message'::text,
  _is_draft boolean DEFAULT false, _visibility text DEFAULT 'shared'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; r public.requests; _vis text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(btrim(coalesce(_body,'')), '') = '' THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id;

  _vis := coalesce(nullif(btrim(coalesce(_visibility,'')), ''), 'shared');
  IF _vis NOT IN ('shared','internal','requester_only') THEN _vis := 'shared'; END IF;
  IF _vis <> 'shared' AND NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  INSERT INTO public.request_messages
    (request_id, author_id, author_role, body, msg_kind, reply_to_id, client_token, is_draft, visibility)
  VALUES (_request_id, auth.uid(), public.current_role_label(), btrim(_body),
          coalesce(_msg_kind, 'message'), _reply_to, _client_token, coalesce(_is_draft, false), _vis)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.request_messages
    WHERE request_id = _request_id AND author_id = auth.uid() AND client_token = _client_token;
    RETURN _id;
  END IF;

  IF NOT coalesce(_is_draft, false) THEN
    PERFORM public.log_audit('request_message', 'create', _id, NULL,
      jsonb_build_object('request_id', _request_id, 'kind', _msg_kind, 'visibility', _vis), NULL);
    IF _vis = 'shared' THEN
      PERFORM public.notify_request(_request_id,
        CASE WHEN _msg_kind = 'reminder' THEN 'reminder_added' ELSE 'message_added' END,
        'رسالة جديدة على الطلب ' || r.request_no, left(btrim(_body), 140), _id);
    END IF;
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.request_post_message(uuid, text, uuid, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_post_message(uuid, text, uuid, text, text, boolean, text) TO authenticated;

-- 6) MEMBERSHIP MANAGEMENT RPCS ---------------------------------------
CREATE OR REPLACE FUNCTION public.project_membership_set(
  _project_id uuid, _supervisor_id uuid, _membership_type text DEFAULT 'partner',
  _start_date date DEFAULT NULL, _end_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid;
BEGIN
  IF NOT (public.is_accountant() OR public.has_perm('projects.manage_supervisors')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _membership_type NOT IN ('primary','partner','site','followup') THEN
    RAISE EXCEPTION 'INVALID_TYPE';
  END IF;
  IF _membership_type = 'primary' THEN
    UPDATE public.project_supervisors
       SET membership_type = 'partner'
     WHERE project_id = _project_id AND membership_type = 'primary'
       AND is_active AND supervisor_id <> _supervisor_id;
  END IF;

  INSERT INTO public.project_supervisors
    (project_id, supervisor_id, membership_type, start_date, end_date, is_active, created_by)
  VALUES (_project_id, _supervisor_id, _membership_type,
          coalesce(_start_date, current_date), _end_date, true, auth.uid())
  ON CONFLICT (project_id, supervisor_id) DO UPDATE
    SET membership_type = excluded.membership_type,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        is_active = true,
        ended_by = NULL,
        end_reason = NULL
  RETURNING id INTO _id;

  IF _membership_type = 'primary' THEN
    UPDATE public.projects SET supervisor_id = _supervisor_id WHERE id = _project_id;
  END IF;

  PERFORM public.log_audit('project_supervisor', 'update', _id, NULL,
    jsonb_build_object('project_id', _project_id, 'supervisor_id', _supervisor_id,
                       'membership_type', _membership_type), NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.project_membership_end(_membership_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row public.project_supervisors;
BEGIN
  IF NOT (public.is_accountant() OR public.has_perm('projects.manage_supervisors')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF coalesce(btrim(coalesce(_reason,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO _row FROM public.project_supervisors WHERE id = _membership_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.project_supervisors
     SET is_active = false,
         end_date = coalesce(end_date, current_date),
         ended_by = auth.uid(),
         end_reason = btrim(_reason)
   WHERE id = _membership_id;

  PERFORM public.log_audit('project_supervisor', 'soft_delete', _membership_id,
    to_jsonb(_row), NULL, btrim(_reason));
END $$;

CREATE OR REPLACE FUNCTION public.request_convert_to_project(
  _request_id uuid, _project_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _old public.requests;
BEGIN
  IF NOT public.is_accountant() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(coalesce(_reason,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO _old FROM public.requests WHERE id = _request_id AND deleted_at IS NULL;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.requests
     SET request_scope = 'project', project_id = _project_id
   WHERE id = _request_id;

  PERFORM public.log_audit('request', 'update', _request_id, to_jsonb(_old),
    jsonb_build_object('request_scope', 'project', 'project_id', _project_id), btrim(_reason));
END $$;

REVOKE ALL ON FUNCTION public.project_membership_set(uuid, uuid, text, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_membership_end(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_convert_to_project(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_membership_set(uuid, uuid, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_membership_end(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_convert_to_project(uuid, uuid, text) TO authenticated;

-- 7) PERMISSION SEEDS FOR EXISTING ACCOUNTS ---------------------------
INSERT INTO public.user_permissions (user_id, permission)
SELECT ur.user_id, p.perm
FROM public.user_roles ur
CROSS JOIN (VALUES
  ('projects.view_assigned'), ('project_requests.view'), ('project_requests.create'),
  ('custody.view_own'), ('request_messages.view_shared'), ('reminders.send')
) AS p(perm)
WHERE ur.role = 'supervisor'
  AND NOT EXISTS (SELECT 1 FROM public.user_permissions up
                   WHERE up.user_id = ur.user_id AND up.permission = p.perm);

INSERT INTO public.user_permissions (user_id, permission)
SELECT ur.user_id, p.perm
FROM public.user_roles ur
CROSS JOIN (VALUES
  ('projects.view_assigned'), ('project_requests.view'),
  ('general_requests.view_assigned'), ('request_messages.view_shared'),
  ('request_messages.view_internal'), ('reminders.send')
) AS p(perm)
WHERE ur.role = 'employee'
  AND NOT EXISTS (SELECT 1 FROM public.user_permissions up
                   WHERE up.user_id = ur.user_id AND up.permission = p.perm);