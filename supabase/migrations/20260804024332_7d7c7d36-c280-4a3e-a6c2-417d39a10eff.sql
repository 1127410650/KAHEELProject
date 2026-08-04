CREATE OR REPLACE FUNCTION public.mkt_call_stop_receiving()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  INSERT INTO public.mkt_call_settings (user_id, tenant_id, call_mode)
  VALUES (_me, NULL, 'off')
  ON CONFLICT (user_id, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET call_mode = 'off';

  UPDATE public.mkt_call_settings SET call_mode = 'off' WHERE user_id = _me;

  UPDATE public.mkt_calls
     SET status = CASE WHEN status = 'connected' THEN 'ended' ELSE 'cancelled' END,
         end_reason = 'receiver_disabled', ended_by = _me, ended_at = now(),
         duration_seconds = CASE WHEN accepted_at IS NOT NULL
                                 THEN greatest(0, extract(epoch FROM now() - accepted_at)::int)
                                 ELSE duration_seconds END,
         updated_at = now()
   WHERE status IN ('requesting','ringing','connected')
     AND (callee_user_id = _me OR caller_user_id = _me);
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_stop_receiving() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_stop_receiving() TO authenticated;