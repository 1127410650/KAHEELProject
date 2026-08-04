-- staff may read only their own work state
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
         COALESCE(s.accepts_auto, true),
         s.department,
         public.mkt_workforce_open_count(auth.uid()),
         (SELECT COUNT(*)::int FROM public.mkt_admin_assignments a
           WHERE a.assignee = auth.uid() AND a.progress = 'done'
             AND a.last_action_at >= date_trunc('day', now())),
         public.mkt_staff_on_leave(auth.uid()),
         public.mkt_workforce_manage()
    FROM (SELECT 1) one
    LEFT JOIN public.mkt_staff_status s ON s.user_id = auth.uid()
   WHERE auth.uid() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_my_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_workforce_my_status() TO authenticated;

-- manual claim must respect leave and off/leave work states
CREATE OR REPLACE FUNCTION public.mkt_admin_claim(_kind text, _subject_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid; _st public.mkt_staff_status;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF public.mkt_staff_on_leave(auth.uid()) THEN RAISE EXCEPTION 'staff_on_leave'; END IF;

  SELECT * INTO _st FROM public.mkt_staff_status WHERE user_id = auth.uid();
  IF _st.user_id IS NOT NULL AND _st.work_state IN ('leave','off') THEN
    RAISE EXCEPTION 'staff_unavailable';
  END IF;
  IF _st.capacity_limit IS NOT NULL
     AND public.mkt_workforce_open_count(auth.uid()) >= _st.capacity_limit THEN
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

-- drop the dead guard in the distributor
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