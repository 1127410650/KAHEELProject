REVOKE EXECUTE ON FUNCTION public.mkt_can_review_identity_for(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_log_registry_review(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_call_signals_purge_expired() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_can_review_identity_for(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_log_registry_review(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_call_signals_purge_expired() TO service_role;
