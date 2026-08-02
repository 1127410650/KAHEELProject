-- 1) Blurred public point (~1 km) so the exact pin never leaves the database.
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS latitude_public double precision
    GENERATED ALWAYS AS (
      CASE WHEN latitude IS NULL THEN NULL
           WHEN location_visibility = 'exact' THEN latitude
           ELSE round(latitude::numeric, 2)::double precision END
    ) STORED,
  ADD COLUMN IF NOT EXISTS longitude_public double precision
    GENERATED ALWAYS AS (
      CASE WHEN longitude IS NULL THEN NULL
           WHEN location_visibility = 'exact' THEN longitude
           ELSE round(longitude::numeric, 2)::double precision END
    ) STORED;

-- 2) Exact coordinates and the street address are no longer selectable by app roles.
REVOKE SELECT (latitude, longitude, address_text, location_accuracy, location_source)
  ON public.mkt_listings FROM anon, authenticated;
GRANT ALL ON public.mkt_listings TO service_role;

-- Owners/admins still need the exact values to edit an ad.
CREATE OR REPLACE FUNCTION public.mkt_listing_exact_location(p_listing_id uuid)
RETURNS TABLE (
  latitude double precision,
  longitude double precision,
  address_text text,
  location_accuracy numeric,
  location_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.latitude, l.longitude, l.address_text, l.location_accuracy, l.location_source
  FROM public.mkt_listings l
  WHERE l.id = p_listing_id
    AND public.mkt_can_manage_listing(p_listing_id)
$$;

REVOKE ALL ON FUNCTION public.mkt_listing_exact_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_exact_location(uuid) TO authenticated, service_role;

-- 3) Licence: visitors read only the columns the authority requires published.
REVOKE SELECT ON public.mkt_listing_licenses FROM anon;
GRANT SELECT (listing_id, advertiser_role, ad_license_number, ad_license_expiry,
              practice_license_number, verification_status)
  ON public.mkt_listing_licenses TO anon;

-- 4) An expired real estate licence hides the ad from public browsing at once.
CREATE OR REPLACE FUNCTION public.mkt_re_license_active(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.mkt_listing_licenses lic
    WHERE lic.listing_id = p_listing_id
      AND COALESCE(lic.exemption_approved, false) = false
      AND (
        lic.verification_status = 'invalid'
        OR (lic.ad_license_expiry IS NOT NULL
            AND lic.ad_license_expiry < (now() AT TIME ZONE 'Asia/Riyadh')::date)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_re_license_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_re_license_active(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS mkt_listings_public_read ON public.mkt_listings;
CREATE POLICY mkt_listings_public_read ON public.mkt_listings
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND public.mkt_re_license_active(id)
  );

DROP POLICY IF EXISTS mkt_listings_auth_read ON public.mkt_listings;
CREATE POLICY mkt_listings_auth_read ON public.mkt_listings
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
      AND public.mkt_re_license_active(id))
    OR owner_user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND is_tenant_member(tenant_id))
    OR mkt_is_platform_admin()
  );

DROP POLICY IF EXISTS "Public licence facts of published ads" ON public.mkt_listing_licenses;
CREATE POLICY "Public licence facts of published ads" ON public.mkt_listing_licenses
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_listings l
      WHERE l.id = mkt_listing_licenses.listing_id
        AND l.status = 'published'
        AND l.deleted_at IS NULL
    )
  );

-- 5) Systematic suspension of ads whose licence lapsed after publishing.
CREATE OR REPLACE FUNCTION public.mkt_expire_re_licenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.mkt_listings l
     SET status = 'suspended',
         rejection_reason = 'انتهت صلاحية ترخيص الإعلان العقاري',
         updated_at = now()
   WHERE l.status = 'published'
     AND l.deleted_at IS NULL
     AND NOT public.mkt_re_license_active(l.id);
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.mkt_listing_licenses lic
     SET verification_status = 'expired',
         updated_at = now()
   WHERE lic.ad_license_expiry IS NOT NULL
     AND lic.ad_license_expiry < (now() AT TIME ZONE 'Asia/Riyadh')::date
     AND COALESCE(lic.exemption_approved, false) = false
     AND lic.verification_status <> 'expired';

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_expire_re_licenses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_expire_re_licenses() TO service_role;