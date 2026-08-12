-- [PARITY RESTORATION] Forward-only, idempotent.
-- storage.allow_any_operation(text[]) exists in production and is USED by the
-- committed migration 20260808231319_fix_mkt_media_storage_policies.sql, but it
-- was never created by any repo migration (created out-of-band), so a fresh
-- rebuild from repo files alone failed on that dependency.
-- Definition captured verbatim (read-only) from production pg_get_functiondef.
-- This file is NOT applied to production (production already holds this state).

CREATE OR REPLACE FUNCTION storage.allow_any_operation(expected_operations text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$function$;
