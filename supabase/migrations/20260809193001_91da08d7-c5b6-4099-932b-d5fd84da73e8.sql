CREATE OR REPLACE FUNCTION public.mkt_errand_contact(_request_id uuid)
RETURNS TABLE(role text, display_name text, phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _status text;
  _captain uuid;
  _captain_user uuid;
BEGIN
  SELECT r.user_id, r.status, r.captain_id, c.user_id
    INTO _owner, _status, _captain, _captain_user
    FROM public.mkt_errand_requests r
    LEFT JOIN public.mkt_errand_captains c ON c.id = r.captain_id
   WHERE r.id = _request_id;

  IF _owner IS NULL THEN RETURN; END IF;
  IF _status NOT IN ('accepted','purchasing','delivering','delivered') THEN RETURN; END IF;

  IF auth.uid() = _owner THEN
    RETURN QUERY
      SELECT 'captain'::text, c.display_name, coalesce(c.phone, '')
        FROM public.mkt_errand_captains c WHERE c.id = _captain;
  ELSIF auth.uid() = _captain_user THEN
    RETURN QUERY
      SELECT 'client'::text,
             coalesce(p.display_name, ''),
             coalesce(p.public_whatsapp, '')
        FROM public.mkt_user_profiles p WHERE p.user_id = _owner;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_errand_contact(uuid) TO authenticated;