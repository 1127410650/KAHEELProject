-- ============================================================
-- Real estate advertising licence (Saudi Real Estate General Authority)
-- ============================================================

CREATE TABLE public.mkt_listing_licenses (
  listing_id uuid PRIMARY KEY REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  advertiser_role text NOT NULL DEFAULT 'owner'
    CHECK (advertiser_role IN ('owner','broker_individual','brokerage_business','authorized_agent')),
  ad_license_number text,
  ad_license_expiry date,
  practice_license_number text,
  license_doc_path text,
  verification_status text NOT NULL DEFAULT 'not_entered'
    CHECK (verification_status IN ('not_entered','pending_verification','valid','expired','invalid','needs_completion','exempt')),
  verified_at timestamptz,
  verified_by uuid,
  verification_note text,
  verification_source text,
  exemption_requested boolean NOT NULL DEFAULT false,
  exemption_reason text,
  exemption_doc_path text,
  exemption_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_listing_licenses TO authenticated;
GRANT ALL ON public.mkt_listing_licenses TO service_role;

ALTER TABLE public.mkt_listing_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read listing licences"
  ON public.mkt_listing_licenses FOR SELECT TO authenticated
  USING (public.mkt_can_manage_listing(listing_id));

CREATE POLICY "Owners and admins create listing licences"
  ON public.mkt_listing_licenses FOR INSERT TO authenticated
  WITH CHECK (public.mkt_can_manage_listing(listing_id));

CREATE POLICY "Owners and admins update listing licences"
  ON public.mkt_listing_licenses FOR UPDATE TO authenticated
  USING (public.mkt_can_manage_listing(listing_id))
  WITH CHECK (public.mkt_can_manage_listing(listing_id));

CREATE POLICY "Owners and admins delete listing licences"
  ON public.mkt_listing_licenses FOR DELETE TO authenticated
  USING (public.mkt_can_manage_listing(listing_id));

-- ---------- private, never public ----------
CREATE TABLE public.mkt_listing_license_private (
  listing_id uuid PRIMARY KEY REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  deed_number text,
  brokerage_contract_number text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_listing_license_private TO authenticated;
GRANT ALL ON public.mkt_listing_license_private TO service_role;

ALTER TABLE public.mkt_listing_license_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage private licence data"
  ON public.mkt_listing_license_private FOR ALL TO authenticated
  USING (public.mkt_can_manage_listing(listing_id))
  WITH CHECK (public.mkt_can_manage_listing(listing_id));

-- ---------- the only publicly readable slice ----------
CREATE VIEW public.mkt_public_listing_licenses AS
  SELECT
    lic.listing_id,
    lic.advertiser_role,
    lic.ad_license_number,
    lic.ad_license_expiry,
    lic.practice_license_number,
    lic.verification_status
  FROM public.mkt_listing_licenses lic
  JOIN public.mkt_listings l ON l.id = lic.listing_id
  WHERE l.status = 'published'
    AND l.deleted_at IS NULL
    AND coalesce(btrim(lic.ad_license_number), '') <> '';

GRANT SELECT ON public.mkt_public_listing_licenses TO anon, authenticated;

-- ---------- clients can never verify themselves ----------
CREATE OR REPLACE FUNCTION public.mkt_license_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin boolean := public.mkt_is_platform_admin();
BEGIN
  NEW.ad_license_number := nullif(btrim(coalesce(NEW.ad_license_number, '')), '');
  NEW.practice_license_number := nullif(btrim(coalesce(NEW.practice_license_number, '')), '');
  NEW.exemption_reason := nullif(btrim(coalesce(NEW.exemption_reason, '')), '');
  NEW.updated_at := now();

  IF v_admin THEN
    IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND NEW.verification_status IN ('valid','exempt','invalid','needs_completion','expired') THEN
      NEW.verified_at := now();
      NEW.verified_by := auth.uid();
      NEW.verification_source := coalesce(NEW.verification_source, 'admin_manual');
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admin writers: verification is not theirs to set.
  IF TG_OP = 'INSERT' THEN
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_note := NULL;
    NEW.verification_source := NULL;
    NEW.exemption_approved := false;
    NEW.verification_status := CASE
      WHEN NEW.ad_license_number IS NULL THEN 'not_entered'
      ELSE 'pending_verification' END;
  ELSE
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.verification_note := OLD.verification_note;
    NEW.verification_source := OLD.verification_source;
    NEW.exemption_approved := OLD.exemption_approved;
    NEW.verification_status := CASE
      WHEN OLD.verification_status = 'exempt' AND OLD.exemption_approved THEN 'exempt'
      WHEN NEW.ad_license_number IS NULL THEN 'not_entered'
      WHEN NEW.ad_license_number IS DISTINCT FROM OLD.ad_license_number THEN 'pending_verification'
      WHEN OLD.verification_status = 'not_entered' THEN 'pending_verification'
      ELSE OLD.verification_status END;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER mkt_listing_licenses_guard
  BEFORE INSERT OR UPDATE ON public.mkt_listing_licenses
  FOR EACH ROW EXECUTE FUNCTION public.mkt_license_guard();

CREATE OR REPLACE FUNCTION public.mkt_license_private_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER mkt_listing_license_private_touch
  BEFORE UPDATE ON public.mkt_listing_license_private
  FOR EACH ROW EXECUTE FUNCTION public.mkt_license_private_touch();

-- ---------- publishing rules for Saudi real estate ads ----------
CREATE OR REPLACE FUNCTION public.mkt_require_re_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_root text;
  v_lic public.mkt_listing_licenses;
  v_today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF NEW.status NOT IN ('pending','published') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.slug, c.slug) INTO v_root
    FROM public.mkt_categories c
    LEFT JOIN public.mkt_categories p ON p.id = c.parent_id
   WHERE c.id = NEW.category_id;

  IF v_root IS DISTINCT FROM 'real-estate' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_lic FROM public.mkt_listing_licenses WHERE listing_id = NEW.id;

  IF v_lic.listing_id IS NOT NULL
     AND v_lic.verification_status = 'exempt'
     AND v_lic.exemption_approved THEN
    RETURN NEW;
  END IF;

  IF v_lic.listing_id IS NULL OR v_lic.ad_license_number IS NULL THEN
    RAISE EXCEPTION 'RE_LICENSE_REQUIRED';
  END IF;
  IF v_lic.ad_license_expiry IS NULL THEN
    RAISE EXCEPTION 'RE_LICENSE_EXPIRY_REQUIRED';
  END IF;
  IF v_lic.ad_license_expiry < v_today THEN
    RAISE EXCEPTION 'RE_LICENSE_EXPIRED';
  END IF;
  IF v_lic.advertiser_role IN ('broker_individual','brokerage_business')
     AND v_lic.practice_license_number IS NULL THEN
    RAISE EXCEPTION 'RE_PRACTICE_LICENSE_REQUIRED';
  END IF;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mkt_require_re_license() FROM anon;

CREATE TRIGGER zz_mkt_listings_require_re_license
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_require_re_license();

-- ---------- expiry sweep: move back to review, notify, keep the ad ----------
CREATE OR REPLACE FUNCTION public.mkt_sweep_expired_re_licenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  v_count integer := 0;
  r record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  FOR r IN
    SELECT l.id, l.owner_user_id, l.title
      FROM public.mkt_listings l
      JOIN public.mkt_listing_licenses lic ON lic.listing_id = l.id
     WHERE l.status = 'published'
       AND l.deleted_at IS NULL
       AND lic.verification_status <> 'exempt'
       AND lic.ad_license_expiry IS NOT NULL
       AND lic.ad_license_expiry < v_today
  LOOP
    UPDATE public.mkt_listing_licenses
       SET verification_status = 'expired', updated_at = now()
     WHERE listing_id = r.id;
    UPDATE public.mkt_listings SET status = 'pending' WHERE id = r.id;
    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (
      r.owner_user_id,
      'listing_action',
      'انتهى ترخيص الإعلان العقاري',
      'تم إيقاف ظهور الإعلان «' || r.title || '» ونقله للمراجعة بعد انتهاء ترخيص الإعلان. حدّث رقم الترخيص وتاريخ انتهائه.'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mkt_sweep_expired_re_licenses() FROM anon;

-- ---------- licence documents: private storage, admins may review ----------
CREATE POLICY "Platform admins read licence documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] = 'licenses'
    AND public.mkt_is_platform_admin()
  );