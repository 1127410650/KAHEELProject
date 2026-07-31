REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_accountant() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_approved_custody() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_mutation() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_accountant() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.lock_approved_custody() TO service_role;
GRANT EXECUTE ON FUNCTION public.block_audit_mutation() TO service_role;