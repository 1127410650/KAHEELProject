REVOKE ALL ON FUNCTION public.mkt_admin_activities(text, uuid, boolean, integer) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_admin_listing_extend(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_admin_listing_reports(text, text, text, text, uuid, timestamptz, timestamptz, boolean, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_activities(text, uuid, boolean, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_extend(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_reports(text, text, text, text, uuid, timestamptz, timestamptz, boolean, integer, integer) TO authenticated, service_role;