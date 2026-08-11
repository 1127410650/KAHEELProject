CREATE OR REPLACE FUNCTION public.resolve_login_candidates(_identifier text)
RETURNS TABLE(user_id uuid, email text, is_active boolean, locked boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_key text := lower(btrim(coalesce(_identifier, '')));
  v_digits text := regexp_replace(coalesce(_identifier, ''), '\D', '', 'g');
  v_tail text := right(v_digits, 9);
  v_locked boolean := false;
BEGIN
  SELECT coalesce(la.locked_until > now(), false) INTO v_locked
  FROM public.login_attempts la WHERE la.identifier = v_key;

  RETURN QUERY
  WITH matches AS (
    -- الملفات: بريد، هوية وطنية، أو رقم جوال بأي صيغة (آخر ٩ أرقام)
    SELECT p.user_id,
           coalesce(nullif(lower(btrim(p.email)), ''), lower(btrim(u.email))) AS email,
           coalesce(p.is_active, true) AS is_active,
           CASE WHEN lower(coalesce(p.email, '')) = v_key THEN 0
                WHEN regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') = v_digits THEN 1
                ELSE 2 END AS rank
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE (v_key <> '' AND lower(coalesce(p.email, '')) = v_key)
       OR (
         length(v_digits) >= 5
         AND regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') <> ''
         AND regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g') = v_digits
       )
       OR (
         length(v_digits) >= 9
         AND length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 9
         AND right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9) = v_tail
       )
    UNION
    -- حسابات المصادقة مباشرة: بريد مطابق، أو رقم جوال محفوظ في بيانات الحساب
    SELECT u.id,
           lower(btrim(u.email)),
           true,
           CASE WHEN lower(coalesce(u.email, '')) = v_key THEN 0 ELSE 3 END
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND (
        (v_key <> '' AND lower(btrim(u.email)) = v_key)
        OR (
          length(v_digits) >= 9
          AND length(regexp_replace(coalesce(u.raw_user_meta_data->>'phone_e164', ''), '\D', '', 'g')) >= 9
          AND right(regexp_replace(coalesce(u.raw_user_meta_data->>'phone_e164', ''), '\D', '', 'g'), 9) = v_tail
        )
        OR (
          length(v_digits) >= 9
          AND length(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g')) >= 9
          AND right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 9) = v_tail
        )
      )
    UNION
    -- جهات اتصال السوق: الرقم المعتمد للحساب الشخصي/المتجر
    SELECT uc.user_id,
           lower(btrim(u2.email)),
           true,
           4
    FROM public.mkt_user_contacts uc
    JOIN auth.users u2 ON u2.id = uc.user_id
    WHERE u2.email IS NOT NULL
      AND length(v_digits) >= 9
      AND length(regexp_replace(coalesce(uc.phone_e164, ''), '\D', '', 'g')) >= 9
      AND right(regexp_replace(coalesce(uc.phone_e164, ''), '\D', '', 'g'), 9) = v_tail
  )
  SELECT m.user_id, m.email, bool_and(m.is_active), coalesce(v_locked, false)
  FROM matches m
  WHERE m.email IS NOT NULL AND m.email <> ''
  GROUP BY m.user_id, m.email
  ORDER BY min(m.rank)
  LIMIT 5;
END
$function$;