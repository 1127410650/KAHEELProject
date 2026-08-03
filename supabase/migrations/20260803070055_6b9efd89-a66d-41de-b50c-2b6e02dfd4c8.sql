CREATE OR REPLACE FUNCTION public.mkt_business_is_restricted(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
    WHERE r.subject_type = 'business'
      AND r.subject_id = _tenant_id
      AND r.restriction IN ('suspended', 'banned', 'hidden', 'profile_hidden')
      AND r.lifted_at IS NULL
      AND (r.starts_at IS NULL OR r.starts_at <= now())
      AND (r.expires_at IS NULL OR r.expires_at > now())
  )
$function$;

REVOKE ALL ON FUNCTION public.mkt_business_is_restricted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_business_is_restricted(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_business_is_restricted(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mkt_public_business(_slug text)
RETURNS TABLE(
  slug text,
  display_name_ar text,
  display_name_en text,
  headline text,
  about text,
  logo_url text,
  entity_type text,
  main_activity text,
  sub_activities text[],
  city_ar text,
  city_en text,
  region text,
  joined_at timestamp with time zone,
  verification_status text,
  active_listings integer,
  public_website text,
  public_phone text,
  public_email text,
  public_whatsapp text,
  is_member boolean,
  can_edit boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    bp.slug,
    COALESCE(NULLIF(btrim(bp.display_name_ar), ''), '') AS display_name_ar,
    NULLIF(btrim(COALESCE(bp.display_name_en, '')), '') AS display_name_en,
    NULLIF(btrim(COALESCE(bp.headline, '')), '') AS headline,
    NULLIF(btrim(COALESCE(bp.about, '')), '') AS about,
    bp.logo_url,
    NULLIF(btrim(COALESCE(br.entity_type, '')), '') AS entity_type,
    NULLIF(btrim(COALESCE(bp.main_activity, '')), '') AS main_activity,
    COALESCE(bp.sub_activities, ARRAY[]::text[]) AS sub_activities,
    COALESCE(NULLIF(btrim(COALESCE(c.name_ar, '')), ''), NULLIF(btrim(COALESCE(bp.city, '')), '')) AS city_ar,
    COALESCE(NULLIF(btrim(COALESCE(c.name_en, '')), ''), NULLIF(btrim(COALESCE(bp.city, '')), '')) AS city_en,
    NULLIF(btrim(COALESCE(bp.region, '')), '') AS region,
    bp.joined_at,
    bp.verification_status,
    (
      SELECT COUNT(*)::int FROM public.mkt_listings l
      WHERE l.tenant_id = bp.tenant_id
        AND l.status = 'published'
        AND l.deleted_at IS NULL
    ) AS active_listings,
    NULLIF(btrim(COALESCE(bp.public_website, '')), '') AS public_website,
    CASE WHEN auth.uid() IS NOT NULL AND bp.show_phone THEN bp.public_phone ELSE NULL END AS public_phone,
    CASE WHEN auth.uid() IS NOT NULL AND bp.show_email THEN bp.public_email ELSE NULL END AS public_email,
    CASE WHEN auth.uid() IS NOT NULL AND bp.show_whatsapp THEN bp.public_whatsapp ELSE NULL END AS public_whatsapp,
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = bp.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
    ) AS is_member,
    EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = bp.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
        AND m.role <> 'viewer'
    ) AS can_edit
  FROM public.mkt_business_profiles bp
  JOIN public.tenants tn ON tn.id = bp.tenant_id
  LEFT JOIN public.mkt_business_registry br ON br.tenant_id = bp.tenant_id
  LEFT JOIN public.mkt_cities c ON c.id = bp.city_id
  WHERE bp.slug = lower(btrim(_slug))
    AND tn.deleted_at IS NULL
    AND tn.status = 'active'
    AND tn.personal_user_id IS NULL
    AND NOT public.mkt_business_is_restricted(bp.tenant_id)
    AND (
      bp.is_published
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = bp.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.mkt_public_business(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_public_business(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_public_business_categories(_slug text)
RETURNS TABLE(category_id uuid, slug text, name_ar text, name_en text, listings_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cat.id, cat.slug, cat.name_ar, cat.name_en, COUNT(l.id)::int
  FROM public.mkt_business_profiles bp
  JOIN public.tenants tn ON tn.id = bp.tenant_id
  JOIN public.mkt_listings l
    ON l.tenant_id = bp.tenant_id
   AND l.status = 'published'
   AND l.deleted_at IS NULL
  JOIN public.mkt_categories cat ON cat.id = l.category_id
  WHERE bp.slug = lower(btrim(_slug))
    AND tn.deleted_at IS NULL
    AND tn.status = 'active'
    AND tn.personal_user_id IS NULL
    AND NOT public.mkt_business_is_restricted(bp.tenant_id)
    AND (
      bp.is_published
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = bp.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )
  GROUP BY cat.id, cat.slug, cat.name_ar, cat.name_en, cat.sort_order
  ORDER BY cat.sort_order, cat.name_ar
$function$;

REVOKE ALL ON FUNCTION public.mkt_public_business_categories(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_public_business_categories(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_public_business_listings(
  _slug text,
  _category_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, slug text, title text, summary text, price numeric, price_on_request boolean,
  price_unit text, currency text, city text, district text, city_id uuid, category_id uuid,
  subcategory_id uuid, type_code text, deal_kind text, item_condition text,
  cover_image_url text, published_at timestamp with time zone,
  created_at timestamp with time zone, views_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    l.id, l.slug, l.title, l.summary, l.price, l.price_on_request, l.price_unit, l.currency,
    l.city, l.district, l.city_id, l.category_id, l.subcategory_id, l.type_code, l.deal_kind,
    l.item_condition, l.cover_image_url, l.published_at, l.created_at, l.views_count
  FROM public.mkt_business_profiles bp
  JOIN public.tenants tn ON tn.id = bp.tenant_id
  JOIN public.mkt_listings l
    ON l.tenant_id = bp.tenant_id
   AND l.status = 'published'
   AND l.deleted_at IS NULL
  WHERE bp.slug = lower(btrim(_slug))
    AND tn.deleted_at IS NULL
    AND tn.status = 'active'
    AND tn.personal_user_id IS NULL
    AND NOT public.mkt_business_is_restricted(bp.tenant_id)
    AND (
      bp.is_published
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = bp.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )
    AND (_category_id IS NULL OR l.category_id = _category_id)
  ORDER BY l.published_at DESC NULLS LAST, l.id DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 12), 48), 1)
  OFFSET GREATEST(COALESCE(_offset, 0), 0)
$function$;

REVOKE ALL ON FUNCTION public.mkt_public_business_listings(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_public_business_listings(text, uuid, integer, integer) TO anon, authenticated, service_role;