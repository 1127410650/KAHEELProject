CREATE OR REPLACE FUNCTION public.notify_request(_request_id uuid, _event text, _title text, _body text DEFAULT NULL::text, _message_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.requests;
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF r.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, request_id, message_id, event, title, body)
  SELECT DISTINCT u, _request_id, _message_id, _event, _title, _body
  FROM (
    SELECT r.requester_id AS u
    UNION SELECT r.assigned_to
    UNION SELECT p.user_id FROM public.profiles p
      WHERE r.supervisor_id IS NOT NULL AND p.supervisor_id = r.supervisor_id
    -- accountants of THIS request's workspace only
    UNION SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.tenant_memberships m
        ON m.tenant_id = ur.tenant_id AND m.user_id = ur.user_id AND m.status = 'active'
     WHERE ur.role = 'accountant' AND ur.tenant_id = r.tenant_id
  ) s
  WHERE u IS NOT NULL AND u <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
END $function$;

UPDATE public.tenants
   SET status = 'archived', deleted_at = COALESCE(deleted_at, now())
 WHERE name_ar LIKE '\_\_test\_%';