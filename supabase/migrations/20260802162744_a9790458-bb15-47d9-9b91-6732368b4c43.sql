-- Accounts the signed-in user may enter. advertiser_type on mkt_listings is a
-- generated column derived from tenant_id, so it already cannot be set by the client.
CREATE OR REPLACE FUNCTION public.mkt_my_accounts()
RETURNS TABLE (
  account_key text,
  kind text,
  tenant_id uuid,
  membership_id uuid,
  role text,
  name text,
  slug text,
  avatar_url text,
  verification_status text,
  can_publish boolean,
  permissions text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    ), '{}'::text[])
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
    ), '{}'::text[])
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
  ORDER BY 2, 6;
$$;

-- 3) Server-side re-validation of a remembered choice.
CREATE OR REPLACE FUNCTION public.mkt_account_context(_account_key text)
RETURNS TABLE (
  account_key text,
  kind text,
  tenant_id uuid,
  membership_id uuid,
  role text,
  name text,
  slug text,
  avatar_url text,
  verification_status text,
  can_publish boolean,
  permissions text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mkt_my_accounts() a WHERE a.account_key = _account_key;
$$;

REVOKE ALL ON FUNCTION public.mkt_my_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_account_context(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_account_context(text) TO authenticated;