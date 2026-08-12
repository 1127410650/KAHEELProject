-- [PARITY RESTORATION] Forward-only, idempotent.
-- Verbatim effect of production ledger version 20260812180555 ("harden_access_control_fn_grants"),
-- which was applied to production on 2026-08-08/12 without a repo file.
-- Purpose: let a fresh database be rebuilt from repo files alone.
-- This file is NOT applied to production (production already holds this state).
-- Only additive idempotency guards were introduced (IF NOT EXISTS / DROP ... IF EXISTS).

-- إحكام صلاحيات دالتي نظام الصلاحيات: سحب التنفيذ عن الزائر غير المسجّل صراحةً.
-- الحماية داخل الدالتين قائمة (mkt_is_system_owner / mkt_is_platform_admin)،
-- لكن مبدأ «المنع الافتراضي» يقتضي ألا يملك anon حق التنفيذ أصلًا.
REVOKE EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;
