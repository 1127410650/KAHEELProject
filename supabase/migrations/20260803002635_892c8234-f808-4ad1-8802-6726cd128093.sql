-- Public individual advertiser profile: field-limited, server-enforced reads.

CREATE OR REPLACE FUNCTION public.mkt_person_is_restricted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
    WHERE r.subject_type = 'user'
      AND r.subject_id = _user_id
      AND r.restriction IN ('suspended', 'banned', 'hidden', 'profile_hidden')
      AND r.lifted_at IS NULL
      AND (r.starts_at IS NULL OR r.starts_at <= now())
      AND (r.expires_at IS NULL OR r.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_public_person(_username text)
RETURNS TABLE(
  username text,
  display_name text,
  headline text,
  about text,
  city_ar text,
  city_en text,
  avatar_url text,
  verification_status text,
  joined_at timestamptz,
  active_listings integer,
  is_owner boolean,
  public_phone text,
  public_email text,
  public_whatsapp text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    up.username,
    COALESCE(NULLIF(btrim(up.display_name), ''), '') AS display_name,
    NULLIF(btrim(COALESCE(up.headline, '')), '') AS headline,
    NULLIF(btrim(COALESCE(up.about, '')), '') AS about,
    COALESCE(NULLIF(btrim(COALESCE(c.name_ar, '')), ''), NULLIF(btrim(COALESCE(up.city, '')), '')) AS city_ar,
    COALESCE(NULLIF(btrim(COALESCE(c.name_en, '')), ''), NULLIF(btrim(COALESCE(up.city, '')), '')) AS city_en,
    up.avatar_url,
    up.verification_status,
    up.joined_at,
    (
      SELECT COUNT(*)::int FROM public.mkt_listings l
      WHERE l.owner_user_id = up.user_id
        AND l.tenant_id IS NULL
        AND l.status = 'published'
        AND l.deleted_at IS NULL
    ) AS active_listings,
    (auth.uid() = up.user_id) AS is_owner,
    CASE WHEN auth.uid() IS NULL THEN NULL ELSE (
      SELECT ct.phone_e164 FROM public.mkt_user_contacts ct
      WHERE ct.user_id = up.user_id AND ct.phone_visibility = 'public' AND ct.phone_e164 IS NOT NULL
      LIMIT 1
    ) END AS public_phone,
    CASE WHEN auth.uid() IS NOT NULL AND up.show_email THEN up.public_email ELSE NULL END AS public_email,
    CASE WHEN auth.uid() IS NOT NULL AND up.show_whatsapp THEN up.public_whatsapp ELSE NULL END AS public_whatsapp
  FROM public.mkt_user_profiles up
  LEFT JOIN public.mkt_cities c ON c.id = up.city_id
  WHERE up.username = lower(btrim(_username))
    AND (
      auth.uid() = up.user_id
      OR (up.is_published AND NOT public.mkt_person_is_restricted(up.user_id))
    )
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mkt_public_person_categories(_username text)
RETURNS TABLE(category_id uuid, slug text, name_ar text, name_en text, listings_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cat.id, cat.slug, cat.name_ar, cat.name_en, COUNT(l.id)::int
  FROM public.mkt_user_profiles up
  JOIN public.mkt_listings l
    ON l.owner_user_id = up.user_id
   AND l.tenant_id IS NULL
   AND l.status = 'published'
   AND l.deleted_at IS NULL
  JOIN public.mkt_categories cat ON cat.id = l.category_id
  WHERE up.username = lower(btrim(_username))
    AND (
      auth.uid() = up.user_id
      OR (up.is_published AND NOT public.mkt_person_is_restricted(up.user_id))
    )
  GROUP BY cat.id, cat.slug, cat.name_ar, cat.name_en, cat.sort_order
  ORDER BY cat.sort_order, cat.name_ar
$$;

CREATE OR REPLACE FUNCTION public.mkt_public_person_listings(
  _username text,
  _category_id uuid DEFAULT NULL,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  slug text,
  title text,
  summary text,
  price numeric,
  price_on_request boolean,
  price_unit text,
  currency text,
  city text,
  district text,
  city_id uuid,
  category_id uuid,
  subcategory_id uuid,
  type_code text,
  deal_kind text,
  item_condition text,
  cover_image_url text,
  published_at timestamptz,
  created_at timestamptz,
  views_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    l.id, l.slug, l.title, l.summary, l.price, l.price_on_request, l.price_unit, l.currency,
    l.city, l.district, l.city_id, l.category_id, l.subcategory_id, l.type_code, l.deal_kind,
    l.item_condition, l.cover_image_url, l.published_at, l.created_at, l.views_count
  FROM public.mkt_user_profiles up
  JOIN public.mkt_listings l
    ON l.owner_user_id = up.user_id
   AND l.tenant_id IS NULL
   AND l.status = 'published'
   AND l.deleted_at IS NULL
  WHERE up.username = lower(btrim(_username))
    AND (_category_id IS NULL OR l.category_id = _category_id)
    AND (
      auth.uid() = up.user_id
      OR (up.is_published AND NOT public.mkt_person_is_restricted(up.user_id))
    )
  ORDER BY l.published_at DESC NULLS LAST, l.id DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 12), 48), 1)
  OFFSET GREATEST(COALESCE(_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.mkt_person_is_restricted(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_public_person(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_public_person_categories(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_public_person_listings(text, uuid, integer, integer) TO anon, authenticated;