CREATE OR REPLACE FUNCTION public.mkt_admin_subject_ids(
  _listing_ids uuid[] DEFAULT NULL,
  _report_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(kind text, source_id uuid, user_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE can_reporter boolean;
BEGIN
  -- Only an admin allowed to open user files gets any identifier at all.
  IF NOT public.mkt_admin_can('users.view') THEN RETURN; END IF;
  can_reporter := public.mkt_is_platform_admin()
    OR public.mkt_staff_has('reports.view_reporter_identity');

  IF _listing_ids IS NOT NULL THEN
    RETURN QUERY
      SELECT 'listing_owner', l.id, l.owner_user_id
        FROM public.mkt_listings l
       WHERE l.id = ANY(_listing_ids) AND l.owner_user_id IS NOT NULL;
  END IF;

  IF _report_ids IS NOT NULL THEN
    RETURN QUERY
      SELECT 'report_owner', r.id, r.owner_user_id
        FROM public.mkt_reports r
       WHERE r.id = ANY(_report_ids) AND r.owner_user_id IS NOT NULL;

    IF can_reporter THEN
      RETURN QUERY
        SELECT 'report_reporter', r.id, r.reporter_user_id
          FROM public.mkt_reports r
         WHERE r.id = ANY(_report_ids) AND r.reporter_user_id IS NOT NULL;
    END IF;
  END IF;
END $function$;

REVOKE EXECUTE ON FUNCTION public.mkt_admin_subject_ids(uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_subject_ids(uuid[], uuid[]) TO authenticated;