-- ---------- 1) one clear status: available | paused | leave | off ----------
ALTER TABLE public.mkt_staff_status DROP CONSTRAINT IF EXISTS mkt_staff_status_work_state_check;
UPDATE public.mkt_staff_status SET work_state = 'paused' WHERE work_state IN ('busy','away');
UPDATE public.mkt_staff_status SET pre_leave_state = 'paused' WHERE pre_leave_state IN ('busy','away');
ALTER TABLE public.mkt_staff_status
  ADD CONSTRAINT mkt_staff_status_work_state_check
  CHECK (work_state IN ('available','paused','leave','off'));

CREATE OR REPLACE FUNCTION public.mkt_staff_status_coherence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.work_state := CASE
    WHEN NEW.work_state IN ('busy','away') THEN 'paused'
    WHEN NEW.work_state IS NULL THEN 'off'
    ELSE NEW.work_state END;
  IF NEW.pre_leave_state IN ('busy','away') THEN NEW.pre_leave_state := 'paused'; END IF;
  NEW.accepts_auto := (NEW.work_state = 'available');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mkt_staff_status_coherence ON public.mkt_staff_status;
CREATE TRIGGER trg_mkt_staff_status_coherence
  BEFORE INSERT OR UPDATE ON public.mkt_staff_status
  FOR EACH ROW EXECUTE FUNCTION public.mkt_staff_status_coherence();
UPDATE public.mkt_staff_status SET updated_at = updated_at;

-- ---------- 2) status writes ----------
CREATE OR REPLACE FUNCTION public.mkt_workforce_set_staff(
  _user_id uuid, _work_state text, _capacity_limit integer, _accepts_auto boolean,
  _department text, _note text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _prev public.mkt_staff_status; _self boolean; _state text;
BEGIN
  _self := _user_id = auth.uid();
  IF NOT (public.mkt_workforce_manage() OR _self) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.mkt_workforce_manage() AND NOT _self AND btrim(COALESCE(_reason,'')) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN _reason := 'self update'; END IF;

  _state := CASE WHEN _work_state IN ('busy','away') THEN 'paused' ELSE _work_state END;
  IF _state IS NULL AND _accepts_auto IS NOT NULL THEN
    _state := CASE WHEN _accepts_auto THEN 'available' ELSE 'paused' END;
  END IF;
  IF _state IS NOT NULL AND _state NOT IN ('available','paused','leave','off') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;

  IF _self AND NOT public.mkt_workforce_manage() THEN
    IF _state IS NOT NULL AND _state NOT IN ('available','paused') THEN RAISE EXCEPTION 'forbidden'; END IF;
    _capacity_limit := NULL;
    _department := NULL;
  END IF;
  IF _state IN ('available','paused') AND public.mkt_staff_on_leave(_user_id) THEN
    RAISE EXCEPTION 'staff_on_leave';
  END IF;

  SELECT * INTO _prev FROM public.mkt_staff_status WHERE user_id = _user_id FOR UPDATE;
  IF _prev.user_id IS NULL THEN
    INSERT INTO public.mkt_staff_status (user_id, work_state, capacity_limit, department, note, updated_by)
    VALUES (_user_id, COALESCE(_state,'off'), COALESCE(_capacity_limit,10), _department,
            NULLIF(btrim(COALESCE(_note,'')),''), auth.uid());
  ELSE
    UPDATE public.mkt_staff_status
       SET work_state     = COALESCE(_state, work_state),
           capacity_limit = COALESCE(_capacity_limit, capacity_limit),
           department     = COALESCE(_department, department),
           note           = COALESCE(NULLIF(btrim(COALESCE(_note,'')),''), note),
           updated_by     = auth.uid()
     WHERE user_id = _user_id;
  END IF;

  PERFORM public.log_audit('mkt_staff_status','update', _user_id,
    to_jsonb(_prev), jsonb_build_object('work_state', _state, 'capacity_limit', _capacity_limit,
      'department', _department), _reason);
END $$;

-- ---------- 3) close / reopen the same work item ----------
ALTER TABLE public.mkt_admin_assignments
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mkt_workforce_close_item(_kind text, _subject_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments;
BEGIN
  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
   FOR UPDATE;
  IF _row.id IS NULL THEN RETURN; END IF;
  UPDATE public.mkt_admin_assignments
     SET closed_at = now(), closed_by = COALESCE(auth.uid(), _row.assignee),
         progress = 'done', last_action_at = now()
   WHERE id = _row.id;
  PERFORM public.log_audit('mkt_admin_assignments','close', _row.id, to_jsonb(_row),
    jsonb_build_object('closed_by', COALESCE(auth.uid(), _row.assignee), 'assignee', _row.assignee), NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_close_item(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mkt_workforce_reopen_item(_kind text, _subject_id uuid, _priority text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _keep boolean;
BEGIN
  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
   FOR UPDATE;
  IF _row.id IS NOT NULL THEN RETURN _row.id; END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND closed_at IS NOT NULL
   ORDER BY closed_at DESC LIMIT 1 FOR UPDATE;
  IF _row.id IS NULL THEN RETURN NULL; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mkt_staff_status s
                  WHERE s.user_id = _row.assignee AND s.work_state = 'available'
                    AND NOT public.mkt_staff_on_leave(s.user_id)
                    AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit)
    INTO _keep;

  UPDATE public.mkt_admin_assignments
     SET closed_at = NULL, closed_by = NULL, released_at = NULL,
         progress = 'unstarted', priority = COALESCE(_priority, priority),
         assignee = CASE WHEN _keep THEN assignee ELSE NULL END,
         claimed_at = CASE WHEN _keep THEN claimed_at ELSE NULL END,
         reopened_at = now(), reopen_count = reopen_count + 1, last_action_at = now()
   WHERE id = _row.id;
  PERFORM public.log_audit('mkt_admin_assignments','reopen', _row.id, to_jsonb(_row),
    jsonb_build_object('kept_assignee', _keep, 'reopen_count', _row.reopen_count + 1), NULL);
  RETURN _row.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_reopen_item(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------- 4) queueing: idempotent, reopen-aware ----------
CREATE OR REPLACE FUNCTION public.mkt_workforce_autoqueue(
  _kind text, _subject_id uuid, _priority text DEFAULT 'normal')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _pick uuid; _auto boolean; _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.mkt_admin_assignments
              WHERE kind = _kind AND subject_id = _subject_id
                AND released_at IS NULL AND closed_at IS NULL) THEN
    RETURN;
  END IF;

  _id := public.mkt_workforce_reopen_item(_kind, _subject_id, _priority);
  IF _id IS NULL THEN
    SELECT COALESCE((value->>'enabled')::boolean, true) INTO _auto
      FROM public.mkt_platform_settings WHERE key = 'workforce.auto_assign';
    IF COALESCE(_auto, true) THEN _pick := public.mkt_workforce_pick_assignee(_kind); END IF;

    INSERT INTO public.mkt_admin_assignments
      (kind, subject_id, assignee, claimed_at, priority, auto_assigned)
    VALUES (_kind, _subject_id, _pick, CASE WHEN _pick IS NULL THEN NULL ELSE now() END,
            COALESCE(_priority,'normal'), _pick IS NOT NULL)
    RETURNING id INTO _id;

    IF _id IS NOT NULL AND _pick IS NOT NULL THEN
      UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
      PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك', NULL);
      PERFORM public.log_audit('mkt_admin_assignments','auto_assign', _id, NULL,
        jsonb_build_object('kind', _kind, 'subject_id', _subject_id, 'assignee', _pick), NULL);
    END IF;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_autoqueue(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------- 5) atomic distribution ----------
CREATE OR REPLACE FUNCTION public.mkt_workforce_distribute(_kind text DEFAULT NULL, _limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _r record; _pick uuid; _n integer := 0; _hit integer;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('mkt_workforce_distribute')) THEN RETURN 0; END IF;

  FOR _r IN
    SELECT id, kind, subject_id FROM public.mkt_admin_assignments
     WHERE assignee IS NULL AND released_at IS NULL AND closed_at IS NULL
       AND (_kind IS NULL OR kind = _kind)
     ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
              created_at
     LIMIT GREATEST(COALESCE(_limit, 50), 1)
     FOR UPDATE SKIP LOCKED
  LOOP
    _pick := public.mkt_workforce_pick_assignee(_r.kind);
    IF _pick IS NULL THEN CONTINUE; END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = _pick, claimed_at = now(), auto_assigned = true, assigned_by = auth.uid()
     WHERE id = _r.id AND assignee IS NULL AND released_at IS NULL AND closed_at IS NULL;
    GET DIAGNOSTICS _hit = ROW_COUNT;
    IF _hit = 0 THEN CONTINUE; END IF;
    UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
    PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك',
      'نوع العمل: ' || _r.kind);
    PERFORM public.log_audit('mkt_admin_assignments','auto_assign', _r.id, NULL,
      jsonb_build_object('kind', _r.kind, 'subject_id', _r.subject_id, 'assignee', _pick), NULL);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- ---------- 6) manual assignment guardrails ----------
CREATE OR REPLACE FUNCTION public.mkt_workforce_can_take(_user_id uuid, _kind text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _st public.mkt_staff_status;
BEGIN
  IF NOT public.mkt_staff_eligible(_user_id, _kind) THEN RETURN 'invalid_assignee'; END IF;
  IF public.mkt_staff_on_leave(_user_id) THEN RETURN 'staff_on_leave'; END IF;
  SELECT * INTO _st FROM public.mkt_staff_status WHERE user_id = _user_id;
  IF _st.user_id IS NULL THEN RETURN 'ok'; END IF;
  IF _st.work_state IN ('leave','off') THEN RETURN 'staff_unavailable'; END IF;
  IF public.mkt_workforce_open_count(_user_id) >= _st.capacity_limit THEN RETURN 'capacity_reached'; END IF;
  RETURN 'ok';
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_can_take(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_workforce_can_take(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_transfer(_kind text, _subject_id uuid, _to uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _check text; _override boolean;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _to IS NULL OR NOT public.mkt_user_can(_to, public.mkt_queue_perm(_kind)) THEN
    RAISE EXCEPTION 'invalid_assignee';
  END IF;

  _check := public.mkt_workforce_can_take(_to, _kind);
  _override := public.mkt_is_platform_admin() OR public.mkt_staff_has('workforce.override');
  IF _check <> 'ok' AND NOT _override THEN RAISE EXCEPTION '%', _check; END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;
  IF _row.id IS NULL THEN
    INSERT INTO public.mkt_admin_assignments
      (kind, subject_id, assignee, claimed_at, transferred_from, transfer_reason, assigned_by)
    VALUES (_kind, _subject_id, _to, now(), auth.uid(), _reason, auth.uid()) RETURNING id INTO _id;
  ELSE
    IF NOT (public.mkt_is_platform_admin() OR public.mkt_workforce_manage() OR _row.assignee = auth.uid()) THEN
      RAISE EXCEPTION 'not_holder';
    END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = _to, claimed_at = now(), transferred_from = _row.assignee,
           transfer_reason = _reason, auto_assigned = false, assigned_by = auth.uid()
     WHERE id = _row.id RETURNING id INTO _id;
  END IF;

  UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _to;
  PERFORM public.mkt_notify(_to, NULL, 'work_assigned', 'تم تحويل عمل إليك', _reason);
  PERFORM public.log_audit('mkt_admin_assignments',
    CASE WHEN _check = 'ok' THEN 'transfer' ELSE 'transfer_override' END, _id,
    jsonb_build_object('assignee', _row.assignee),
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id, 'assignee', _to,
                       'guard', _check, 'override', _check <> 'ok'), _reason);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_admin_claim(_kind text, _subject_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _check text;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  _check := public.mkt_workforce_can_take(auth.uid(), _kind);
  IF _check <> 'ok' THEN RAISE EXCEPTION '%', _check; END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;

  IF _row.id IS NOT NULL THEN
    IF _row.assignee = auth.uid() THEN RETURN _row.id; END IF;
    IF _row.assignee IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = auth.uid(), claimed_at = now(), auto_assigned = false, assigned_by = auth.uid()
     WHERE id = _row.id AND assignee IS NULL RETURNING id INTO _id;
    IF _id IS NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;
  ELSE
    INSERT INTO public.mkt_admin_assignments (kind, subject_id, assignee, claimed_at, assigned_by)
    VALUES (_kind, _subject_id, auth.uid(), now(), auth.uid())
    RETURNING id INTO _id;
  END IF;

  UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = auth.uid();
  PERFORM public.log_audit('mkt_admin_assignments','claim', _id, NULL,
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id), NULL);
  RETURN _id;
END $$;

-- ---------- 7) counters that match the visible list ----------
CREATE OR REPLACE FUNCTION public.mkt_workforce_overview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN NOT public.mkt_workforce_manage() THEN '{}'::jsonb ELSE jsonb_build_object(
    'unassigned', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                    WHERE assignee IS NULL AND released_at IS NULL AND closed_at IS NULL),
    'open', (SELECT COUNT(*) FROM public.mkt_admin_assignments
              WHERE released_at IS NULL AND closed_at IS NULL),
    'urgent', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                WHERE released_at IS NULL AND closed_at IS NULL AND priority = 'urgent'),
    'overdue', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                 WHERE released_at IS NULL AND closed_at IS NULL
                   AND due_at IS NOT NULL AND due_at < now()),
    'available_staff', (SELECT COUNT(*) FROM public.mkt_staff_status s
                         WHERE s.work_state = 'available' AND s.accepts_auto
                           AND NOT public.mkt_staff_on_leave(s.user_id)),
    'on_leave', (SELECT COUNT(*) FROM public.mkt_staff_status s
                  WHERE public.mkt_staff_on_leave(s.user_id) OR s.work_state = 'leave')
  ) END
$$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_done_today(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
   WHERE a.assignee = _user_id AND a.progress = 'done' AND a.last_action_at IS NOT NULL
     AND (a.last_action_at AT TIME ZONE 'Asia/Riyadh')::date = (now() AT TIME ZONE 'Asia/Riyadh')::date
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_done_today(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_workforce_done_today(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_workforce_staff()
RETURNS TABLE(user_id uuid, label text, email text, platform_role text, perms text[], work_state text,
  effective_state text, capacity_limit integer, accepts_auto boolean, department text, note text,
  open_count integer, done_today integer, on_leave boolean, leave_ends_on date,
  last_assigned_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.user_id,
         COALESCE(p.full_name, up.display_name, p.email, 'موظف'),
         CASE WHEN public.mkt_workforce_manage() THEN p.email ELSE NULL END,
         pa.platform_role,
         COALESCE(ARRAY(SELECT sp.perm FROM public.mkt_staff_permissions sp WHERE sp.user_id = u.user_id), '{}'),
         COALESCE(s.work_state, 'off'),
         CASE WHEN public.mkt_staff_on_leave(u.user_id) THEN 'leave' ELSE COALESCE(s.work_state,'off') END,
         COALESCE(s.capacity_limit, 10),
         COALESCE(s.work_state, 'off') = 'available' AND NOT public.mkt_staff_on_leave(u.user_id),
         s.department, s.note,
         public.mkt_workforce_open_count(u.user_id),
         public.mkt_workforce_done_today(u.user_id),
         public.mkt_staff_on_leave(u.user_id),
         (SELECT MAX(l.ends_on) FROM public.mkt_staff_leaves l
           WHERE l.user_id = u.user_id AND l.cancelled_at IS NULL
             AND (now() AT TIME ZONE 'Asia/Riyadh')::date BETWEEN l.starts_on AND l.ends_on),
         s.last_assigned_at
    FROM (
      SELECT user_id FROM public.mkt_platform_admins
      UNION
      SELECT DISTINCT user_id FROM public.mkt_staff_permissions
      UNION
      SELECT user_id FROM public.mkt_staff_status
    ) u
    LEFT JOIN public.mkt_staff_status s ON s.user_id = u.user_id
    LEFT JOIN public.mkt_platform_admins pa ON pa.user_id = u.user_id
    LEFT JOIN public.profiles p ON p.user_id = u.user_id
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = u.user_id
   WHERE public.mkt_workforce_manage() OR u.user_id = auth.uid()
   ORDER BY 6, 12 DESC
$$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_my_status()
RETURNS TABLE(user_id uuid, work_state text, effective_state text, capacity_limit integer,
  accepts_auto boolean, department text, open_count integer, done_today integer,
  on_leave boolean, can_manage boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid(),
         COALESCE(s.work_state, 'off'),
         CASE WHEN public.mkt_staff_on_leave(auth.uid()) THEN 'leave'
              ELSE COALESCE(s.work_state, 'off') END,
         COALESCE(s.capacity_limit, 10),
         COALESCE(s.work_state,'off') = 'available' AND NOT public.mkt_staff_on_leave(auth.uid()),
         s.department,
         public.mkt_workforce_open_count(auth.uid()),
         public.mkt_workforce_done_today(auth.uid()),
         public.mkt_staff_on_leave(auth.uid()),
         public.mkt_workforce_manage()
    FROM (SELECT 1) one
    LEFT JOIN public.mkt_staff_status s ON s.user_id = auth.uid()
   WHERE auth.uid() IS NOT NULL
$$;

-- ---------- 8) reopen wiring ----------
CREATE OR REPLACE FUNCTION public.mkt_report_workforce_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_workforce_autoqueue('report', NEW.id, 'high');
  ELSIF NEW.status IN ('closed','rejected','resolved','dismissed','merged') THEN
    PERFORM public.mkt_workforce_close_item('report', NEW.id);
  ELSE
    PERFORM public.mkt_workforce_autoqueue('report', NEW.id, 'high');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_verification_workforce_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_workforce_autoqueue('verification', NEW.id, 'normal');
  ELSIF NEW.status IN ('approved','rejected','cancelled','withdrawn') THEN
    PERFORM public.mkt_workforce_close_item('verification', NEW.id);
  ELSE
    PERFORM public.mkt_workforce_autoqueue('verification', NEW.id, 'normal');
  END IF;
  RETURN NEW;
END $$;