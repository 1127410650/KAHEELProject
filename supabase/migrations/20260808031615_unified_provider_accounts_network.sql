-- ============================================================================
-- Gohail unified provider accounts, provider network and external integrations
--
-- Additive marketplace foundation. Existing ids, memberships, storefronts,
-- listings, catalog items and bookings are preserved. The retired
-- `establishment` classification is migrated in place; no business row is
-- deleted or recreated.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Retire the `establishment` classification without changing entity ids.
-- ---------------------------------------------------------------------------

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_tenant_type_check;

UPDATE public.tenants
SET tenant_type = 'store', updated_at = now()
WHERE tenant_type = 'establishment';

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_tenant_type_check CHECK (
    tenant_type IN (
      'company', 'store', 'property_owner', 'project_owner', 'individual',
      'service_provider'
    )
  );

ALTER TABLE public.mkt_business_registry
  DROP CONSTRAINT IF EXISTS mkt_business_registry_entity_type_chk;

UPDATE public.mkt_business_registry
SET entity_type = 'sole_proprietorship', updated_at = now()
WHERE entity_type = 'establishment';

ALTER TABLE public.mkt_business_registry
  ALTER COLUMN entity_type SET DEFAULT 'sole_proprietorship',
  ADD CONSTRAINT mkt_business_registry_entity_type_chk CHECK (
    entity_type IN (
      'sole_proprietorship', 'company', 'office', 'factory', 'branch',
      'non_profit', 'government', 'other'
    )
  );

-- Keep the existing function signature for every current client, but accept the
-- new canonical store type and stop creating the retired classification.
CREATE OR REPLACE FUNCTION public.create_workspace(
  _tenant_type text,
  _name_ar text,
  _name_en text DEFAULT NULL::text,
  _legal_name text DEFAULT NULL::text,
  _cr_number text DEFAULT NULL::text,
  _vat_number text DEFAULT NULL::text,
  _city text DEFAULT NULL::text,
  _phone text DEFAULT NULL::text,
  _email text DEFAULT NULL::text,
  _activity text DEFAULT NULL::text,
  _usage_type text DEFAULT NULL::text,
  _provider_type text DEFAULT NULL::text,
  _specialty text DEFAULT NULL::text,
  _contact_info jsonb DEFAULT '{}'::jsonb,
  _confirm_duplicate boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant_id uuid;
  _dup integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _tenant_type NOT IN (
    'company', 'store', 'property_owner', 'project_owner', 'individual',
    'service_provider'
  ) THEN
    RAISE EXCEPTION 'INVALID_TENANT_TYPE';
  END IF;
  IF coalesce(btrim(_name_ar), '') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.created_by = _uid
      AND t.deleted_at IS NULL
      AND t.status <> 'archived'
      AND t.personal_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'WORKSPACE_LIMIT_REACHED';
  END IF;

  IF coalesce(btrim(_cr_number), '') <> '' OR coalesce(btrim(_vat_number), '') <> '' THEN
    SELECT count(*) INTO _dup
    FROM public.tenants t
    WHERE t.deleted_at IS NULL
      AND t.status = 'active'
      AND (
        (coalesce(btrim(_cr_number), '') <> ''
          AND t.commercial_registration_number = btrim(_cr_number))
        OR
        (coalesce(btrim(_vat_number), '') <> ''
          AND t.vat_number = btrim(_vat_number))
      );
    IF _dup > 0 AND NOT _confirm_duplicate THEN
      RAISE EXCEPTION 'DUPLICATE_REGISTRATION';
    END IF;
  END IF;

  INSERT INTO public.tenants (
    name_ar, name_en, tenant_type, legal_name, commercial_registration_number,
    vat_number, status, is_default, is_test, created_by, city, phone, email,
    activity, usage_type, provider_type, specialty, contact_info,
    onboarding_completed_at
  ) VALUES (
    btrim(_name_ar),
    coalesce(nullif(btrim(coalesce(_name_en, '')), ''), btrim(_name_ar)),
    _tenant_type,
    nullif(btrim(coalesce(_legal_name, '')), ''),
    nullif(btrim(coalesce(_cr_number, '')), ''),
    nullif(btrim(coalesce(_vat_number, '')), ''),
    'active',
    false,
    (btrim(_name_ar) LIKE 'TEST-SIGNUP-%'
      OR btrim(_name_ar) LIKE 'TEST-FINAL-ACCOUNT-%'),
    _uid,
    nullif(btrim(coalesce(_city, '')), ''),
    nullif(btrim(coalesce(_phone, '')), ''),
    nullif(btrim(coalesce(_email, '')), ''),
    nullif(btrim(coalesce(_activity, '')), ''),
    nullif(btrim(coalesce(_usage_type, '')), ''),
    nullif(btrim(coalesce(_provider_type, '')), ''),
    nullif(btrim(coalesce(_specialty, '')), ''),
    coalesce(_contact_info, '{}'::jsonb),
    now()
  ) RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_memberships (
    tenant_id, user_id, role, status, joined_at, membership_start, created_by
  ) VALUES (
    _tenant_id, _uid, 'owner', 'active', now(), current_date, _uid
  );

  UPDATE public.profiles
  SET active_tenant_id = _tenant_id
  WHERE user_id = _uid;

  INSERT INTO public.audit_log (
    actor_id, entity_type, entity_id, action, new_value, tenant_id
  ) VALUES (
    _uid,
    'tenant',
    _tenant_id,
    'create',
    jsonb_build_object(
      'tenant_type', _tenant_type,
      'name_ar', btrim(_name_ar),
      'role', 'owner',
      'provider_type', nullif(btrim(coalesce(_provider_type, '')), '')
    ),
    _tenant_id
  );

  RETURN _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  jsonb, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  jsonb, boolean
) TO authenticated, service_role;

-- A tenant account owns one storefront, regardless of which authorised member
-- created it. Personal accounts still own one storefront per auth user.
DROP INDEX IF EXISTS public.mkt_storefronts_one_per_account;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_storefronts_one_per_personal_account
  ON public.mkt_storefronts (owner_user_id)
  WHERE tenant_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_storefronts_one_per_tenant_account
  ON public.mkt_storefronts (tenant_id)
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;

-- The original store RPC searched by creator + tenant. After enforcing one
-- store per tenant that would make a second authorised member try to create a
-- duplicate. Reuse the tenant's canonical store for every active member while
-- keeping personal stores scoped to their auth user.
CREATE OR REPLACE FUNCTION public.mkt_store_save(
  _account_key text,
  _patch jsonb,
  _step smallint DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
  v_country uuid;
  v_base text;
  v_slug text;
  v_n integer := 0;
  v_city uuid;
  v_type text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT a.tenant_id INTO v_tenant
  FROM public.mkt_my_accounts() a
  WHERE a.account_key = _account_key
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not allowed'; END IF;
  IF v_tenant IS NOT NULL AND NOT public.mkt_can_publish_as_business(v_tenant) THEN
    RAISE EXCEPTION 'not allowed to publish as this business';
  END IF;

  v_country := public.mkt_account_country_id(auth.uid());

  SELECT s.id INTO v_id
  FROM public.mkt_storefronts s
  WHERE s.deleted_at IS NULL
    AND (
      (v_tenant IS NULL AND s.tenant_id IS NULL AND s.owner_user_id = auth.uid())
      OR (v_tenant IS NOT NULL AND s.tenant_id = v_tenant)
    )
  ORDER BY s.created_at
  LIMIT 1;

  IF v_id IS NULL AND _idempotency_key IS NOT NULL THEN
    SELECT s.id INTO v_id
    FROM public.mkt_storefronts s
    WHERE s.deleted_at IS NULL
      AND s.idempotency_key = _idempotency_key
      AND (
        (v_tenant IS NULL AND s.tenant_id IS NULL AND s.owner_user_id = auth.uid())
        OR (v_tenant IS NOT NULL AND s.tenant_id = v_tenant)
      )
    LIMIT 1;
  END IF;

  v_type := coalesce(nullif(_patch ->> 'store_type', ''), 'retail');
  IF v_type NOT IN ('restaurant', 'retail', 'services', 'mixed') THEN
    RAISE EXCEPTION 'invalid store type';
  END IF;

  IF _patch ? 'city_id' AND nullif(_patch ->> 'city_id', '') IS NOT NULL THEN
    v_city := (_patch ->> 'city_id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_cities c
      WHERE c.id = v_city AND c.country_id = v_country AND c.is_active
    ) THEN RAISE EXCEPTION 'city does not belong to the account country'; END IF;
  END IF;

  IF v_id IS NULL THEN
    v_base := nullif(regexp_replace(
      lower(coalesce(_patch ->> 'name_en', _patch ->> 'name_ar', 'store')),
      '[^a-z0-9\u0600-\u06ff]+', '-', 'g'
    ), '');
    v_base := trim(both '-' from coalesce(v_base, 'store'));
    IF v_base = '' THEN v_base := 'store'; END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM public.mkt_storefronts s WHERE s.slug = v_slug) LOOP
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n::text;
    END LOOP;

    INSERT INTO public.mkt_storefronts (
      owner_user_id, tenant_id, store_type, slug, name_ar, country_id, status,
      draft_step, idempotency_key, currency_code
    ) VALUES (
      auth.uid(), v_tenant, v_type, v_slug,
      coalesce(nullif(_patch ->> 'name_ar', ''), 'متجر'), v_country, 'draft',
      coalesce(_step, 1), _idempotency_key,
      coalesce((
        SELECT c.currency_code FROM public.mkt_countries c WHERE c.id = v_country
      ), 'SAR')
    ) RETURNING id INTO v_id;
  END IF;

  UPDATE public.mkt_storefronts s SET
    store_type = v_type,
    cuisine_id = CASE WHEN _patch ? 'cuisine_id'
      THEN nullif(_patch ->> 'cuisine_id', '')::uuid ELSE s.cuisine_id END,
    name_ar = coalesce(nullif(_patch ->> 'name_ar', ''), s.name_ar),
    name_en = CASE WHEN _patch ? 'name_en'
      THEN nullif(_patch ->> 'name_en', '') ELSE s.name_en END,
    short_description_ar = CASE WHEN _patch ? 'short_description_ar'
      THEN nullif(_patch ->> 'short_description_ar', '') ELSE s.short_description_ar END,
    short_description_en = CASE WHEN _patch ? 'short_description_en'
      THEN nullif(_patch ->> 'short_description_en', '') ELSE s.short_description_en END,
    logo_path = CASE WHEN _patch ? 'logo_path'
      THEN nullif(_patch ->> 'logo_path', '') ELSE s.logo_path END,
    cover_path = CASE WHEN _patch ? 'cover_path'
      THEN nullif(_patch ->> 'cover_path', '') ELSE s.cover_path END,
    city_id = CASE WHEN _patch ? 'city_id' THEN v_city ELSE s.city_id END,
    district = CASE WHEN _patch ? 'district'
      THEN nullif(_patch ->> 'district', '') ELSE s.district END,
    address_text = CASE WHEN _patch ? 'address_text'
      THEN nullif(_patch ->> 'address_text', '') ELSE s.address_text END,
    latitude = CASE WHEN _patch ? 'latitude'
      THEN nullif(_patch ->> 'latitude', '')::double precision ELSE s.latitude END,
    longitude = CASE WHEN _patch ? 'longitude'
      THEN nullif(_patch ->> 'longitude', '')::double precision ELSE s.longitude END,
    location_precision = CASE WHEN _patch ? 'location_precision'
      THEN coalesce(nullif(_patch ->> 'location_precision', ''), 'approximate')
      ELSE s.location_precision END,
    public_phone_enabled = coalesce(
      (_patch ->> 'public_phone_enabled')::boolean, s.public_phone_enabled
    ),
    chat_enabled = coalesce((_patch ->> 'chat_enabled')::boolean, s.chat_enabled),
    call_enabled = coalesce((_patch ->> 'call_enabled')::boolean, s.call_enabled),
    pickup_enabled = coalesce((_patch ->> 'pickup_enabled')::boolean, s.pickup_enabled),
    merchant_delivery_enabled = coalesce(
      (_patch ->> 'merchant_delivery_enabled')::boolean, s.merchant_delivery_enabled
    ),
    minimum_order_amount = greatest(0, coalesce(
      (_patch ->> 'minimum_order_amount')::numeric, s.minimum_order_amount
    )),
    delivery_fee = greatest(0, coalesce(
      (_patch ->> 'delivery_fee')::numeric, s.delivery_fee
    )),
    estimated_delivery_minutes_min = CASE WHEN _patch ? 'estimated_delivery_minutes_min'
      THEN nullif(_patch ->> 'estimated_delivery_minutes_min', '')::integer
      ELSE s.estimated_delivery_minutes_min END,
    estimated_delivery_minutes_max = CASE WHEN _patch ? 'estimated_delivery_minutes_max'
      THEN nullif(_patch ->> 'estimated_delivery_minutes_max', '')::integer
      ELSE s.estimated_delivery_minutes_max END,
    is_open_manually = coalesce(
      (_patch ->> 'is_open_manually')::boolean, s.is_open_manually
    ),
    accepts_orders = coalesce((_patch ->> 'accepts_orders')::boolean, s.accepts_orders),
    draft_step = coalesce(_step, s.draft_step),
    updated_at = now()
  WHERE s.id = v_id;

  INSERT INTO public.mkt_store_private (storefront_id) VALUES (v_id)
  ON CONFLICT (storefront_id) DO NOTHING;

  UPDATE public.mkt_store_private p SET
    contact_phone = CASE WHEN _patch ? 'contact_phone'
      THEN nullif(_patch ->> 'contact_phone', '') ELSE p.contact_phone END,
    delivery_phone = CASE WHEN _patch ? 'delivery_phone'
      THEN nullif(_patch ->> 'delivery_phone', '') ELSE p.delivery_phone END,
    delivery_permit_number = CASE WHEN _patch ? 'delivery_permit_number'
      THEN nullif(_patch ->> 'delivery_permit_number', '') ELSE p.delivery_permit_number END,
    delivery_permit_expires_on = CASE WHEN _patch ? 'delivery_permit_expires_on'
      THEN nullif(_patch ->> 'delivery_permit_expires_on', '')::date
      ELSE p.delivery_permit_expires_on END,
    delivery_permit_doc_path = CASE WHEN _patch ? 'delivery_permit_doc_path'
      THEN nullif(_patch ->> 'delivery_permit_doc_path', '') ELSE p.delivery_permit_doc_path END,
    delivery_declaration_accepted_at = CASE
      WHEN (_patch ->> 'delivery_declaration')::boolean IS true
        THEN coalesce(p.delivery_declaration_accepted_at, now())
      WHEN (_patch ->> 'delivery_declaration')::boolean IS false THEN NULL
      ELSE p.delivery_declaration_accepted_at
    END,
    updated_at = now()
  WHERE p.storefront_id = v_id;

  UPDATE public.mkt_store_branches b SET
    city_id = s.city_id,
    country_id = s.country_id,
    district = s.district,
    address_text = s.address_text,
    latitude = s.latitude,
    longitude = s.longitude,
    pickup_enabled = s.pickup_enabled,
    delivery_enabled = s.merchant_delivery_enabled,
    updated_at = now()
  FROM public.mkt_storefronts s
  WHERE s.id = v_id AND b.storefront_id = v_id AND b.is_primary;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_store_save(text, jsonb, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_store_save(text, jsonb, smallint, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Extensible provider taxonomy. Capabilities drive the experience; adding a
-- profession never requires a new auth model or a new set of tenant tables.
-- ---------------------------------------------------------------------------

CREATE TABLE public.mkt_provider_categories (
  code text PRIMARY KEY,
  parent_code text REFERENCES public.mkt_provider_categories(code),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  icon text NOT NULL DEFAULT 'store',
  default_store_type text NOT NULL DEFAULT 'retail'
    CHECK (default_store_type IN ('restaurant', 'retail', 'services', 'mixed')),
  default_theme_id text NOT NULL DEFAULT 'general',
  capabilities text[] NOT NULL DEFAULT '{}'::text[],
  requires_professional_license boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_provider_categories_capabilities_ck CHECK (
    capabilities <@ ARRAY[
      'catalog.products', 'catalog.services', 'orders.receive',
      'bookings.receive', 'delivery.request', 'delivery.provide',
      'jobs.receive', 'quotes.receive', 'listings.publish',
      'relationships.manage', 'integrations.manage'
    ]::text[]
  )
);

CREATE INDEX mkt_provider_categories_parent_idx
  ON public.mkt_provider_categories (parent_code)
  WHERE parent_code IS NOT NULL;

INSERT INTO public.mkt_provider_categories (
  code, parent_code, name_ar, name_en, icon, default_store_type,
  default_theme_id, capabilities, requires_professional_license, sort_order
) VALUES
  ('marketplace_seller', NULL, 'متجر بيع', 'Marketplace seller', 'store', 'retail', 'general',
    ARRAY['catalog.products','orders.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], false, 10),
  ('restaurant', NULL, 'مطعم أو مطبخ', 'Restaurant or kitchen', 'utensils', 'restaurant', 'restaurant',
    ARRAY['catalog.products','orders.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], false, 20),
  ('grocery', NULL, 'بقالة ومقاضي', 'Grocery', 'shopping-basket', 'retail', 'general',
    ARRAY['catalog.products','orders.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], false, 30),
  ('pharmacy', NULL, 'صيدلية', 'Pharmacy', 'pill', 'mixed', 'general',
    ARRAY['catalog.products','catalog.services','orders.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], true, 40),
  ('clinic', NULL, 'عيادة أو مركز صحي', 'Clinic or health center', 'stethoscope', 'services', 'general',
    ARRAY['catalog.services','bookings.receive','listings.publish','relationships.manage','integrations.manage'], true, 50),
  ('doctor', 'clinic', 'طبيب أو مختص صحي', 'Doctor or health professional', 'user-round', 'services', 'general',
    ARRAY['catalog.services','bookings.receive','listings.publish','relationships.manage','integrations.manage'], true, 51),
  ('barber', NULL, 'حلاق', 'Barber', 'scissors', 'services', 'men',
    ARRAY['catalog.services','bookings.receive','listings.publish','relationships.manage','integrations.manage'], false, 60),
  ('salon_spa', NULL, 'صالون وعناية', 'Salon and spa', 'sparkles', 'services', 'women',
    ARRAY['catalog.services','bookings.receive','listings.publish','relationships.manage','integrations.manage'], false, 70),
  ('fuel_station', NULL, 'محطة وقود وخدمات طريق', 'Fuel station and road services', 'fuel', 'mixed', 'cars',
    ARRAY['catalog.products','catalog.services','orders.receive','bookings.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], false, 80),
  ('car_service', NULL, 'صيانة وخدمات مركبات', 'Vehicle services', 'car', 'services', 'cars',
    ARRAY['catalog.services','bookings.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 90),
  ('home_services', NULL, 'خدمات منزلية', 'Home services', 'house', 'services', 'general',
    ARRAY['catalog.services','bookings.receive','jobs.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 100),
  ('maintenance', NULL, 'صيانة ومقاولات', 'Maintenance and contracting', 'wrench', 'services', 'contracting',
    ARRAY['catalog.services','bookings.receive','jobs.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 110),
  ('education_training', NULL, 'تعليم وتدريب', 'Education and training', 'graduation-cap', 'services', 'clubs',
    ARRAY['catalog.services','bookings.receive','listings.publish','relationships.manage','integrations.manage'], false, 120),
  ('professional_services', NULL, 'خدمات مهنية', 'Professional services', 'briefcase', 'services', 'general',
    ARRAY['catalog.services','bookings.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 130),
  ('shipping_company', NULL, 'شركة شحن ونقل', 'Shipping and transport company', 'truck', 'services', 'general',
    ARRAY['catalog.services','jobs.receive','delivery.provide','quotes.receive','listings.publish','relationships.manage','integrations.manage'], true, 140),
  ('courier', 'shipping_company', 'مندوب توصيل', 'Courier', 'bike', 'services', 'general',
    ARRAY['catalog.services','jobs.receive','delivery.provide','relationships.manage','integrations.manage'], false, 141),
  ('warehouse', NULL, 'مستودع وخدمات لوجستية', 'Warehouse and logistics', 'warehouse', 'services', 'wholesale',
    ARRAY['catalog.services','jobs.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 150),
  ('supplier', NULL, 'مورد وتوزيع', 'Supplier and distributor', 'package', 'mixed', 'wholesale',
    ARRAY['catalog.products','catalog.services','orders.receive','quotes.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], false, 160),
  ('factory', NULL, 'مصنع', 'Factory', 'factory', 'mixed', 'factory',
    ARRAY['catalog.products','catalog.services','orders.receive','quotes.receive','delivery.request','listings.publish','relationships.manage','integrations.manage'], true, 170),
  ('real_estate', NULL, 'عقار ووساطة', 'Real estate and brokerage', 'building', 'services', 'real-estate',
    ARRAY['catalog.services','bookings.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], true, 180),
  ('other', NULL, 'نشاط آخر', 'Other activity', 'grid', 'mixed', 'general',
    ARRAY['catalog.products','catalog.services','orders.receive','bookings.receive','quotes.receive','listings.publish','relationships.manage','integrations.manage'], false, 999)
ON CONFLICT (code) DO UPDATE SET
  parent_code = EXCLUDED.parent_code,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  default_store_type = EXCLUDED.default_store_type,
  default_theme_id = EXCLUDED.default_theme_id,
  capabilities = EXCLUDED.capabilities,
  requires_professional_license = EXCLUDED.requires_professional_license,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

CREATE TABLE public.mkt_provider_profiles (
  storefront_id uuid PRIMARY KEY REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  category_code text NOT NULL DEFAULT 'marketplace_seller'
    REFERENCES public.mkt_provider_categories(code),
  headline_ar text,
  headline_en text,
  accepts_partner_requests boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'suspended', 'archived')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_provider_profiles_directory_idx
  ON public.mkt_provider_profiles (category_code, status, accepts_partner_requests);

-- Existing stores become seller, restaurant or service accounts without
-- changing their ids or public slugs.
INSERT INTO public.mkt_provider_profiles (
  storefront_id, category_code, status, created_by
)
SELECT
  s.id,
  CASE
    WHEN s.store_type = 'restaurant' THEN 'restaurant'
    WHEN s.store_type = 'services' THEN 'professional_services'
    ELSE 'marketplace_seller'
  END,
  CASE WHEN s.status = 'archived' THEN 'archived' ELSE 'active' END,
  s.owner_user_id
FROM public.mkt_storefronts s
WHERE s.deleted_at IS NULL
ON CONFLICT (storefront_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Provider-to-provider network. A relationship grants no tenant membership,
-- catalog access or booking access; it is a scoped business agreement only.
-- ---------------------------------------------------------------------------

CREATE TABLE public.mkt_provider_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_storefront_id uuid NOT NULL
    REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  provider_storefront_id uuid NOT NULL
    REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN (
    'delivery_partner', 'supplier', 'subcontractor', 'service_partner',
    'referral_partner', 'integration_partner'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'rejected', 'paused', 'ended'
  )),
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  request_message text,
  response_note text,
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  responded_by uuid,
  accepted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_provider_relations_not_self_ck
    CHECK (requester_storefront_id <> provider_storefront_id),
  CONSTRAINT mkt_provider_relations_scopes_ck CHECK (
    scopes <@ ARRAY[
      'orders', 'deliveries', 'bookings', 'quotes', 'catalog',
      'referrals', 'status_updates'
    ]::text[]
  )
);

CREATE UNIQUE INDEX mkt_provider_relations_open_unique
  ON public.mkt_provider_relations (
    requester_storefront_id, provider_storefront_id, relation_type
  )
  WHERE status IN ('pending', 'active', 'paused');
CREATE INDEX mkt_provider_relations_requester_idx
  ON public.mkt_provider_relations (requester_storefront_id, status, created_at DESC);
CREATE INDEX mkt_provider_relations_provider_idx
  ON public.mkt_provider_relations (provider_storefront_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. External integrations. Public configuration never stores credentials.
-- secret_ref is populated only by a trusted server/Edge Function using Vault.
-- ---------------------------------------------------------------------------

CREATE TABLE public.mkt_integration_catalog (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  integration_kind text NOT NULL CHECK (integration_kind IN (
    'api', 'webhook', 'calendar', 'erp', 'pos', 'commerce', 'shipping'
  )),
  supported_directions text[] NOT NULL DEFAULT ARRAY['outbound']::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_integration_catalog_directions_ck CHECK (
    supported_directions <@ ARRAY['inbound','outbound','bidirectional']::text[]
  )
);

INSERT INTO public.mkt_integration_catalog (
  code, name_ar, name_en, description_ar, description_en,
  integration_kind, supported_directions, sort_order
) VALUES
  ('custom_api', 'واجهة API مخصصة', 'Custom API',
    'ربط نظام خارجي عبر واجهة موثقة.', 'Connect an external system through a documented API.',
    'api', ARRAY['inbound','outbound','bidirectional'], 10),
  ('signed_webhook', 'Webhook موقّع', 'Signed webhook',
    'إرسال أحداث موقعة إلى نظام خارجي.', 'Send signed events to an external system.',
    'webhook', ARRAY['outbound'], 20),
  ('calendar_sync', 'مزامنة التقويم', 'Calendar sync',
    'مزامنة المواعيد مع تقويم خارجي.', 'Synchronise bookings with an external calendar.',
    'calendar', ARRAY['bidirectional'], 30),
  ('shipping_gateway', 'بوابة شحن', 'Shipping gateway',
    'إرسال طلبات التوصيل واستقبال التحديثات.', 'Send deliveries and receive status updates.',
    'shipping', ARRAY['bidirectional'], 40),
  ('pos', 'نظام نقاط البيع', 'Point of sale',
    'مزامنة الأصناف والطلبات مع نقاط البيع.', 'Synchronise catalog and orders with a POS.',
    'pos', ARRAY['bidirectional'], 50),
  ('erp', 'نظام ERP', 'ERP',
    'ربط المخزون والطلبات والفواتير.', 'Connect inventory, orders and invoices.',
    'erp', ARRAY['bidirectional'], 60),
  ('external_store', 'متجر إلكتروني خارجي', 'External commerce store',
    'مزامنة كتالوج متجر خارجي وطلباته.', 'Synchronise an external store catalog and orders.',
    'commerce', ARRAY['bidirectional'], 70)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  integration_kind = EXCLUDED.integration_kind,
  supported_directions = EXCLUDED.supported_directions,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE public.mkt_external_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  integration_code text NOT NULL REFERENCES public.mkt_integration_catalog(code),
  display_name text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'error', 'revoked')),
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref uuid,
  credentials_state text NOT NULL DEFAULT 'missing'
    CHECK (credentials_state IN ('missing', 'ready', 'rotation_required', 'revoked')),
  last_connected_at timestamptz,
  last_error_code text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_id, integration_code, display_name),
  CONSTRAINT mkt_external_integrations_config_object_ck
    CHECK (jsonb_typeof(config_public) = 'object')
);

CREATE INDEX mkt_external_integrations_store_idx
  ON public.mkt_external_integrations (storefront_id, status, created_at DESC);
CREATE INDEX mkt_external_integrations_catalog_idx
  ON public.mkt_external_integrations (integration_code);

CREATE TABLE public.mkt_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL
    REFERENCES public.mkt_external_integrations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  event_type text NOT NULL,
  external_id text,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'dead_letter')),
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 100),
  next_attempt_at timestamptz,
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, idempotency_key),
  CONSTRAINT mkt_integration_events_summary_object_ck
    CHECK (jsonb_typeof(payload_summary) = 'object')
);

CREATE INDEX mkt_integration_events_queue_idx
  ON public.mkt_integration_events (status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX mkt_integration_events_owner_idx
  ON public.mkt_integration_events (integration_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Grants + RLS. Explicit grants are required by the 2026 Data API rollout.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.mkt_provider_categories, public.mkt_provider_profiles,
  public.mkt_provider_relations, public.mkt_integration_catalog,
  public.mkt_external_integrations, public.mkt_integration_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mkt_provider_categories TO anon, authenticated;
GRANT SELECT ON public.mkt_integration_catalog TO authenticated;
GRANT ALL ON public.mkt_provider_categories, public.mkt_provider_profiles,
  public.mkt_provider_relations, public.mkt_integration_catalog,
  public.mkt_external_integrations, public.mkt_integration_events TO service_role;

ALTER TABLE public.mkt_provider_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_provider_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_integration_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_provider_categories_public_read
  ON public.mkt_provider_categories FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY mkt_provider_profiles_public_read
  ON public.mkt_provider_profiles FOR SELECT TO anon, authenticated
  USING (
    (status = 'active' AND public.mkt_store_visible(storefront_id))
    OR public.mkt_store_manage(storefront_id)
    OR public.mkt_store_admin()
  );

CREATE POLICY mkt_provider_relations_party_read
  ON public.mkt_provider_relations FOR SELECT TO authenticated
  USING (
    public.mkt_store_manage(requester_storefront_id)
    OR public.mkt_store_manage(provider_storefront_id)
    OR public.mkt_store_admin()
  );

CREATE POLICY mkt_integration_catalog_authenticated_read
  ON public.mkt_integration_catalog FOR SELECT TO authenticated
  USING (is_active);

CREATE POLICY mkt_external_integrations_owner_read
  ON public.mkt_external_integrations FOR SELECT TO authenticated
  USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin());

CREATE POLICY mkt_integration_events_owner_read
  ON public.mkt_integration_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_external_integrations i
      WHERE i.id = integration_id
        AND (public.mkt_store_manage(i.storefront_id) OR public.mkt_store_admin())
    )
  );

CREATE TRIGGER mkt_provider_categories_touch
  BEFORE UPDATE ON public.mkt_provider_categories
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_provider_profiles_touch
  BEFORE UPDATE ON public.mkt_provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_provider_relations_touch
  BEFORE UPDATE ON public.mkt_provider_relations
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_external_integrations_touch
  BEFORE UPDATE ON public.mkt_external_integrations
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();

-- ---------------------------------------------------------------------------
-- 6. Guard listing -> catalog links at the database boundary.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mkt_store_item_listing_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.source_listing_id IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_listings l
    WHERE l.id = NEW.source_listing_id
      AND l.deleted_at IS NULL
      AND l.storefront_id = NEW.storefront_id
  ) THEN
    RAISE EXCEPTION 'listing_store_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_items_listing_guard ON public.mkt_store_items;
CREATE TRIGGER mkt_store_items_listing_guard
  BEFORE INSERT OR UPDATE OF storefront_id, source_listing_id
  ON public.mkt_store_items
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_item_listing_guard();

REVOKE ALL ON FUNCTION public.mkt_store_item_listing_guard() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Public and authenticated APIs.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mkt_provider_categories_public()
RETURNS SETOF public.mkt_provider_categories
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  SELECT c.*
  FROM public.mkt_provider_categories c
  WHERE c.is_active
  ORDER BY c.sort_order, c.name_ar;
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_profile_context(_account_key text)
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_account
  FROM public.mkt_account_context(_account_key)
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_allowed'; END IF;

  SELECT s.* INTO v_store
  FROM public.mkt_storefronts s
  WHERE s.deleted_at IS NULL
    AND (
      (v_account.tenant_id IS NULL
        AND s.tenant_id IS NULL
        AND s.owner_user_id = auth.uid())
      OR
      (v_account.tenant_id IS NOT NULL
        AND s.tenant_id = v_account.tenant_id)
    )
  ORDER BY s.created_at
  LIMIT 1;

  IF v_store.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_profile
  FROM public.mkt_provider_profiles p
  WHERE p.storefront_id = v_store.id;

  IF v_profile.storefront_id IS NOT NULL THEN
    SELECT * INTO v_category
    FROM public.mkt_provider_categories c
    WHERE c.code = v_profile.category_code;
  END IF;

  RETURN jsonb_build_object(
    'storefront_id', v_store.id,
    'store_slug', v_store.slug,
    'store_name', v_store.name_ar,
    'store_type', v_store.store_type,
    'store_status', v_store.status,
    'profile', CASE WHEN v_profile.storefront_id IS NULL THEN NULL ELSE jsonb_build_object(
      'category_code', v_profile.category_code,
      'headline_ar', v_profile.headline_ar,
      'headline_en', v_profile.headline_en,
      'accepts_partner_requests', v_profile.accepts_partner_requests,
      'status', v_profile.status
    ) END,
    'category', CASE WHEN v_category.code IS NULL THEN NULL ELSE jsonb_build_object(
      'code', v_category.code,
      'name_ar', v_category.name_ar,
      'name_en', v_category.name_en,
      'capabilities', v_category.capabilities,
      'requires_professional_license', v_category.requires_professional_license
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_profile_save(
  _account_key text,
  _category_code text,
  _headline_ar text DEFAULT NULL,
  _headline_en text DEFAULT NULL,
  _accepts_partner_requests boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_account record;
  v_category public.mkt_provider_categories;
  v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_account
  FROM public.mkt_account_context(_account_key)
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_allowed'; END IF;
  IF NOT v_account.can_publish THEN RAISE EXCEPTION 'account_cannot_publish'; END IF;

  SELECT * INTO v_category
  FROM public.mkt_provider_categories c
  WHERE c.code = _category_code AND c.is_active;
  IF v_category.code IS NULL THEN RAISE EXCEPTION 'provider_category_invalid'; END IF;

  SELECT s.id INTO v_store_id
  FROM public.mkt_storefronts s
  WHERE s.deleted_at IS NULL
    AND (
      (v_account.tenant_id IS NULL
        AND s.tenant_id IS NULL
        AND s.owner_user_id = auth.uid())
      OR
      (v_account.tenant_id IS NOT NULL
        AND s.tenant_id = v_account.tenant_id)
    )
  ORDER BY s.created_at
  LIMIT 1;

  IF v_store_id IS NULL THEN
    v_store_id := public.mkt_store_save(
      _account_key,
      jsonb_build_object(
        'name_ar', coalesce(nullif(btrim(v_account.name), ''), 'متجر'),
        'store_type', v_category.default_store_type
      ),
      1,
      'provider-bootstrap:' || _account_key
    );
  END IF;

  IF NOT public.mkt_store_manage(v_store_id) THEN
    RAISE EXCEPTION 'store_account_mismatch';
  END IF;

  INSERT INTO public.mkt_provider_profiles (
    storefront_id, category_code, headline_ar, headline_en,
    accepts_partner_requests, status, created_by
  ) VALUES (
    v_store_id,
    v_category.code,
    nullif(btrim(coalesce(_headline_ar, '')), ''),
    nullif(btrim(coalesce(_headline_en, '')), ''),
    coalesce(_accepts_partner_requests, true),
    'active',
    auth.uid()
  )
  ON CONFLICT (storefront_id) DO UPDATE SET
    category_code = EXCLUDED.category_code,
    headline_ar = EXCLUDED.headline_ar,
    headline_en = EXCLUDED.headline_en,
    accepts_partner_requests = EXCLUDED.accepts_partner_requests,
    status = CASE
      WHEN public.mkt_provider_profiles.status = 'suspended'
        THEN public.mkt_provider_profiles.status
      ELSE 'active'
    END,
    updated_at = now();

  UPDATE public.tenants
  SET provider_type = v_category.code, updated_at = now()
  WHERE id = v_account.tenant_id;

  -- Category, catalog mode and booking mode stay aligned. Catalog data is not
  -- deleted when a category changes; only the storefront operating mode moves.
  UPDATE public.mkt_storefronts
  SET store_type = v_category.default_store_type, updated_at = now()
  WHERE id = v_store_id;

  INSERT INTO public.mkt_store_audit (
    storefront_id, entity_type, entity_id, action, actor_user_id
  ) VALUES (
    v_store_id, 'provider_profile', v_store_id, 'save', auth.uid()
  );

  RETURN public.mkt_provider_profile_context(_account_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_directory(
  _q text DEFAULT NULL,
  _category_code text DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  storefront_id uuid,
  slug text,
  name_ar text,
  name_en text,
  logo_path text,
  verification_status text,
  city_name_ar text,
  city_name_en text,
  category_code text,
  category_name_ar text,
  category_name_en text,
  headline_ar text,
  headline_en text,
  capabilities text[],
  accepts_partner_requests boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    s.id,
    s.slug,
    s.name_ar,
    s.name_en,
    s.logo_path,
    s.verification_status,
    ci.name_ar,
    ci.name_en,
    p.category_code,
    c.name_ar,
    c.name_en,
    p.headline_ar,
    p.headline_en,
    c.capabilities,
    p.accepts_partner_requests
  FROM public.mkt_provider_profiles p
  JOIN public.mkt_provider_categories c ON c.code = p.category_code AND c.is_active
  JOIN public.mkt_storefronts s ON s.id = p.storefront_id
  LEFT JOIN public.mkt_cities ci ON ci.id = s.city_id
  WHERE p.status = 'active'
    AND p.accepts_partner_requests
    AND s.status = 'published'
    AND s.deleted_at IS NULL
    AND (_category_code IS NULL OR p.category_code = _category_code)
    AND (
      coalesce(btrim(_q), '') = ''
      OR s.name_ar ILIKE '%' || btrim(_q) || '%'
      OR coalesce(s.name_en, '') ILIKE '%' || btrim(_q) || '%'
      OR c.name_ar ILIKE '%' || btrim(_q) || '%'
      OR c.name_en ILIKE '%' || btrim(_q) || '%'
    )
  ORDER BY s.verification_status = 'approved' DESC, s.name_ar
  LIMIT greatest(1, least(coalesce(_limit, 50), 100));
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_relation_request(
  _account_key text,
  _target_storefront_id uuid,
  _relation_type text,
  _message text DEFAULT NULL,
  _scopes text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_source uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _relation_type NOT IN (
    'delivery_partner', 'supplier', 'subcontractor', 'service_partner',
    'referral_partner', 'integration_partner'
  ) THEN RAISE EXCEPTION 'relation_type_invalid'; END IF;
  IF NOT coalesce(_scopes, '{}'::text[]) <@ ARRAY[
    'orders', 'deliveries', 'bookings', 'quotes', 'catalog',
    'referrals', 'status_updates'
  ]::text[] THEN RAISE EXCEPTION 'relation_scopes_invalid'; END IF;

  v_context := public.mkt_provider_profile_context(_account_key);
  v_source := (v_context ->> 'storefront_id')::uuid;
  IF v_source IS NULL
    OR NOT public.mkt_store_manage(v_source)
    OR NOT EXISTS (
      SELECT 1 FROM public.mkt_provider_profiles p
      WHERE p.storefront_id = v_source AND p.status IN ('active', 'paused')
    ) THEN
    RAISE EXCEPTION 'provider_profile_required';
  END IF;
  IF v_source = _target_storefront_id THEN RAISE EXCEPTION 'relation_self_forbidden'; END IF;
  IF _relation_type = 'delivery_partner' AND NOT EXISTS (
    SELECT 1
    FROM public.mkt_provider_profiles p
    JOIN public.mkt_provider_categories c ON c.code = p.category_code
    WHERE p.storefront_id = v_source
      AND 'delivery.request' = ANY(c.capabilities)
  ) THEN RAISE EXCEPTION 'relation_capability_mismatch'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.mkt_provider_profiles p
    JOIN public.mkt_provider_categories c ON c.code = p.category_code
    JOIN public.mkt_storefronts s ON s.id = p.storefront_id
    WHERE p.storefront_id = _target_storefront_id
      AND p.status = 'active'
      AND p.accepts_partner_requests
      AND s.status = 'published'
      AND s.deleted_at IS NULL
      AND (
        _relation_type <> 'delivery_partner'
        OR 'delivery.provide' = ANY(c.capabilities)
      )
  ) THEN RAISE EXCEPTION 'target_provider_unavailable'; END IF;

  INSERT INTO public.mkt_provider_relations (
    requester_storefront_id, provider_storefront_id, relation_type, scopes,
    request_message, requested_by
  ) VALUES (
    v_source,
    _target_storefront_id,
    _relation_type,
    coalesce(_scopes, '{}'::text[]),
    nullif(btrim(coalesce(_message, '')), ''),
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_relations_list(_account_key text)
RETURNS TABLE (
  id uuid,
  direction text,
  relation_type text,
  status text,
  scopes text[],
  request_message text,
  response_note text,
  other_storefront_id uuid,
  other_store_slug text,
  other_store_name text,
  other_category_code text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_store uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  v_context := public.mkt_provider_profile_context(_account_key);
  v_store := (v_context ->> 'storefront_id')::uuid;
  IF v_store IS NULL
    OR NOT public.mkt_store_manage(v_store)
    OR NOT EXISTS (
      SELECT 1 FROM public.mkt_provider_profiles p
      WHERE p.storefront_id = v_store AND p.status IN ('active', 'paused')
    ) THEN
    RAISE EXCEPTION 'provider_profile_required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    CASE WHEN r.requester_storefront_id = v_store THEN 'outgoing' ELSE 'incoming' END,
    r.relation_type,
    r.status,
    r.scopes,
    r.request_message,
    r.response_note,
    other.id,
    other.slug,
    other.name_ar,
    op.category_code,
    r.created_at,
    r.updated_at
  FROM public.mkt_provider_relations r
  JOIN public.mkt_storefronts other ON other.id = CASE
    WHEN r.requester_storefront_id = v_store THEN r.provider_storefront_id
    ELSE r.requester_storefront_id
  END
  LEFT JOIN public.mkt_provider_profiles op ON op.storefront_id = other.id
  WHERE r.requester_storefront_id = v_store OR r.provider_storefront_id = v_store
  ORDER BY r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_provider_relation_respond(
  _account_key text,
  _relation_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_store uuid;
  v_relation public.mkt_provider_relations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  v_context := public.mkt_provider_profile_context(_account_key);
  v_store := (v_context ->> 'storefront_id')::uuid;
  IF v_store IS NULL
    OR NOT public.mkt_store_manage(v_store)
    OR NOT EXISTS (
      SELECT 1 FROM public.mkt_provider_profiles p
      WHERE p.storefront_id = v_store AND p.status IN ('active', 'paused')
    ) THEN
    RAISE EXCEPTION 'provider_profile_required';
  END IF;

  SELECT * INTO v_relation
  FROM public.mkt_provider_relations r
  WHERE r.id = _relation_id
  FOR UPDATE;
  IF v_relation.id IS NULL THEN RAISE EXCEPTION 'relation_not_found'; END IF;

  IF _action IN ('accept', 'reject') THEN
    IF v_relation.provider_storefront_id <> v_store OR v_relation.status <> 'pending' THEN
      RAISE EXCEPTION 'relation_action_forbidden';
    END IF;
    UPDATE public.mkt_provider_relations
    SET status = CASE WHEN _action = 'accept' THEN 'active' ELSE 'rejected' END,
        response_note = nullif(btrim(coalesce(_note, '')), ''),
        responded_by = auth.uid(),
        accepted_at = CASE WHEN _action = 'accept' THEN now() ELSE NULL END,
        ended_at = CASE WHEN _action = 'reject' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = _relation_id;
  ELSIF _action IN ('pause', 'resume', 'end') THEN
    IF v_store NOT IN (
      v_relation.requester_storefront_id, v_relation.provider_storefront_id
    ) THEN RAISE EXCEPTION 'relation_action_forbidden'; END IF;
    IF _action = 'resume' AND v_relation.status <> 'paused' THEN
      RAISE EXCEPTION 'relation_transition_invalid';
    END IF;
    IF _action = 'pause' AND v_relation.status <> 'active' THEN
      RAISE EXCEPTION 'relation_transition_invalid';
    END IF;
    IF _action = 'end' AND v_relation.status NOT IN ('pending', 'active', 'paused') THEN
      RAISE EXCEPTION 'relation_transition_invalid';
    END IF;
    UPDATE public.mkt_provider_relations
    SET status = CASE
          WHEN _action = 'pause' THEN 'paused'
          WHEN _action = 'resume' THEN 'active'
          ELSE 'ended'
        END,
        response_note = coalesce(nullif(btrim(coalesce(_note, '')), ''), response_note),
        ended_at = CASE WHEN _action = 'end' THEN now() ELSE ended_at END,
        updated_at = now()
    WHERE id = _relation_id;
  ELSE
    RAISE EXCEPTION 'relation_action_invalid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_integration_catalog_public()
RETURNS SETOF public.mkt_integration_catalog
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  SELECT c.* FROM public.mkt_integration_catalog c
  WHERE c.is_active
  ORDER BY c.sort_order, c.name_ar;
$$;

CREATE OR REPLACE FUNCTION public.mkt_external_integrations_list(_account_key text)
RETURNS TABLE (
  id uuid,
  storefront_id uuid,
  integration_code text,
  display_name text,
  direction text,
  status text,
  config_public jsonb,
  credentials_state text,
  last_connected_at timestamptz,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_store uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  v_context := public.mkt_provider_profile_context(_account_key);
  v_store := (v_context ->> 'storefront_id')::uuid;
  IF v_store IS NULL
    OR NOT public.mkt_store_manage(v_store)
    OR NOT EXISTS (
      SELECT 1 FROM public.mkt_provider_profiles p
      WHERE p.storefront_id = v_store AND p.status IN ('active', 'paused')
    ) THEN
    RAISE EXCEPTION 'provider_profile_required';
  END IF;
  RETURN QUERY
  SELECT
    i.id, i.storefront_id, i.integration_code, i.display_name, i.direction,
    i.status, i.config_public, i.credentials_state, i.last_connected_at,
    i.last_error_code, i.created_at, i.updated_at
  FROM public.mkt_external_integrations i
  WHERE i.storefront_id = v_store
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_external_integration_save(
  _account_key text,
  _integration_id uuid,
  _integration_code text,
  _display_name text,
  _direction text,
  _config_public jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_store uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF coalesce(btrim(_display_name), '') = '' THEN RAISE EXCEPTION 'integration_name_required'; END IF;
  IF _direction NOT IN ('inbound', 'outbound', 'bidirectional') THEN
    RAISE EXCEPTION 'integration_direction_invalid';
  END IF;
  IF jsonb_typeof(coalesce(_config_public, '{}'::jsonb)) <> 'object'
    OR octet_length(coalesce(_config_public, '{}'::jsonb)::text) > 16384 THEN
    RAISE EXCEPTION 'integration_config_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(coalesce(_config_public, '{}'::jsonb)) AS key
    WHERE key ~* '(secret|token|password|api[_-]?key|private[_-]?key|credential)'
  ) THEN
    RAISE EXCEPTION 'integration_secret_forbidden';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_integration_catalog c
    WHERE c.code = _integration_code
      AND c.is_active
      AND _direction = ANY(c.supported_directions)
  ) THEN RAISE EXCEPTION 'integration_not_supported'; END IF;

  v_context := public.mkt_provider_profile_context(_account_key);
  v_store := (v_context ->> 'storefront_id')::uuid;
  IF v_store IS NULL
    OR NOT public.mkt_store_manage(v_store)
    OR NOT EXISTS (
      SELECT 1 FROM public.mkt_provider_profiles p
      WHERE p.storefront_id = v_store AND p.status IN ('active', 'paused')
    ) THEN
    RAISE EXCEPTION 'provider_profile_required';
  END IF;

  IF _integration_id IS NULL THEN
    INSERT INTO public.mkt_external_integrations (
      storefront_id, integration_code, display_name, direction, config_public,
      status, credentials_state, created_by
    ) VALUES (
      v_store,
      _integration_code,
      btrim(_display_name),
      _direction,
      coalesce(_config_public, '{}'::jsonb),
      'draft',
      'missing',
      auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.mkt_external_integrations i
    SET integration_code = _integration_code,
        display_name = btrim(_display_name),
        direction = _direction,
        config_public = coalesce(_config_public, '{}'::jsonb),
        updated_at = now()
    WHERE i.id = _integration_id
      AND i.storefront_id = v_store
      AND i.status <> 'revoked'
    RETURNING i.id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'integration_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Catalog editors can only choose ads that are already attached to the same
-- managed storefront. The projection intentionally excludes owner identities
-- and every private listing field.
CREATE OR REPLACE FUNCTION public.mkt_store_item_linked_listings(_storefront_id uuid)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  status text,
  storefront_id uuid,
  cover_image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_store_manage(_storefront_id) THEN
    RAISE EXCEPTION 'store_account_mismatch';
  END IF;

  RETURN QUERY
  SELECT l.id, l.slug, l.title, l.status, l.storefront_id, l.cover_image_url
  FROM public.mkt_listings l
  WHERE l.storefront_id = _storefront_id
    AND l.deleted_at IS NULL
    AND l.status IN ('published', 'pending', 'draft')
  ORDER BY l.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_listing_commerce_action(_listing_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'action_kind', CASE
      WHEN i.item_type IN ('service', 'package')
        AND coalesce(ss.accepts_bookings, false)
        THEN 'book'
      ELSE 'open_store'
    END,
    'storefront_id', s.id,
    'store_slug', s.slug,
    'store_name_ar', s.name_ar,
    'store_name_en', s.name_en,
    'item_id', i.id,
    'item_type', i.item_type,
    'item_name_ar', i.name_ar,
    'item_name_en', i.name_en,
    'target_path', CASE
      WHEN i.item_type IN ('service', 'package')
        AND coalesce(ss.accepts_bookings, false)
        THEN '/services/' || s.slug || '/' || i.id::text || '/book'
      ELSE '/stores/' || s.slug
    END
  )
  FROM public.mkt_listings l
  JOIN public.mkt_store_items i
    ON i.source_listing_id = l.id
    AND i.deleted_at IS NULL
    AND i.is_available
  JOIN public.mkt_storefronts s
    ON s.id = i.storefront_id
    AND s.id = l.storefront_id
    AND s.status = 'published'
    AND s.deleted_at IS NULL
  LEFT JOIN public.mkt_service_settings ss ON ss.storefront_id = s.id
  WHERE l.id = _listing_id
    AND l.status = 'published'
    AND l.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.mkt_provider_categories_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_provider_categories_public() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.mkt_provider_profile_context(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_profile_context(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_provider_profile_save(text, text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_profile_save(text, text, text, text, boolean)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_provider_directory(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_provider_directory(text, text, integer)
  TO anon, authenticated;

REVOKE ALL ON FUNCTION public.mkt_provider_relation_request(text, uuid, text, text, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_relation_request(text, uuid, text, text, text[])
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_provider_relations_list(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_relations_list(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_provider_relation_respond(text, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_provider_relation_respond(text, uuid, text, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_integration_catalog_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_integration_catalog_public() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_external_integrations_list(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_external_integrations_list(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_external_integration_save(text, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_external_integration_save(text, uuid, text, text, text, jsonb)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_store_item_linked_listings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_store_item_linked_listings(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_listing_commerce_action(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_listing_commerce_action(uuid) TO anon, authenticated;

COMMENT ON TABLE public.mkt_provider_profiles IS
  'Canonical provider/store account profile. Category capabilities drive UI and workflows.';
COMMENT ON TABLE public.mkt_provider_relations IS
  'Scoped provider-to-provider agreements; never grants tenant membership or data access.';
COMMENT ON TABLE public.mkt_external_integrations IS
  'External connector metadata only. Credentials belong in Vault/server secrets, never config_public.';
COMMENT ON COLUMN public.mkt_external_integrations.secret_ref IS
  'Opaque Vault/server secret reference. It is never accepted from the browser API.';
