REVOKE EXECUTE ON FUNCTION public.mkt_guide_place_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_guide_place_owner(uuid) TO authenticated, service_role;