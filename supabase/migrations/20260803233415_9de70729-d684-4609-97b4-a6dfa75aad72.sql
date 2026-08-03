CREATE OR REPLACE FUNCTION public.mkt_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'businesses', (SELECT count(*) FROM public.tenants t
                    WHERE t.deleted_at IS NULL AND t.personal_user_id IS NULL),
    'listings_published', (SELECT count(*) FROM public.mkt_listings WHERE status = 'published'),
    'listings_pending', (SELECT count(*) FROM public.mkt_listings
                          WHERE status IN ('pending','pending_review','in_review')),
    'reports_new', (SELECT count(*) FROM public.mkt_reports WHERE status IN ('new','open')),
    'verifications_pending', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'pending'),
    'restricted_accounts', (SELECT count(DISTINCT subject_id) FROM public.mkt_account_restrictions
                             WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
    'activity_suggestions', (SELECT count(*) FROM public.mkt_activity_suggestions WHERE status = 'pending')
  );
END
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_admin_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_overview() TO authenticated;