REVOKE ALL ON FUNCTION public.mkt_is_errand_captain() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_is_errand_captain() TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_errand_captain_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_errand_request_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_errand_touch() FROM PUBLIC, anon, authenticated;