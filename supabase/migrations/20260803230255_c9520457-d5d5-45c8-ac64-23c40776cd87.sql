DROP FUNCTION IF EXISTS public.mkt_admin_businesses(text, integer);

CREATE FUNCTION public.mkt_admin_businesses(_search text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE(
  tenant_id uuid, name text, slug text, country text, city text,
  main_activity text, sub_activities text[], verification_status text,
  listings_count bigint, status text, created_at timestamptz,
  officer_name text, restriction text, restriction_id uuid,
  officer_user_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.mkt_admin_can('businesses.view') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
  WITH officer AS (
    SELECT DISTINCT ON (m.tenant_id) m.tenant_id, m.user_id
      FROM public.tenant_memberships m
     ORDER BY m.tenant_id, m.created_at
  )
  SELECT t.id,
         COALESCE(bp.display_name_ar, t.name_ar),
         bp.slug,
         (SELECT c.name_ar FROM public.mkt_countries c WHERE c.id = bp.country_id),
         bp.city,
         bp.main_activity,
         bp.sub_activities,
         bp.verification_status,
         (SELECT count(*) FROM public.mkt_listings l WHERE l.tenant_id = t.id AND l.deleted_at IS NULL),
         t.status,
         t.created_at,
         p.full_name,
         r.restriction,
         r.id,
         o.user_id
    FROM public.tenants t
    LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
    LEFT JOIN officer o ON o.tenant_id = t.id
    LEFT JOIN public.profiles p ON p.user_id = o.user_id
    LEFT JOIN LATERAL (
      SELECT x.id, x.restriction FROM public.mkt_account_restrictions x
       WHERE x.subject_type = 'business' AND x.subject_id = t.id AND x.lifted_at IS NULL
         AND (x.expires_at IS NULL OR x.expires_at > now())
       ORDER BY x.created_at DESC LIMIT 1
    ) r ON true
   WHERE t.deleted_at IS NULL
     AND t.tenant_type <> 'individual'
     AND (
       _search IS NULL OR btrim(_search) = ''
       OR COALESCE(bp.display_name_ar, t.name_ar) ILIKE '%' || btrim(_search) || '%'
       OR COALESCE(bp.display_name_en, t.name_en) ILIKE '%' || btrim(_search) || '%'
       OR bp.slug ILIKE '%' || btrim(_search) || '%'
     )
   ORDER BY t.created_at DESC
   LIMIT COALESCE(_limit, 100);
END $function$;

REVOKE EXECUTE ON FUNCTION public.mkt_admin_businesses(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_businesses(text, integer) TO authenticated;