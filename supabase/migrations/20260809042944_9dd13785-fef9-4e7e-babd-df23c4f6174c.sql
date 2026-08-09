REVOKE ALL ON FUNCTION public.structure_guard_is_enabled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.structure_guard_allows_table(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.structure_guard_allows_bucket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.structure_guard_is_enabled() TO service_role;
GRANT EXECUTE ON FUNCTION public.structure_guard_allows_table(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.structure_guard_allows_bucket(text) TO authenticated, service_role;
