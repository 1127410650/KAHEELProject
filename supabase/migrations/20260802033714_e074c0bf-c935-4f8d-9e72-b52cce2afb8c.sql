-- writes go through RPCs only
DROP POLICY IF EXISTS mkt_reports_insert ON public.mkt_reports;
DROP POLICY IF EXISTS mkt_reports_admin_update ON public.mkt_reports;
DROP POLICY IF EXISTS mkt_reports_read ON public.mkt_reports;
REVOKE INSERT, UPDATE, DELETE ON public.mkt_reports FROM authenticated;

-- allow a moderation "hidden" state
ALTER TABLE public.mkt_listings DROP CONSTRAINT mkt_listings_status_check;
ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_status_check CHECK (status = ANY (ARRAY[
  'draft','pending','published','rejected','suspended','hidden','expired','archived','deleted']));

-- ===== restrictions =====
CREATE OR REPLACE FUNCTION public.mkt_has_restriction(_subject_type text, _subject_id uuid, _restrictions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
    WHERE r.subject_type = _subject_type AND r.subject_id = _subject_id
      AND r.restriction = ANY (_restrictions)
      AND r.lifted_at IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_user_blocked(_restrictions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.mkt_has_restriction('user', auth.uid(), _restrictions || ARRAY['suspend_account','permanent_ban'])
$$;
GRANT EXECUTE ON FUNCTION public.mkt_user_blocked(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_lift_expired_restrictions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer := 0; r record;
BEGIN
  FOR r IN
    SELECT * FROM public.mkt_account_restrictions
    WHERE lifted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= now()
  LOOP
    UPDATE public.mkt_account_restrictions
       SET lifted_at = now(), lifted_reason = 'auto: duration ended'
     WHERE id = r.id;
    IF r.subject_type = 'user' THEN
      PERFORM public.mkt_notify(r.subject_id, r.report_id, 'restriction_lifted',
        'انتهت مدة القيد', 'تم رفع القيد المؤقت عن حسابك تلقائيًا.');
    END IF;
    PERFORM public.log_audit('mkt_restriction', 'update', r.id,
      jsonb_build_object('lifted', false), jsonb_build_object('lifted', true), 'auto expiry');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mkt_lift_expired_restrictions() TO authenticated;

-- ===== submit a report =====
CREATE OR REPLACE FUNCTION public.mkt_submit_report(
  _listing_id uuid, _reason_code text, _note text DEFAULT NULL, _confirmed boolean DEFAULT false)
RETURNS TABLE (report_id uuid, ref_no text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := auth.uid();
  l record; rs record; sev text; ref text; new_id uuid; snap jsonb; recent integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT _confirmed THEN RAISE EXCEPTION 'Confirmation required'; END IF;
  IF public.mkt_user_blocked(ARRAY['warning']::text[]) THEN
    RAISE EXCEPTION 'Account restricted';
  END IF;

  SELECT * INTO l FROM public.mkt_listings WHERE id = _listing_id;
  IF l IS NULL OR l.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.owner_user_id = uid OR (l.tenant_id IS NOT NULL AND public.is_tenant_member(l.tenant_id)) THEN
    RAISE EXCEPTION 'You cannot report your own listing';
  END IF;

  SELECT * INTO rs FROM public.mkt_report_reasons WHERE code = _reason_code AND is_active;
  IF rs IS NULL THEN RAISE EXCEPTION 'Unknown reason'; END IF;
  IF rs.requires_note AND (_note IS NULL OR btrim(_note) = '') THEN
    RAISE EXCEPTION 'A description is required for this reason';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mkt_reports r
    WHERE r.listing_id = _listing_id AND r.reporter_user_id = uid
      AND r.status NOT IN ('closed','invalid','duplicate','out_of_scope')
  ) THEN
    RAISE EXCEPTION 'You already have an open report on this listing';
  END IF;

  SELECT count(*) INTO recent FROM public.mkt_reports
   WHERE reporter_user_id = uid AND created_at > now() - interval '1 hour';
  IF recent >= 5 THEN RAISE EXCEPTION 'Too many reports, please try later'; END IF;
  SELECT count(*) INTO recent FROM public.mkt_reports
   WHERE reporter_user_id = uid AND created_at > now() - interval '24 hours';
  IF recent >= 20 THEN RAISE EXCEPTION 'Daily report limit reached'; END IF;

  sev := rs.default_severity;
  ref := 'RPT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.mkt_report_ref_seq')::text, 6, '0');

  snap := jsonb_build_object(
    'title', l.title, 'summary', l.summary, 'description', l.description,
    'price', l.price, 'currency', l.currency, 'city', l.city, 'status', l.status,
    'category_id', l.category_id, 'type_code', l.type_code, 'slug', l.slug,
    'cover_image_url', l.cover_image_url, 'captured_at', now(),
    'images', COALESCE((SELECT jsonb_agg(i.url ORDER BY i.sort_order)
                        FROM public.mkt_listing_images i WHERE i.listing_id = l.id), '[]'::jsonb));

  INSERT INTO public.mkt_reports (
    listing_id, reporter_user_id, reason, reason_code, note, status, severity, priority,
    listing_snapshot, owner_user_id, tenant_id, ref_no, sla_due_at, reporter_confirmed)
  VALUES (
    _listing_id, uid, _reason_code, _reason_code, NULLIF(btrim(COALESCE(_note,'')),''),
    'new', sev,
    CASE sev WHEN 'critical' THEN 'urgent' WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'normal' END,
    snap, l.owner_user_id, l.tenant_id, ref,
    now() + CASE sev WHEN 'critical' THEN interval '6 hours' WHEN 'high' THEN interval '24 hours'
                     WHEN 'medium' THEN interval '72 hours' ELSE interval '7 days' END,
    true)
  RETURNING id INTO new_id;

  INSERT INTO public.mkt_report_status_history (report_id, from_status, to_status, reason, actor_id)
  VALUES (new_id, NULL, 'new', 'submitted', uid);

  PERFORM public.mkt_notify(uid, new_id, 'report_received', 'تم استلام بلاغك',
    'رقم البلاغ ' || ref || ' — سيتم مراجعته من فريق المنصة.');
  PERFORM public.log_audit('mkt_report', 'create', new_id, NULL,
    jsonb_build_object('ref_no', ref, 'reason', _reason_code, 'listing_id', _listing_id), NULL);

  RETURN QUERY SELECT new_id, ref;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_submit_report(uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_submit_report(uuid, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_submit_report(uuid, text, text, boolean) TO authenticated;

-- ===== internal status setter =====
CREATE OR REPLACE FUNCTION public.mkt_report_apply_status(_report_id uuid, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_status text;
BEGIN
  SELECT status INTO old_status FROM public.mkt_reports WHERE id = _report_id;
  IF old_status IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  UPDATE public.mkt_reports
     SET status = _status,
         first_response_at = COALESCE(first_response_at, now()),
         reopened_at = CASE WHEN _status = 'reopened' THEN now() ELSE reopened_at END,
         closed_at = CASE WHEN _status = 'closed' THEN now() ELSE closed_at END,
         updated_at = now()
   WHERE id = _report_id;
  INSERT INTO public.mkt_report_status_history (report_id, from_status, to_status, reason, actor_id)
  VALUES (_report_id, old_status, _status, _reason, auth.uid());
  PERFORM public.log_audit('mkt_report', 'update', _report_id,
    jsonb_build_object('status', old_status), jsonb_build_object('status', _status), _reason);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_report_apply_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_report_apply_status(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_report_apply_status(uuid, text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.mkt_report_require(_report_id uuid, _perm text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mkt_staff_has(_perm) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.mkt_report_conflict(_report_id) THEN
    RAISE EXCEPTION 'Conflict of interest: you belong to the reported business';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_report_require(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_report_require(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_report_require(uuid, text) FROM authenticated;

-- ===== staff workflow =====
CREATE OR REPLACE FUNCTION public.mkt_report_assign(_report_id uuid, _assignee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE cur text;
BEGIN
  IF _assignee = auth.uid() THEN
    PERFORM public.mkt_report_require(_report_id, 'reports.review');
  ELSE
    PERFORM public.mkt_report_require(_report_id, 'reports.assign');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins WHERE user_id = _assignee)
     AND NOT EXISTS (SELECT 1 FROM public.mkt_staff_permissions WHERE user_id = _assignee AND perm = 'reports.inbox_view') THEN
    RAISE EXCEPTION 'Assignee is not a review staff member';
  END IF;
  SELECT status INTO cur FROM public.mkt_reports WHERE id = _report_id;
  UPDATE public.mkt_reports SET assigned_to = _assignee, assigned_at = now(), updated_at = now()
   WHERE id = _report_id;
  IF cur IN ('new','unassigned','reopened') THEN
    PERFORM public.mkt_report_apply_status(_report_id, 'under_review', 'assigned');
  END IF;
  PERFORM public.mkt_notify(_assignee, _report_id, 'report_assigned', 'تم إسناد بلاغ إليك', NULL);
  PERFORM public.log_audit('mkt_report', 'update', _report_id, NULL,
    jsonb_build_object('assigned_to', _assignee), 'assignment');
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_set_status(_report_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _status = 'closed' THEN PERFORM public.mkt_report_require(_report_id, 'reports.close');
  ELSIF _status = 'reopened' THEN PERFORM public.mkt_report_require(_report_id, 'reports.reopen');
  ELSIF _status = 'escalated' THEN PERFORM public.mkt_report_require(_report_id, 'reports.escalate');
  ELSE PERFORM public.mkt_report_require(_report_id, 'reports.review');
  END IF;
  IF _status NOT IN ('new','unassigned','under_review','awaiting_reporter','awaiting_advertiser',
                     'action_taken','closed','reopened','duplicate','invalid','out_of_scope','escalated','referred') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  IF _status IN ('closed','invalid','duplicate','out_of_scope','referred')
     AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  PERFORM public.mkt_report_apply_status(_report_id, _status, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_set_priority(_report_id uuid, _priority text, _severity text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.review');
  UPDATE public.mkt_reports
     SET priority = _priority, severity = COALESCE(_severity, severity), updated_at = now()
   WHERE id = _report_id;
  PERFORM public.log_audit('mkt_report', 'update', _report_id, NULL,
    jsonb_build_object('priority', _priority, 'severity', _severity), 'priority change');
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_note(_report_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.add_internal_note');
  IF btrim(COALESCE(_body,'')) = '' THEN RAISE EXCEPTION 'Empty note'; END IF;
  INSERT INTO public.mkt_report_notes (report_id, body, author_id) VALUES (_report_id, _body, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_message(
  _report_id uuid, _channel text, _body text, _kind text DEFAULT 'message',
  _due_days integer DEFAULT NULL, _attachment_path text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; target uuid;
BEGIN
  IF _channel = 'reporter' THEN PERFORM public.mkt_report_require(_report_id, 'reports.message_reporter');
  ELSIF _channel = 'advertiser' THEN PERFORM public.mkt_report_require(_report_id, 'reports.message_advertiser');
  ELSE RAISE EXCEPTION 'Unknown channel'; END IF;
  IF btrim(COALESCE(_body,'')) = '' THEN RAISE EXCEPTION 'Empty message'; END IF;

  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  INSERT INTO public.mkt_report_messages (report_id, channel, sender_side, sender_user_id, kind, body, attachment_path, due_at)
  VALUES (_report_id, _channel, 'staff', auth.uid(), _kind, _body, _attachment_path,
          CASE WHEN _due_days IS NULL THEN NULL ELSE now() + make_interval(days => _due_days) END);

  target := CASE WHEN _channel = 'reporter' THEN r.reporter_user_id ELSE r.owner_user_id END;
  PERFORM public.mkt_notify(target, _report_id,
    CASE WHEN _channel = 'reporter' THEN 'reporter_info_requested' ELSE 'advertiser_message' END,
    CASE WHEN _channel = 'reporter' THEN 'رسالة بخصوص بلاغك' ELSE 'رسالة من فريق مراجعة السوق' END,
    left(_body, 180));

  IF _kind IN ('info_request','document_request','edit_deadline') THEN
    PERFORM public.mkt_report_apply_status(_report_id,
      CASE WHEN _channel = 'reporter' THEN 'awaiting_reporter' ELSE 'awaiting_advertiser' END, _kind);
  ELSE
    UPDATE public.mkt_reports SET first_response_at = COALESCE(first_response_at, now()), updated_at = now()
     WHERE id = _report_id;
  END IF;
END;
$$;

-- party reply (reporter or advertiser)
CREATE OR REPLACE FUNCTION public.mkt_report_reply(_report_id uuid, _body text, _attachment_path text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; ch text; side text;
BEGIN
  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF btrim(COALESCE(_body,'')) = '' THEN RAISE EXCEPTION 'Empty message'; END IF;
  IF r.reporter_user_id = auth.uid() THEN ch := 'reporter'; side := 'reporter';
  ELSIF public.mkt_report_is_advertiser(_report_id) THEN ch := 'advertiser'; side := 'advertiser';
  ELSE RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO public.mkt_report_messages (report_id, channel, sender_side, sender_user_id, kind, body, attachment_path)
  VALUES (_report_id, ch, side, auth.uid(), 'message', _body, _attachment_path);

  IF r.status IN ('awaiting_reporter','awaiting_advertiser') THEN
    PERFORM public.mkt_report_apply_status(_report_id, 'under_review', 'party replied');
  END IF;
  PERFORM public.mkt_notify(r.assigned_to, _report_id, 'party_replied', 'رد جديد على بلاغ', left(_body, 180));
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_merge(_report_id uuid, _into uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.merge');
  IF _report_id = _into THEN RAISE EXCEPTION 'Cannot merge into itself'; END IF;
  UPDATE public.mkt_reports SET merged_into = _into, updated_at = now() WHERE id = _report_id;
  PERFORM public.mkt_report_apply_status(_report_id, 'duplicate', 'merged into another report');
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_close(
  _report_id uuid, _decision text, _reason text, _public_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.close');
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  UPDATE public.mkt_reports
     SET decision = _decision, decision_reason = _reason,
         public_outcome = COALESCE(_public_outcome, _decision), updated_at = now()
   WHERE id = _report_id;
  PERFORM public.mkt_report_apply_status(_report_id, 'closed', _reason);
  PERFORM public.mkt_notify(r.reporter_user_id, _report_id, 'report_closed', 'تم إغلاق بلاغك',
    'النتيجة: ' || COALESCE(_public_outcome, _decision));
  PERFORM public.mkt_notify(r.owner_user_id, _report_id, 'final_decision', 'صدر قرار نهائي بخصوص إعلانك', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_reopen(_report_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.reopen');
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.mkt_reports SET closed_at = NULL, updated_at = now() WHERE id = _report_id;
  PERFORM public.mkt_report_apply_status(_report_id, 'reopened', _reason);
END;
$$;

-- ===== enforcement on listings =====
CREATE OR REPLACE FUNCTION public.mkt_enforce_listing(
  _report_id uuid, _action text, _reason text DEFAULT NULL, _days integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; l record; new_status text; needs_reason boolean := true;
BEGIN
  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;

  IF _action = 'hide' THEN PERFORM public.mkt_report_require(_report_id, 'ads.moderation_hide');
  ELSIF _action IN ('suspend','reject','archive','soft_delete','republish') THEN
    PERFORM public.mkt_report_require(_report_id, 'ads.moderation_suspend');
  ELSIF _action IN ('none','warn','request_edit') THEN
    PERFORM public.mkt_report_require(_report_id, 'reports.review');
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;

  IF _action IN ('none','warn') THEN needs_reason := false; END IF;
  IF needs_reason AND btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO l FROM public.mkt_listings WHERE id = r.listing_id;
  new_status := CASE _action
    WHEN 'hide' THEN 'hidden'
    WHEN 'suspend' THEN 'suspended'
    WHEN 'reject' THEN 'rejected'
    WHEN 'archive' THEN 'archived'
    WHEN 'soft_delete' THEN 'deleted'
    WHEN 'republish' THEN 'published'
    ELSE NULL END;

  IF new_status IS NOT NULL THEN
    UPDATE public.mkt_listings
       SET status = new_status,
           rejection_reason = CASE WHEN _action = 'republish' THEN NULL ELSE _reason END,
           deleted_at = CASE WHEN _action = 'soft_delete' THEN now() ELSE NULL END,
           updated_at = now()
     WHERE id = l.id;
    INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
    VALUES (l.id, l.status, new_status, _reason, auth.uid());
  END IF;

  INSERT INTO public.mkt_enforcement_actions (report_id, target_type, target_id, action, reason, duration_days, expires_at, actor_id)
  VALUES (_report_id, 'listing', l.id, _action, _reason, _days,
          CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END, auth.uid());

  IF _action <> 'none' THEN
    PERFORM public.mkt_notify(l.owner_user_id, _report_id, 'listing_action',
      'قرار بشأن إعلانك: ' || _action, _reason);
  END IF;

  PERFORM public.mkt_report_apply_status(_report_id, 'action_taken', _action || COALESCE(': ' || _reason, ''));
  PERFORM public.log_audit('mkt_listing', 'update', l.id,
    jsonb_build_object('status', l.status), jsonb_build_object('status', COALESCE(new_status, l.status), 'action', _action), _reason);
END;
$$;

-- ===== enforcement on accounts / businesses =====
CREATE OR REPLACE FUNCTION public.mkt_restrict_subject(
  _report_id uuid, _subject_type text, _subject_id uuid, _restriction text,
  _reason text, _days integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE new_id uuid;
BEGIN
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  IF _restriction IN ('suspend_account','permanent_ban') THEN
    IF NOT (public.mkt_is_super_admin() OR public.mkt_staff_has('accounts.suspend')) THEN
      RAISE EXCEPTION 'Not authorized: account suspension is restricted';
    END IF;
  ELSIF _restriction = 'suspend_business_publishing' THEN
    IF NOT public.mkt_staff_has('businesses.suspend') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  ELSIF _restriction = 'revoke_verification' THEN
    IF NOT public.mkt_staff_has('businesses.revoke_verification') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  ELSE
    IF NOT public.mkt_staff_has('accounts.restrict') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  END IF;

  IF _report_id IS NOT NULL AND public.mkt_report_conflict(_report_id) THEN
    RAISE EXCEPTION 'Conflict of interest';
  END IF;

  INSERT INTO public.mkt_account_restrictions
    (report_id, subject_type, subject_id, restriction, reason, expires_at, created_by)
  VALUES (_report_id, _subject_type, _subject_id, _restriction, _reason,
          CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END, auth.uid())
  RETURNING id INTO new_id;

  IF _restriction = 'revoke_verification' THEN
    UPDATE public.mkt_business_profiles
       SET verification_status = 'rejected', verification_note = _reason, is_published = false, updated_at = now()
     WHERE tenant_id = _subject_id;
  ELSIF _restriction = 'suspend_business_publishing' THEN
    UPDATE public.mkt_business_profiles SET is_published = false, updated_at = now() WHERE tenant_id = _subject_id;
  ELSIF _restriction IN ('suspend_listings','suspend_account','permanent_ban') THEN
    UPDATE public.mkt_listings SET status = 'suspended', rejection_reason = _reason, updated_at = now()
     WHERE status IN ('published','pending','hidden')
       AND ((_subject_type = 'user' AND owner_user_id = _subject_id)
         OR (_subject_type = 'business' AND tenant_id = _subject_id));
  END IF;

  INSERT INTO public.mkt_enforcement_actions (report_id, target_type, target_id, action, reason, duration_days, expires_at, actor_id)
  VALUES (_report_id, CASE WHEN _subject_type = 'user' THEN 'user' ELSE 'business' END,
          _subject_id, _restriction, _reason, _days,
          CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END, auth.uid());

  IF _subject_type = 'user' THEN
    PERFORM public.mkt_notify(_subject_id, _report_id, 'account_restricted', 'قيد على حسابك: ' || _restriction, _reason);
  END IF;
  PERFORM public.log_audit('mkt_restriction', 'create', new_id, NULL,
    jsonb_build_object('subject_type', _subject_type, 'subject_id', _subject_id, 'restriction', _restriction), _reason);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_lift_restriction(_restriction_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.mkt_account_restrictions WHERE id = _restriction_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF r.restriction IN ('suspend_account','permanent_ban') THEN
    IF NOT (public.mkt_is_super_admin() OR public.mkt_staff_has('accounts.suspend')) THEN
      RAISE EXCEPTION 'Not authorized'; END IF;
  ELSIF NOT public.mkt_staff_has('accounts.restrict') THEN RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.mkt_account_restrictions SET lifted_at = now(), lifted_reason = _reason WHERE id = _restriction_id;
  IF r.subject_type = 'user' THEN
    PERFORM public.mkt_notify(r.subject_id, r.report_id, 'restriction_lifted', 'تم رفع القيد عن حسابك', _reason);
  END IF;
  PERFORM public.log_audit('mkt_restriction', 'update', _restriction_id, NULL,
    jsonb_build_object('lifted', true), _reason);
END;
$$;

-- ===== appeals =====
CREATE OR REPLACE FUNCTION public.mkt_submit_appeal(_report_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; new_id uuid;
BEGIN
  IF NOT public.mkt_report_is_advertiser(_report_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  IF r.status NOT IN ('action_taken','closed') THEN RAISE EXCEPTION 'No decision to appeal yet'; END IF;
  IF COALESCE(r.closed_at, r.updated_at) < now() - interval '14 days' THEN
    RAISE EXCEPTION 'The appeal window has ended';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_appeals a WHERE a.report_id = _report_id AND a.status IN ('new','under_review')) THEN
    RAISE EXCEPTION 'An appeal is already under review';
  END IF;
  INSERT INTO public.mkt_appeals (report_id, listing_id, reason) VALUES (_report_id, r.listing_id, _reason)
  RETURNING id INTO new_id;
  PERFORM public.mkt_notify(r.assigned_to, _report_id, 'appeal_submitted', 'تم تقديم اعتراض على قرار', left(_reason, 180));
  PERFORM public.log_audit('mkt_appeal', 'create', new_id, NULL, jsonb_build_object('report_id', _report_id), _reason);
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_submit_appeal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_submit_appeal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_submit_appeal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_review_appeal(_appeal_id uuid, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record; r record; severe boolean;
BEGIN
  SELECT * INTO a FROM public.mkt_appeals WHERE id = _appeal_id;
  IF a IS NULL THEN RAISE EXCEPTION 'Appeal not found'; END IF;
  PERFORM public.mkt_report_require(a.report_id, 'appeals.review');
  IF _status NOT IN ('under_review','accepted','partially_accepted','rejected') THEN
    RAISE EXCEPTION 'Unknown status'; END IF;
  IF _status <> 'under_review' AND btrim(COALESCE(_reason,'')) = '' THEN
    RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO r FROM public.mkt_reports WHERE id = a.report_id;
  severe := EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions x
    WHERE x.report_id = a.report_id AND x.lifted_at IS NULL
      AND x.restriction IN ('suspend_account','permanent_ban','revoke_verification'));
  IF severe AND _status <> 'under_review' THEN
    IF NOT public.mkt_is_super_admin() THEN
      RAISE EXCEPTION 'Severe decisions must be reviewed by a system administrator';
    END IF;
    IF EXISTS (SELECT 1 FROM public.mkt_account_restrictions x
               WHERE x.report_id = a.report_id AND x.created_by = auth.uid()) THEN
      RAISE EXCEPTION 'The same reviewer cannot decide this appeal alone';
    END IF;
  END IF;

  UPDATE public.mkt_appeals
     SET status = _status, decision_reason = _reason,
         decided_by = CASE WHEN _status = 'under_review' THEN NULL ELSE auth.uid() END,
         decided_at = CASE WHEN _status = 'under_review' THEN NULL ELSE now() END
   WHERE id = _appeal_id;

  IF _status = 'accepted' THEN
    UPDATE public.mkt_account_restrictions SET lifted_at = now(), lifted_reason = 'appeal accepted'
     WHERE report_id = a.report_id AND lifted_at IS NULL;
    IF a.listing_id IS NOT NULL THEN
      UPDATE public.mkt_listings SET status = 'published', rejection_reason = NULL, deleted_at = NULL, updated_at = now()
       WHERE id = a.listing_id AND status IN ('hidden','suspended','rejected','archived','deleted');
    END IF;
  END IF;

  PERFORM public.mkt_notify(a.submitted_by, a.report_id, 'appeal_decision',
    'صدر قرار الاعتراض: ' || _status, _reason);
  PERFORM public.log_audit('mkt_appeal', 'update', _appeal_id, NULL,
    jsonb_build_object('status', _status), _reason);
END;
$$;

-- ===== advertiser-facing view (never exposes reporter identity) =====
CREATE OR REPLACE FUNCTION public.mkt_my_moderation_cases()
RETURNS TABLE (
  report_id uuid, ref_no text, listing_id uuid, listing_title text, status text,
  severity text, reason_code text, decision text, decision_reason text,
  created_at timestamptz, closed_at timestamptz, can_appeal boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.ref_no, r.listing_id, l.title, r.status, r.severity, r.reason_code,
         r.decision, r.decision_reason, r.created_at, r.closed_at,
         (r.status IN ('action_taken','closed')
          AND COALESCE(r.closed_at, r.updated_at) > now() - interval '14 days'
          AND NOT EXISTS (SELECT 1 FROM public.mkt_appeals a
                          WHERE a.report_id = r.id AND a.status IN ('new','under_review')))
  FROM public.mkt_reports r
  LEFT JOIN public.mkt_listings l ON l.id = r.listing_id
  WHERE r.owner_user_id = auth.uid()
     OR (r.tenant_id IS NOT NULL AND public.is_tenant_member(r.tenant_id))
  ORDER BY r.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.mkt_my_moderation_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_my_moderation_cases() FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_moderation_cases() TO authenticated;

-- ===== inbox statistics =====
CREATE OR REPLACE FUNCTION public.mkt_report_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE out jsonb;
BEGIN
  IF NOT public.mkt_staff_has('reports.inbox_view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'new', count(*) FILTER (WHERE status = 'new'),
    'open', count(*) FILTER (WHERE status NOT IN ('closed','duplicate','invalid','out_of_scope')),
    'unassigned', count(*) FILTER (WHERE assigned_to IS NULL AND status <> 'closed'),
    'critical', count(*) FILTER (WHERE severity = 'critical' AND status <> 'closed'),
    'overdue', count(*) FILTER (WHERE sla_due_at < now() AND status NOT IN ('closed','duplicate','invalid','out_of_scope')),
    'avg_first_response_hours', round(COALESCE(avg(EXTRACT(epoch FROM (first_response_at - created_at)) / 3600.0), 0)::numeric, 1),
    'avg_close_hours', round(COALESCE(avg(EXTRACT(epoch FROM (closed_at - created_at)) / 3600.0), 0)::numeric, 1),
    'by_reason', (SELECT COALESCE(jsonb_object_agg(reason_code, c), '{}'::jsonb)
                  FROM (SELECT reason_code, count(*) c FROM public.mkt_reports GROUP BY 1) s),
    'by_assignee', (SELECT COALESCE(jsonb_object_agg(assigned_to::text, c), '{}'::jsonb)
                    FROM (SELECT assigned_to, count(*) c FROM public.mkt_reports WHERE assigned_to IS NOT NULL GROUP BY 1) s),
    'by_action', (SELECT COALESCE(jsonb_object_agg(action, c), '{}'::jsonb)
                  FROM (SELECT action, count(*) c FROM public.mkt_enforcement_actions GROUP BY 1) s),
    'top_listings', (SELECT COALESCE(jsonb_agg(jsonb_build_object('listing_id', listing_id, 'count', c)), '[]'::jsonb)
                     FROM (SELECT listing_id, count(*) c FROM public.mkt_reports GROUP BY 1 ORDER BY c DESC LIMIT 5) s),
    'top_accounts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', owner_user_id, 'count', c)), '[]'::jsonb)
                     FROM (SELECT owner_user_id, count(*) c FROM public.mkt_reports WHERE owner_user_id IS NOT NULL
                           GROUP BY 1 ORDER BY c DESC LIMIT 5) s)
  ) INTO out FROM public.mkt_reports;
  RETURN out;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_report_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_report_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_report_stats() TO authenticated;

-- staff RPC grants
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'mkt_report_assign(uuid,uuid)','mkt_report_set_status(uuid,text,text)',
    'mkt_report_set_priority(uuid,text,text)','mkt_report_note(uuid,text)',
    'mkt_report_message(uuid,text,text,text,integer,text)','mkt_report_reply(uuid,text,text)',
    'mkt_report_merge(uuid,uuid)','mkt_report_close(uuid,text,text,text)',
    'mkt_report_reopen(uuid,text)','mkt_enforce_listing(uuid,text,text,integer)',
    'mkt_restrict_subject(uuid,text,uuid,text,text,integer)','mkt_lift_restriction(uuid,text)',
    'mkt_review_appeal(uuid,text,text)','mkt_has_restriction(text,uuid,text[])']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- ===== restriction enforcement on listing writes and messaging =====
CREATE OR REPLACE FUNCTION public.mkt_guard_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.mkt_is_super_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND public.mkt_user_blocked(ARRAY['no_new_listings']::text[]) THEN
    RAISE EXCEPTION 'Your account is restricted from creating new listings';
  END IF;
  IF NEW.status = 'pending'
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND public.mkt_user_blocked(ARRAY['no_submit_review']::text[]) THEN
    RAISE EXCEPTION 'Your account is restricted from submitting listings for review';
  END IF;
  IF NEW.tenant_id IS NOT NULL AND NEW.status IN ('pending','published')
     AND public.mkt_has_restriction('business', NEW.tenant_id,
         ARRAY['suspend_business_publishing','revoke_verification']) THEN
    RAISE EXCEPTION 'This business is suspended from publishing';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mkt_listings_guard_restrictions
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_restrictions();

DROP POLICY IF EXISTS mkt_messages_insert ON public.mkt_messages;
CREATE POLICY mkt_messages_insert ON public.mkt_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_user_id = auth.uid()
    AND public.mkt_can_view_conversation(conversation_id)
    AND NOT public.mkt_user_blocked(ARRAY['no_messaging']::text[])
  );

DROP POLICY IF EXISTS mkt_quote_requests_buyer_insert ON public.mkt_quote_requests;
CREATE POLICY mkt_quote_requests_buyer_insert ON public.mkt_quote_requests
  FOR INSERT TO authenticated WITH CHECK (
    buyer_user_id = auth.uid()
    AND (listing_id IS NULL OR public.mkt_listing_is_public(listing_id))
    AND NOT public.mkt_user_blocked(ARRAY['no_messaging']::text[])
    AND NOT (listing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.mkt_listings l
      WHERE l.id = listing_id AND public.mkt_has_restriction('user', l.owner_user_id, ARRAY['no_new_requests'])))
  );
