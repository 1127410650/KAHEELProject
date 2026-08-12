-- Idempotent re-declaration of access-control EXECUTE hardening
-- (repo parity for prod ledger entries 20260812180555_harden_access_control_fn_grants
--  and 20260812180628_harden_set_staff_perm_grant)
REVOKE ALL ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_admin_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_roles() TO authenticated;

REVOKE ALL ON FUNCTION public.mkt_admin_ops_log(text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_ops_log(text, text, timestamptz, timestamptz, integer, integer) TO authenticated;
