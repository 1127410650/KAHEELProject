ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS job_title text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS start_date date;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('new','processing','needs_info','awaiting_payment','paid','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_no text NOT NULL UNIQUE,
  request_type text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE RESTRICT,
  request_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Riyadh')::date,
  reference_no text,
  status public.request_status NOT NULL DEFAULT 'new',
  notes_ar text,
  notes_en text,
  deleted_at timestamp with time zone,
  delete_reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT requests_delete_reason_chk CHECK (deleted_at IS NULL OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);

CREATE INDEX IF NOT EXISTS requests_project_idx ON public.requests(project_id);
CREATE INDEX IF NOT EXISTS requests_supervisor_idx ON public.requests(supervisor_id);

GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requests_select_allowed ON public.requests;
CREATE POLICY requests_select_allowed ON public.requests
  FOR SELECT TO authenticated
  USING (public.is_accountant() OR public.can_access_project(project_id));

DROP POLICY IF EXISTS requests_insert_allowed ON public.requests;
CREATE POLICY requests_insert_allowed ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_accountant()
    OR (public.can_access_project(project_id) AND status = 'new' AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS requests_update_allowed ON public.requests;
CREATE POLICY requests_update_allowed ON public.requests
  FOR UPDATE TO authenticated
  USING (
    public.is_accountant()
    OR (created_by = auth.uid() AND status IN ('new','needs_info'))
  )
  WITH CHECK (
    public.is_accountant()
    OR (created_by = auth.uid() AND status IN ('new','needs_info'))
  );

DROP TRIGGER IF EXISTS requests_updated_at ON public.requests;
CREATE TRIGGER requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.request_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  from_status public.request_status,
  to_status public.request_status NOT NULL,
  actor_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_status_history_request_idx ON public.request_status_history(request_id);

GRANT SELECT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_history_select_allowed ON public.request_status_history;
CREATE POLICY request_history_select_allowed ON public.request_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = request_id
      AND (public.is_accountant() OR public.can_access_project(r.project_id))
  ));

CREATE OR REPLACE FUNCTION public.log_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.request_status_history (request_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_history (request_id, from_status, to_status, actor_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.log_request_status() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS requests_status_log ON public.requests;
CREATE TRIGGER requests_status_log AFTER INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.log_request_status();

CREATE OR REPLACE FUNCTION public.block_request_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN RAISE EXCEPTION 'Request status history is immutable'; END; $$;

DROP TRIGGER IF EXISTS request_history_no_update ON public.request_status_history;
CREATE TRIGGER request_history_no_update BEFORE UPDATE ON public.request_status_history
  FOR EACH ROW EXECUTE FUNCTION public.block_request_history_mutation();

DROP TRIGGER IF EXISTS request_history_no_delete ON public.request_status_history;
CREATE TRIGGER request_history_no_delete BEFORE DELETE ON public.request_status_history
  FOR EACH ROW EXECUTE FUNCTION public.block_request_history_mutation();