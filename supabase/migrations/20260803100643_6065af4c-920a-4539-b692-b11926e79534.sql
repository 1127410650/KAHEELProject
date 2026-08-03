DROP FUNCTION IF EXISTS public.mkt_account_context(text);
DROP FUNCTION IF EXISTS public.mkt_my_accounts();

CREATE OR REPLACE FUNCTION public.mkt_my_accounts()
 RETURNS TABLE(account_key text, kind text, tenant_id uuid, membership_id uuid, role text, name text, slug text, avatar_url text, verification_status text, can_publish boolean, permissions text[], city text, activity text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ORDER BY 2, 6;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_account_context(_account_key text)
 RETURNS TABLE(account_key text, kind text, tenant_id uuid, membership_id uuid, role text, name text, slug text, avatar_url text, verification_status text, can_publish boolean, permissions text[], city text, activity text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.mkt_my_accounts() a WHERE a.account_key = _account_key;
$function$;

REVOKE ALL ON FUNCTION public.mkt_my_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_account_context(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_accounts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_account_context(text) TO authenticated, service_role;