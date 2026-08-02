-- ========== 1. Private official registry ==========
CREATE TABLE public.mkt_business_registry (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  country_id uuid REFERENCES public.mkt_countries(id),
  entity_type text NOT NULL DEFAULT 'establishment',
  legal_name text NOT NULL,
  cr_number text,
  unified_number text,
  cr_issue_date date,
  cr_expiry_date date,
  main_activity text,
  sub_activities text[] NOT NULL DEFAULT '{}',
  national_address text,
  contact_phone text,
  contact_email text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_business_registry_entity_type_chk
    CHECK (entity_type IN ('establishment','company','office','factory','branch','non_profit','government','other')),
  CONSTRAINT mkt_business_registry_cr_chk
    CHECK (cr_number IS NULL OR cr_number ~ '^[0-9A-Za-z-]{5,30}$'),
  CONSTRAINT mkt_business_registry_unified_chk
    CHECK (unified_number IS NULL OR unified_number ~ '^[0-9A-Za-z-]{5,30}$'),
  CONSTRAINT mkt_business_registry_dates_chk
    CHECK (cr_expiry_date IS NULL OR cr_issue_date IS NULL OR cr_expiry_date >= cr_issue_date)
);

GRANT SELECT, INSERT, UPDATE ON public.mkt_business_registry TO authenticated;
GRANT ALL ON public.mkt_business_registry TO service_role;
ALTER TABLE public.mkt_business_registry ENABLE ROW LEVEL SECURITY;

-- No duplicate business per country + official number.
CREATE UNIQUE INDEX mkt_business_registry_cr_unique
  ON public.mkt_business_registry (country_id, lower(cr_number)) WHERE cr_number IS NOT NULL;
CREATE UNIQUE INDEX mkt_business_registry_unified_unique
  ON public.mkt_business_registry (country_id, lower(unified_number)) WHERE unified_number IS NOT NULL;

-- ========== 2. Private officer identity ==========
CREATE TABLE public.mkt_business_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  id_type text NOT NULL,
  id_number text NOT NULL,
  id_last2 text GENERATED ALWAYS AS (right(regexp_replace(id_number, '[^0-9A-Za-z]', '', 'g'), 2)) STORED,
  capacity text NOT NULL,
  relation text,
  phone text NOT NULL,
  email text,
  authorization_expires_on date,
  is_primary boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_business_officers_id_type_chk CHECK (id_type IN ('national_id','iqama','gcc_id','passport','other')),
  CONSTRAINT mkt_business_officers_capacity_chk CHECK (capacity IN ('owner','manager','authorized','employee')),
  CONSTRAINT mkt_business_officers_id_number_chk CHECK (id_number ~ '^[0-9A-Za-z]{6,20}$'),
  CONSTRAINT mkt_business_officers_name_chk CHECK (char_length(btrim(full_name)) >= 4),
  CONSTRAINT mkt_business_officers_phone_chk CHECK (phone ~ '^[+0-9][0-9 ()-]{6,20}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_business_officers TO authenticated;
GRANT ALL ON public.mkt_business_officers TO service_role;
ALTER TABLE public.mkt_business_officers ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX mkt_business_officers_primary_unique
  ON public.mkt_business_officers (tenant_id) WHERE is_primary;
CREATE INDEX mkt_business_officers_tenant_idx ON public.mkt_business_officers (tenant_id);

-- ========== 3. Verification-review permission ==========
INSERT INTO public.mkt_staff_permissions (user_id, perm)
SELECT DISTINCT ur.user_id, 'verifications.review'
FROM public.user_roles ur
WHERE ur.role IN ('accountant')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.mkt_can_review_identity()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mkt_is_super_admin() OR public.mkt_staff_has('verifications.review');
$$;

REVOKE ALL ON FUNCTION public.mkt_can_review_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_can_review_identity() TO authenticated, service_role;

-- ========== 4. RLS: registry ==========
CREATE POLICY mkt_business_registry_read ON public.mkt_business_registry
  FOR SELECT TO authenticated
  USING (public.mkt_can_manage_business(tenant_id) OR public.mkt_can_review_identity());

CREATE POLICY mkt_business_registry_insert ON public.mkt_business_registry
  FOR INSERT TO authenticated
  WITH CHECK (public.mkt_can_manage_business(tenant_id));

CREATE POLICY mkt_business_registry_update ON public.mkt_business_registry
  FOR UPDATE TO authenticated
  USING (public.mkt_can_manage_business(tenant_id))
  WITH CHECK (public.mkt_can_manage_business(tenant_id));

-- ========== 5. RLS: officers ==========
CREATE POLICY mkt_business_officers_read ON public.mkt_business_officers
  FOR SELECT TO authenticated
  USING (public.mkt_can_manage_business(tenant_id) OR public.mkt_can_review_identity());

CREATE POLICY mkt_business_officers_insert ON public.mkt_business_officers
  FOR INSERT TO authenticated
  WITH CHECK (public.mkt_can_manage_business(tenant_id));

CREATE POLICY mkt_business_officers_update ON public.mkt_business_officers
  FOR UPDATE TO authenticated
  USING (public.mkt_can_manage_business(tenant_id))
  WITH CHECK (public.mkt_can_manage_business(tenant_id));

CREATE POLICY mkt_business_officers_delete ON public.mkt_business_officers
  FOR DELETE TO authenticated
  USING (public.mkt_can_manage_business(tenant_id));

-- ========== 6. Guards: tenant and country never client-chosen after insert ==========
CREATE OR REPLACE FUNCTION public.mkt_registry_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_country uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.tenant_id := OLD.tenant_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  SELECT country_id INTO v_country FROM public.mkt_business_profiles WHERE tenant_id = NEW.tenant_id;
  IF v_country IS NULL THEN
    v_country := public.mkt_account_country_id(auth.uid());
  END IF;
  NEW.country_id := v_country;
  NEW.updated_at := now();
  IF NEW.cr_number IS NULL AND NEW.unified_number IS NULL THEN
    RAISE EXCEPTION 'OFFICIAL_NUMBER_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_business_registry_guard
  BEFORE INSERT OR UPDATE ON public.mkt_business_registry
  FOR EACH ROW EXECUTE FUNCTION public.mkt_registry_guard();

CREATE OR REPLACE FUNCTION public.mkt_officer_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.tenant_id := OLD.tenant_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.id_number := upper(regexp_replace(NEW.id_number, '[^0-9A-Za-z]', '', 'g'));
  NEW.full_name := btrim(NEW.full_name);
  NEW.updated_at := now();
  IF NEW.capacity <> 'owner' AND NEW.authorization_expires_on IS NOT NULL
     AND NEW.authorization_expires_on < current_date THEN
    RAISE EXCEPTION 'AUTHORIZATION_EXPIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_business_officers_guard
  BEFORE INSERT OR UPDATE ON public.mkt_business_officers
  FOR EACH ROW EXECUTE FUNCTION public.mkt_officer_guard();

-- ========== 7. Public business profile: activities and service areas ==========
ALTER TABLE public.mkt_business_profiles
  ADD COLUMN IF NOT EXISTS main_activity text,
  ADD COLUMN IF NOT EXISTS sub_activities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_area_city_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_area_regions text[] NOT NULL DEFAULT '{}';

-- ========== 8. Completeness gate before publishing as a business ==========
CREATE OR REPLACE FUNCTION public.mkt_business_details_complete(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mkt_business_registry r
    JOIN public.mkt_business_profiles p ON p.tenant_id = r.tenant_id
    WHERE r.tenant_id = _tenant_id
      AND char_length(btrim(r.legal_name)) >= 3
      AND (r.cr_number IS NOT NULL OR r.unified_number IS NOT NULL)
      AND r.main_activity IS NOT NULL
      AND r.contact_phone IS NOT NULL
      AND p.city_id IS NOT NULL
      AND char_length(btrim(p.display_name_ar)) >= 2
      AND EXISTS (SELECT 1 FROM public.mkt_business_officers o WHERE o.tenant_id = _tenant_id)
  );
$$;

REVOKE ALL ON FUNCTION public.mkt_business_details_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_business_details_complete(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_listing_require_business_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL
     AND NEW.status IN ('pending','published')
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_business_details_complete(NEW.tenant_id) THEN
    RAISE EXCEPTION 'BUSINESS_DETAILS_INCOMPLETE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_listings_require_business_details
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_require_business_details();

-- ========== 9. Verification documents: kind + delete audit ==========
ALTER TABLE public.mkt_verification_files
  ADD COLUMN IF NOT EXISTS doc_kind text NOT NULL DEFAULT 'other';

ALTER TABLE public.mkt_verification_files
  ADD CONSTRAINT mkt_verification_files_kind_chk
  CHECK (doc_kind IN ('cr','authorization','id','other'));

CREATE OR REPLACE FUNCTION public.mkt_verification_file_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.mkt_verification_requests WHERE id = OLD.request_id;
  IF v_status = 'approved' AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'APPROVED_DOCUMENT_LOCKED';
  END IF;
  INSERT INTO public.mkt_verification_events (tenant_id, request_id, from_status, to_status, reason, actor_id)
  VALUES (OLD.tenant_id, OLD.request_id, v_status, coalesce(v_status, 'unknown'),
          'document_deleted: ' || OLD.doc_kind || ' / ' || OLD.file_name, auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER mkt_verification_files_delete_guard
  BEFORE DELETE ON public.mkt_verification_files
  FOR EACH ROW EXECUTE FUNCTION public.mkt_verification_file_delete_guard();

CREATE POLICY mkt_verification_files_delete ON public.mkt_verification_files
  FOR DELETE TO authenticated
  USING (public.mkt_can_manage_business(tenant_id));

-- ========== 10. Verification request needs complete data ==========
CREATE OR REPLACE FUNCTION public.mkt_verification_request_requires_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_business_details_complete(NEW.tenant_id) THEN
    RAISE EXCEPTION 'BUSINESS_DETAILS_INCOMPLETE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_verification_requests_require_details
  BEFORE INSERT ON public.mkt_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_verification_request_requires_details();

-- keep updated_at fresh on the new tables via the shared helper as well
CREATE TRIGGER mkt_business_registry_touch
  BEFORE UPDATE ON public.mkt_business_registry
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE TRIGGER mkt_business_officers_touch
  BEFORE UPDATE ON public.mkt_business_officers
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();