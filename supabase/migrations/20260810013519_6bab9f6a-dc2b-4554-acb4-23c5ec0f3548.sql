-- Trigger functions and internal helpers must not be callable through the Data API.
REVOKE EXECUTE ON FUNCTION public.mkt_attendance_recompute(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_wallet_for_listing(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_moderation_scan_listing(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_moderation_rule_normalize() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_require_attendance() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_grants_on_membership_end() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_assignments_kind_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_order_before() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_order_after() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_log_tenant_autofill() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.freeze_tenant_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_tenant_creation() FROM anon, authenticated;
