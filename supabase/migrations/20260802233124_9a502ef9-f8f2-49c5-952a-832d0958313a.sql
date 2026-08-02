ALTER VIEW public.mkt_public_listing_licenses SET (security_invoker = on);

-- Anonymous visitors may read only the columns the authority allows in an ad,
-- and only for ads that are actually published.
GRANT SELECT (
  listing_id, advertiser_role, ad_license_number, ad_license_expiry,
  practice_license_number, verification_status
) ON public.mkt_listing_licenses TO anon;

CREATE POLICY "Public licence facts of published ads"
  ON public.mkt_listing_licenses FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mkt_listings l
    WHERE l.id = mkt_listing_licenses.listing_id
      AND l.status = 'published'
      AND l.deleted_at IS NULL
  ));