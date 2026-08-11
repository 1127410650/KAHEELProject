CREATE OR REPLACE FUNCTION public.mkt_admin_revoke_user_sessions(
  _user_id uuid,
  _reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sessions integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.mkt_admin_can('staff.sessions_revoke') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_required';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_revoke_self';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_platform_admins pa WHERE pa.user_id = _user_id) THEN
    RAISE EXCEPTION 'cannot_revoke_platform_admin';
  END IF;

  DELETE FROM auth.refresh_tokens rt WHERE rt.user_id::uuid = _user_id;
  DELETE FROM auth.sessions s WHERE s.user_id = _user_id;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  PERFORM public.mkt_ops_log_write(
    'staff.sessions_revoked',
    'platform',
    'auth_user',
    _user_id,
    btrim(_reason),
    jsonb_build_object('sessions_ended', v_sessions)
  );

  RETURN v_sessions;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_revoke_user_sessions(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_revoke_user_sessions(uuid, text) TO authenticated;