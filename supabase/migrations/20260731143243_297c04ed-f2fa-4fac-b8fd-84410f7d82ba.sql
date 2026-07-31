-- ============ requests: new fields ============
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS beneficiary text,
  ADD COLUMN IF NOT EXISTS need_date date,
  ADD COLUMN IF NOT EXISTS account_ref text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS info_state text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS execution_reference text;

-- ============ attachments: versioning + hash + role ============
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploader_role text,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_requested_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS attachments_hash_unique
  ON public.attachments (entity_type, entity_id, file_hash)
  WHERE file_hash IS NOT NULL AND deleted_at IS NULL;

-- ============ reminders: targeting, follow-up, dedupe ============
ALTER TABLE public.request_reminders
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS client_token text;

CREATE UNIQUE INDEX IF NOT EXISTS request_reminders_token_unique
  ON public.request_reminders (request_id, actor_id, client_token)
  WHERE client_token IS NOT NULL;

-- ============ status history: richer trail ============
ALTER TABLE public.request_status_history
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS department text;

-- ============ access helper ============
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (
        public.is_accountant()
        OR r.requester_id = auth.uid()
        OR r.created_by = auth.uid()
        OR r.assigned_to = auth.uid()
        OR (r.supervisor_id IS NOT NULL AND r.supervisor_id = public.current_supervisor_id())
        OR (r.project_id IS NOT NULL AND public.can_access_project(r.project_id))
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_role_label()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'accountant') THEN 'accountant'
    WHEN public.current_supervisor_id() IS NOT NULL THEN 'supervisor'
    WHEN public.has_role(auth.uid(), 'employee') THEN 'employee'
    ELSE 'user' END;
$$;
REVOKE EXECUTE ON FUNCTION public.current_role_label() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role_label() TO authenticated, service_role;

-- ============ conversation ============
CREATE TABLE IF NOT EXISTS public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id uuid,
  author_role text,
  body text NOT NULL,
  msg_kind text NOT NULL DEFAULT 'message',
  reply_to_id uuid REFERENCES public.request_messages(id) ON DELETE SET NULL,
  is_draft boolean NOT NULL DEFAULT false,
  due_date date,
  priority text,
  items jsonb,
  client_token text,
  deleted_at timestamptz,
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_messages_request_idx ON public.request_messages (request_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS request_messages_token_unique
  ON public.request_messages (request_id, author_id, client_token) WHERE client_token IS NOT NULL;

GRANT SELECT ON public.request_messages TO authenticated;
GRANT ALL ON public.request_messages TO service_role;
ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_messages_read ON public.request_messages;
CREATE POLICY request_messages_read ON public.request_messages FOR SELECT TO authenticated
  USING (public.can_access_request(request_id) AND (is_draft = false OR author_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.request_message_reads (
  message_id uuid NOT NULL REFERENCES public.request_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT ON public.request_message_reads TO authenticated;
GRANT ALL ON public.request_message_reads TO service_role;
ALTER TABLE public.request_message_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_message_reads_own ON public.request_message_reads;
CREATE POLICY request_message_reads_own ON public.request_message_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS request_message_reads_insert ON public.request_message_reads;
CREATE POLICY request_message_reads_insert ON public.request_message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.request_messages(id) ON DELETE SET NULL,
  event text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, read_at, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own_read ON public.notifications;
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ change / delete sub-requests ============
CREATE TABLE IF NOT EXISTS public.request_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  field_name text,
  old_value text,
  new_value text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  requested_role text,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  executed_by uuid,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_change_requests_request_idx
  ON public.request_change_requests (request_id, created_at);
GRANT SELECT ON public.request_change_requests TO authenticated;
GRANT ALL ON public.request_change_requests TO service_role;
ALTER TABLE public.request_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_change_requests_read ON public.request_change_requests;
CREATE POLICY request_change_requests_read ON public.request_change_requests FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

-- ============ field versions (old values kept forever) ============
CREATE TABLE IF NOT EXISTS public.request_field_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  change_request_id uuid REFERENCES public.request_change_requests(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.request_field_versions TO authenticated;
GRANT ALL ON public.request_field_versions TO service_role;
ALTER TABLE public.request_field_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_field_versions_read ON public.request_field_versions;
CREATE POLICY request_field_versions_read ON public.request_field_versions FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

-- ============ requests RLS refresh (visibility by role) ============
DROP POLICY IF EXISTS requests_select ON public.requests;
CREATE POLICY requests_select ON public.requests FOR SELECT TO authenticated
  USING (
    public.is_accountant()
    OR requester_id = auth.uid()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (supervisor_id IS NOT NULL AND supervisor_id = public.current_supervisor_id())
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
  );