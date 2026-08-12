-- [PARITY RESTORATION] Forward-only, idempotent.
-- Verbatim effect of production ledger version 20260808152846 ("harden_syria_directory_raw_rls"),
-- which was applied to production on 2026-08-08/12 without a repo file.
-- Purpose: let a fresh database be rebuilt from repo files alone.
-- This file is NOT applied to production (production already holds this state).
-- Only additive idempotency guards were introduced (IF NOT EXISTS / DROP ... IF EXISTS).

-- Make the private-import boundary explicit to database linters as well as grants.
-- service_role continues to bypass RLS for controlled migrations and admin RPCs.
DROP POLICY IF EXISTS syria_directory_raw_client_deny
  ON mkt_private.syria_directory_raw;
CREATE POLICY syria_directory_raw_client_deny
  ON mkt_private.syria_directory_raw
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
