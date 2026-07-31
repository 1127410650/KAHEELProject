CREATE OR REPLACE VIEW public.custody_balances
WITH (security_invoker = true)
AS
SELECT
  s.id AS supervisor_id,
  s.name_ar,
  s.name_en,
  COALESCE(SUM(
    CASE
      WHEN t.txn_type = 'reversal'::public.custody_txn_type
        THEN - public.custody_base_effect(o.txn_type, t.amount)
      ELSE public.custody_base_effect(t.txn_type, t.amount)
    END
  ), 0::numeric)::numeric(14,2) AS balance
FROM public.supervisors s
LEFT JOIN public.custody_transactions t
  ON t.supervisor_id = s.id
 AND t.status = 'approved'::public.record_status
 AND t.deleted_at IS NULL
LEFT JOIN public.custody_transactions o ON o.id = t.reversal_of_id
WHERE public.is_staff()
   OR s.id = public.current_supervisor_id()
GROUP BY s.id, s.name_ar, s.name_en;

REVOKE ALL ON public.custody_balances FROM anon;
GRANT SELECT ON public.custody_balances TO authenticated;
GRANT ALL ON public.custody_balances TO service_role;