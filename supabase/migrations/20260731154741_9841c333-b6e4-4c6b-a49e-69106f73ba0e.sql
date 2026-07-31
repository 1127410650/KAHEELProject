DROP FUNCTION IF EXISTS public.request_execute(uuid, text);

CREATE OR REPLACE FUNCTION public.request_decide(_request_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.requester_id = auth.uid() AND NOT public.is_accountant() THEN
    RAISE EXCEPTION 'SELF_DECISION_FORBIDDEN';
  END IF;

  IF _decision = 'approve' THEN
    IF NOT public.has_perm('requests.approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF r.kind IN ('custody_topup', 'payment')
       AND NOT (public.has_perm('custody.approve_movement') OR public.has_perm('requests.approve')) THEN
      RAISE EXCEPTION 'CUSTODY_FORBIDDEN';
    END IF;
    PERFORM public.request_set_status(_request_id, 'approved', _note);
    PERFORM public.request_set_status(_request_id, 'awaiting_execution', _note);
  ELSIF _decision = 'reject' THEN
    IF NOT public.has_perm('requests.reject') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    PERFORM public.request_set_status(_request_id, 'rejected', _note);
  ELSE
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.request_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_decide(uuid, text, text) TO authenticated;