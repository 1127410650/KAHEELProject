-- ===== helper: is this user any platform staff member =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin()
      OR EXISTS (SELECT 1 FROM public.mkt_staff_permissions p WHERE p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.mkt_staff_status s WHERE s.user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_workforce_is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_departments_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has('departments.manage')
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_departments_manage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_departments_manage() TO authenticated;

-- ===== reference: specialties =====
CREATE TABLE IF NOT EXISTS public.mkt_workforce_specialties (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  department_code text REFERENCES public.mkt_workforce_departments(code) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_workforce_specialties TO authenticated;
GRANT ALL ON public.mkt_workforce_specialties TO service_role;
ALTER TABLE public.mkt_workforce_specialties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "specialties_staff_read" ON public.mkt_workforce_specialties;
CREATE POLICY "specialties_staff_read" ON public.mkt_workforce_specialties
  FOR SELECT TO authenticated USING (public.mkt_workforce_is_staff());

-- ===== reference: work kinds =====
CREATE TABLE IF NOT EXISTS public.mkt_workforce_kinds (
  kind text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  department_code text REFERENCES public.mkt_workforce_departments(code) ON DELETE SET NULL,
  required_specialty text REFERENCES public.mkt_workforce_specialties(code) ON DELETE SET NULL,
  default_priority text NOT NULL DEFAULT 'normal',
  sla_minutes integer NOT NULL DEFAULT 1440,
  allow_general boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mkt_workforce_kinds
  DROP CONSTRAINT IF EXISTS mkt_workforce_kinds_priority_chk;
ALTER TABLE public.mkt_workforce_kinds
  ADD CONSTRAINT mkt_workforce_kinds_priority_chk
  CHECK (default_priority IN ('low','normal','high','urgent'));
GRANT SELECT ON public.mkt_workforce_kinds TO authenticated;
GRANT ALL ON public.mkt_workforce_kinds TO service_role;
ALTER TABLE public.mkt_workforce_kinds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kinds_staff_read" ON public.mkt_workforce_kinds;
CREATE POLICY "kinds_staff_read" ON public.mkt_workforce_kinds
  FOR SELECT TO authenticated USING (public.mkt_workforce_is_staff());

-- ===== staff extra departments / specialties =====
CREATE TABLE IF NOT EXISTS public.mkt_staff_departments (
  user_id uuid NOT NULL,
  department_code text NOT NULL REFERENCES public.mkt_workforce_departments(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, department_code)
);
GRANT SELECT ON public.mkt_staff_departments TO authenticated;
GRANT ALL ON public.mkt_staff_departments TO service_role;
ALTER TABLE public.mkt_staff_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_departments_read" ON public.mkt_staff_departments;
CREATE POLICY "staff_departments_read" ON public.mkt_staff_departments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_workforce_manage() OR public.mkt_departments_manage());

CREATE TABLE IF NOT EXISTS public.mkt_staff_specialties (
  user_id uuid NOT NULL,
  specialty_code text NOT NULL REFERENCES public.mkt_workforce_specialties(code) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, specialty_code)
);
GRANT SELECT ON public.mkt_staff_specialties TO authenticated;
GRANT ALL ON public.mkt_staff_specialties TO service_role;
ALTER TABLE public.mkt_staff_specialties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_specialties_read" ON public.mkt_staff_specialties;
CREATE POLICY "staff_specialties_read" ON public.mkt_staff_specialties
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_workforce_manage() OR public.mkt_departments_manage());

-- ===== staff status extensions =====
ALTER TABLE public.mkt_staff_status
  ADD COLUMN IF NOT EXISTS assign_priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS eligibility_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS substitute_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_today_at date,
  ADD COLUMN IF NOT EXISTS assigned_today integer NOT NULL DEFAULT 0;

ALTER TABLE public.mkt_workforce_departments
  ADD COLUMN IF NOT EXISTS pause_auto_when_off boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text;

-- ===== seed departments / specialties / kinds (idempotent, no deletes) =====
INSERT INTO public.mkt_workforce_departments (code, name_ar, name_en, queue_kinds, sort_order)
VALUES
  ('listings','مراجعة الإعلانات','Listing review', ARRAY['listing_review'], 10),
  ('reports','البلاغات والمخالفات','Reports & violations', ARRAY['report'], 20),
  ('verification','التوثيق','Verification', ARRAY['verification'], 30),
  ('businesses','مراجعة المنشآت','Business review', ARRAY['business_review'], 40),
  ('activities','الأنشطة والتصنيفات','Activities & categories', ARRAY['activity_suggestion'], 50),
  ('support','دعم المستخدمين','User support', ARRAY['account_review','admin_request'], 60),
  ('security','الأمان','Security', ARRAY['security_review'], 70),
  ('operations','العمليات','Operations', ARRAY['admin_request'], 80)
ON CONFLICT (code) DO UPDATE
  SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
      queue_kinds = EXCLUDED.queue_kinds, sort_order = EXCLUDED.sort_order,
      is_active = true, updated_at = now();

INSERT INTO public.mkt_workforce_specialties (code, name_ar, name_en, department_code, sort_order)
VALUES
  ('listing_moderation','تدقيق محتوى الإعلانات','Listing moderation','listings',10),
  ('report_handling','معالجة البلاغات','Report handling','reports',20),
  ('doc_verification','تدقيق المستندات','Document verification','verification',30),
  ('business_vetting','فحص المنشآت','Business vetting','businesses',40),
  ('taxonomy','التصنيفات والأنشطة','Taxonomy','activities',50),
  ('user_support','دعم المستخدمين','User support','support',60),
  ('fraud_safety','مكافحة الاحتيال والسلامة','Fraud & safety','security',70),
  ('operations','العمليات العامة','General operations','operations',80)
ON CONFLICT (code) DO UPDATE
  SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
      department_code = EXCLUDED.department_code, is_active = true, updated_at = now();

INSERT INTO public.mkt_workforce_kinds (kind, name_ar, name_en, department_code, required_specialty, default_priority, sla_minutes, allow_general, sort_order)
VALUES
  ('listing_review','مراجعة إعلان','Listing review','listings','listing_moderation','high',720,true,10),
  ('report','بلاغ','Report','reports','report_handling','high',480,true,20),
  ('verification','طلب توثيق','Verification request','verification','doc_verification','normal',1440,true,30),
  ('business_review','مراجعة منشأة','Business review','businesses','business_vetting','normal',1440,true,40),
  ('activity_suggestion','نشاط مقترح','Suggested activity','activities','taxonomy','low',2880,true,50),
  ('account_review','مراجعة مستخدم','User review','support','user_support','normal',1440,true,60),
  ('security_review','مراجعة أمنية','Security review','security','fraud_safety','urgent',240,false,70),
  ('admin_request','طلب إداري آخر','Other admin request','operations','operations','normal',1440,true,80)
ON CONFLICT (kind) DO UPDATE
  SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
      department_code = EXCLUDED.department_code,
      required_specialty = EXCLUDED.required_specialty,
      default_priority = EXCLUDED.default_priority,
      sla_minutes = EXCLUDED.sla_minutes,
      allow_general = EXCLUDED.allow_general,
      is_active = true, updated_at = now();

-- ===== eligibility =====
CREATE OR REPLACE FUNCTION public.mkt_staff_specialist(_user_id uuid, _kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN k.required_specialty IS NULL THEN true
    ELSE EXISTS (SELECT 1 FROM public.mkt_staff_specialties ss
                  WHERE ss.user_id = _user_id AND ss.specialty_code = k.required_specialty)
  END
  FROM public.mkt_workforce_kinds k WHERE k.kind = _kind
$$;

CREATE OR REPLACE FUNCTION public.mkt_staff_eligible(_user_id uuid, _kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_user_can(_user_id, public.mkt_queue_perm(_kind))
$$;

-- overdue count is part of fairness: a staff member sitting on overdue work gets new work last
CREATE OR REPLACE FUNCTION public.mkt_workforce_overdue_count(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
   WHERE a.assignee = _user_id AND a.closed_at IS NULL AND a.released_at IS NULL
     AND a.due_at IS NOT NULL AND a.due_at < now()
$$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_assigned_today(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
   WHERE a.assignee = _user_id
     AND (a.claimed_at AT TIME ZONE 'Asia/Riyadh')::date = (now() AT TIME ZONE 'Asia/Riyadh')::date
$$;

-- ===== fair picker: specialists first, then general when the kind allows it =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_pick_assignee(_kind text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _pick uuid; _allow_general boolean;
BEGIN
  SELECT COALESCE(k.allow_general, true) INTO _allow_general
    FROM public.mkt_workforce_kinds k WHERE k.kind = _kind;
  IF _allow_general IS NULL THEN _allow_general := true; END IF;

  -- pass 1: specialists
  SELECT s.user_id INTO _pick
    FROM public.mkt_staff_status s
   WHERE s.work_state = 'available'
     AND s.accepts_auto
     AND NOT public.mkt_staff_on_leave(s.user_id)
     AND public.mkt_staff_eligible(s.user_id, _kind)
     AND public.mkt_staff_specialist(s.user_id, _kind)
     AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit
   ORDER BY public.mkt_workforce_open_count(s.user_id) ASC,
            public.mkt_workforce_overdue_count(s.user_id) ASC,
            public.mkt_workforce_assigned_today(s.user_id) ASC,
            s.assign_priority ASC,
            s.last_assigned_at ASC NULLS FIRST,
            s.user_id
   LIMIT 1;
  IF _pick IS NOT NULL THEN RETURN _pick; END IF;

  IF NOT _allow_general THEN RETURN NULL; END IF;

  -- pass 2: any eligible available staff member
  SELECT s.user_id INTO _pick
    FROM public.mkt_staff_status s
   WHERE s.work_state = 'available'
     AND s.accepts_auto
     AND NOT public.mkt_staff_on_leave(s.user_id)
     AND public.mkt_staff_eligible(s.user_id, _kind)
     AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit
   ORDER BY public.mkt_workforce_open_count(s.user_id) ASC,
            public.mkt_workforce_overdue_count(s.user_id) ASC,
            public.mkt_workforce_assigned_today(s.user_id) ASC,
            s.assign_priority ASC,
            s.last_assigned_at ASC NULLS FIRST,
            s.user_id
   LIMIT 1;
  RETURN _pick;
END $$;

-- ===== enqueue now derives priority + due date from the work kind =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_enqueue(
  _kind text, _subject_id uuid, _priority text DEFAULT NULL, _due_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _pick uuid; _auto boolean;
        _k public.mkt_workforce_kinds; _prio text; _due timestamptz; _dept text;
BEGIN
  IF NOT (public.mkt_workforce_manage() OR public.mkt_admin_can(public.mkt_queue_perm(_kind))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _k FROM public.mkt_workforce_kinds WHERE kind = _kind;
  _prio := COALESCE(_priority, _k.default_priority, 'normal');
  IF _prio NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
  _due := COALESCE(_due_at, now() + make_interval(mins => COALESCE(_k.sla_minutes, 1440)));
  _dept := _k.department_code;

  -- idempotent: one open record per (kind, subject)
  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
   FOR UPDATE;
  IF _row.id IS NOT NULL THEN
    UPDATE public.mkt_admin_assignments
       SET priority = COALESCE(_priority, priority),
           due_at = COALESCE(_due_at, due_at, _due),
           department = COALESCE(department, _dept)
     WHERE id = _row.id;
    RETURN _row.id;
  END IF;

  SELECT COALESCE((value->>'enabled')::boolean, true) INTO _auto
    FROM public.mkt_platform_settings WHERE key = 'workforce.auto_assign';
  IF COALESCE(_auto, true) THEN _pick := public.mkt_workforce_pick_assignee(_kind); END IF;

  INSERT INTO public.mkt_admin_assignments
    (kind, subject_id, assignee, claimed_at, priority, due_at, auto_assigned, assigned_by, department)
  VALUES (_kind, _subject_id, _pick, CASE WHEN _pick IS NULL THEN NULL ELSE now() END,
          _prio, _due, _pick IS NOT NULL, auth.uid(), _dept)
  RETURNING id INTO _id;

  IF _pick IS NOT NULL THEN
    UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
    PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك', 'نوع العمل: ' || _kind);
  END IF;
  PERFORM public.log_audit('mkt_admin_assignments','enqueue', _id, NULL,
    jsonb_build_object('kind',_kind,'subject_id',_subject_id,'assignee',_pick,
                       'auto',_pick IS NOT NULL,'priority',_prio,'due_at',_due), NULL);
  RETURN _id;
END $$;

-- ===== manual override by a manager, reason mandatory =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_override_assign(
  _kind text, _subject_id uuid, _user_id uuid, _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'assignee_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_staff_status WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'not_staff';
  END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND closed_at IS NULL
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _row.id IS NULL THEN
    _id := public.mkt_workforce_enqueue(_kind, _subject_id, NULL, NULL);
    SELECT * INTO _row FROM public.mkt_admin_assignments WHERE id = _id FOR UPDATE;
  END IF;

  UPDATE public.mkt_admin_assignments
     SET assignee = _user_id, claimed_at = now(), released_at = NULL, released_reason = NULL,
         transferred_from = _row.assignee, transfer_reason = _reason,
         auto_assigned = false, assigned_by = auth.uid()
   WHERE id = _row.id;
  UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _user_id;
  PERFORM public.mkt_notify(_user_id, NULL, 'work_assigned', 'تم إسناد عمل إليك', 'نوع العمل: ' || _kind);
  PERFORM public.log_audit('mkt_admin_assignments','override_assign', _row.id,
    to_jsonb(_row), jsonb_build_object('assignee', _user_id), _reason);
  RETURN _row.id;
END $$;

-- ===== redistribute the open work of an unavailable staff member =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_reassign_from(_user_id uuid, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _r record; _pick uuid; _n integer := 0; _sub uuid;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT substitute_user_id INTO _sub FROM public.mkt_staff_status WHERE user_id = _user_id;

  FOR _r IN
    SELECT * FROM public.mkt_admin_assignments
     WHERE assignee = _user_id AND closed_at IS NULL AND released_at IS NULL
       -- unstarted work and urgent work move; work already in progress stays for a manager decision
       AND (progress = 'unstarted' OR priority = 'urgent')
     ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at
     FOR UPDATE
  LOOP
    _pick := NULL;
    IF _sub IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.mkt_staff_status s
                    WHERE s.user_id = _sub AND s.work_state = 'available'
                      AND NOT public.mkt_staff_on_leave(s.user_id)
                      AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit)
       AND public.mkt_staff_eligible(_sub, _r.kind)
    THEN _pick := _sub;
    ELSE _pick := public.mkt_workforce_pick_assignee(_r.kind);
    END IF;
    IF _pick = _user_id THEN _pick := NULL; END IF;

    UPDATE public.mkt_admin_assignments
       SET assignee = _pick,
           claimed_at = CASE WHEN _pick IS NULL THEN NULL ELSE now() END,
           transferred_from = _user_id,
           transfer_reason = _reason,
           auto_assigned = _pick IS NOT NULL,
           assigned_by = auth.uid()
     WHERE id = _r.id;
    IF _pick IS NOT NULL THEN
      UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
      PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل إليك', 'نوع العمل: ' || _r.kind);
    END IF;
    PERFORM public.log_audit('mkt_admin_assignments','reassign', _r.id, to_jsonb(_r),
      jsonb_build_object('assignee', _pick, 'from', _user_id), _reason);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- ===== department / specialty / kind admin RPCs =====
CREATE OR REPLACE FUNCTION public.mkt_workforce_department_save(
  _code text, _name_ar text, _name_en text, _queue_kinds text[], _sort integer,
  _is_active boolean, _pause_auto boolean, _description text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _old public.mkt_workforce_departments;
BEGIN
  IF NOT public.mkt_departments_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_code,'')) = '' OR btrim(COALESCE(_name_ar,'')) = '' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO _old FROM public.mkt_workforce_departments WHERE code = _code;
  INSERT INTO public.mkt_workforce_departments (code, name_ar, name_en, queue_kinds, sort_order, is_active, pause_auto_when_off, description)
  VALUES (_code, _name_ar, COALESCE(_name_en,_name_ar), COALESCE(_queue_kinds, '{}'), COALESCE(_sort,100),
          COALESCE(_is_active,true), COALESCE(_pause_auto,true), NULLIF(btrim(COALESCE(_description,'')),''))
  ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, queue_kinds = EXCLUDED.queue_kinds,
    sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
    pause_auto_when_off = EXCLUDED.pause_auto_when_off, description = EXCLUDED.description,
    updated_at = now();
  PERFORM public.log_audit('mkt_workforce_departments', CASE WHEN _old.code IS NULL THEN 'create' ELSE 'update' END,
    NULL, to_jsonb(_old), jsonb_build_object('code',_code,'name_ar',_name_ar,'is_active',COALESCE(_is_active,true)), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_specialty_save(
  _code text, _name_ar text, _name_en text, _department text, _sort integer, _is_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _old public.mkt_workforce_specialties;
BEGIN
  IF NOT public.mkt_departments_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_code,'')) = '' OR btrim(COALESCE(_name_ar,'')) = '' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO _old FROM public.mkt_workforce_specialties WHERE code = _code;
  INSERT INTO public.mkt_workforce_specialties (code, name_ar, name_en, department_code, sort_order, is_active)
  VALUES (_code, _name_ar, COALESCE(_name_en,_name_ar), _department, COALESCE(_sort,100), COALESCE(_is_active,true))
  ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, department_code = EXCLUDED.department_code,
    sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, updated_at = now();
  PERFORM public.log_audit('mkt_workforce_specialties', CASE WHEN _old.code IS NULL THEN 'create' ELSE 'update' END,
    NULL, to_jsonb(_old), jsonb_build_object('code',_code,'name_ar',_name_ar), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_kind_save(
  _kind text, _name_ar text, _name_en text, _department text, _required_specialty text,
  _default_priority text, _sla_minutes integer, _allow_general boolean, _is_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _old public.mkt_workforce_kinds;
BEGIN
  IF NOT public.mkt_departments_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_kind,'')) = '' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF COALESCE(_default_priority,'normal') NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
  SELECT * INTO _old FROM public.mkt_workforce_kinds WHERE kind = _kind;
  INSERT INTO public.mkt_workforce_kinds (kind, name_ar, name_en, department_code, required_specialty,
                                          default_priority, sla_minutes, allow_general, is_active)
  VALUES (_kind, COALESCE(_name_ar,_kind), COALESCE(_name_en,_name_ar,_kind), _department, _required_specialty,
          COALESCE(_default_priority,'normal'), GREATEST(COALESCE(_sla_minutes,1440),1),
          COALESCE(_allow_general,true), COALESCE(_is_active,true))
  ON CONFLICT (kind) DO UPDATE SET
    name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, department_code = EXCLUDED.department_code,
    required_specialty = EXCLUDED.required_specialty, default_priority = EXCLUDED.default_priority,
    sla_minutes = EXCLUDED.sla_minutes, allow_general = EXCLUDED.allow_general,
    is_active = EXCLUDED.is_active, updated_at = now();
  PERFORM public.log_audit('mkt_workforce_kinds', CASE WHEN _old.kind IS NULL THEN 'create' ELSE 'update' END,
    NULL, to_jsonb(_old), jsonb_build_object('kind',_kind,'department',_department,
      'required_specialty',_required_specialty,'allow_general',COALESCE(_allow_general,true)), NULL);
END $$;

-- staff department / specialty assignment
CREATE OR REPLACE FUNCTION public.mkt_workforce_set_staff_profile(
  _user_id uuid, _primary_department text, _extra_departments text[], _specialties text[],
  _eligibility_level integer, _assign_priority integer, _substitute uuid, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _old jsonb;
BEGIN
  IF NOT (public.mkt_departments_manage() OR public.mkt_workforce_manage()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF _substitute IS NOT NULL AND _substitute = _user_id THEN RAISE EXCEPTION 'substitute_self'; END IF;

  SELECT jsonb_build_object(
      'status', to_jsonb(s),
      'departments', (SELECT COALESCE(jsonb_agg(d.department_code), '[]'::jsonb) FROM public.mkt_staff_departments d WHERE d.user_id = _user_id),
      'specialties', (SELECT COALESCE(jsonb_agg(x.specialty_code), '[]'::jsonb) FROM public.mkt_staff_specialties x WHERE x.user_id = _user_id))
    INTO _old FROM public.mkt_staff_status s WHERE s.user_id = _user_id;

  INSERT INTO public.mkt_staff_status (user_id, department, eligibility_level, assign_priority, substitute_user_id, updated_by)
  VALUES (_user_id, _primary_department, COALESCE(_eligibility_level,1), COALESCE(_assign_priority,100), _substitute, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    department = _primary_department,
    eligibility_level = COALESCE(_eligibility_level, public.mkt_staff_status.eligibility_level),
    assign_priority = COALESCE(_assign_priority, public.mkt_staff_status.assign_priority),
    substitute_user_id = _substitute,
    updated_by = auth.uid(), updated_at = now();

  DELETE FROM public.mkt_staff_departments WHERE user_id = _user_id;
  IF _extra_departments IS NOT NULL THEN
    INSERT INTO public.mkt_staff_departments (user_id, department_code, created_by)
    SELECT _user_id, c, auth.uid() FROM unnest(_extra_departments) c
     WHERE c IS NOT NULL AND c <> '' AND EXISTS (SELECT 1 FROM public.mkt_workforce_departments d WHERE d.code = c)
    ON CONFLICT DO NOTHING;
  END IF;

  DELETE FROM public.mkt_staff_specialties WHERE user_id = _user_id;
  IF _specialties IS NOT NULL THEN
    INSERT INTO public.mkt_staff_specialties (user_id, specialty_code, created_by)
    SELECT _user_id, c, auth.uid() FROM unnest(_specialties) c
     WHERE c IS NOT NULL AND c <> '' AND EXISTS (SELECT 1 FROM public.mkt_workforce_specialties s WHERE s.code = c)
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.log_audit('mkt_staff_status','profile_update', NULL, _old,
    jsonb_build_object('user_id',_user_id,'primary_department',_primary_department,
      'extra_departments', to_jsonb(COALESCE(_extra_departments,'{}')),
      'specialties', to_jsonb(COALESCE(_specialties,'{}')),
      'eligibility_level',_eligibility_level,'assign_priority',_assign_priority,'substitute',_substitute), _reason);
END $$;

-- departments overview for the admin page
CREATE OR REPLACE FUNCTION public.mkt_workforce_departments_overview()
RETURNS TABLE (
  code text, name_ar text, name_en text, description text, is_active boolean,
  pause_auto_when_off boolean, sort_order integer, queue_kinds text[],
  staff_count integer, open_count integer, unassigned_count integer, overdue_count integer,
  specialties jsonb, kinds jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT (public.mkt_departments_manage() OR public.mkt_workforce_manage()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT d.code, d.name_ar, d.name_en, d.description, d.is_active, d.pause_auto_when_off, d.sort_order, d.queue_kinds,
    (SELECT COUNT(*)::int FROM public.mkt_staff_status s
      WHERE s.department = d.code
         OR EXISTS (SELECT 1 FROM public.mkt_staff_departments sd WHERE sd.user_id = s.user_id AND sd.department_code = d.code)),
    (SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
      WHERE a.closed_at IS NULL AND a.released_at IS NULL
        AND a.kind IN (SELECT k.kind FROM public.mkt_workforce_kinds k WHERE k.department_code = d.code)),
    (SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
      WHERE a.closed_at IS NULL AND a.assignee IS NULL
        AND a.kind IN (SELECT k.kind FROM public.mkt_workforce_kinds k WHERE k.department_code = d.code)),
    (SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
      WHERE a.closed_at IS NULL AND a.released_at IS NULL AND a.due_at IS NOT NULL AND a.due_at < now()
        AND a.kind IN (SELECT k.kind FROM public.mkt_workforce_kinds k WHERE k.department_code = d.code)),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('code',s.code,'name_ar',s.name_ar,'name_en',s.name_en,
        'is_active',s.is_active,'staff_count',(SELECT COUNT(*)::int FROM public.mkt_staff_specialties ss WHERE ss.specialty_code = s.code))
        ORDER BY s.sort_order), '[]'::jsonb)
       FROM public.mkt_workforce_specialties s WHERE s.department_code = d.code),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',k.kind,'name_ar',k.name_ar,'name_en',k.name_en,
        'required_specialty',k.required_specialty,'default_priority',k.default_priority,
        'sla_minutes',k.sla_minutes,'allow_general',k.allow_general,'is_active',k.is_active) ORDER BY k.sort_order), '[]'::jsonb)
       FROM public.mkt_workforce_kinds k WHERE k.department_code = d.code)
  FROM public.mkt_workforce_departments d
  ORDER BY d.sort_order, d.code;
END $$;

-- ===== least-privilege execute grants =====
DO $$
DECLARE _f text;
BEGIN
  FOR _f IN SELECT unnest(ARRAY[
    'mkt_staff_specialist(uuid,text)','mkt_staff_eligible(uuid,text)',
    'mkt_workforce_overdue_count(uuid)','mkt_workforce_assigned_today(uuid)',
    'mkt_workforce_pick_assignee(text)',
    'mkt_workforce_enqueue(text,uuid,text,timestamptz)',
    'mkt_workforce_override_assign(text,uuid,uuid,text)',
    'mkt_workforce_reassign_from(uuid,text)',
    'mkt_workforce_department_save(text,text,text,text[],integer,boolean,boolean,text)',
    'mkt_workforce_specialty_save(text,text,text,text,integer,boolean)',
    'mkt_workforce_kind_save(text,text,text,text,text,text,integer,boolean,boolean)',
    'mkt_workforce_set_staff_profile(uuid,text,text[],text[],integer,integer,uuid,text)',
    'mkt_workforce_departments_overview()'])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', _f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _f);
  END LOOP;
END $$;