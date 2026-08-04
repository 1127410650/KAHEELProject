-- ============================================================
-- Workforce distribution & staff operations (platform admin)
-- ============================================================

-- 1. Reference departments -----------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_workforce_departments (
  code        text PRIMARY KEY,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  queue_kinds text[] NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_workforce_departments TO authenticated;
GRANT ALL ON public.mkt_workforce_departments TO service_role;
ALTER TABLE public.mkt_workforce_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read departments" ON public.mkt_workforce_departments
  FOR SELECT TO authenticated USING (public.is_staff() OR public.mkt_is_platform_admin());

INSERT INTO public.mkt_workforce_departments (code, name_ar, name_en, queue_kinds, sort_order) VALUES
  ('listings',      'مراجعة الإعلانات', 'Listing review',     ARRAY['listing_review'],       10),
  ('reports',       'البلاغات',          'Reports',            ARRAY['report'],               20),
  ('verification',  'التوثيق',           'Verification',       ARRAY['verification'],         30),
  ('accounts',      'الحسابات',          'Accounts',           ARRAY['account_review'],       40),
  ('businesses',    'المنشآت',           'Businesses',         ARRAY['business_review'],      50),
  ('activities',    'الأنشطة',           'Activities',         ARRAY['activity_suggestion'],  60),
  ('support',       'الدعم',             'Support',            '{}',                          70),
  ('finance',       'المالية',           'Finance',            '{}',                          80)
ON CONFLICT (code) DO NOTHING;

-- 2. Staff operational status (separate from account state) ---
CREATE TABLE IF NOT EXISTS public.mkt_staff_status (
  user_id          uuid PRIMARY KEY,
  work_state       text NOT NULL DEFAULT 'off'
                   CHECK (work_state IN ('available','busy','away','leave','off')),
  capacity_limit   integer NOT NULL DEFAULT 10 CHECK (capacity_limit BETWEEN 1 AND 200),
  accepts_auto     boolean NOT NULL DEFAULT true,
  department       text REFERENCES public.mkt_workforce_departments(code),
  note             text,
  last_assigned_at timestamptz,
  updated_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_staff_status TO authenticated;
GRANT ALL ON public.mkt_staff_status TO service_role;
ALTER TABLE public.mkt_staff_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own status" ON public.mkt_staff_status
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin() OR public.mkt_staff_has('workforce.manage'));

CREATE TRIGGER trg_mkt_staff_status_updated
  BEFORE UPDATE ON public.mkt_staff_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Leaves ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_staff_leaves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  kind                text NOT NULL DEFAULT 'annual'
                      CHECK (kind IN ('annual','sick','emergency','training','other')),
  starts_on           date NOT NULL,
  ends_on             date NOT NULL,
  note                text,
  substitute_user_id  uuid,
  created_by          uuid,
  cancelled_at        timestamptz,
  cancelled_by        uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_staff_leaves_user ON public.mkt_staff_leaves (user_id, starts_on);
GRANT SELECT ON public.mkt_staff_leaves TO authenticated;
GRANT ALL ON public.mkt_staff_leaves TO service_role;
ALTER TABLE public.mkt_staff_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own leaves" ON public.mkt_staff_leaves
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin() OR public.mkt_staff_has('workforce.manage'));

CREATE TRIGGER trg_mkt_staff_leaves_updated
  BEFORE UPDATE ON public.mkt_staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- dates sanity via trigger (not CHECK: keeps time-dependent rules out of constraints)
CREATE OR REPLACE FUNCTION public.mkt_staff_leave_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.ends_on < NEW.starts_on THEN RAISE EXCEPTION 'invalid_leave_range'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mkt_staff_leave_validate
  BEFORE INSERT OR UPDATE ON public.mkt_staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.mkt_staff_leave_validate();

-- 4. Shared work queue = existing assignments table, extended --
ALTER TABLE public.mkt_admin_assignments
  ALTER COLUMN assignee DROP NOT NULL;
ALTER TABLE public.mkt_admin_assignments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS progress text NOT NULL DEFAULT 'unstarted',
  ADD COLUMN IF NOT EXISTS auto_assigned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS first_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.mkt_admin_assignments
    ADD CONSTRAINT mkt_admin_assignments_priority_chk
    CHECK (priority IN ('low','normal','high','urgent'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mkt_admin_assignments
    ADD CONSTRAINT mkt_admin_assignments_progress_chk
    CHECK (progress IN ('unstarted','in_progress','waiting_info','done'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mkt_admin_assignments_unassigned
  ON public.mkt_admin_assignments (kind, priority, created_at)
  WHERE assignee IS NULL AND released_at IS NULL AND closed_at IS NULL;

-- 5. Helpers --------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_user_can(_uid uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = _uid)
      OR EXISTS (
           SELECT 1 FROM public.mkt_staff_permissions p
            WHERE p.user_id = _uid
              AND (p.perm = ANY (public.mkt_perm_aliases(_perm))
                OR p.perm = ANY (CASE _perm
                     WHEN 'listings.review'      THEN ARRAY['ads.moderation_hide','ads.moderation_suspend']
                     WHEN 'listings.view'        THEN ARRAY['ads.events_view','ads.moderation_hide']
                     WHEN 'reports.manage'       THEN ARRAY['reports.review']
                     WHEN 'reports.view'         THEN ARRAY['reports.inbox_view']
                     WHEN 'verifications.manage' THEN ARRAY['verifications.review']
                     WHEN 'verifications.view'   THEN ARRAY['verifications.review']
                     WHEN 'users.manage'         THEN ARRAY['accounts.restrict']
                     WHEN 'users.view'           THEN ARRAY['accounts.restrict','accounts.suspend']
                     WHEN 'businesses.manage'    THEN ARRAY['businesses.suspend']
                     WHEN 'businesses.view'      THEN ARRAY['businesses.suspend','verifications.review']
                     ELSE ARRAY[]::text[] END))
         )
$$;
REVOKE ALL ON FUNCTION public.mkt_user_can(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has('workforce.manage')
$$;
REVOKE ALL ON FUNCTION public.mkt_workforce_manage() FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_staff_on_leave(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_staff_leaves l
     WHERE l.user_id = _uid AND l.cancelled_at IS NULL
       AND (now() AT TIME ZONE 'Asia/Riyadh')::date BETWEEN l.starts_on AND l.ends_on
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_staff_on_leave(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_open_count(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
   WHERE a.assignee = _uid AND a.released_at IS NULL AND a.closed_at IS NULL
     AND a.progress <> 'done'
$$;
REVOKE ALL ON FUNCTION public.mkt_workforce_open_count(uuid) FROM anon;

-- fair pick: eligible + available + under capacity, least loaded then longest idle
CREATE OR REPLACE FUNCTION public.mkt_workforce_pick_assignee(_kind text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.user_id
    FROM public.mkt_staff_status s
   WHERE s.work_state = 'available'
     AND s.accepts_auto
     AND NOT public.mkt_staff_on_leave(s.user_id)
     AND public.mkt_user_can(s.user_id, public.mkt_queue_perm(_kind))
     AND public.mkt_workforce_open_count(s.user_id) < s.capacity_limit
   ORDER BY public.mkt_workforce_open_count(s.user_id) ASC,
            s.last_assigned_at ASC NULLS FIRST,
            s.user_id
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.mkt_workforce_pick_assignee(text) FROM anon;

-- 6. Queue operations ----------------------------------------
-- enqueue a subject into the shared list (unassigned) and try auto-assign
CREATE OR REPLACE FUNCTION public.mkt_workforce_enqueue(
  _kind text, _subject_id uuid, _priority text DEFAULT 'normal', _due_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _pick uuid; _auto boolean;
BEGIN
  IF NOT (public.mkt_workforce_manage() OR public.mkt_admin_can(public.mkt_queue_perm(_kind))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(_priority,'normal') NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid_priority';
  END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
   WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
   FOR UPDATE;
  IF _row.id IS NOT NULL THEN
    UPDATE public.mkt_admin_assignments
       SET priority = COALESCE(_priority, priority), due_at = COALESCE(_due_at, due_at)
     WHERE id = _row.id;
    RETURN _row.id;
  END IF;

  SELECT COALESCE((value->>'enabled')::boolean, true) INTO _auto
    FROM public.mkt_platform_settings WHERE key = 'workforce.auto_assign';
  IF _auto THEN _pick := public.mkt_workforce_pick_assignee(_kind); END IF;

  INSERT INTO public.mkt_admin_assignments
    (kind, subject_id, assignee, claimed_at, priority, due_at, auto_assigned, assigned_by)
  VALUES (_kind, _subject_id, _pick, CASE WHEN _pick IS NULL THEN NULL ELSE now() END,
          COALESCE(_priority,'normal'), _due_at, _pick IS NOT NULL, auth.uid())
  RETURNING id INTO _id;

  IF _pick IS NOT NULL THEN
    UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
    PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك',
      'نوع العمل: ' || _kind);
  END IF;

  PERFORM public.log_audit('mkt_admin_assignments', 'enqueue', _id, NULL,
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id,
                       'assignee', _pick, 'auto', _pick IS NOT NULL, 'priority', COALESCE(_priority,'normal')), NULL);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_enqueue(text, uuid, text, timestamptz) FROM anon;

-- claim: allow taking an unassigned queue row; enforce capacity
CREATE OR REPLACE FUNCTION public.mkt_admin_claim(_kind text, _subject_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _limit integer;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT capacity_limit INTO _limit FROM public.mkt_staff_status WHERE user_id = auth.uid();
  IF _limit IS NOT NULL AND public.mkt_workforce_open_count(auth.uid()) >= _limit THEN
    RAISE EXCEPTION 'capacity_reached';
  END IF;

  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;

  IF _row.id IS NOT NULL THEN
    IF _row.assignee = auth.uid() THEN RETURN _row.id; END IF;
    IF _row.assignee IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = auth.uid(), claimed_at = now(), auto_assigned = false, assigned_by = auth.uid()
     WHERE id = _row.id RETURNING id INTO _id;
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

-- transfer: notify the receiver, keep fairness counter honest
CREATE OR REPLACE FUNCTION public.mkt_admin_transfer(_kind text, _subject_id uuid, _to uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _to IS NULL OR NOT public.mkt_user_can(_to, public.mkt_queue_perm(_kind)) THEN
    RAISE EXCEPTION 'invalid_assignee';
  END IF;

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
  PERFORM public.log_audit('mkt_admin_assignments','transfer', _id,
    jsonb_build_object('assignee', _row.assignee),
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id, 'assignee', _to), _reason);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_set_progress(_kind text, _subject_id uuid, _progress text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments;
BEGIN
  IF _progress NOT IN ('unstarted','in_progress','waiting_info','done') THEN
    RAISE EXCEPTION 'invalid_progress';
  END IF;
  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (_row.assignee = auth.uid() OR public.mkt_workforce_manage()) THEN RAISE EXCEPTION 'not_holder'; END IF;

  UPDATE public.mkt_admin_assignments
     SET progress = _progress,
         first_action_at = COALESCE(first_action_at, now()),
         last_action_at = now()
   WHERE id = _row.id;
  PERFORM public.log_audit('mkt_admin_assignments','progress', _row.id,
    jsonb_build_object('progress', _row.progress), jsonb_build_object('progress', _progress), NULL);
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_set_progress(text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_set_priority(_kind text, _subject_id uuid, _priority text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.mkt_admin_assignments
     SET priority = _priority
   WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL;
  PERFORM public.log_audit('mkt_admin_assignments','priority', NULL, NULL,
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id, 'priority', _priority), _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_set_priority(text, uuid, text, text) FROM anon;

-- distribute every unassigned item that now has an eligible taker
CREATE OR REPLACE FUNCTION public.mkt_workforce_distribute(_kind text DEFAULT NULL, _limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _r record; _pick uuid; _n integer := 0;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR _r IN
    SELECT id, kind, subject_id FROM public.mkt_admin_assignments
     WHERE assignee IS NULL AND released_at IS NULL AND closed_at IS NULL
       AND (_kind IS NULL OR kind = _kind)
     ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
              created_at
     LIMIT GREATEST(COALESCE(_limit, 50), 1)
  LOOP
    _pick := public.mkt_workforce_pick_assignee(_r.kind);
    EXIT WHEN _pick IS NULL AND _n = 0 AND false;
    IF _pick IS NULL THEN CONTINUE; END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = _pick, claimed_at = now(), auto_assigned = true, assigned_by = auth.uid()
     WHERE id = _r.id;
    UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
    PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك',
      'نوع العمل: ' || _r.kind);
    PERFORM public.log_audit('mkt_admin_assignments','auto_assign', _r.id, NULL,
      jsonb_build_object('kind', _r.kind, 'subject_id', _r.subject_id, 'assignee', _pick), NULL);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_distribute(text, integer) FROM anon;

-- 7. Staff administration ------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_workforce_set_staff(
  _user_id uuid, _work_state text, _capacity_limit integer, _accepts_auto boolean,
  _department text, _note text, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _prev public.mkt_staff_status; _self boolean;
BEGIN
  _self := _user_id = auth.uid();
  IF NOT (public.mkt_workforce_manage() OR _self) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.mkt_workforce_manage() AND btrim(COALESCE(_reason,'')) = '' THEN _reason := 'self update'; END IF;
  IF public.mkt_workforce_manage() AND NOT _self AND btrim(COALESCE(_reason,'')) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF _work_state IS NOT NULL AND _work_state NOT IN ('available','busy','away','leave','off') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  -- staff may only move themselves between working states, never change their own limit
  IF _self AND NOT public.mkt_workforce_manage() THEN
    IF _work_state IS NOT NULL AND _work_state NOT IN ('available','busy','away') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    _capacity_limit := NULL;
    _department := NULL;
  END IF;

  SELECT * INTO _prev FROM public.mkt_staff_status WHERE user_id = _user_id FOR UPDATE;
  IF _prev.user_id IS NULL THEN
    INSERT INTO public.mkt_staff_status (user_id, work_state, capacity_limit, accepts_auto, department, note, updated_by)
    VALUES (_user_id, COALESCE(_work_state,'off'), COALESCE(_capacity_limit,10),
            COALESCE(_accepts_auto,true), _department, NULLIF(btrim(COALESCE(_note,'')),''), auth.uid());
  ELSE
    UPDATE public.mkt_staff_status
       SET work_state     = COALESCE(_work_state, work_state),
           capacity_limit = COALESCE(_capacity_limit, capacity_limit),
           accepts_auto   = COALESCE(_accepts_auto, accepts_auto),
           department     = COALESCE(_department, department),
           note           = COALESCE(NULLIF(btrim(COALESCE(_note,'')),''), note),
           updated_by     = auth.uid()
     WHERE user_id = _user_id;
  END IF;

  PERFORM public.log_audit('mkt_staff_status','update', _user_id,
    to_jsonb(_prev), jsonb_build_object('work_state', _work_state, 'capacity_limit', _capacity_limit,
      'accepts_auto', _accepts_auto, 'department', _department), _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_set_staff(uuid, text, integer, boolean, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_add_leave(
  _user_id uuid, _kind text, _starts_on date, _ends_on date, _note text, _substitute uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _starts_on IS NULL OR _ends_on IS NULL THEN RAISE EXCEPTION 'dates_required'; END IF;
  INSERT INTO public.mkt_staff_leaves (user_id, kind, starts_on, ends_on, note, substitute_user_id, created_by)
  VALUES (_user_id, COALESCE(_kind,'annual'), _starts_on, _ends_on,
          NULLIF(btrim(COALESCE(_note,'')),''), _substitute, auth.uid())
  RETURNING id INTO _id;

  IF (now() AT TIME ZONE 'Asia/Riyadh')::date BETWEEN _starts_on AND _ends_on THEN
    UPDATE public.mkt_staff_status SET work_state = 'leave', updated_by = auth.uid() WHERE user_id = _user_id;
  END IF;

  PERFORM public.mkt_notify(_user_id, NULL, 'leave_recorded', 'تم تسجيل إجازة لك', NULL);
  PERFORM public.log_audit('mkt_staff_leaves','create', _id, NULL,
    jsonb_build_object('user_id', _user_id, 'kind', COALESCE(_kind,'annual'),
      'starts_on', _starts_on, 'ends_on', _ends_on, 'substitute', _substitute), _note);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_add_leave(uuid, text, date, date, text, uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_cancel_leave(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_staff_leaves;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.mkt_staff_leaves SET cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = _id AND cancelled_at IS NULL RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.mkt_staff_status SET work_state = 'off', updated_by = auth.uid()
   WHERE user_id = _row.user_id AND work_state = 'leave'
     AND NOT public.mkt_staff_on_leave(_row.user_id);
  PERFORM public.log_audit('mkt_staff_leaves','cancel', _id, to_jsonb(_row), NULL, _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_workforce_cancel_leave(uuid, text) FROM anon;

-- 8. Reads for the UI ----------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_workforce_staff()
RETURNS TABLE(
  user_id uuid, label text, email text, platform_role text, perms text[],
  work_state text, effective_state text, capacity_limit integer, accepts_auto boolean,
  department text, note text, open_count integer, done_today integer,
  on_leave boolean, leave_ends_on date, last_assigned_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.user_id,
         COALESCE(p.full_name, up.display_name, p.email, 'موظف'),
         CASE WHEN public.mkt_workforce_manage() THEN p.email ELSE NULL END,
         pa.platform_role,
         COALESCE(ARRAY(SELECT sp.perm FROM public.mkt_staff_permissions sp WHERE sp.user_id = u.user_id), '{}'),
         COALESCE(s.work_state, 'off'),
         CASE WHEN public.mkt_staff_on_leave(u.user_id) THEN 'leave' ELSE COALESCE(s.work_state,'off') END,
         COALESCE(s.capacity_limit, 10),
         COALESCE(s.accepts_auto, true),
         s.department, s.note,
         public.mkt_workforce_open_count(u.user_id),
         (SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
           WHERE a.assignee = u.user_id AND a.progress = 'done'
             AND a.last_action_at >= (now() - interval '1 day')),
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
REVOKE ALL ON FUNCTION public.mkt_workforce_staff() FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_queue(
  _scope text DEFAULT 'mine', _kind text DEFAULT NULL, _limit integer DEFAULT 100
) RETURNS TABLE(
  id uuid, kind text, subject_id uuid, assignee uuid, assignee_label text,
  priority text, progress text, auto_assigned boolean, due_at timestamptz,
  claimed_at timestamptz, created_at timestamptz, is_mine boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT a.id, a.kind, a.subject_id, a.assignee,
         COALESCE(p.full_name, up.display_name, p.email),
         a.priority, a.progress, a.auto_assigned, a.due_at, a.claimed_at, a.created_at,
         a.assignee = auth.uid()
    FROM public.mkt_admin_assignments a
    LEFT JOIN public.profiles p ON p.user_id = a.assignee
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = a.assignee
   WHERE a.released_at IS NULL AND a.closed_at IS NULL
     AND (_kind IS NULL OR a.kind = _kind)
     AND public.mkt_admin_can(public.mkt_queue_perm(a.kind))
     AND CASE COALESCE(_scope,'mine')
           WHEN 'mine'       THEN a.assignee = auth.uid()
           WHEN 'unassigned' THEN a.assignee IS NULL
           WHEN 'all'        THEN public.mkt_workforce_manage()
           ELSE false END
   ORDER BY CASE a.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            a.due_at NULLS LAST, a.created_at
   LIMIT GREATEST(COALESCE(_limit, 100), 1)
$$;
REVOKE ALL ON FUNCTION public.mkt_workforce_queue(text, text, integer) FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_workforce_overview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN NOT public.mkt_workforce_manage() THEN '{}'::jsonb ELSE jsonb_build_object(
    'unassigned', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                    WHERE assignee IS NULL AND released_at IS NULL AND closed_at IS NULL),
    'open', (SELECT COUNT(*) FROM public.mkt_admin_assignments
              WHERE released_at IS NULL AND closed_at IS NULL AND progress <> 'done'),
    'urgent', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                WHERE released_at IS NULL AND closed_at IS NULL AND priority = 'urgent'),
    'overdue', (SELECT COUNT(*) FROM public.mkt_admin_assignments
                 WHERE released_at IS NULL AND closed_at IS NULL AND progress <> 'done'
                   AND due_at IS NOT NULL AND due_at < now()),
    'available_staff', (SELECT COUNT(*) FROM public.mkt_staff_status s
                         WHERE s.work_state = 'available' AND NOT public.mkt_staff_on_leave(s.user_id)),
    'on_leave', (SELECT COUNT(*) FROM public.mkt_staff_status s WHERE public.mkt_staff_on_leave(s.user_id))
  ) END
$$;
REVOKE ALL ON FUNCTION public.mkt_workforce_overview() FROM anon;

-- 9. Settings -------------------------------------------------
INSERT INTO public.mkt_platform_settings (key, section, value, description_ar) VALUES
  ('workforce.auto_assign', 'workforce', '{"enabled": true}'::jsonb, 'تفعيل التوزيع الآلي للأعمال'),
  ('workforce.default_capacity', 'workforce', '{"limit": 10}'::jsonb, 'الحد التشغيلي الافتراضي للموظف'),
  ('workforce.fairness', 'workforce', '{"mode": "least_load"}'::jsonb, 'سياسة عدالة التوزيع')
ON CONFLICT (key) DO NOTHING;