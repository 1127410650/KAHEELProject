CREATE OR REPLACE FUNCTION public.custody_base_effect(p_type public.custody_txn_type, p_amount numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type = 'add'::public.custody_txn_type THEN COALESCE(p_amount, 0)
    WHEN p_type IN ('settlement'::public.custody_txn_type, 'deduction'::public.custody_txn_type, 'refund'::public.custody_txn_type) THEN -COALESCE(p_amount, 0)
    ELSE 0::numeric
  END
$$;

REVOKE ALL ON FUNCTION public.custody_base_effect(public.custody_txn_type, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custody_base_effect(public.custody_txn_type, numeric) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.custody_txn_effects
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.serial_no,
  t.supervisor_id,
  t.project_id,
  t.txn_type,
  t.amount,
  t.txn_date,
  t.status,
  t.reason,
  t.notes_ar,
  t.deleted_at,
  t.reversal_of_id,
  o.serial_no AS reversal_of_serial,
  o.txn_type AS reversal_of_type,
  r.id AS reversed_by_id,
  r.serial_no AS reversed_by_serial,
  CASE
    WHEN t.txn_type = 'reversal'::public.custody_txn_type
      THEN -public.custody_base_effect(o.txn_type, t.amount)
    ELSE public.custody_base_effect(t.txn_type, t.amount)
  END::numeric(14,2) AS signed_amount
FROM public.custody_transactions t
LEFT JOIN public.custody_transactions o ON o.id = t.reversal_of_id
LEFT JOIN public.custody_transactions r
  ON r.reversal_of_id = t.id AND r.deleted_at IS NULL;

GRANT SELECT ON public.custody_txn_effects TO authenticated;
GRANT ALL ON public.custody_txn_effects TO service_role;

CREATE OR REPLACE VIEW public.custody_balances AS
SELECT
  s.id AS supervisor_id,
  s.name_ar,
  s.name_en,
  COALESCE(SUM(
    CASE
      WHEN t.txn_type = 'reversal'::public.custody_txn_type
        THEN -public.custody_base_effect(o.txn_type, t.amount)
      ELSE public.custody_base_effect(t.txn_type, t.amount)
    END), 0::numeric)::numeric(14,2) AS balance
FROM public.supervisors s
LEFT JOIN public.custody_transactions t
  ON t.supervisor_id = s.id
  AND t.status = 'approved'::public.record_status
  AND t.deleted_at IS NULL
LEFT JOIN public.custody_transactions o ON o.id = t.reversal_of_id
GROUP BY s.id, s.name_ar, s.name_en;