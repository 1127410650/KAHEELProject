-- ============================================================================
-- KAHEEL account classification
--
-- `kind` remains the authorization boundary used by account-scoped RLS:
--   individual | business
--
-- `classification` is an additive, server-derived presentation/experience
-- value. It is never accepted from the browser and never grants permissions:
--   customer | service_provider | store | system_admin
--
-- The personal account is always returned. Becoming a store or service provider
-- adds a work account; it must not erase the owner's personal customer identity.
-- ============================================================================

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

CREATE OR REPLACE FUNCTION public.mkt_my_account_classifications()
RETURNS TABLE(account_key text, classification text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    account.account_key,
    CASE
      WHEN account.kind = 'individual' AND public.mkt_is_platform_admin()
        THEN 'system_admin'
      WHEN account.kind = 'individual'
        THEN 'customer'
      WHEN approved.application_kind = 'service_provider'
        THEN 'service_provider'
      WHEN approved.application_kind = 'seller'
        THEN 'store'
      WHEN tenant.tenant_type = 'service_provider'
        THEN 'service_provider'
      WHEN storefront.store_type = 'services'
        THEN 'service_provider'
      WHEN category.capabilities && ARRAY[
        'catalog.services', 'bookings.receive', 'jobs.receive', 'quotes.receive'
      ]::text[]
        AND NOT category.capabilities && ARRAY[
          'catalog.products', 'orders.receive'
        ]::text[]
        THEN 'service_provider'
      ELSE 'store'
    END::text AS classification
  FROM public.mkt_my_accounts() account
  LEFT JOIN public.tenants tenant ON tenant.id = account.tenant_id
  LEFT JOIN LATERAL (
    SELECT application.application_kind
    FROM public.mkt_join_applications application
    WHERE application.tenant_id = account.tenant_id
      AND application.application_kind IN ('seller', 'service_provider')
      AND application.status = 'approved'
    ORDER BY application.approved_at DESC NULLS LAST, application.created_at DESC
    LIMIT 1
  ) approved ON account.tenant_id IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT store.id, store.store_type
    FROM public.mkt_storefronts store
    WHERE store.tenant_id = account.tenant_id
      AND store.deleted_at IS NULL
    ORDER BY store.created_at
    LIMIT 1
  ) storefront ON account.tenant_id IS NOT NULL
  LEFT JOIN public.mkt_provider_profiles provider
    ON provider.storefront_id = storefront.id
  LEFT JOIN public.mkt_provider_categories category
    ON category.code = provider.category_code;
$$;

REVOKE ALL ON FUNCTION public.mkt_my_account_classifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_account_classifications()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.mkt_my_account_classifications() IS
  'Server-derived UX classification for accounts already authorized by mkt_my_accounts. It never grants access.';
