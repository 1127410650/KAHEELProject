-- ================= change / delete requests =================
CREATE OR REPLACE FUNCTION public.change_request_create(
  _request_id uuid, _action text, _target_type text, _reason text,
  _target_id uuid DEFAULT NULL, _field_name text DEFAULT NULL,
  _old_value text DEFAULT NULL, _new_value text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _action NOT IN ('edit','delete') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF _target_type NOT IN ('request','attachment','project') THEN RAISE EXCEPTION 'INVALID_TARGET'; END IF;
  IF coalesce(btrim(coalesce(_reason,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _action = 'edit' AND coalesce(btrim(coalesce(_field_name,'')), '') = '' THEN
    RAISE EXCEPTION 'FIELD_REQUIRED';
  END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  INSERT INTO public.request_change_requests
    (request_id, action, target_type, target_id, field_name, old_value, new_value,
     reason, requested_by, requested_role)
  VALUES (_request_id, _action, _target_type, _target_id, nullif(btrim(coalesce(_field_name,'')), ''),
          _old_value, _new_value, btrim(_reason), auth.uid(), public.current_role_label())
  RETURNING id INTO _id;

  IF _action = 'delete' AND _target_type = 'attachment' AND _target_id IS NOT NULL THEN
    UPDATE public.attachments SET delete_requested_by = auth.uid() WHERE id = _target_id;
  END IF;

  PERFORM public.log_audit('request_change', 'create', _id, NULL,
    jsonb_build_object('request_id', _request_id, 'action', _action, 'target_type', _target_type,
                       'field', _field_name, 'old', _old_value, 'new', _new_value), btrim(_reason));
  PERFORM public.notify_request(_request_id,
    CASE WHEN _action = 'edit' THEN 'edit_requested' ELSE 'delete_requested' END,
    CASE WHEN _action = 'edit' THEN 'طلب تعديل على الطلب ' ELSE 'طلب حذف على الطلب ' END || r.request_no,
    btrim(_reason));
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.change_request_create(uuid,text,text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_request_create(uuid,text,text,text,uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.change_request_decide(
  _change_id uuid, _decision text, _reason text DEFAULT NULL, _new_value text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.request_change_requests; rq public.requests;
BEGIN
  IF NOT public.is_accountant() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  SELECT * INTO c FROM public.request_change_requests WHERE id = _change_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
  IF _decision = 'reject' AND coalesce(btrim(coalesce(_reason,'')), '') = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  UPDATE public.request_change_requests
     SET status = CASE _decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
         new_value = CASE WHEN _decision = 'approve' AND _new_value IS NOT NULL THEN _new_value ELSE new_value END,
         decided_by = auth.uid(), decided_at = now(), decision_reason = _reason
   WHERE id = _change_id;

  SELECT * INTO rq FROM public.requests WHERE id = c.request_id;
  PERFORM public.log_audit('request_change', _decision, _change_id, NULL,
    jsonb_build_object('decision', _decision), _reason);
  PERFORM public.notify_request(c.request_id,
    CASE WHEN c.action = 'edit' THEN 'edit_' ELSE 'delete_' END || _decision || 'd',
    'قرار على طلب ' || CASE WHEN c.action = 'edit' THEN 'التعديل' ELSE 'الحذف' END ||
      ' في ' || coalesce(rq.request_no, ''), _reason);
END $$;
REVOKE EXECUTE ON FUNCTION public.change_request_decide(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_request_decide(uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.change_request_execute(_change_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.request_change_requests; _old text; _sql text;
BEGIN
  IF NOT public.is_accountant() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM public.request_change_requests WHERE id = _change_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status = 'executed' THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
  IF c.status <> 'approved' THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;

  IF c.action = 'delete' THEN
    IF c.target_type = 'attachment' THEN
      UPDATE public.attachments
         SET deleted_at = now(), deleted_by = auth.uid(), delete_reason = c.reason
       WHERE id = c.target_id AND deleted_at IS NULL;
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_TARGET';
    END IF;

  ELSIF c.action = 'edit' THEN
    IF c.target_type = 'request' THEN
      IF c.field_name NOT IN ('title','notes_ar','notes_en','amount','request_date','need_date',
            'beneficiary','reason','department','service_type','account_ref','authority',
            'reference_no','priority','due_date','payment_no','payment_reference') THEN
        RAISE EXCEPTION 'FIELD_NOT_EDITABLE';
      END IF;
      EXECUTE format('SELECT (%I)::text FROM public.requests WHERE id = $1', c.field_name)
        INTO _old USING c.request_id;
      _sql := format('UPDATE public.requests SET %I = $1, updated_at = now() WHERE id = $2', c.field_name);
      IF c.field_name IN ('amount') THEN
        EXECUTE _sql USING nullif(c.new_value, '')::numeric, c.request_id;
      ELSIF c.field_name IN ('request_date','need_date','due_date') THEN
        EXECUTE _sql USING nullif(c.new_value, '')::date, c.request_id;
      ELSE
        EXECUTE _sql USING nullif(c.new_value, ''), c.request_id;
      END IF;

    ELSIF c.target_type = 'attachment' THEN
      IF c.field_name NOT IN ('note','kind','file_name') THEN RAISE EXCEPTION 'FIELD_NOT_EDITABLE'; END IF;
      EXECUTE format('SELECT (%I)::text FROM public.attachments WHERE id = $1', c.field_name)
        INTO _old USING c.target_id;
      EXECUTE format('UPDATE public.attachments SET %I = $1 WHERE id = $2', c.field_name)
        USING nullif(c.new_value, ''), c.target_id;

    ELSIF c.target_type = 'project' THEN
      IF c.field_name NOT IN ('name_ar','name_en','city','location','description_ar','description_en') THEN
        RAISE EXCEPTION 'FIELD_NOT_EDITABLE';
      END IF;
      EXECUTE format('SELECT (%I)::text FROM public.projects WHERE id = $1', c.field_name)
        INTO _old USING c.target_id;
      EXECUTE format('UPDATE public.projects SET %I = $1, updated_at = now() WHERE id = $2', c.field_name)
        USING nullif(c.new_value, ''), c.target_id;
    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_TARGET';
    END IF;

    INSERT INTO public.request_field_versions
      (request_id, change_request_id, target_type, target_id, field_name, old_value, new_value, changed_by)
    VALUES (c.request_id, c.id, c.target_type, coalesce(c.target_id, c.request_id),
            c.field_name, _old, c.new_value, auth.uid());
  END IF;

  UPDATE public.request_change_requests
     SET status = 'executed', executed_by = auth.uid(), executed_at = now() WHERE id = _change_id;

  PERFORM public.log_audit('request_change', 'update', _change_id,
    jsonb_build_object('old', _old), jsonb_build_object('executed', true, 'new', c.new_value), c.reason);
  PERFORM public.notify_request(c.request_id, 'change_executed', 'تم تنفيذ الإجراء المعتمد', c.reason);
END $$;
REVOKE EXECUTE ON FUNCTION public.change_request_execute(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_request_execute(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attachment_restore(_attachment_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid;
BEGIN
  IF NOT public.is_accountant() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.attachments
     SET deleted_at = NULL, delete_reason = NULL, deleted_by = NULL, delete_requested_by = NULL
   WHERE id = _attachment_id RETURNING entity_id INTO _req;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM public.log_audit('attachment', 'restore', _attachment_id, NULL,
    jsonb_build_object('restored', true), _reason);
END $$;
REVOKE EXECUTE ON FUNCTION public.attachment_restore(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attachment_restore(uuid, text) TO authenticated, service_role;

-- ================= approve / execute / reopen =================
CREATE OR REPLACE FUNCTION public.request_decide(
  _request_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _decision = 'approve' AND NOT public.has_perm('requests.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision = 'reject' AND NOT public.has_perm('requests.reject') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision = 'approve' AND r.requester_id = auth.uid() THEN RAISE EXCEPTION 'SELF_APPROVAL_FORBIDDEN'; END IF;
  IF _decision = 'reject' AND coalesce(btrim(coalesce(_note,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  IF _decision = 'approve' THEN
    IF r.status::text <> 'awaiting_approval' THEN
      IF public.request_can_transition(r.status::text, 'awaiting_approval') THEN
        UPDATE public.requests SET status = 'awaiting_approval', updated_at = now() WHERE id = _request_id;
      ELSE
        RAISE EXCEPTION 'INVALID_TRANSITION';
      END IF;
    END IF;
    UPDATE public.requests SET status = 'approved', status_note = _note,
           approved_by = auth.uid(), approved_at = now(), updated_at = now()
     WHERE id = _request_id;
    UPDATE public.requests SET status = 'awaiting_execution', updated_at = now() WHERE id = _request_id;
  ELSE
    UPDATE public.requests SET status = 'rejected', status_note = _note,
           reject_reason = btrim(_note), closed_at = now(), updated_at = now()
     WHERE id = _request_id;
  END IF;

  PERFORM public.log_audit('request', _decision, _request_id,
    jsonb_build_object('status', r.status), jsonb_build_object('decision', _decision), _note);
  PERFORM public.notify_request(_request_id, 'request_' || _decision || 'd',
    CASE WHEN _decision = 'approve' THEN 'تم اعتماد الطلب ' ELSE 'تم رفض الطلب ' END || r.request_no, _note);
END $$;

CREATE OR REPLACE FUNCTION public.request_execute(
  _request_id uuid, _note text DEFAULT NULL, _reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests; v_txn uuid; v_project uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.executed_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
  IF r.approved_at IS NULL THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  IF r.status::text NOT IN ('approved','awaiting_execution','executing') THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  IF r.requester_id = auth.uid() THEN RAISE EXCEPTION 'SELF_EXECUTION_FORBIDDEN'; END IF;

  IF r.status::text <> 'executing' THEN
    IF r.status::text = 'approved' THEN
      UPDATE public.requests SET status = 'awaiting_execution', updated_at = now() WHERE id = r.id;
    END IF;
    UPDATE public.requests SET status = 'executing', updated_at = now() WHERE id = r.id;
  END IF;

  IF r.kind = 'custody_topup' THEN
    IF NOT public.has_perm('custody.execute_topup') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    IF EXISTS (SELECT 1 FROM public.custody_transactions WHERE request_id = r.id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'ALREADY_EXECUTED';
    END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date,
        status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'add', r.amount, current_date, 'approved',
        coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'payment' THEN
    IF NOT public.has_perm('payment.execute') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.supervisor_id IS NULL OR coalesce(r.amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    IF EXISTS (SELECT 1 FROM public.custody_transactions WHERE request_id = r.id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'ALREADY_EXECUTED';
    END IF;
    INSERT INTO public.custody_transactions (supervisor_id, project_id, txn_type, amount, txn_date,
        status, notes_ar, request_id, created_by)
    VALUES (r.supervisor_id, r.project_id, 'deduction', r.amount, current_date, 'approved',
        coalesce(_note, r.notes_ar), r.id, auth.uid())
    RETURNING id INTO v_txn;
    v_result := jsonb_build_object('custody_transaction_id', v_txn);

  ELSIF r.kind = 'project_create' THEN
    IF NOT public.has_perm('project.approve_create') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.created_project_id IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_EXECUTED'; END IF;
    INSERT INTO public.projects (name_ar, code, supervisor_id, status, created_by, description_ar)
    VALUES (coalesce(nullif(btrim(coalesce(r.title, r.notes_ar)), ''), 'مشروع مقترح ' || r.request_no),
            'REQ-' || r.request_no, r.supervisor_id, 'draft', auth.uid(), r.notes_ar)
    RETURNING id INTO v_project;
    UPDATE public.requests SET created_project_id = v_project WHERE id = r.id;
    v_result := jsonb_build_object('project_id', v_project);

  ELSIF r.kind = 'document_upload' THEN
    IF NOT public.has_perm('documents.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    UPDATE public.attachments SET approved_at = now(), approved_by = auth.uid(),
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
END $$;
REVOKE EXECUTE ON FUNCTION public.request_execute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_execute(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_close(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  IF NOT (public.is_accountant() OR public.has_perm('requests.process')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.request_can_transition(r.status::text, 'completed') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE public.requests SET status = 'completed', closed_at = now(), status_note = _note,
         updated_at = now() WHERE id = _request_id;
  PERFORM public.log_audit('request', 'update', _request_id, NULL,
    jsonb_build_object('closed', true), _note);
  PERFORM public.notify_request(_request_id, 'request_closed', 'تم إغلاق الطلب ' || r.request_no, _note);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_close(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_close(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_reopen(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  IF NOT public.has_perm('requests.reopen') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(coalesce(_reason,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.status::text NOT IN ('completed','rejected','cancelled') THEN RAISE EXCEPTION 'NOT_CLOSED'; END IF;

  PERFORM set_config('tahqaq.bypass_transition', 'on', true);
  UPDATE public.requests SET status = 'under_review', reopen_reason = btrim(_reason),
         status_note = btrim(_reason), closed_at = NULL, updated_at = now()
   WHERE id = _request_id;
  PERFORM set_config('tahqaq.bypass_transition', 'off', true);

  PERFORM public.log_audit('request', 'restore', _request_id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'under_review'), btrim(_reason));
  PERFORM public.notify_request(_request_id, 'request_reopened',
    'إعادة فتح الطلب ' || r.request_no, btrim(_reason));
END $$;
REVOKE EXECUTE ON FUNCTION public.request_reopen(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_reopen(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_cancel(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  IF NOT public.is_accountant() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(coalesce(_reason,'')), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.requests SET status = 'cancelled', status_note = btrim(_reason),
         closed_at = now(), updated_at = now() WHERE id = _request_id;
  PERFORM public.log_audit('request', 'cancel', _request_id, NULL, NULL, btrim(_reason));
  PERFORM public.notify_request(_request_id, 'request_cancelled', 'إلغاء الطلب ' || r.request_no, btrim(_reason));
END $$;
REVOKE EXECUTE ON FUNCTION public.request_cancel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_cancel(uuid, text) TO authenticated, service_role;

-- ================= attachments: append-only for non-accountants =================
CREATE OR REPLACE FUNCTION public.enforce_attachment_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
    NEW.uploader_role := coalesce(NEW.uploader_role, public.current_role_label());
    IF NEW.replaces_id IS NOT NULL THEN
      IF NOT public.is_accountant() THEN RAISE EXCEPTION 'REPLACE_FORBIDDEN'; END IF;
      SELECT coalesce(max(version), 1) + 1 INTO NEW.version
        FROM public.attachments WHERE id = NEW.replaces_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_accountant() THEN
    RAISE EXCEPTION 'ATTACHMENT_EDIT_FORBIDDEN';
  END IF;
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'STORAGE_PATH_LOCKED';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_attachments_rules ON public.attachments;
CREATE TRIGGER trg_attachments_rules BEFORE INSERT OR UPDATE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.enforce_attachment_rules();

REVOKE DELETE ON public.attachments FROM authenticated;