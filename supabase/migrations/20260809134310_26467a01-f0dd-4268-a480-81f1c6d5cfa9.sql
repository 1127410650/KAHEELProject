-- Ad credit top-up is manual (platform admin) only for now: no payment
-- gateway is wired, so the self-service purchase-request endpoint is closed.
-- The function itself is kept (not dropped) so existing pending entries and
-- their history stay interpretable; only client access is revoked.
REVOKE EXECUTE ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) FROM PUBLIC;

COMMENT ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) IS
  'Retired for now: ad credit is topped up manually by a platform admin via mkt_ad_credit_admin_grant. EXECUTE is revoked from anon/authenticated until a payment provider is connected.';