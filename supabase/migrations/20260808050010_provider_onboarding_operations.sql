-- ============================================================================
-- Gohail reviewed provider onboarding and unified operations centre
--
-- Adds reviewed join applications for sellers, service providers, couriers and
-- platform-team candidates. New provider tenants stay operationally locked until
-- approval. Existing providers are grandfathered: when no join application
-- exists for a tenant, their current access is preserved.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.mkt_join_application_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.mkt_join_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text NOT NULL UNIQUE DEFAULT (
    'KJ-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMMDD') || '-' ||
    lpad(nextval('public.mkt_join_application_number_seq')::text, 5, '0')
  ),
  applicant_user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE,
  application_kind text NOT NULL CHECK (application_kind IN (
    'seller', 'service_provider', 'delivery_team', 'platform_team'
  )),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  provider_category_code text
    REFERENCES public.mkt_provider_categories(code) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_review', 'needs_more', 'approved', 'rejected', 'withdrawn'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_join_application_tenant_kind_ck CHECK (
    (application_kind IN ('seller', 'service_provider') AND tenant_id IS NOT NULL)
    OR
    (application_kind IN ('delivery_team', 'platform_team') AND tenant_id IS NULL)
  ),
  CONSTRAINT mkt_join_application_payload_size_ck CHECK (
    octet_length(payload::text) <= 24000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS mkt_join_applications_open_user_kind_idx
  ON public.mkt_join_applications (applicant_user_id, application_kind)
  WHERE status IN ('pending', 'in_review', 'needs_more');
CREATE UNIQUE INDEX IF NOT EXISTS mkt_join_applications_open_tenant_idx
  ON public.mkt_join_applications (tenant_id)
  WHERE tenant_id IS NOT NULL AND status IN ('pending', 'in_review', 'needs_more');
CREATE INDEX IF NOT EXISTS mkt_join_applications_admin_queue_idx
  ON public.mkt_join_applications (status, application_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS mkt_join_applications_user_idx
  ON public.mkt_join_applications (applicant_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mkt_join_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.mkt_join_applications(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_kind text NOT NULL CHECK (document_kind IN (
    'identity', 'license', 'vehicle', 'resume', 'authorization', 'other'
  )),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  )),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_join_application_documents_application_idx
  ON public.mkt_join_application_documents (application_id, created_at);

CREATE TABLE IF NOT EXISTS public.mkt_join_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.mkt_join_applications(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_join_application_events_application_idx
  ON public.mkt_join_application_events (application_id, created_at);

GRANT ALL ON public.mkt_join_applications,
  public.mkt_join_application_documents,
  public.mkt_join_application_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mkt_join_application_number_seq TO service_role;
REVOKE ALL ON public.mkt_join_applications,
  public.mkt_join_application_documents,
  public.mkt_join_application_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.mkt_join_application_number_seq
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.mkt_join_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_join_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_join_application_events ENABLE ROW LEVEL SECURITY;

-- No browser role receives direct table privileges. All reads and writes pass
-- through the account-scoped RPCs below. RLS remains enabled as defence in depth.

DROP TRIGGER IF EXISTS mkt_join_applications_touch ON public.mkt_join_applications;
CREATE TRIGGER mkt_join_applications_touch
  BEFORE UPDATE ON public.mkt_join_applications
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- A pending onboarding tenant is not an operational tenant. Existing tenants
-- without an onboarding record remain accessible exactly as before.
CREATE OR REPLACE FUNCTION public.mkt_tenant_operational_allowed(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_tenant_member(_tenant_id)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.mkt_join_applications a
        WHERE a.tenant_id = _tenant_id
          AND a.application_kind IN ('seller', 'service_provider')
      )
      OR EXISTS (
        SELECT 1 FROM public.mkt_join_applications a
        WHERE a.tenant_id = _tenant_id
          AND a.application_kind IN ('seller', 'service_provider')
          AND a.status = 'approved'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.mkt_tenant_operational_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_tenant_operational_allowed(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_store_manage(_storefront_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_storefronts s
    WHERE s.id = _storefront_id
      AND s.deleted_at IS NULL
      AND (
        (s.tenant_id IS NULL AND s.owner_user_id = auth.uid())
        OR
        (s.tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(s.tenant_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.mkt_store_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_store_manage(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS mkt_storefronts_owner_read ON public.mkt_storefronts;
CREATE POLICY mkt_storefronts_owner_read ON public.mkt_storefronts
  FOR SELECT TO authenticated
  USING (public.mkt_store_manage(id) OR public.mkt_store_admin());

DROP POLICY IF EXISTS mkt_storefronts_owner_update ON public.mkt_storefronts;
CREATE POLICY mkt_storefronts_owner_update ON public.mkt_storefronts
  FOR UPDATE TO authenticated
  USING (public.mkt_store_manage(id))
  WITH CHECK (public.mkt_store_manage(id));

-- Provider creation and personal-account submission share one guarded API. For
-- business applications the tenant must be owned by the caller. The RPC creates
-- the canonical storefront/profile in a draft state without exposing the hidden
-- business account to the normal account picker.
CREATE OR REPLACE FUNCTION public.mkt_join_application_submit(
  _application_kind text,
  _tenant_id uuid DEFAULT NULL,
  _provider_category_code text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_category public.mkt_provider_categories;
  v_store uuid;
  v_country uuid;
  v_name text;
  v_slug text;
  v_suffix integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _application_kind NOT IN (
    'seller', 'service_provider', 'delivery_team', 'platform_team'
  ) THEN RAISE EXCEPTION 'join_kind_invalid'; END IF;
  IF jsonb_typeof(coalesce(_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'join_payload_invalid';
  END IF;
  IF length(btrim(coalesce(_payload ->> 'full_name', ''))) < 3 THEN
    RAISE EXCEPTION 'join_full_name_required';
  END IF;
  IF length(regexp_replace(coalesce(_payload ->> 'phone', ''), '[^0-9+]', '', 'g')) < 7 THEN
    RAISE EXCEPTION 'join_phone_required';
  END IF;

  SELECT a.id INTO v_id
  FROM public.mkt_join_applications a
  WHERE a.applicant_user_id = auth.uid()
    AND a.application_kind = _application_kind
    AND a.status IN ('pending', 'in_review', 'needs_more')
  ORDER BY a.created_at DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF _application_kind IN ('seller', 'service_provider') THEN
    IF _tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = _tenant_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
        AND m.status = 'active'
    ) THEN RAISE EXCEPTION 'join_tenant_owner_required'; END IF;

    SELECT * INTO v_category
    FROM public.mkt_provider_categories c
    WHERE c.code = _provider_category_code AND c.is_active;
    IF v_category.code IS NULL THEN RAISE EXCEPTION 'provider_category_invalid'; END IF;
    IF _application_kind = 'seller'
      AND NOT (
        'catalog.products' = ANY(v_category.capabilities)
        OR 'orders.receive' = ANY(v_category.capabilities)
      ) THEN RAISE EXCEPTION 'seller_category_required'; END IF;
    IF _application_kind = 'service_provider'
      AND NOT (
        'catalog.services' = ANY(v_category.capabilities)
        OR 'bookings.receive' = ANY(v_category.capabilities)
        OR 'jobs.receive' = ANY(v_category.capabilities)
        OR 'quotes.receive' = ANY(v_category.capabilities)
      ) THEN RAISE EXCEPTION 'service_category_required'; END IF;

    SELECT t.name_ar INTO v_name FROM public.tenants t WHERE t.id = _tenant_id;
    v_country := public.mkt_account_country_id(auth.uid());

    SELECT s.id INTO v_store
    FROM public.mkt_storefronts s
    WHERE s.tenant_id = _tenant_id AND s.deleted_at IS NULL
    ORDER BY s.created_at LIMIT 1;

    IF v_store IS NULL THEN
      v_slug := nullif(public.mkt_slugify(v_name), '');
      v_slug := coalesce(v_slug, 'store');
      WHILE EXISTS (SELECT 1 FROM public.mkt_storefronts s WHERE s.slug = v_slug) LOOP
        v_suffix := v_suffix + 1;
        v_slug := coalesce(nullif(public.mkt_slugify(v_name), ''), 'store') || '-' || v_suffix::text;
      END LOOP;
      INSERT INTO public.mkt_storefronts (
        owner_user_id, tenant_id, store_type, slug, name_ar, country_id,
        status, draft_step, idempotency_key, currency_code
      ) VALUES (
        auth.uid(), _tenant_id, v_category.default_store_type, v_slug,
        coalesce(nullif(btrim(v_name), ''), 'متجر'), v_country,
        'draft', 1, 'join:' || _tenant_id::text,
        coalesce((SELECT c.currency_code FROM public.mkt_countries c WHERE c.id = v_country), 'SAR')
      ) RETURNING id INTO v_store;
      INSERT INTO public.mkt_store_private (storefront_id) VALUES (v_store)
      ON CONFLICT (storefront_id) DO NOTHING;
    END IF;

    INSERT INTO public.mkt_provider_profiles (
      storefront_id, category_code, headline_ar, headline_en,
      accepts_partner_requests, status, created_by
    ) VALUES (
      v_store, v_category.code,
      nullif(btrim(coalesce(_payload ->> 'headline_ar', '')), ''),
      nullif(btrim(coalesce(_payload ->> 'headline_en', '')), ''),
      false, 'draft', auth.uid()
    )
    ON CONFLICT (storefront_id) DO UPDATE SET
      category_code = EXCLUDED.category_code,
      headline_ar = EXCLUDED.headline_ar,
      headline_en = EXCLUDED.headline_en,
      accepts_partner_requests = false,
      status = 'draft',
      updated_at = now();

    UPDATE public.tenants
    SET provider_type = v_category.code,
        usage_type = 'onboarding:' || _application_kind,
        updated_at = now()
    WHERE id = _tenant_id;
    UPDATE public.mkt_storefronts
    SET store_type = v_category.default_store_type,
        status = 'draft',
        accepts_orders = false,
        updated_at = now()
    WHERE id = v_store;
    UPDATE public.mkt_business_profiles
    SET is_published = false, updated_at = now()
    WHERE tenant_id = _tenant_id;
  ELSE
    IF _tenant_id IS NOT NULL OR _provider_category_code IS NOT NULL THEN
      RAISE EXCEPTION 'join_personal_scope_invalid';
    END IF;
    IF _application_kind = 'delivery_team'
      AND coalesce(btrim(_payload ->> 'vehicle_type'), '') = '' THEN
      RAISE EXCEPTION 'join_vehicle_required';
    END IF;
    IF _application_kind = 'platform_team'
      AND coalesce(btrim(_payload ->> 'desired_role'), '') = '' THEN
      RAISE EXCEPTION 'join_role_required';
    END IF;
  END IF;

  INSERT INTO public.mkt_join_applications (
    applicant_user_id, application_kind, tenant_id, provider_category_code,
    status, payload
  ) VALUES (
    auth.uid(), _application_kind, _tenant_id, _provider_category_code,
    'pending', coalesce(_payload, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  INSERT INTO public.mkt_join_application_events (
    application_id, from_status, to_status, actor_user_id
  ) VALUES (v_id, NULL, 'pending', auth.uid());

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_application_submit(text, uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_application_submit(text, uuid, text, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_join_application_document_add(
  _application_id uuid,
  _document_kind text,
  _storage_path text,
  _file_name text,
  _mime_type text,
  _size_bytes integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _document_kind NOT IN (
    'identity', 'license', 'vehicle', 'resume', 'authorization', 'other'
  ) THEN RAISE EXCEPTION 'join_document_kind_invalid'; END IF;
  IF _mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    OR _size_bytes <= 0 OR _size_bytes > 10485760 THEN
    RAISE EXCEPTION 'join_document_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_join_applications a
    WHERE a.id = _application_id
      AND a.applicant_user_id = auth.uid()
      AND a.status IN ('pending', 'needs_more')
  ) THEN RAISE EXCEPTION 'join_application_not_editable'; END IF;
  IF _storage_path NOT LIKE ('join-applications/' || auth.uid()::text || '/' || _application_id::text || '/%') THEN
    RAISE EXCEPTION 'join_document_path_invalid';
  END IF;
  INSERT INTO public.mkt_join_application_documents (
    application_id, owner_user_id, document_kind, storage_path,
    file_name, mime_type, size_bytes
  ) VALUES (
    _application_id, auth.uid(), _document_kind, _storage_path,
    left(_file_name, 240), _mime_type, _size_bytes
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_application_document_add(uuid, text, text, text, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_application_document_add(uuid, text, text, text, text, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_my_join_applications()
RETURNS TABLE (
  id uuid,
  application_number text,
  application_kind text,
  tenant_id uuid,
  tenant_name text,
  provider_category_code text,
  provider_category_name_ar text,
  provider_category_name_en text,
  status text,
  payload jsonb,
  decision_reason text,
  documents_count bigint,
  account_key text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    a.id, a.application_number, a.application_kind, a.tenant_id,
    t.name_ar, a.provider_category_code, c.name_ar, c.name_en,
    a.status, a.payload, a.decision_reason,
    (SELECT count(*) FROM public.mkt_join_application_documents d
      WHERE d.application_id = a.id),
    CASE WHEN a.tenant_id IS NULL THEN 'individual'
      ELSE 'business:' || a.tenant_id::text END,
    a.created_at, a.reviewed_at
  FROM public.mkt_join_applications a
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.mkt_provider_categories c ON c.code = a.provider_category_code
  WHERE auth.uid() IS NOT NULL AND a.applicant_user_id = auth.uid()
  ORDER BY a.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.mkt_my_join_applications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_join_applications() TO authenticated, service_role;

-- Account projection: an approved seller/provider works only under the work
-- account. The personal identity remains in Auth for ownership and audit, but it
-- is intentionally omitted from the marketplace account switcher.
CREATE OR REPLACE FUNCTION public.mkt_my_accounts()
RETURNS TABLE(
  account_key text, kind text, tenant_id uuid, membership_id uuid, role text,
  name text, slug text, avatar_url text, verification_status text,
  can_publish boolean, permissions text[], city text, activity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    'individual'::text,
    'individual'::text,
    NULL::uuid,
    NULL::uuid,
    NULL::text,
    COALESCE(NULLIF(btrim(up.display_name), ''), NULLIF(btrim(p.full_name), ''), ''),
    up.username,
    up.avatar_url,
    up.verification_status,
    true,
    COALESCE((
      SELECT array_agg(DISTINCT perm.permission)
      FROM public.user_permissions perm
      WHERE perm.user_id = auth.uid() AND perm.tenant_id IS NULL
    ), '{}'::text[]),
    NULLIF(btrim(COALESCE(up.city, '')), ''),
    NULL::text
  FROM (SELECT 1) x
  LEFT JOIN public.mkt_user_profiles up ON up.user_id = auth.uid()
  LEFT JOIN public.profiles p ON p.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.mkt_join_applications a
      JOIN public.tenant_memberships jm ON jm.tenant_id = a.tenant_id
      WHERE a.status = 'approved'
        AND a.application_kind IN ('seller', 'service_provider')
        AND jm.user_id = auth.uid()
        AND jm.status = 'active'
    )

  UNION ALL

  SELECT
    'business:' || t.id::text,
    'business'::text,
    t.id,
    m.id,
    m.role::text,
    COALESCE(NULLIF(btrim(bp.display_name_ar), ''), t.name_ar),
    bp.slug,
    bp.logo_url,
    bp.verification_status,
    m.role::text IN ('owner', 'accountant', 'employee', 'service_provider'),
    COALESCE((
      SELECT array_agg(DISTINCT perm.permission)
      FROM public.user_permissions perm
      WHERE perm.user_id = auth.uid() AND perm.tenant_id = t.id
    ), '{}'::text[]),
    NULLIF(btrim(COALESCE(bp.city, '')), ''),
    NULLIF(btrim(COALESCE(bp.main_activity, '')), '')
  FROM public.tenant_memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND (m.membership_start IS NULL OR m.membership_start::date <= current_date)
    AND (m.membership_end IS NULL OR m.membership_end::date >= current_date)
    AND t.deleted_at IS NULL
    AND COALESCE(t.status, 'active') = 'active'
    AND t.personal_user_id IS NULL
    AND (
      coalesce(t.usage_type, '') NOT LIKE 'onboarding:%'
      OR EXISTS (
        SELECT 1 FROM public.mkt_join_applications a
        WHERE a.tenant_id = t.id
          AND a.application_kind IN ('seller', 'service_provider')
          AND a.status = 'approved'
      )
    )
  ORDER BY 2, 6;
$$;

REVOKE ALL ON FUNCTION public.mkt_my_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_accounts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_account_context(_account_key text)
RETURNS TABLE(
  account_key text, kind text, tenant_id uuid, membership_id uuid, role text,
  name text, slug text, avatar_url text, verification_status text,
  can_publish boolean, permissions text[], city text, activity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT * FROM public.mkt_my_accounts() a WHERE a.account_key = _account_key;
$$;

REVOKE ALL ON FUNCTION public.mkt_account_context(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_account_context(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_operational_access(_account_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_account record;
  v_store public.mkt_storefronts;
  v_profile public.mkt_provider_profiles;
  v_category public.mkt_provider_categories;
  v_join public.mkt_join_applications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_account FROM public.mkt_account_context(_account_key) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_allowed'; END IF;

  IF v_account.kind = 'individual' THEN
    SELECT * INTO v_join
    FROM public.mkt_join_applications a
    WHERE a.applicant_user_id = auth.uid()
      AND a.application_kind IN ('delivery_team', 'platform_team')
      AND a.status = 'approved'
    ORDER BY a.approved_at DESC NULLS LAST, a.created_at DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'allowed', v_join.id IS NOT NULL,
      'account_kind', 'individual',
      'operational_kind', coalesce(v_join.application_kind, 'customer'),
      'application_status', coalesce(v_join.status, 'none'),
      'storefront_id', NULL,
      'category_code', NULL,
      'category_name_ar', NULL,
      'category_name_en', NULL,
      'capabilities', CASE v_join.application_kind
        WHEN 'delivery_team' THEN ARRAY['delivery.provide','jobs.receive']::text[]
        WHEN 'platform_team' THEN ARRAY['platform.work']::text[]
        ELSE '{}'::text[] END
    );
  END IF;

  SELECT s.* INTO v_store
  FROM public.mkt_storefronts s
  WHERE s.tenant_id = v_account.tenant_id AND s.deleted_at IS NULL
  ORDER BY s.created_at LIMIT 1;
  IF v_store.id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.mkt_provider_profiles p
    WHERE p.storefront_id = v_store.id;
    SELECT * INTO v_category FROM public.mkt_provider_categories c
    WHERE c.code = v_profile.category_code AND c.is_active;
  END IF;
  SELECT * INTO v_join
  FROM public.mkt_join_applications a
  WHERE a.tenant_id = v_account.tenant_id
    AND a.application_kind IN ('seller', 'service_provider')
  ORDER BY a.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'allowed', v_store.id IS NOT NULL
      AND v_profile.storefront_id IS NOT NULL
      AND (v_join.id IS NULL OR v_join.status = 'approved'),
    'account_kind', 'business',
    'operational_kind', coalesce(v_join.application_kind,
      CASE WHEN 'bookings.receive' = ANY(coalesce(v_category.capabilities, '{}'::text[]))
        AND NOT ('orders.receive' = ANY(coalesce(v_category.capabilities, '{}'::text[])))
        THEN 'service_provider' ELSE 'seller' END),
    'application_status', coalesce(v_join.status, 'legacy_approved'),
    'storefront_id', v_store.id,
    'store_slug', v_store.slug,
    'store_status', v_store.status,
    'category_code', v_category.code,
    'category_name_ar', v_category.name_ar,
    'category_name_en', v_category.name_en,
    'capabilities', coalesce(v_category.capabilities, '{}'::text[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_operational_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_operational_access(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_provider_operations_overview(_account_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_access jsonb;
  v_store uuid;
BEGIN
  v_access := public.mkt_operational_access(_account_key);
  IF NOT coalesce((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'provider_access_required';
  END IF;
  v_store := nullif(v_access ->> 'storefront_id', '')::uuid;
  RETURN v_access || jsonb_build_object(
    'orders_pending', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_orders o
      WHERE o.storefront_id = v_store AND o.order_status = 'submitted') END,
    'orders_active', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_orders o
      WHERE o.storefront_id = v_store
        AND o.order_status IN ('accepted','preparing','ready','out_for_delivery')) END,
    'orders_completed', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_orders o
      WHERE o.storefront_id = v_store AND o.order_status = 'completed') END,
    'bookings_pending', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_service_bookings b
      WHERE b.storefront_id = v_store AND b.status = 'pending') END,
    'bookings_today', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_service_bookings b
      WHERE b.storefront_id = v_store
        AND b.starts_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh'
        AND b.starts_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh') + interval '1 day') AT TIME ZONE 'Asia/Riyadh'
        AND b.status NOT IN ('rejected','cancelled_by_customer','cancelled_by_provider')) END,
    'catalog_items', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_store_items i
      WHERE i.storefront_id = v_store AND i.deleted_at IS NULL) END,
    'published_listings', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_listings l
      WHERE l.storefront_id = v_store AND l.deleted_at IS NULL AND l.status = 'published') END,
    'active_promotions', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*)
      FROM public.mkt_listing_promotions p
      JOIN public.mkt_listings l ON l.id = p.listing_id
      WHERE l.storefront_id = v_store AND p.status = 'active' AND p.ends_at > now()) END,
    'active_integrations', CASE WHEN v_store IS NULL THEN 0 ELSE (
      SELECT count(*) FROM public.mkt_external_integrations i
      WHERE i.storefront_id = v_store AND i.status = 'active') END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_provider_operations_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_operations_overview(text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_merchant_orders_list(
  _account_key text,
  _status text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_access jsonb;
  v_store uuid;
BEGIN
  v_access := public.mkt_operational_access(_account_key);
  IF NOT coalesce((v_access ->> 'allowed')::boolean, false)
    OR NOT ('orders.receive' = ANY(ARRAY(
      SELECT jsonb_array_elements_text(v_access -> 'capabilities')
    ))) THEN RAISE EXCEPTION 'orders_access_required'; END IF;
  v_store := (v_access ->> 'storefront_id')::uuid;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'order_status', o.order_status,
      'fulfillment_type', o.fulfillment_type,
      'payment_method', o.payment_method,
      'payment_status', o.payment_status,
      'total', o.total,
      'currency_code', o.currency_code,
      'customer_name', o.customer_name_snapshot,
      'customer_phone', CASE WHEN o.share_phone_with_merchant
        THEN o.customer_phone_snapshot ELSE NULL END,
      'delivery_district', o.delivery_district,
      'delivery_address_text', o.delivery_address_text,
      'customer_notes', o.customer_notes,
      'merchant_notes', o.merchant_notes,
      'items_count', (SELECT coalesce(sum(oi.quantity), 0)
        FROM public.mkt_order_items oi WHERE oi.order_id = o.id),
      'created_at', o.created_at,
      'submitted_at', o.submitted_at,
      'updated_at', o.updated_at
    ) ORDER BY o.created_at DESC)
    FROM (
      SELECT source.*
      FROM public.mkt_orders source
      WHERE source.storefront_id = v_store
        AND source.order_status <> 'draft'
        AND (_status IS NULL OR source.order_status = _status)
      ORDER BY source.created_at DESC
      LIMIT greatest(1, least(coalesce(_limit, 100), 200))
    ) o
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_merchant_orders_list(text, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_merchant_orders_list(text, text, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_merchant_order_action(
  _account_key text,
  _order_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_access jsonb;
  v_store uuid;
  v_order public.mkt_orders;
  v_next text;
BEGIN
  v_access := public.mkt_operational_access(_account_key);
  IF NOT coalesce((v_access ->> 'allowed')::boolean, false)
    OR NOT ('orders.receive' = ANY(ARRAY(
      SELECT jsonb_array_elements_text(v_access -> 'capabilities')
    ))) THEN RAISE EXCEPTION 'orders_access_required'; END IF;
  v_store := (v_access ->> 'storefront_id')::uuid;
  SELECT * INTO v_order FROM public.mkt_orders o
  WHERE o.id = _order_id AND o.storefront_id = v_store
  FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_next := CASE
    WHEN v_order.order_status = 'submitted' AND _action = 'accept' THEN 'accepted'
    WHEN v_order.order_status = 'submitted' AND _action = 'reject' THEN 'rejected'
    WHEN v_order.order_status = 'accepted' AND _action = 'prepare' THEN 'preparing'
    WHEN v_order.order_status = 'preparing' AND _action = 'ready' THEN 'ready'
    WHEN v_order.order_status = 'ready' AND _action = 'dispatch' THEN 'out_for_delivery'
    WHEN v_order.order_status = 'ready' AND _action = 'complete' THEN 'completed'
    WHEN v_order.order_status = 'out_for_delivery' AND _action = 'complete' THEN 'completed'
    WHEN v_order.order_status IN ('accepted','preparing','ready') AND _action = 'cancel' THEN 'cancelled'
    ELSE NULL END;
  IF v_next IS NULL THEN RAISE EXCEPTION 'order_transition_invalid'; END IF;
  IF _action IN ('reject', 'cancel') AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'order_reason_required';
  END IF;

  UPDATE public.mkt_orders
  SET order_status = v_next,
      merchant_notes = CASE WHEN coalesce(btrim(_note), '') = ''
        THEN merchant_notes ELSE btrim(_note) END,
      cancellation_reason = CASE WHEN v_next IN ('rejected','cancelled')
        THEN btrim(_note) ELSE cancellation_reason END,
      merchant_account_id = _account_key,
      merchant_tenant_id = (
        SELECT a.tenant_id FROM public.mkt_account_context(_account_key) a LIMIT 1
      )
  WHERE id = _order_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_merchant_order_action(text, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_merchant_order_action(text, uuid, text, text)
  TO authenticated, service_role;

-- Admin review queue. Verification permission is reused deliberately: accepting
-- an operator is a back-office identity review, while verification badges remain
-- a separate visual decision and never grant operational access.
CREATE OR REPLACE FUNCTION public.mkt_admin_join_applications(
  _status text DEFAULT NULL,
  _kind text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  application_number text,
  application_kind text,
  applicant_user_id uuid,
  applicant_name text,
  tenant_id uuid,
  tenant_name text,
  provider_category_code text,
  provider_category_name text,
  status text,
  payload jsonb,
  decision_reason text,
  documents_count bigint,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NOT public.mkt_admin_can('verifications.view') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
  SELECT
    a.id, a.application_number, a.application_kind, a.applicant_user_id,
    coalesce(nullif(btrim(up.display_name), ''), nullif(btrim(p.full_name), ''),
      nullif(btrim(a.payload ->> 'full_name'), ''), ''),
    a.tenant_id, t.name_ar, a.provider_category_code,
    coalesce(c.name_ar, ''), a.status, a.payload, a.decision_reason,
    (SELECT count(*) FROM public.mkt_join_application_documents d
      WHERE d.application_id = a.id),
    a.created_at, a.reviewed_at
  FROM public.mkt_join_applications a
  LEFT JOIN public.mkt_user_profiles up ON up.user_id = a.applicant_user_id
  LEFT JOIN public.profiles p ON p.user_id = a.applicant_user_id
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.mkt_provider_categories c ON c.code = a.provider_category_code
  WHERE (_status IS NULL OR a.status = _status)
    AND (_kind IS NULL OR a.application_kind = _kind)
  ORDER BY a.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 100), 200));
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_join_applications(text, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_join_applications(text, text, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_join_documents(_application_id uuid)
RETURNS TABLE (
  id uuid, document_kind text, storage_path text, file_name text,
  mime_type text, size_bytes integer, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NOT public.mkt_admin_can('docs.view_sensitive') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY SELECT d.id, d.document_kind, d.storage_path, d.file_name,
    d.mime_type, d.size_bytes, d.created_at
  FROM public.mkt_join_application_documents d
  WHERE d.application_id = _application_id
  ORDER BY d.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_join_documents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_join_documents(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_join_application_review(
  _application_id uuid,
  _action text,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_app public.mkt_join_applications;
  v_next text;
BEGIN
  IF NOT public.mkt_admin_can('verifications.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT * INTO v_app FROM public.mkt_join_applications a
  WHERE a.id = _application_id FOR UPDATE;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'join_application_not_found'; END IF;
  v_next := CASE _action
    WHEN 'review' THEN 'in_review'
    WHEN 'approve' THEN 'approved'
    WHEN 'needs_more' THEN 'needs_more'
    WHEN 'reject' THEN 'rejected'
    ELSE NULL END;
  IF v_next IS NULL THEN RAISE EXCEPTION 'join_action_invalid'; END IF;
  IF v_app.status IN ('approved','rejected','withdrawn') THEN
    RAISE EXCEPTION 'join_application_final';
  END IF;
  IF _action IN ('needs_more','reject') AND coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'join_reason_required';
  END IF;

  UPDATE public.mkt_join_applications
  SET status = v_next,
      decision_reason = nullif(btrim(coalesce(_reason, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      approved_at = CASE WHEN v_next = 'approved' THEN now() ELSE approved_at END
  WHERE id = _application_id;

  IF v_app.tenant_id IS NOT NULL THEN
    IF v_next = 'approved' THEN
      UPDATE public.tenants
      SET usage_type = v_app.application_kind,
          provider_type = v_app.provider_category_code,
          updated_at = now()
      WHERE id = v_app.tenant_id;
      UPDATE public.mkt_provider_profiles p
      SET status = 'active', accepts_partner_requests = true, updated_at = now()
      FROM public.mkt_storefronts s
      WHERE s.id = p.storefront_id AND s.tenant_id = v_app.tenant_id;
      UPDATE public.mkt_storefronts
      SET accepts_orders = EXISTS (
            SELECT 1
            FROM public.mkt_provider_categories c
            WHERE c.code = v_app.provider_category_code
              AND 'orders.receive' = ANY(c.capabilities)
          ),
          updated_at = now()
      WHERE tenant_id = v_app.tenant_id AND deleted_at IS NULL;
      UPDATE public.mkt_business_profiles
      SET is_published = true, updated_at = now()
      WHERE tenant_id = v_app.tenant_id;
    ELSIF v_next IN ('needs_more','rejected') THEN
      UPDATE public.mkt_provider_profiles p
      SET status = 'draft', accepts_partner_requests = false, updated_at = now()
      FROM public.mkt_storefronts s
      WHERE s.id = p.storefront_id AND s.tenant_id = v_app.tenant_id;
    END IF;
  END IF;

  INSERT INTO public.mkt_join_application_events (
    application_id, from_status, to_status, note, actor_user_id
  ) VALUES (
    v_app.id, v_app.status, v_next,
    nullif(btrim(coalesce(_reason, '')), ''), auth.uid()
  );

  PERFORM public.mkt_notify(
    v_app.applicant_user_id,
    NULL,
    'join_application_' || v_next,
    CASE v_next
      WHEN 'approved' THEN 'تم قبول طلب انضمامك'
      WHEN 'rejected' THEN 'تم رفض طلب الانضمام'
      WHEN 'needs_more' THEN 'طلب الانضمام يحتاج استكمالًا'
      ELSE 'طلب الانضمام قيد المراجعة' END,
    coalesce(nullif(btrim(_reason), ''), v_app.application_number)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_join_application_review(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_join_application_review(uuid, text, text)
  TO authenticated, service_role;

-- Join documents remain private. Owners use the existing owner policy; staff
-- receive read-only access only when the path is registered against an
-- application and they hold the sensitive-document review permission.
DROP POLICY IF EXISTS mkt_join_documents_staff_read ON storage.objects;
CREATE POLICY mkt_join_documents_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] = 'join-applications'
    AND public.mkt_admin_can('docs.view_sensitive')
    AND EXISTS (
      SELECT 1 FROM public.mkt_join_application_documents d
      WHERE d.storage_path = storage.objects.name
    )
  );

-- Trigger functions are not browser APIs.
REVOKE ALL ON FUNCTION public.mkt_touch_updated_at() FROM PUBLIC, anon, authenticated;
