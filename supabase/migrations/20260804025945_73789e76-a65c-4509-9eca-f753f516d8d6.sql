CREATE OR REPLACE FUNCTION public.mkt_workforce_can_take(_user_id uuid, _kind text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _st public.mkt_staff_status;
BEGIN
  IF NOT public.mkt_staff_eligible(_user_id, _kind) THEN RETURN 'invalid_assignee'; END IF;
  IF public.mkt_staff_on_leave(_user_id) THEN RETURN 'staff_on_leave'; END IF;
  SELECT * INTO _st FROM public.mkt_staff_status WHERE user_id = _user_id;
  IF _st.user_id IS NULL THEN RETURN 'ok'; END IF;
  -- paused / leave / off all mean: no new work, current work stays put
  IF _st.work_state <> 'available' THEN RETURN 'staff_unavailable'; END IF;
  IF public.mkt_workforce_open_count(_user_id) >= _st.capacity_limit THEN RETURN 'capacity_reached'; END IF;
  RETURN 'ok';
END $$;