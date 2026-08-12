-- [PARITY RESTORATION] Forward-only, idempotent.
-- Verbatim effect of production ledger version 20260812180628 ("harden_set_staff_perm_grant"),
-- which was applied to production on 2026-08-08/12 without a repo file.
-- Purpose: let a fresh database be rebuilt from repo files alone.
-- This file is NOT applied to production (production already holds this state).
-- Only additive idempotency guards were introduced (IF NOT EXISTS / DROP ... IF EXISTS).

-- نفس المبدأ: سحب حق التنفيذ عن الزائر من دالة ضبط الصلاحية المفردة.
REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated;
