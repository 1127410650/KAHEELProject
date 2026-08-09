-- The purchase request is a request only: it writes a 'pending' ledger entry and
-- never touches the balance. Settlement stays admin-only
-- (mkt_ad_credit_admin_settle), which is what keeps this safe to expose while no
-- payment provider is connected.
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) TO authenticated;

COMMENT ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) IS
  'Provider-facing ad credit purchase request. Inserts a pending purchase entry for the caller''s wallet; the balance only moves when a platform admin settles it via mkt_ad_credit_admin_settle. Payment-gateway integration plugs in later by settling with a payment_ref.';

-- Let the provider withdraw a purchase request it has not paid for yet, so a
-- mistaken amount does not sit in the admin queue forever. Only the wallet
-- owner, only still-pending purchase rows.
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_cancel_request(_entry_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.mkt_ad_credit_entries e
     SET status = 'cancelled'
   WHERE e.id = _entry_id
     AND e.kind = 'purchase'
     AND e.status = 'pending'
     AND EXISTS (
       SELECT 1 FROM public.mkt_ad_credit_wallets w
        WHERE w.id = e.wallet_id
          AND (
            w.owner_user_id = auth.uid()
            OR (w.tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(w.tenant_id))
          )
     )
  RETURNING true INTO ok;

  IF ok IS NULL THEN
    RAISE EXCEPTION 'entry_not_pending';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_cancel_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_cancel_request(uuid) TO authenticated;