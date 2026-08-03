-- Column-level revokes only work when the table-level SELECT grant is gone.
REVOKE SELECT ON public.mkt_listings FROM anon, authenticated;

GRANT SELECT (
  id, slug, owner_user_id, tenant_id, type_code, category_id, subcategory_id, title, summary,
  description, specs, price, price_on_request, price_unit, currency, quantity, unit,
  item_condition, deal_kind, city, region, cover_image_url, status, rejection_reason,
  published_at, expires_at, views_count, contact_requests_count, deleted_at, created_at,
  updated_at, advertiser_type, country_id, city_id, district, location_visibility,
  latitude_public, longitude_public
) ON public.mkt_listings TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.mkt_listings TO authenticated;
GRANT ALL ON public.mkt_listings TO service_role;

-- Licence: the public columns only, and no visitor access to the private row.
REVOKE SELECT ON public.mkt_listing_licenses FROM anon;
GRANT SELECT (listing_id, advertiser_role, ad_license_number, ad_license_expiry,
              practice_license_number, verification_status)
  ON public.mkt_listing_licenses TO anon;

REVOKE ALL ON public.mkt_listing_license_private FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_listing_license_private TO authenticated;
GRANT ALL ON public.mkt_listing_license_private TO service_role;