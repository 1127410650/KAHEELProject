CREATE OR REPLACE FUNCTION public.resolve_login_identity(_identifier text)
RETURNS TABLE (email text, is_active boolean, locked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_key text := lower(btrim(_identifier));
  v_digits text := regexp_replace(coalesce(_identifier,''), '\D', '', 'g');
  v_locked boolean := false;
BEGIN
  SELECT coalesce(la.locked_until > now(), false) INTO v_locked
  FROM public.login_attempts la WHERE la.identifier = v_key;

  RETURN QUERY
  SELECT p.email, p.is_active, coalesce(v_locked, false)
  FROM public.profiles p
  WHERE
    (v_key <> '' AND lower(coalesce(p.email, '')) = v_key)
    OR (
      length(v_digits) >= 5
      AND regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') <> ''
      AND regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') = v_digits
    )
    OR (
      length(v_digits) >= 9
      AND length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 9
      AND right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)
    )
  ORDER BY
    CASE WHEN lower(coalesce(p.email, '')) = v_key THEN 0
         WHEN regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') = v_digits THEN 1
         ELSE 2 END
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.resolve_login_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_identity(text) FROM authenticated, anon;