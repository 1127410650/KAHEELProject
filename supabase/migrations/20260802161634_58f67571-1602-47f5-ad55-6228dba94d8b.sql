CREATE OR REPLACE FUNCTION public.mkt_business_number_taken(_cr_number text, _unified_number text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  v_country := public.mkt_account_country_id(auth.uid());
  RETURN EXISTS (
    SELECT 1 FROM public.mkt_business_registry r
    WHERE r.country_id IS NOT DISTINCT FROM v_country
      AND (
        (_cr_number IS NOT NULL AND r.cr_number IS NOT NULL
          AND lower(r.cr_number) = lower(btrim(_cr_number)))
        OR (_unified_number IS NOT NULL AND r.unified_number IS NOT NULL
          AND lower(r.unified_number) = lower(btrim(_unified_number)))
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_business_number_taken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_business_number_taken(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_registry_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_officer_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_listing_require_business_details() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_verification_file_delete_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_verification_request_requires_details() FROM PUBLIC;