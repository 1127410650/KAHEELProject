ALTER TABLE public.mkt_staff_status
  ADD COLUMN IF NOT EXISTS pre_leave_state text;

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
    UPDATE public.mkt_staff_status
       SET pre_leave_state = CASE WHEN work_state = 'leave' THEN pre_leave_state ELSE work_state END,
           work_state = 'leave',
           updated_by = auth.uid()
     WHERE user_id = _user_id;
  END IF;

  PERFORM public.mkt_notify(_user_id, NULL, 'leave_recorded', 'تم تسجيل إجازة لك', NULL);
  PERFORM public.log_audit('mkt_staff_leaves','create', _id, NULL,
    jsonb_build_object('user_id', _user_id, 'kind', COALESCE(_kind,'annual'),
      'starts_on', _starts_on, 'ends_on', _ends_on, 'substitute', _substitute), _note);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_workforce_cancel_leave(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _row public.mkt_staff_leaves;
BEGIN
  IF NOT public.mkt_workforce_manage() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.mkt_staff_leaves SET cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = _id AND cancelled_at IS NULL RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.mkt_staff_status
     SET work_state = COALESCE(pre_leave_state, 'off'),
         pre_leave_state = NULL,
         updated_by = auth.uid()
   WHERE user_id = _row.user_id AND work_state = 'leave'
     AND NOT public.mkt_staff_on_leave(_row.user_id);
  PERFORM public.log_audit('mkt_staff_leaves','cancel', _id, to_jsonb(_row), NULL, _reason);
END $$;

-- a finished leave also restores the previous state (used by the daily sweep / reads)
CREATE OR REPLACE FUNCTION public.mkt_workforce_refresh_leave_states()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.mkt_staff_status s
     SET work_state = COALESCE(s.pre_leave_state, 'off'),
         pre_leave_state = NULL
   WHERE s.work_state = 'leave'
     AND NOT public.mkt_staff_on_leave(s.user_id);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_refresh_leave_states() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_workforce_refresh_leave_states() TO authenticated;