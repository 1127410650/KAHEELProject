CREATE OR REPLACE FUNCTION public.set_request_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.request_scope := CASE
    WHEN NEW.kind = 'custody_topup' THEN 'custody'
    WHEN NEW.kind = 'payment' THEN 'payment'
    WHEN NEW.kind IN ('general', 'project_create') THEN 'general'
    WHEN NEW.project_id IS NOT NULL THEN 'project'
    ELSE 'general'
  END;

  IF NEW.request_scope = 'project' AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.submit_request(
  _kind text,
  _title text DEFAULT NULL::text,
  _project_id uuid DEFAULT NULL::uuid,
  _amount numeric DEFAULT NULL::numeric,
  _notes_ar text DEFAULT NULL::text,
  _priority text DEFAULT 'normal'::text,
  _department text DEFAULT NULL::text,
  _service_type text DEFAULT NULL::text,
  _beneficiary text DEFAULT NULL::text,
  _reason text DEFAULT NULL::text,
  _need_date date DEFAULT NULL::date,
  _account_ref text DEFAULT NULL::text,
  _authority text DEFAULT NULL::text,
  _request_date date DEFAULT NULL::date,
  _request_type text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _sup uuid;
  _no text;
  _id uuid;
  _scope text;
BEGIN
  IF NOT (public.is_supervisor_user() OR public.has_perm('requests.create')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _kind IS NULL OR _kind = '' THEN RAISE EXCEPTION 'KIND_REQUIRED'; END IF;
  IF coalesce(btrim(coalesce(_title, _notes_ar, '')), '') = '' THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;

  IF _kind NOT IN ('project_create', 'general') AND _project_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_REQUIRED';
  END IF;
  IF _project_id IS NOT NULL AND NOT public.can_access_project(_project_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _kind IN ('custody_topup', 'payment') AND (_amount IS NULL OR _amount <= 0) THEN
    RAISE EXCEPTION 'AMOUNT_REQUIRED';
  END IF;
  IF _kind = 'payment' AND coalesce(btrim(coalesce(_beneficiary, '')), '') = '' THEN
    RAISE EXCEPTION 'BENEFICIARY_REQUIRED';
  END IF;

  _scope := CASE
    WHEN _kind = 'custody_topup' THEN 'custody'
    WHEN _kind = 'payment' THEN 'payment'
    WHEN _kind IN ('general', 'project_create') THEN 'general'
    WHEN _project_id IS NOT NULL THEN 'project'
    ELSE 'general'
  END;
  _sup := public.current_supervisor_id();
  _no := 'PR-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMMDD') || '-' ||
         lpad((SELECT (count(*) + 1)::text FROM public.requests
               WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh')), 3, '0');

  INSERT INTO public.requests (
    request_no, request_type, kind, request_scope, title, project_id, supervisor_id, amount,
    notes_ar, priority, department, service_type, beneficiary, reason, need_date, account_ref,
    authority, request_date, status, info_state, requester_id, created_by
  ) VALUES (
    _no, coalesce(nullif(_request_type, ''), _kind), _kind, _scope,
    nullif(btrim(coalesce(_title, '')), ''), _project_id, _sup, _amount,
    _notes_ar, coalesce(nullif(_priority, ''), 'normal'), _department, _service_type,
    _beneficiary, _reason, _need_date, _account_ref, _authority,
    coalesce(_request_date, (now() AT TIME ZONE 'Asia/Riyadh')::date),
    'awaiting_reply', 'not_needed', auth.uid(), auth.uid()
  ) RETURNING id INTO _id;

  PERFORM public.log_audit('request', 'create', _id, NULL,
    jsonb_build_object('kind', _kind, 'request_scope', _scope, 'amount', _amount, 'source', 'portal'), NULL);
  PERFORM public.notify_request(_id, 'request_created', 'طلب جديد: ' || _no, coalesce(_title, _notes_ar));
  RETURN _id;
END
$$;

REVOKE ALL ON FUNCTION public.submit_request(text,text,uuid,numeric,text,text,text,text,text,text,date,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_request(text,text,uuid,numeric,text,text,text,text,text,text,date,text,text,date,text) TO authenticated;

DROP POLICY IF EXISTS custody_select_allowed ON public.custody_transactions;
CREATE POLICY custody_select_allowed ON public.custody_transactions
FOR SELECT TO authenticated
USING (
  public.is_accountant()
  OR (public.is_staff() AND project_id IS NOT NULL AND public.can_access_project(project_id))
  OR (public.is_supervisor_user() AND supervisor_id = public.current_supervisor_id())
);

DROP POLICY IF EXISTS custody_insert_allowed ON public.custody_transactions;
CREATE POLICY custody_insert_allowed ON public.custody_transactions
FOR INSERT TO authenticated
WITH CHECK (
  public.is_accountant()
  OR (public.is_staff() AND project_id IS NOT NULL AND public.can_access_project(project_id) AND status = 'draft')
);

DROP POLICY IF EXISTS invoices_select_scoped ON public.invoices;
CREATE POLICY invoices_select_scoped ON public.invoices
FOR SELECT TO authenticated
USING (
  public.is_accountant()
  OR (public.is_staff() AND public.can_access_project(project_id))
  OR (public.is_supervisor_user() AND supervisor_id = public.current_supervisor_id())
);

DROP POLICY IF EXISTS invoices_insert_scoped ON public.invoices;
CREATE POLICY invoices_insert_scoped ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  public.is_accountant()
  OR (public.is_staff() AND public.can_access_project(project_id))
);

DROP POLICY IF EXISTS invoices_update_scoped ON public.invoices;
CREATE POLICY invoices_update_scoped ON public.invoices
FOR UPDATE TO authenticated
USING (
  public.is_accountant()
  OR (public.is_staff() AND public.can_access_project(project_id))
)
WITH CHECK (
  public.is_accountant()
  OR (public.is_staff() AND public.can_access_project(project_id))
);

ALTER VIEW public.custody_balances SET (security_invoker = true);

REVOKE ALL ON public.custody_transactions FROM anon;
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.custody_balances FROM anon;
GRANT SELECT ON public.custody_balances TO authenticated;