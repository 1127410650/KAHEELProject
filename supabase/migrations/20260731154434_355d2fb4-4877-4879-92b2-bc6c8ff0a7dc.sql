-- 1) Backfill new independent custody permissions for existing users
INSERT INTO public.user_permissions (user_id, permission)
SELECT up.user_id, 'custody.request_movement'
FROM public.user_permissions up
WHERE up.permission IN ('custody.view_own', 'custody.request_topup')
ON CONFLICT (user_id, permission) DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission)
SELECT up.user_id, p.perm
FROM public.user_permissions up
CROSS JOIN (VALUES ('custody.approve_movement'), ('custody.execute_movement')) AS p(perm)
WHERE up.permission = 'custody.execute_topup'
ON CONFLICT (user_id, permission) DO NOTHING;

-- 2) Custody rows are visible to a supervisor only with custody.view_own
DROP POLICY IF EXISTS custody_select_allowed ON public.custody_transactions;
CREATE POLICY custody_select_allowed ON public.custody_transactions
FOR SELECT TO authenticated
USING (
  public.is_accountant()
  OR (public.is_staff() AND project_id IS NOT NULL AND public.can_access_project(project_id))
  OR (
    public.is_supervisor_user()
    AND supervisor_id = public.current_supervisor_id()
    AND public.has_perm('custody.view_own')
  )
);

-- 3) Balances view honours the same rule (security_invoker keeps RLS in effect)
CREATE OR REPLACE VIEW public.custody_balances
WITH (security_invoker = true) AS
 SELECT s.id AS supervisor_id,
    s.name_ar,
    s.name_en,
    COALESCE(sum(
        CASE
            WHEN t.txn_type = 'reversal'::custody_txn_type THEN - public.custody_base_effect(o.txn_type, t.amount)
            ELSE public.custody_base_effect(t.txn_type, t.amount)
        END), 0::numeric)::numeric(14,2) AS balance
   FROM public.supervisors s
     LEFT JOIN public.custody_transactions t ON t.supervisor_id = s.id AND t.status = 'approved'::record_status AND t.deleted_at IS NULL
     LEFT JOIN public.custody_transactions o ON o.id = t.reversal_of_id
  WHERE public.is_staff()
     OR (s.id = public.current_supervisor_id() AND public.has_perm('custody.view_own'))
  GROUP BY s.id, s.name_ar, s.name_en;

-- 4) Submitting a custody/payment request requires the movement-request permission
CREATE OR REPLACE FUNCTION public.submit_request(_kind text, _title text DEFAULT NULL::text, _project_id uuid DEFAULT NULL::uuid, _amount numeric DEFAULT NULL::numeric, _notes_ar text DEFAULT NULL::text, _priority text DEFAULT 'normal'::text, _department text DEFAULT NULL::text, _service_type text DEFAULT NULL::text, _beneficiary text DEFAULT NULL::text, _reason text DEFAULT NULL::text, _need_date date DEFAULT NULL::date, _account_ref text DEFAULT NULL::text, _authority text DEFAULT NULL::text, _request_date date DEFAULT NULL::date, _request_type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF _kind IN ('custody_topup', 'payment')
     AND NOT (public.has_perm('custody.request_movement') OR public.has_perm('custody.request_topup')) THEN
    RAISE EXCEPTION 'CUSTODY_FORBIDDEN';
  END IF;

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
$function$;

-- 5) Same guard for the legacy portal helper
CREATE OR REPLACE FUNCTION public.submit_portal_request(_kind text, _request_type text DEFAULT NULL::text, _project_id uuid DEFAULT NULL::uuid, _amount numeric DEFAULT NULL::numeric, _notes_ar text DEFAULT NULL::text, _authority text DEFAULT NULL::text, _request_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.submit_request(
    _kind := _kind,
    _title := coalesce(nullif(btrim(coalesce(_request_type, '')), ''), _kind),
    _project_id := _project_id,
    _amount := _amount,
    _notes_ar := _notes_ar,
    _authority := _authority,
    _request_date := _request_date,
    _request_type := _request_type
  );
END
$function$;

-- 6) Approval of custody/payment requests requires the approve-movement permission
CREATE OR REPLACE FUNCTION public.request_decide(_request_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.requester_id = auth.uid() AND NOT public.is_accountant() THEN
    RAISE EXCEPTION 'SELF_DECISION_FORBIDDEN';
  END IF;

  IF _decision = 'approve' THEN
    IF NOT public.has_perm('requests.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.kind IN ('custody_topup', 'payment')
       AND NOT (public.has_perm('custody.approve_movement') OR public.has_perm('requests.approve')) THEN
      RAISE EXCEPTION 'CUSTODY_FORBIDDEN';
    END IF;
    PERFORM public.request_set_status(_request_id, 'approved', _note);
  ELSIF _decision = 'reject' THEN
    IF NOT public.has_perm('requests.reject') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    PERFORM public.request_set_status(_request_id, 'rejected', _note);
  ELSE
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
END
$function$;

-- 7) Execution requires the execute-movement permission and stays single-shot
CREATE OR REPLACE FUNCTION public.request_execute(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.requests; v_txn uuid; v_project uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  IF r.executed_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
  IF r.requester_id = auth.uid() THEN RAISE EXCEPTION 'SELF_EXECUTION_FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.custody_transactions ct WHERE ct.request_id = r.id AND ct.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'ALREADY_EXECUTED';
  END IF;

  IF r.kind = 'custody_topup' THEN
    IF NOT (public.has_perm('custody.execute_movement') OR public.has_perm('custody.execute_topup')) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date, status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'add', r.amount, current_date, 'approved', coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'payment' THEN
    IF NOT (public.has_perm('custody.execute_movement') OR public.has_perm('payment.execute')) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.request_execute(_request_id uuid, _note text DEFAULT NULL::text, _reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.requests; v_txn uuid; v_project uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.status NOT IN ('approved', 'awaiting_execution') THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  IF r.executed_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
  IF r.requester_id = auth.uid() THEN RAISE EXCEPTION 'SELF_EXECUTION_FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.custody_transactions ct WHERE ct.request_id = r.id AND ct.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'ALREADY_EXECUTED';
  END IF;

  IF r.kind = 'custody_topup' THEN
    IF NOT (public.has_perm('custody.execute_movement') OR public.has_perm('custody.execute_topup')) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date, status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'add', r.amount, current_date, 'approved', coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'payment' THEN
    IF NOT (public.has_perm('custody.execute_movement') OR public.has_perm('payment.execute')) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
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

  ELSIF r.kind = 'document_upload' THEN
    IF NOT public.has_perm('documents.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    UPDATE public.attachments
       SET approved_by = auth.uid(), approved_at = now(),
           project_id = coalesce(project_id, r.project_id)
     WHERE entity_type = 'request' AND entity_id = r.id AND deleted_at IS NULL AND approved_at IS NULL;
    v_result := jsonb_build_object('documents_linked', true);

  ELSE
    IF NOT public.has_perm('requests.process') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    v_result := jsonb_build_object('ok', true);
  END IF;

  UPDATE public.requests
     SET executed_by = auth.uid(), executed_at = now(), status = 'executed',
         status_note = _note, execution_reference = _reference, updated_at = now()
   WHERE id = r.id;

  PERFORM public.log_audit('request', 'approve', r.id, NULL,
    jsonb_build_object('executed', true, 'kind', r.kind, 'result', v_result), coalesce(_note, 'execute'));
  PERFORM public.notify_request(r.id, 'request_executed', 'تم تنفيذ الطلب ' || r.request_no, _note);
  RETURN v_result;
END $function$;

REVOKE ALL ON FUNCTION public.request_decide(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_execute(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_execute(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_request(text, text, uuid, numeric, text, text, text, text, text, text, date, text, text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_portal_request(text, text, uuid, numeric, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_decide(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_execute(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_execute(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_request(text, text, uuid, numeric, text, text, text, text, text, text, date, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_portal_request(text, text, uuid, numeric, text, text, date) TO authenticated;