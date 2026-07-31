-- ================= stage order & progress =================
CREATE OR REPLACE FUNCTION public.request_stage_order()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['awaiting_reply','under_review','assigned','processing','needs_info',
               'supervisor_replied','review_after_info','awaiting_approval','approved',
               'awaiting_execution','executing','executed','completed'];
$$;

CREATE OR REPLACE FUNCTION public.request_progress(_status text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _status IN ('rejected','cancelled') THEN 100
    WHEN _status = 'paid' THEN 92
    WHEN _status = 'awaiting_payment' THEN 85
    WHEN _status = 'new' THEN 8
    ELSE coalesce(
      (array_position(public.request_stage_order(), _status) * 100) / 13,
      0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.request_can_transition(_from text, _to text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE f text := CASE WHEN _from = 'new' THEN 'awaiting_reply' ELSE _from END;
BEGIN
  IF f = _to THEN RETURN true; END IF;
  RETURN CASE f
    WHEN 'awaiting_reply'     THEN _to IN ('under_review','assigned','cancelled','rejected')
    WHEN 'under_review'       THEN _to IN ('assigned','processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'assigned'           THEN _to IN ('processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'processing'          THEN _to IN ('needs_info','awaiting_approval','awaiting_payment','cancelled','rejected')
    WHEN 'needs_info'          THEN _to IN ('supervisor_replied','cancelled','rejected')
    WHEN 'supervisor_replied'  THEN _to IN ('review_after_info','cancelled')
    WHEN 'review_after_info'   THEN _to IN ('processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'awaiting_approval'   THEN _to IN ('approved','rejected','needs_info','cancelled')
    WHEN 'approved'            THEN _to IN ('awaiting_execution','cancelled')
    WHEN 'awaiting_execution'  THEN _to IN ('executing','awaiting_payment','cancelled')
    WHEN 'executing'           THEN _to IN ('executed','awaiting_payment','cancelled')
    WHEN 'executed'            THEN _to IN ('completed','awaiting_payment')
    WHEN 'awaiting_payment'    THEN _to IN ('paid','cancelled')
    WHEN 'paid'                THEN _to IN ('executed','completed')
    ELSE false
  END;
END $$;

-- ================= transition guard trigger =================
CREATE OR REPLACE FUNCTION public.enforce_request_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(current_setting('tahqaq.bypass_transition', true), '') <> 'on'
     AND NOT public.request_can_transition(OLD.status::text, NEW.status::text) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_requests_transition ON public.requests;
CREATE TRIGGER trg_requests_transition BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_request_transition();

-- richer status history
CREATE OR REPLACE FUNCTION public.log_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.request_status_history
      (request_id, from_status, to_status, actor_id, actor_role, assignee_id, department, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), public.current_role_label(),
            NEW.assigned_to, NEW.department, NULLIF(btrim(coalesce(NEW.status_note, '')), ''));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_history
      (request_id, from_status, to_status, actor_id, actor_role, assignee_id, department, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), public.current_role_label(),
            NEW.assigned_to, NEW.department, NULLIF(btrim(coalesce(NEW.status_note, '')), ''));
  END IF;
  RETURN NEW;
END $$;

-- ================= notifications fan-out =================
CREATE OR REPLACE FUNCTION public.notify_request(
  _request_id uuid, _event text, _title text, _body text DEFAULT NULL, _message_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF r.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, request_id, message_id, event, title, body)
  SELECT DISTINCT u, _request_id, _message_id, _event, _title, _body
  FROM (
    SELECT r.requester_id AS u
    UNION SELECT r.assigned_to
    UNION SELECT p.user_id FROM public.profiles p
      WHERE r.supervisor_id IS NOT NULL AND p.supervisor_id = r.supervisor_id
    UNION SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'accountant'
  ) s
  WHERE u IS NOT NULL AND u <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_request(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_request(uuid, text, text, text, uuid) TO service_role;

-- ================= submit a request (portal, all kinds) =================
CREATE OR REPLACE FUNCTION public.submit_request(
  _kind text,
  _title text DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _notes_ar text DEFAULT NULL,
  _priority text DEFAULT 'normal',
  _department text DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _beneficiary text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _need_date date DEFAULT NULL,
  _account_ref text DEFAULT NULL,
  _authority text DEFAULT NULL,
  _request_date date DEFAULT NULL,
  _request_type text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sup uuid; _no text; _id uuid;
BEGIN
  IF NOT (public.is_supervisor_user() OR public.has_perm('requests.create')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _kind IS NULL OR _kind = '' THEN RAISE EXCEPTION 'KIND_REQUIRED'; END IF;
  IF coalesce(btrim(coalesce(_title, _notes_ar, '')), '') = '' THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;

  IF _kind NOT IN ('project_create', 'general') THEN
    IF _project_id IS NULL THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
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

  _sup := public.current_supervisor_id();
  _no := 'PR-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMMDD') || '-' ||
         lpad((SELECT (count(*) + 1)::text FROM public.requests
               WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh')), 3, '0');

  INSERT INTO public.requests (
    request_no, request_type, kind, title, project_id, supervisor_id, amount, notes_ar,
    priority, department, service_type, beneficiary, reason, need_date, account_ref,
    authority, request_date, status, info_state, requester_id, created_by
  ) VALUES (
    _no, coalesce(nullif(_request_type, ''), _kind), _kind, nullif(btrim(coalesce(_title,'')), ''),
    _project_id, _sup, _amount, _notes_ar,
    coalesce(nullif(_priority, ''), 'normal'), _department, _service_type, _beneficiary, _reason,
    _need_date, _account_ref, _authority,
    coalesce(_request_date, (now() AT TIME ZONE 'Asia/Riyadh')::date),
    'awaiting_reply', 'not_needed', auth.uid(), auth.uid()
  ) RETURNING id INTO _id;

  PERFORM public.log_audit('request', 'create', _id, NULL,
    jsonb_build_object('kind', _kind, 'amount', _amount, 'source', 'portal'), NULL);
  PERFORM public.notify_request(_id, 'request_created', 'طلب جديد: ' || _no, coalesce(_title, _notes_ar));
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_request(text,text,uuid,numeric,text,text,text,text,text,text,date,text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_request(text,text,uuid,numeric,text,text,text,text,text,text,date,text,text,date,text) TO authenticated, service_role;

-- ================= status change =================
CREATE OR REPLACE FUNCTION public.request_set_status(
  _request_id uuid, _status text, _note text DEFAULT NULL, _assignee uuid DEFAULT NULL,
  _department text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('requests.process')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF public.current_supervisor_id() IS NOT NULL AND NOT public.is_accountant() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT public.request_can_transition(r.status::text, _status) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  UPDATE public.requests SET
    status = _status::request_status,
    status_note = _note,
    assigned_to = coalesce(_assignee, assigned_to),
    department = coalesce(nullif(btrim(coalesce(_department,'')), ''), department),
    updated_at = now()
  WHERE id = _request_id;

  PERFORM public.log_audit('request', 'update', _request_id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', _status), _note);
  PERFORM public.notify_request(_request_id, 'status_changed',
    'تغيير حالة الطلب ' || r.request_no, _status);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_set_status(uuid,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_set_status(uuid,text,text,uuid,text) TO authenticated, service_role;

-- ================= conversation =================
CREATE OR REPLACE FUNCTION public.request_post_message(
  _request_id uuid, _body text, _reply_to uuid DEFAULT NULL, _client_token text DEFAULT NULL,
  _msg_kind text DEFAULT 'message', _is_draft boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(btrim(coalesce(_body,'')), '') = '' THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id;

  INSERT INTO public.request_messages
    (request_id, author_id, author_role, body, msg_kind, reply_to_id, client_token, is_draft)
  VALUES (_request_id, auth.uid(), public.current_role_label(), btrim(_body),
          coalesce(_msg_kind, 'message'), _reply_to, _client_token, coalesce(_is_draft, false))
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.request_messages
    WHERE request_id = _request_id AND author_id = auth.uid() AND client_token = _client_token;
    RETURN _id;
  END IF;

  IF NOT coalesce(_is_draft, false) THEN
    PERFORM public.log_audit('request_message', 'create', _id, NULL,
      jsonb_build_object('request_id', _request_id, 'kind', _msg_kind), NULL);
    PERFORM public.notify_request(_request_id,
      CASE WHEN _msg_kind = 'reminder' THEN 'reminder_added' ELSE 'message_added' END,
      'رسالة جديدة على الطلب ' || r.request_no, left(btrim(_body), 140), _id);
  END IF;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_post_message(uuid,text,uuid,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_post_message(uuid,text,uuid,text,text,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_message_publish(_message_id uuid, _body text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.request_messages;
BEGIN
  SELECT * INTO m FROM public.request_messages WHERE id = _message_id FOR UPDATE;
  IF m.id IS NULL OR m.author_id <> auth.uid() OR NOT m.is_draft THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.request_messages
     SET is_draft = false, body = coalesce(nullif(btrim(coalesce(_body,'')), ''), body), created_at = now()
   WHERE id = _message_id;
  PERFORM public.notify_request(m.request_id, 'message_added', 'رسالة جديدة على الطلب', NULL, _message_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_message_publish(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_message_publish(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_mark_read(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO public.request_message_reads (message_id, user_id)
  SELECT m.id, auth.uid() FROM public.request_messages m
  WHERE m.request_id = _request_id AND m.is_draft = false AND m.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  UPDATE public.notifications SET read_at = now()
   WHERE request_id = _request_id AND user_id = auth.uid() AND read_at IS NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_mark_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_mark_read(uuid) TO authenticated, service_role;

-- ================= request info from supervisor =================
CREATE OR REPLACE FUNCTION public.request_ask_info(
  _request_id uuid, _body text, _items text DEFAULT NULL, _due_date date DEFAULT NULL,
  _priority text DEFAULT 'normal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _msg uuid; r public.requests;
BEGIN
  IF coalesce(btrim(coalesce(_body,'')), '') = '' THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('requests.process')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  INSERT INTO public.request_messages
    (request_id, author_id, author_role, body, msg_kind, due_date, priority, items)
  VALUES (_request_id, auth.uid(), public.current_role_label(), btrim(_body), 'info_request',
          _due_date, _priority,
          CASE WHEN coalesce(btrim(coalesce(_items,'')), '') = '' THEN NULL
               ELSE to_jsonb(string_to_array(_items, E'\n')) END)
  RETURNING id INTO _msg;

  IF public.request_can_transition(r.status::text, 'needs_info') THEN
    UPDATE public.requests
       SET status = 'needs_info', info_state = 'requested', status_note = btrim(_body),
           due_date = coalesce(_due_date, due_date), updated_at = now()
     WHERE id = _request_id;
  ELSE
    UPDATE public.requests SET info_state = 'requested', updated_at = now() WHERE id = _request_id;
  END IF;

  PERFORM public.log_audit('request', 'update', _request_id, NULL,
    jsonb_build_object('info_request', true), btrim(_body));
  PERFORM public.notify_request(_request_id, 'info_requested',
    'مطلوب استكمال بيانات للطلب ' || r.request_no, left(btrim(_body), 140), _msg);
  RETURN _msg;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_ask_info(uuid,text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_ask_info(uuid,text,text,date,text) TO authenticated, service_role;

-- ================= supervisor reply to info request =================
CREATE OR REPLACE FUNCTION public.request_supervisor_reply(
  _request_id uuid, _body text, _is_draft boolean DEFAULT false, _client_token text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _msg uuid; r public.requests;
BEGIN
  IF coalesce(btrim(coalesce(_body,'')), '') = '' THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  _msg := public.request_post_message(_request_id, _body, NULL, _client_token,
                                      'supervisor_reply', coalesce(_is_draft, false));
  IF coalesce(_is_draft, false) THEN RETURN _msg; END IF;

  IF r.status::text = 'needs_info' THEN
    UPDATE public.requests SET status = 'supervisor_replied', info_state = 'answered',
           status_note = left(btrim(_body), 200), updated_at = now()
     WHERE id = _request_id;
    PERFORM set_config('tahqaq.bypass_transition', '', true);
    UPDATE public.requests SET status = 'review_after_info', updated_at = now()
     WHERE id = _request_id;
  ELSE
    UPDATE public.requests SET info_state = 'answered', updated_at = now() WHERE id = _request_id;
  END IF;

  PERFORM public.notify_request(_request_id, 'supervisor_replied',
    'رد المشرف على الطلب ' || r.request_no, left(btrim(_body), 140), _msg);
  RETURN _msg;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_supervisor_reply(uuid,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_supervisor_reply(uuid,text,boolean,text) TO authenticated, service_role;

-- ================= reminders (no throttle, double-click safe) =================
CREATE OR REPLACE FUNCTION public.request_add_reminder(
  _request_id uuid, _message text, _target_user_id uuid DEFAULT NULL,
  _follow_up_date date DEFAULT NULL, _client_token text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _msg uuid; r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(btrim(coalesce(_message,'')), '') = '' THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF _client_token IS NOT NULL THEN
    SELECT id INTO _id FROM public.request_reminders
     WHERE request_id = _request_id AND actor_id = auth.uid() AND client_token = _client_token;
    IF _id IS NOT NULL THEN RETURN _id; END IF;
  END IF;

  INSERT INTO public.request_reminders
    (request_id, actor_id, message, target_user_id, follow_up_date, client_token)
  VALUES (_request_id, auth.uid(), btrim(_message), _target_user_id, _follow_up_date, _client_token)
  RETURNING id INTO _id;

  _msg := public.request_post_message(_request_id, btrim(_message), NULL,
             coalesce(_client_token, _id::text), 'reminder', false);

  INSERT INTO public.request_status_history
    (request_id, actor_id, actor_role, from_status, to_status, note)
  VALUES (_request_id, auth.uid(), public.current_role_label(), r.status, r.status,
          'تذكير: ' || btrim(_message));

  IF _target_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, request_id, message_id, event, title, body)
    VALUES (_target_user_id, _request_id, _msg, 'reminder_added',
            'تذكير على الطلب ' || r.request_no, left(btrim(_message), 140));
  END IF;

  PERFORM public.log_audit('request', 'update', _request_id, NULL,
    jsonb_build_object('reminder', true, 'message', _message), 'reminder');
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_add_reminder(uuid,text,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_add_reminder(uuid,text,uuid,date,text) TO authenticated, service_role;