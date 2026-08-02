-- A single, narrow system actor: only the licence-expiry job may set it, and it
-- lives for one transaction. Advertisers and visitors cannot set it at all.
CREATE OR REPLACE FUNCTION public.mkt_is_system_action()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT coalesce(current_setting('mkt.system_action', true), '') = 'license_expiry' $$;

REVOKE ALL ON FUNCTION public.mkt_is_system_action() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_is_system_action() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_listing_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Review decisions belong to platform admins only.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('published','rejected','suspended')
     AND NOT public.mkt_is_platform_admin()
     AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action()) THEN
    RAISE EXCEPTION 'Only marketplace administrators can approve, reject or suspend listings';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.mkt_is_platform_admin() THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'The advertiser of a listing cannot be changed';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'The advertising identity of a listing cannot be changed';
    END IF;
  END IF;

  -- Publishing under a business name requires an active membership with publishing rights.
  IF NEW.tenant_id IS NOT NULL
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_is_system_action()
     AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
    RAISE EXCEPTION 'You are not allowed to publish on behalf of this business';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.mkt_slugify(NEW.title);
    IF base IS NULL OR base = '' THEN base := 'ad'; END IF;
    candidate := base || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    WHILE EXISTS (SELECT 1 FROM public.mkt_listings l WHERE l.slug = candidate AND l.id <> NEW.id) LOOP
      n := n + 1; candidate := base || '-' || n::text || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    END LOOP;
    NEW.slug := candidate;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('published','rejected','suspended')
       AND NOT public.mkt_is_platform_admin()
       AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action()) THEN
      RAISE EXCEPTION 'Only platform reviewers can set status %', NEW.status;
    END IF;
    IF NEW.status = 'rejected' AND coalesce(btrim(NEW.rejection_reason),'') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_expire_re_licenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  PERFORM set_config('mkt.system_action', 'license_expiry', true);

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

  PERFORM set_config('mkt.system_action', '', true);
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_expire_re_licenses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_expire_re_licenses() TO service_role;