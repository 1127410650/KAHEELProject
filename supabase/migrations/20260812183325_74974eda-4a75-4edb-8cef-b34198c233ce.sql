CREATE OR REPLACE FUNCTION public.mkt_content_health_open(_limit integer DEFAULT 50)
RETURNS SETOF public.mkt_content_health_findings
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.mkt_admin_can('platform.health.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT f.*
  FROM public.mkt_content_health_findings AS f
  WHERE f.resolved_at IS NULL
  ORDER BY CASE f.severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
           f.last_seen_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_perf_summary(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_flag_change_request(text, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_flag_change_decide(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_content_health_scan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_content_health_open(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_cms_preflight_override(uuid, text[], text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_perf_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_flag_change_request(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_flag_change_decide(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_content_health_scan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_content_health_open(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_cms_preflight_override(uuid, text[], text) TO authenticated;