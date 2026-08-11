-- anon must not be able to trigger a data purge, nor probe admin/owner aggregates.
REVOKE EXECUTE ON FUNCTION public.mkt_analytics_purge_expired() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mkt_owner_analytics(integer, uuid) FROM anon;