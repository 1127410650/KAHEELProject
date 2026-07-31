-- Project-creation requests have no project yet.
ALTER TABLE public.requests ALTER COLUMN project_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_portal_request(
  _kind text,
  _request_type text,
  _project_id uuid DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _notes_ar text DEFAULT NULL,
  _authority text DEFAULT NULL,
  _request_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sup uuid;
  _no text;
  _id uuid;
BEGIN
  IF NOT (public.is_supervisor_user() OR public.has_perm('requests.create')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF _kind IS NULL OR _kind = '' THEN
    RAISE EXCEPTION 'KIND_REQUIRED';
  END IF;

  IF _kind <> 'project_create' THEN
    IF _project_id IS NULL THEN
      RAISE EXCEPTION 'PROJECT_REQUIRED';
    END IF;
    IF NOT public.can_access_project(_project_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  IF _kind IN ('custody_topup', 'payment') AND (_amount IS NULL OR _amount <= 0) THEN
    RAISE EXCEPTION 'AMOUNT_REQUIRED';
  END IF;

  _sup := public.current_supervisor_id();

  _no := 'PR-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMMDD') || '-' ||
         lpad((
           SELECT (count(*) + 1)::text
           FROM public.requests
           WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh')
         ), 3, '0');

  INSERT INTO public.requests (
    request_no, request_type, kind, project_id, supervisor_id, amount,
    notes_ar, authority, request_date, status, requester_id, created_by
  ) VALUES (
    _no, coalesce(nullif(_request_type, ''), _kind), _kind, _project_id, _sup, _amount,
    _notes_ar, _authority, coalesce(_request_date, (now() AT TIME ZONE 'Asia/Riyadh')::date),
    'new', auth.uid(), auth.uid()
  )
  RETURNING id INTO _id;

  PERFORM public.log_audit('request', 'create', _id, NULL,
    jsonb_build_object('kind', _kind, 'amount', _amount, 'source', 'portal'), NULL);

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_portal_request(text, text, uuid, numeric, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_portal_request(text, text, uuid, numeric, text, text, date) TO authenticated;