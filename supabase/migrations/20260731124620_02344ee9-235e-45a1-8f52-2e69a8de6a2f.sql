CREATE OR REPLACE FUNCTION public.custody_base_effect(p_type public.custody_txn_type, p_amount numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_type IN ('add', 'refund') THEN coalesce(p_amount, 0)
    ELSE -coalesce(p_amount, 0)
  END
$$;
GRANT EXECUTE ON FUNCTION public.custody_base_effect(public.custody_txn_type, numeric) TO authenticated, anon, service_role;