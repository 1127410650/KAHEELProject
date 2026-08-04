-- ===== permission helpers =====
CREATE OR REPLACE FUNCTION public.mkt_attendance_can_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has('attendance.view')
      OR public.mkt_staff_has('attendance.manage') OR public.mkt_staff_has('attendance.approve')
$$;
CREATE OR REPLACE FUNCTION public.mkt_attendance_can_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has('attendance.manage')
$$;
CREATE OR REPLACE FUNCTION public.mkt_attendance_can_approve()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has('attendance.approve')
      OR public.mkt_staff_has('attendance.manage')
$$;

-- ===== shift templates =====
CREATE TABLE IF NOT EXISTS public.mkt_shift_templates (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  kind text NOT NULL DEFAULT 'fixed',
  start_time time,
  end_time time,
  break_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_shift_templates_kind_chk CHECK (kind IN ('fixed','rotating','flex','rest','holiday'))
);
GRANT SELECT ON public.mkt_shift_templates TO authenticated;
GRANT ALL ON public.mkt_shift_templates TO service_role;
ALTER TABLE public.mkt_shift_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shift_templates_staff_read" ON public.mkt_shift_templates;
CREATE POLICY "shift_templates_staff_read" ON public.mkt_shift_templates
  FOR SELECT TO authenticated USING (public.mkt_workforce_is_staff());

INSERT INTO public.mkt_shift_templates (code, name_ar, name_en, kind, start_time, end_time, break_minutes, sort_order)
VALUES
  ('morning','الفترة الصباحية','Morning shift','fixed','09:00','17:00',60,10),
  ('evening','الفترة المسائية','Evening shift','fixed','16:00','23:00',30,20),
  ('rotating','مناوبة متغيرة','Rotating shift','rotating',NULL,NULL,30,30),
  ('flex','عمل مرن','Flexible hours','flex',NULL,NULL,0,40),
  ('rest','يوم راحة','Rest day','rest',NULL,NULL,0,50),
  ('holiday','عطلة','Holiday','holiday',NULL,NULL,0,60)
ON CONFLICT (code) DO UPDATE SET name_ar=EXCLUDED.name_ar, name_en=EXCLUDED.name_en,
  kind=EXCLUDED.kind, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
  break_minutes=EXCLUDED.break_minutes, is_active=true, updated_at=now();

-- ===== per-day shifts =====
CREATE TABLE IF NOT EXISTS public.mkt_staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  template_code text REFERENCES public.mkt_shift_templates(code) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'fixed',
  planned_start time,
  planned_end time,
  planned_minutes integer NOT NULL DEFAULT 0,
  remote boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date),
  CONSTRAINT mkt_staff_shifts_kind_chk CHECK (kind IN ('fixed','rotating','flex','rest','holiday'))
);
GRANT SELECT ON public.mkt_staff_shifts TO authenticated;
GRANT ALL ON public.mkt_staff_shifts TO service_role;
ALTER TABLE public.mkt_staff_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_shifts_read" ON public.mkt_staff_shifts;
CREATE POLICY "staff_shifts_read" ON public.mkt_staff_shifts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_attendance_can_view());

-- ===== attendance days =====
CREATE TABLE IF NOT EXISTS public.mkt_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  source text NOT NULL DEFAULT 'self',
  remote boolean NOT NULL DEFAULT false,
  planned_minutes integer NOT NULL DEFAULT 0,
  actual_minutes integer NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  note text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date),
  CONSTRAINT mkt_attendance_source_chk CHECK (source IN ('self','admin')),
  CONSTRAINT mkt_attendance_status_chk CHECK (status IN ('open','present','late','early_leave','absent','remote','leave','rest','holiday'))
);
GRANT SELECT ON public.mkt_attendance TO authenticated;
GRANT ALL ON public.mkt_attendance TO service_role;
ALTER TABLE public.mkt_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_read" ON public.mkt_attendance;
CREATE POLICY "attendance_read" ON public.mkt_attendance
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_attendance_can_view());

-- ===== append-only edit trail =====
CREATE TABLE IF NOT EXISTS public.mkt_attendance_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.mkt_attendance(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text NOT NULL,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_attendance_edits TO authenticated;
GRANT ALL ON public.mkt_attendance_edits TO service_role;
ALTER TABLE public.mkt_attendance_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_edits_read" ON public.mkt_attendance_edits;
CREATE POLICY "attendance_edits_read" ON public.mkt_attendance_edits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_attendance_can_view());

CREATE OR REPLACE FUNCTION public.mkt_append_only_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'append_only_record';
END $$;
DROP TRIGGER IF EXISTS trg_mkt_attendance_edits_append_only ON public.mkt_attendance_edits;
CREATE TRIGGER trg_mkt_attendance_edits_append_only
  BEFORE UPDATE OR DELETE ON public.mkt_attendance_edits
  FOR EACH ROW EXECUTE FUNCTION public.mkt_append_only_guard();

-- ===== planned shift resolution + recompute =====
CREATE OR REPLACE FUNCTION public.mkt_shift_for(_user_id uuid, _date date)
RETURNS public.mkt_staff_shifts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT * FROM public.mkt_staff_shifts WHERE user_id = _user_id AND work_date = _date
$$;

CREATE OR REPLACE FUNCTION public.mkt_attendance_recompute(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _a public.mkt_attendance; _s public.mkt_staff_shifts;
        _planned integer; _actual integer; _late integer; _early integer; _over integer;
        _status text; _plan_start timestamptz; _plan_end timestamptz;
BEGIN
  SELECT * INTO _a FROM public.mkt_attendance WHERE id = _id;
  IF _a.id IS NULL THEN RETURN; END IF;
  SELECT * INTO _s FROM public.mkt_staff_shifts WHERE user_id = _a.user_id AND work_date = _a.work_date;

  _planned := COALESCE(_s.planned_minutes, 0);
  IF _s.planned_start IS NOT NULL THEN
    _plan_start := ((_a.work_date::text || ' ' || _s.planned_start::text)::timestamp AT TIME ZONE 'Asia/Riyadh');
  END IF;
  IF _s.planned_end IS NOT NULL THEN
    _plan_end := ((_a.work_date::text || ' ' || _s.planned_end::text)::timestamp AT TIME ZONE 'Asia/Riyadh');
  END IF;

  _actual := CASE WHEN _a.checked_in_at IS NOT NULL AND _a.checked_out_at IS NOT NULL
                  THEN GREATEST(0, (EXTRACT(EPOCH FROM (_a.checked_out_at - _a.checked_in_at)) / 60)::int
                                   - COALESCE((SELECT break_minutes FROM public.mkt_shift_templates WHERE code = _s.template_code), 0))
                  ELSE 0 END;
  _late := CASE WHEN _a.checked_in_at IS NOT NULL AND _plan_start IS NOT NULL AND _a.checked_in_at > _plan_start
                THEN (EXTRACT(EPOCH FROM (_a.checked_in_at - _plan_start)) / 60)::int ELSE 0 END;
  _early := CASE WHEN _a.checked_out_at IS NOT NULL AND _plan_end IS NOT NULL AND _a.checked_out_at < _plan_end
                 THEN (EXTRACT(EPOCH FROM (_plan_end - _a.checked_out_at)) / 60)::int ELSE 0 END;
  _over := CASE WHEN _planned > 0 AND _actual > _planned THEN _actual - _planned ELSE 0 END;

  IF public.mkt_staff_on_leave_at(_a.user_id, _a.work_date) THEN _status := 'leave';
  ELSIF COALESCE(_s.kind,'') = 'rest' THEN _status := 'rest';
  ELSIF COALESCE(_s.kind,'') = 'holiday' THEN _status := 'holiday';
  ELSIF _a.checked_in_at IS NULL THEN
    _status := CASE WHEN _a.work_date < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN 'absent' ELSE 'open' END;
  ELSIF _a.checked_out_at IS NULL THEN _status := 'open';
  ELSIF _a.remote THEN _status := 'remote';
  ELSIF _late > 0 THEN _status := 'late';
  ELSIF _early > 0 THEN _status := 'early_leave';
  ELSE _status := 'present';
  END IF;

  UPDATE public.mkt_attendance
     SET planned_minutes = _planned, actual_minutes = _actual, late_minutes = _late,
         early_leave_minutes = _early, overtime_minutes = _over, status = _status, updated_at = now()
   WHERE id = _id;
END $$;

-- leave lookup for a specific date (the existing helper only answers "today")
CREATE OR REPLACE FUNCTION public.mkt_staff_on_leave_at(_user_id uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_staff_leaves l
                  WHERE l.user_id = _user_id AND l.cancelled_at IS NULL
                    AND _date BETWEEN l.starts_on AND l.ends_on)
$$;

-- ===== self check-in / check-out (manual only, no location tracking) =====
CREATE OR REPLACE FUNCTION public.mkt_attendance_check_in(_remote boolean DEFAULT false, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _today date; _row public.mkt_attendance; _s public.mkt_staff_shifts; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.mkt_workforce_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  _today := (now() AT TIME ZONE 'Asia/Riyadh')::date;

  SELECT * INTO _row FROM public.mkt_attendance WHERE user_id = _uid AND work_date = _today FOR UPDATE;
  IF _row.id IS NOT NULL AND _row.checked_in_at IS NOT NULL THEN
    IF _row.checked_out_at IS NULL THEN RETURN _row.id; END IF; -- idempotent
    RAISE EXCEPTION 'already_checked_out';
  END IF;

  SELECT * INTO _s FROM public.mkt_staff_shifts WHERE user_id = _uid AND work_date = _today;
  INSERT INTO public.mkt_attendance (user_id, work_date, checked_in_at, source, remote,
                                     planned_minutes, note, created_by, updated_by)
  VALUES (_uid, _today, now(), 'self', COALESCE(_remote, COALESCE(_s.remote,false)),
          COALESCE(_s.planned_minutes,0), NULLIF(btrim(COALESCE(_note,'')),''), _uid, _uid)
  ON CONFLICT (user_id, work_date) DO UPDATE
    SET checked_in_at = now(), source = 'self', remote = COALESCE(_remote, public.mkt_attendance.remote),
        updated_by = _uid, updated_at = now()
  RETURNING id INTO _id;

  PERFORM public.mkt_attendance_recompute(_id);
  PERFORM public.log_audit('mkt_attendance','check_in', _id, NULL,
    jsonb_build_object('user_id',_uid,'work_date',_today,'remote',COALESCE(_remote,false)), NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_attendance_check_out(_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _today date; _row public.mkt_attendance;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  _today := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  SELECT * INTO _row FROM public.mkt_attendance WHERE user_id = _uid AND work_date = _today FOR UPDATE;
  IF _row.id IS NULL OR _row.checked_in_at IS NULL THEN RAISE EXCEPTION 'not_checked_in'; END IF;
  IF _row.checked_out_at IS NOT NULL THEN RETURN _row.id; END IF; -- idempotent
  UPDATE public.mkt_attendance
     SET checked_out_at = now(), note = COALESCE(NULLIF(btrim(COALESCE(_note,'')),''), note),
         updated_by = _uid, updated_at = now()
   WHERE id = _row.id;
  PERFORM public.mkt_attendance_recompute(_row.id);
  PERFORM public.log_audit('mkt_attendance','check_out', _row.id, to_jsonb(_row),
    jsonb_build_object('checked_out_at', now()), NULL);
  RETURN _row.id;
END $$;

-- ===== administrative correction: reason mandatory, original values kept =====
CREATE OR REPLACE FUNCTION public.mkt_attendance_admin_set(
  _user_id uuid, _work_date date, _checked_in timestamptz, _checked_out timestamptz,
  _remote boolean, _status text, _note text, _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_attendance; _id uuid; _after public.mkt_attendance;
BEGIN
  IF NOT public.mkt_attendance_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _user_id IS NULL OR _work_date IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF _checked_in IS NOT NULL AND _checked_out IS NOT NULL AND _checked_out < _checked_in THEN
    RAISE EXCEPTION 'invalid_range';
  END IF;

  SELECT * INTO _row FROM public.mkt_attendance WHERE user_id = _user_id AND work_date = _work_date FOR UPDATE;
  IF _row.id IS NULL THEN
    INSERT INTO public.mkt_attendance (user_id, work_date, checked_in_at, checked_out_at, source, remote,
                                       note, created_by, updated_by)
    VALUES (_user_id, _work_date, _checked_in, _checked_out, 'admin', COALESCE(_remote,false),
            NULLIF(btrim(COALESCE(_note,'')),''), auth.uid(), auth.uid())
    RETURNING id INTO _id;
  ELSE
    _id := _row.id;
    UPDATE public.mkt_attendance
       SET checked_in_at = _checked_in, checked_out_at = _checked_out, source = 'admin',
           remote = COALESCE(_remote, remote), note = COALESCE(NULLIF(btrim(COALESCE(_note,'')),''), note),
           updated_by = auth.uid(), updated_at = now()
     WHERE id = _id;
  END IF;

  PERFORM public.mkt_attendance_recompute(_id);
  IF _status IS NOT NULL AND _status <> '' THEN
    UPDATE public.mkt_attendance SET status = _status WHERE id = _id;
  END IF;
  SELECT * INTO _after FROM public.mkt_attendance WHERE id = _id;

  INSERT INTO public.mkt_attendance_edits (attendance_id, user_id, before_value, after_value, reason, actor)
  VALUES (_id, _user_id, to_jsonb(_row), to_jsonb(_after), btrim(_reason), auth.uid());
  PERFORM public.log_audit('mkt_attendance','admin_set', _id, to_jsonb(_row), to_jsonb(_after), _reason);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_attendance_approve(_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_attendance;
BEGIN
  IF NOT public.mkt_attendance_can_approve() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _row FROM public.mkt_attendance WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.mkt_attendance SET approved_by = auth.uid(), approved_at = now(), updated_at = now() WHERE id = _id;
  PERFORM public.log_audit('mkt_attendance','approve', _id, to_jsonb(_row),
    jsonb_build_object('approved_by', auth.uid()), _note);
END $$;

-- ===== shift planning =====
CREATE OR REPLACE FUNCTION public.mkt_shift_set(
  _user_id uuid, _work_date date, _template text, _planned_start time, _planned_end time,
  _remote boolean, _note text, _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _t public.mkt_shift_templates; _old public.mkt_staff_shifts; _id uuid;
        _kind text; _ps time; _pe time; _minutes integer;
BEGIN
  IF NOT public.mkt_attendance_can_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id IS NULL OR _work_date IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO _t FROM public.mkt_shift_templates WHERE code = _template;
  _kind := COALESCE(_t.kind, 'fixed');
  _ps := COALESCE(_planned_start, _t.start_time);
  _pe := COALESCE(_planned_end, _t.end_time);
  _minutes := CASE
    WHEN _kind IN ('rest','holiday') THEN 0
    WHEN _ps IS NOT NULL AND _pe IS NOT NULL THEN
      GREATEST(0, (EXTRACT(EPOCH FROM (_pe - _ps)) / 60)::int - COALESCE(_t.break_minutes,0))
    ELSE 0 END;

  SELECT * INTO _old FROM public.mkt_staff_shifts WHERE user_id = _user_id AND work_date = _work_date FOR UPDATE;
  INSERT INTO public.mkt_staff_shifts (user_id, work_date, template_code, kind, planned_start, planned_end,
                                       planned_minutes, remote, note, created_by, updated_by)
  VALUES (_user_id, _work_date, _template, _kind, _ps, _pe, _minutes, COALESCE(_remote,false),
          NULLIF(btrim(COALESCE(_note,'')),''), auth.uid(), auth.uid())
  ON CONFLICT (user_id, work_date) DO UPDATE
    SET template_code = EXCLUDED.template_code, kind = EXCLUDED.kind,
        planned_start = EXCLUDED.planned_start, planned_end = EXCLUDED.planned_end,
        planned_minutes = EXCLUDED.planned_minutes, remote = EXCLUDED.remote,
        note = EXCLUDED.note, updated_by = auth.uid(), updated_at = now()
  RETURNING id INTO _id;

  UPDATE public.mkt_attendance SET planned_minutes = _minutes
   WHERE user_id = _user_id AND work_date = _work_date;
  PERFORM public.mkt_attendance_recompute((SELECT id FROM public.mkt_attendance
    WHERE user_id = _user_id AND work_date = _work_date));
  PERFORM public.log_audit('mkt_staff_shifts', CASE WHEN _old.id IS NULL THEN 'create' ELSE 'update' END,
    _id, to_jsonb(_old), jsonb_build_object('user_id',_user_id,'work_date',_work_date,
      'template',_template,'planned_minutes',_minutes,'remote',COALESCE(_remote,false)), _reason);
  RETURN _id;
END $$;

-- ===== reads =====
CREATE OR REPLACE FUNCTION public.mkt_attendance_list(_from date, _to date, _user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, user_id uuid, label text, work_date date, checked_in_at timestamptz, checked_out_at timestamptz,
  source text, remote boolean, planned_minutes integer, actual_minutes integer, late_minutes integer,
  early_leave_minutes integer, overtime_minutes integer, status text, note text,
  approved_at timestamptz, shift_template text, shift_kind text, edits_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT (public.mkt_attendance_can_view() OR _user_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.id, a.user_id,
         COALESCE(NULLIF(btrim(p.full_name),''), '') AS label,
         a.work_date, a.checked_in_at, a.checked_out_at, a.source, a.remote,
         a.planned_minutes, a.actual_minutes, a.late_minutes, a.early_leave_minutes, a.overtime_minutes,
         a.status, a.note, a.approved_at, s.template_code, s.kind,
         (SELECT COUNT(*)::int FROM public.mkt_attendance_edits e WHERE e.attendance_id = a.id)
    FROM public.mkt_attendance a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.mkt_staff_shifts s ON s.user_id = a.user_id AND s.work_date = a.work_date
   WHERE a.work_date BETWEEN COALESCE(_from, a.work_date) AND COALESCE(_to, a.work_date)
     AND (_user_id IS NULL OR a.user_id = _user_id)
     AND (public.mkt_attendance_can_view() OR a.user_id = auth.uid())
   ORDER BY a.work_date DESC, label;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_attendance_my(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE (
  id uuid, work_date date, checked_in_at timestamptz, checked_out_at timestamptz, source text,
  remote boolean, planned_minutes integer, actual_minutes integer, late_minutes integer,
  early_leave_minutes integer, overtime_minutes integer, status text, note text,
  shift_template text, shift_kind text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _f date; _t date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  _t := COALESCE(_to, (now() AT TIME ZONE 'Asia/Riyadh')::date);
  _f := COALESCE(_from, _t - 30);
  RETURN QUERY
  SELECT a.id, a.work_date, a.checked_in_at, a.checked_out_at, a.source, a.remote,
         a.planned_minutes, a.actual_minutes, a.late_minutes, a.early_leave_minutes, a.overtime_minutes,
         a.status, a.note, s.template_code, s.kind
    FROM public.mkt_attendance a
    LEFT JOIN public.mkt_staff_shifts s ON s.user_id = a.user_id AND s.work_date = a.work_date
   WHERE a.user_id = auth.uid() AND a.work_date BETWEEN _f AND _t
   ORDER BY a.work_date DESC;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_shifts_list(_from date, _to date, _user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, user_id uuid, label text, work_date date, template_code text, kind text,
  planned_start time, planned_end time, planned_minutes integer, remote boolean, note text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT (public.mkt_attendance_can_view() OR _user_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.user_id, COALESCE(NULLIF(btrim(p.full_name),''),'') AS label, s.work_date,
         s.template_code, s.kind, s.planned_start, s.planned_end, s.planned_minutes, s.remote, s.note
    FROM public.mkt_staff_shifts s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
   WHERE s.work_date BETWEEN COALESCE(_from, s.work_date) AND COALESCE(_to, s.work_date)
     AND (_user_id IS NULL OR s.user_id = _user_id)
     AND (public.mkt_attendance_can_view() OR s.user_id = auth.uid())
   ORDER BY s.work_date DESC, label;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_attendance_edits_list(_attendance_id uuid)
RETURNS TABLE (id uuid, before_value jsonb, after_value jsonb, reason text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mkt_attendance_can_view() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT e.id, e.before_value, e.after_value, e.reason, e.created_at
    FROM public.mkt_attendance_edits e WHERE e.attendance_id = _attendance_id
   ORDER BY e.created_at DESC;
END $$;

-- ===== attendance-aware auto assignment (opt-in setting) =====
CREATE OR REPLACE FUNCTION public.mkt_staff_on_shift(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_attendance a
     WHERE a.user_id = _user_id
       AND a.work_date = (now() AT TIME ZONE 'Asia/Riyadh')::date
       AND a.checked_in_at IS NOT NULL AND a.checked_out_at IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_require_attendance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings
                    WHERE key = 'workforce.require_attendance'), false)
$$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_pick_assignee(_kind text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _pick uuid; _allow_general boolean; _need_att boolean;
BEGIN
  SELECT COALESCE(k.allow_general, true) INTO _allow_general
    FROM public.mkt_workforce_kinds k WHERE k.kind = _kind;
  IF _allow_general IS NULL THEN _allow_general := true; END IF;
  _need_att := public.mkt_workforce_require_attendance();

  SELECT s.user_id INTO _pick
    FROM public.mkt_staff_status s
   WHERE s.work_state = 'available' AND s.accepts_auto
     AND NOT public.mkt_staff_on_leave(s.user_id)
     AND (NOT _need_att OR public.mkt_staff_on_shift(s.user_id))
     AND public.mkt_staff_eligible(s.user_id, _kind)
     AND public.mkt_staff_specialist(s.user_id, _kind)
     AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit
   ORDER BY public.mkt_workforce_open_count(s.user_id) ASC,
            public.mkt_workforce_overdue_count(s.user_id) ASC,
            public.mkt_workforce_assigned_today(s.user_id) ASC,
            s.assign_priority ASC, s.last_assigned_at ASC NULLS FIRST, s.user_id
   LIMIT 1;
  IF _pick IS NOT NULL THEN RETURN _pick; END IF;
  IF NOT _allow_general THEN RETURN NULL; END IF;

  SELECT s.user_id INTO _pick
    FROM public.mkt_staff_status s
   WHERE s.work_state = 'available' AND s.accepts_auto
     AND NOT public.mkt_staff_on_leave(s.user_id)
     AND (NOT _need_att OR public.mkt_staff_on_shift(s.user_id))
     AND public.mkt_staff_eligible(s.user_id, _kind)
     AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit
   ORDER BY public.mkt_workforce_open_count(s.user_id) ASC,
            public.mkt_workforce_overdue_count(s.user_id) ASC,
            public.mkt_workforce_assigned_today(s.user_id) ASC,
            s.assign_priority ASC, s.last_assigned_at ASC NULLS FIRST, s.user_id
   LIMIT 1;
  RETURN _pick;
END $$;

-- ===== least-privilege execute grants =====
DO $$
DECLARE _f text;
BEGIN
  FOR _f IN SELECT unnest(ARRAY[
    'mkt_attendance_can_view()','mkt_attendance_can_manage()','mkt_attendance_can_approve()',
    'mkt_staff_on_leave_at(uuid,date)','mkt_shift_for(uuid,date)','mkt_attendance_recompute(uuid)',
    'mkt_attendance_check_in(boolean,text)','mkt_attendance_check_out(text)',
    'mkt_attendance_admin_set(uuid,date,timestamptz,timestamptz,boolean,text,text,text)',
    'mkt_attendance_approve(uuid,text)',
    'mkt_shift_set(uuid,date,text,time,time,boolean,text,text)',
    'mkt_attendance_list(date,date,uuid)','mkt_attendance_my(date,date)',
    'mkt_shifts_list(date,date,uuid)','mkt_attendance_edits_list(uuid)',
    'mkt_staff_on_shift(uuid)','mkt_workforce_require_attendance()',
    'mkt_workforce_pick_assignee(text)','mkt_append_only_guard()',
    'mkt_admin_assignments_kind_guard()'])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', _f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _f);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_append_only_guard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_assignments_kind_guard() FROM authenticated;