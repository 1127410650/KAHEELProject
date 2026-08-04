-- ═══════════════════════════════════════════════════════════════════════════
-- Mini stores & restaurants — batch 4: management, catalog, public page.
-- No new tables: everything below reuses the batch-1 schema.
-- ═══════════════════════════════════════════════════════════════════════════

/* ── 1. link existing listings to a storefront ─────────────────────────── */

ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS storefront_id uuid REFERENCES public.mkt_storefronts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mkt_listings_storefront_idx
  ON public.mkt_listings (storefront_id) WHERE storefront_id IS NOT NULL;

-- The store must belong to the very same account as the listing. Ownership is
-- never taken from the client: it is compared server-side on every write.
CREATE OR REPLACE FUNCTION public.mkt_listing_store_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE s public.mkt_storefronts;
BEGIN
  IF NEW.storefront_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.storefront_id IS NOT DISTINCT FROM NEW.storefront_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.mkt_storefronts
  WHERE id = NEW.storefront_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;
  IF s.owner_user_id <> NEW.owner_user_id
     OR s.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'store_account_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_listings_store_link_guard ON public.mkt_listings;
CREATE TRIGGER mkt_listings_store_link_guard
  BEFORE INSERT OR UPDATE OF storefront_id ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_store_link_guard();

/* ── 2. catalog integrity: sections ────────────────────────────────────── */

CREATE UNIQUE INDEX IF NOT EXISTS mkt_store_sections_unique_name
  ON public.mkt_store_sections (storefront_id, lower(btrim(name_ar)))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_store_section_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.name_ar := btrim(NEW.name_ar);
  IF NEW.name_ar = '' THEN RAISE EXCEPTION 'section_name_required'; END IF;

  -- A section that still holds available items cannot be removed: the items
  -- must be moved or hidden first.
  IF NEW.deleted_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM public.mkt_store_items i
      WHERE i.section_id = NEW.id AND i.deleted_at IS NULL AND i.is_available
    ) THEN
      RAISE EXCEPTION 'section_has_published_items';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_sections_guard ON public.mkt_store_sections;
CREATE TRIGGER mkt_store_sections_guard
  BEFORE INSERT OR UPDATE ON public.mkt_store_sections
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_section_guard();

/* ── 3. catalog integrity: items ───────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_store uuid;
BEGIN
  NEW.name_ar := btrim(NEW.name_ar);
  IF NEW.name_ar = '' THEN RAISE EXCEPTION 'item_name_required'; END IF;

  IF NEW.base_price IS NOT NULL AND NEW.base_price < 0 THEN
    RAISE EXCEPTION 'item_price_negative';
  END IF;
  IF NEW.compare_at_price IS NOT NULL AND NEW.compare_at_price < 0 THEN
    RAISE EXCEPTION 'item_compare_price_negative';
  END IF;

  -- The section must belong to the very same storefront.
  IF NEW.section_id IS NOT NULL THEN
    SELECT s.storefront_id INTO v_store FROM public.mkt_store_sections s
    WHERE s.id = NEW.section_id AND s.deleted_at IS NULL;
    IF v_store IS NULL OR v_store <> NEW.storefront_id THEN
      RAISE EXCEPTION 'section_other_store';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_items_guard ON public.mkt_store_items;
CREATE TRIGGER mkt_store_items_guard
  BEFORE INSERT OR UPDATE ON public.mkt_store_items
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_item_guard();

/* ── 4. catalog integrity: option groups and options ───────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_addon_group_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.name_ar := btrim(NEW.name_ar);
  IF NEW.name_ar = '' THEN RAISE EXCEPTION 'group_name_required'; END IF;
  IF NEW.selection_type NOT IN ('single', 'multiple') THEN
    RAISE EXCEPTION 'group_selection_type_invalid';
  END IF;
  IF NEW.selection_type = 'single' THEN
    NEW.maximum_choices := 1;
  END IF;
  IF NEW.minimum_choices < 0 THEN RAISE EXCEPTION 'group_min_negative'; END IF;
  IF NEW.maximum_choices IS NOT NULL AND NEW.minimum_choices > NEW.maximum_choices THEN
    RAISE EXCEPTION 'group_min_above_max';
  END IF;
  IF NEW.is_required AND NEW.minimum_choices = 0 THEN
    NEW.minimum_choices := 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_addon_groups_guard ON public.mkt_store_addon_groups;
CREATE TRIGGER mkt_store_addon_groups_guard
  BEFORE INSERT OR UPDATE ON public.mkt_store_addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_addon_group_guard();

CREATE OR REPLACE FUNCTION public.mkt_store_addon_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.name_ar := btrim(NEW.name_ar);
  IF NEW.name_ar = '' THEN RAISE EXCEPTION 'addon_name_required'; END IF;
  IF NEW.price_delta < 0 THEN RAISE EXCEPTION 'addon_price_negative'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_addons_guard ON public.mkt_store_addons;
CREATE TRIGGER mkt_store_addons_guard
  BEFORE INSERT OR UPDATE ON public.mkt_store_addons
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_addon_guard();

/* ── 5. opening hours validation ───────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_hours_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.is_closed THEN
    NEW.opens_at := NULL; NEW.closes_at := NULL;
    NEW.second_opens_at := NULL; NEW.second_closes_at := NULL;
    RETURN NEW;
  END IF;

  IF (NEW.opens_at IS NULL) <> (NEW.closes_at IS NULL) THEN
    RAISE EXCEPTION 'hours_incomplete';
  END IF;
  IF (NEW.second_opens_at IS NULL) <> (NEW.second_closes_at IS NULL) THEN
    RAISE EXCEPTION 'hours_incomplete';
  END IF;
  IF NEW.second_opens_at IS NOT NULL AND NEW.opens_at IS NULL THEN
    RAISE EXCEPTION 'hours_second_without_first';
  END IF;

  -- A single period may wrap past midnight (closes_at < opens_at). Two periods
  -- in one day must both be same-day and must not overlap.
  IF NEW.second_opens_at IS NOT NULL THEN
    IF NEW.closes_at <= NEW.opens_at OR NEW.second_closes_at <= NEW.second_opens_at THEN
      RAISE EXCEPTION 'hours_period_invalid';
    END IF;
    IF NEW.second_opens_at < NEW.closes_at THEN
      RAISE EXCEPTION 'hours_overlap';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_store_hours_guard ON public.mkt_store_hours;
CREATE TRIGGER mkt_store_hours_guard
  BEFORE INSERT OR UPDATE ON public.mkt_store_hours
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_hours_guard();

/* ── 6. owner dashboard indicators ─────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_overview(_account_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_store public.mkt_storefronts;
  v_missing text[] := '{}';
BEGIN
  SELECT s.* INTO v_store
  FROM public.mkt_storefronts s
  JOIN public.mkt_my_storefront(_account_key) m ON m.id = s.id
  LIMIT 1;

  IF v_store.id IS NULL THEN RETURN NULL; END IF;

  IF coalesce(btrim(v_store.name_ar), '') = '' THEN v_missing := v_missing || 'name'; END IF;
  IF v_store.city_id IS NULL THEN v_missing := v_missing || 'city'; END IF;
  IF v_store.logo_path IS NULL THEN v_missing := v_missing || 'logo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_store_sections x
    WHERE x.storefront_id = v_store.id AND x.deleted_at IS NULL
  ) THEN v_missing := v_missing || 'sections'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_store_items x
    WHERE x.storefront_id = v_store.id AND x.deleted_at IS NULL AND x.is_available
  ) THEN v_missing := v_missing || 'items'; END IF;

  RETURN jsonb_build_object(
    'storefront_id', v_store.id,
    'slug', v_store.slug,
    'store_type', v_store.store_type,
    'status', v_store.status,
    'is_open_manually', v_store.is_open_manually,
    'city_name_ar', (SELECT c.name_ar FROM public.mkt_cities c WHERE c.id = v_store.city_id),
    'city_name_en', (SELECT c.name_en FROM public.mkt_cities c WHERE c.id = v_store.city_id),
    'logo_path', v_store.logo_path,
    'cover_path', v_store.cover_path,
    'name_ar', v_store.name_ar,
    'name_en', v_store.name_en,
    'verification_status', v_store.verification_status,
    'draft_step', v_store.draft_step,
    'sections_count', (SELECT count(*) FROM public.mkt_store_sections x
                       WHERE x.storefront_id = v_store.id AND x.deleted_at IS NULL),
    'items_published', (SELECT count(*) FROM public.mkt_store_items x
                        WHERE x.storefront_id = v_store.id AND x.deleted_at IS NULL AND x.is_available),
    'items_hidden', (SELECT count(*) FROM public.mkt_store_items x
                     WHERE x.storefront_id = v_store.id AND x.deleted_at IS NULL AND NOT x.is_available),
    'linked_listings', (SELECT count(*) FROM public.mkt_listings l
                        WHERE l.storefront_id = v_store.id AND l.deleted_at IS NULL),
    'missing', to_jsonb(v_missing),
    'complete', (array_length(v_missing, 1) IS NULL)
  );
END;
$$;

/* ── 7. listings the active account may link ───────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_linkable_listings(_account_key text DEFAULT NULL)
RETURNS TABLE(id uuid, slug text, title text, status text, storefront_id uuid, cover_image_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH store AS (SELECT m.id, m.tenant_id FROM public.mkt_my_storefront(_account_key) m LIMIT 1)
  SELECT l.id, l.slug, l.title, l.status, l.storefront_id, l.cover_image_url
  FROM public.mkt_listings l, store
  WHERE l.deleted_at IS NULL
    AND l.owner_user_id = auth.uid()
    AND l.tenant_id IS NOT DISTINCT FROM store.tenant_id
    AND l.status IN ('published', 'pending', 'draft')
    AND (l.storefront_id IS NULL OR l.storefront_id = store.id)
  ORDER BY l.created_at DESC
  LIMIT 100
$$;

/* ── 8. the public storefront page (one safe payload) ──────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_public(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  s public.mkt_storefronts;
  v_branch uuid;
  v_exact boolean;
BEGIN
  SELECT * INTO s FROM public.mkt_storefronts
  WHERE slug = _slug AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Unpublished stores are only readable by their own account (preview).
  IF s.status <> 'published' AND NOT public.mkt_store_manage(s.id) THEN
    RETURN jsonb_build_object('unavailable', true);
  END IF;

  v_exact := s.location_precision = 'exact';
  SELECT b.id INTO v_branch FROM public.mkt_store_branches b
  WHERE b.storefront_id = s.id AND b.is_primary AND b.deleted_at IS NULL LIMIT 1;

  RETURN jsonb_build_object(
    'id', s.id,
    'slug', s.slug,
    'store_type', s.store_type,
    'status', s.status,
    'name_ar', s.name_ar,
    'name_en', s.name_en,
    'short_description_ar', s.short_description_ar,
    'short_description_en', s.short_description_en,
    'logo_path', s.logo_path,
    'cover_path', s.cover_path,
    'city_name_ar', (SELECT c.name_ar FROM public.mkt_cities c WHERE c.id = s.city_id),
    'city_name_en', (SELECT c.name_en FROM public.mkt_cities c WHERE c.id = s.city_id),
    'district', s.district,
    'address_text', CASE WHEN v_exact THEN s.address_text ELSE NULL END,
    -- Approximate stores expose a coarse point only; the exact one stays private.
    'latitude', CASE WHEN s.latitude IS NULL THEN NULL
                     WHEN v_exact THEN s.latitude ELSE round(s.latitude::numeric, 2)::double precision END,
    'longitude', CASE WHEN s.longitude IS NULL THEN NULL
                      WHEN v_exact THEN s.longitude ELSE round(s.longitude::numeric, 2)::double precision END,
    'location_precision', s.location_precision,
    'verification_status', s.verification_status,
    'currency_code', s.currency_code,
    'pickup_enabled', s.pickup_enabled,
    'delivery_enabled', s.merchant_delivery_enabled,
    'chat_enabled', s.chat_enabled,
    'call_enabled', s.call_enabled AND s.public_phone_enabled,
    -- Never leaked: owner_user_id, tenant_id, documents, private phone.
    'public_phone', public.mkt_store_public_phone(s.id),
    'cuisine', (SELECT jsonb_build_object('name_ar', cu.name_ar, 'name_en', cu.name_en)
                FROM public.mkt_store_cuisines cu WHERE cu.id = s.cuisine_id),
    'open_state', public.mkt_store_open_state(s.id),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'weekday', h.weekday, 'is_closed', h.is_closed,
               'opens_at', h.opens_at, 'closes_at', h.closes_at,
               'second_opens_at', h.second_opens_at, 'second_closes_at', h.second_closes_at)
             ORDER BY h.weekday)
      FROM public.mkt_store_hours h WHERE h.branch_id = v_branch
    ), '[]'::jsonb),
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', x.id, 'name_ar', x.name_ar, 'name_en', x.name_en,
               'sort_order', x.sort_order)
             ORDER BY x.sort_order, x.created_at)
      FROM public.mkt_store_sections x
      WHERE x.storefront_id = s.id AND x.deleted_at IS NULL AND x.is_active
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'section_id', i.section_id,
               'name_ar', i.name_ar, 'name_en', i.name_en,
               'description_ar', i.description_ar, 'description_en', i.description_en,
               'base_price', i.base_price, 'compare_at_price', i.compare_at_price,
               'image_path', i.image_path, 'is_available', i.is_available,
               'is_featured', i.is_featured, 'preparation_minutes', i.preparation_minutes,
               'sort_order', i.sort_order,
               'specs', i.specs,
               'addon_groups', coalesce((
                 SELECT jsonb_agg(jsonb_build_object(
                          'id', g.id, 'name_ar', g.name_ar, 'name_en', g.name_en,
                          'selection_type', g.selection_type, 'is_required', g.is_required,
                          'minimum_choices', g.minimum_choices, 'maximum_choices', g.maximum_choices,
                          'options', coalesce((
                            SELECT jsonb_agg(jsonb_build_object(
                                     'id', o.id, 'name_ar', o.name_ar, 'name_en', o.name_en,
                                     'price_delta', o.price_delta, 'is_available', o.is_available)
                                   ORDER BY o.sort_order, o.created_at)
                            FROM public.mkt_store_addons o
                            WHERE o.addon_group_id = g.id AND o.deleted_at IS NULL
                          ), '[]'::jsonb))
                        ORDER BY g.sort_order, g.created_at)
                 FROM public.mkt_store_addon_groups g
                 WHERE g.item_id = i.id AND g.deleted_at IS NULL
               ), '[]'::jsonb))
             ORDER BY i.sort_order, i.created_at)
      FROM public.mkt_store_items i
      WHERE i.storefront_id = s.id AND i.deleted_at IS NULL
    ), '[]'::jsonb),
    'listings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'slug', l.slug, 'title', l.title,
               'price', l.price, 'price_on_request', l.price_on_request,
               'currency', l.currency, 'cover_image_url', l.cover_image_url,
               'city', l.city)
             ORDER BY l.published_at DESC NULLS LAST)
      FROM public.mkt_listings l
      WHERE l.storefront_id = s.id AND l.deleted_at IS NULL AND l.status = 'published'
    ), '[]'::jsonb)
  );
END;
$$;

/* ── 9. marketplace search (safe, published only) ──────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_search_stores(
  _q text DEFAULT NULL,
  _country_iso2 text DEFAULT NULL,
  _limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, slug text, name_ar text, name_en text, store_type text,
  logo_path text, cover_path text, city_name_ar text, city_name_en text,
  matched_items bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH term AS (SELECT nullif(btrim(coalesce(_q, '')), '') AS q)
  SELECT s.id, s.slug, s.name_ar, s.name_en, s.store_type,
         s.logo_path, s.cover_path, c.name_ar, c.name_en,
         (SELECT count(*) FROM public.mkt_store_items i
          WHERE i.storefront_id = s.id AND i.deleted_at IS NULL AND i.is_available
            AND (SELECT q FROM term) IS NOT NULL
            AND (i.name_ar ILIKE '%' || (SELECT q FROM term) || '%'
                 OR i.name_en ILIKE '%' || (SELECT q FROM term) || '%'))
  FROM public.mkt_storefronts s
  LEFT JOIN public.mkt_cities c ON c.id = s.city_id
  LEFT JOIN public.mkt_countries co ON co.id = s.country_id
  WHERE s.deleted_at IS NULL
    AND s.status = 'published'
    AND (_country_iso2 IS NULL OR co.iso2 = upper(_country_iso2))
    AND (
      (SELECT q FROM term) IS NULL
      OR s.name_ar ILIKE '%' || (SELECT q FROM term) || '%'
      OR s.name_en ILIKE '%' || (SELECT q FROM term) || '%'
      OR s.short_description_ar ILIKE '%' || (SELECT q FROM term) || '%'
      OR s.short_description_en ILIKE '%' || (SELECT q FROM term) || '%'
      OR EXISTS (
        SELECT 1 FROM public.mkt_store_items i
        WHERE i.storefront_id = s.id AND i.deleted_at IS NULL AND i.is_available
          AND (i.name_ar ILIKE '%' || (SELECT q FROM term) || '%'
               OR i.name_en ILIKE '%' || (SELECT q FROM term) || '%')
      )
      OR EXISTS (
        SELECT 1 FROM public.mkt_store_sections x
        WHERE x.storefront_id = s.id AND x.deleted_at IS NULL AND x.is_active
          AND (x.name_ar ILIKE '%' || (SELECT q FROM term) || '%'
               OR x.name_en ILIKE '%' || (SELECT q FROM term) || '%')
      )
    )
  ORDER BY s.updated_at DESC
  LIMIT least(coalesce(_limit, 20), 50)
$$;

/* ── 10. system-owner console ──────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_admin_stores(
  _q text DEFAULT NULL,
  _status text DEFAULT NULL,
  _store_type text DEFAULT NULL,
  _limit integer DEFAULT 30,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, slug text, name_ar text, store_type text, status text,
  verification_status text, owner_label text, owner_kind text,
  country_iso2 text, city_name_ar text, items_count bigint, reports_count bigint,
  created_at timestamptz, suspension_reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT s.id, s.slug, s.name_ar, s.store_type, s.status, s.verification_status,
         COALESCE(b.display_name_ar, p.display_name, '—') AS owner_label,
         CASE WHEN s.tenant_id IS NULL THEN 'individual' ELSE 'business' END AS owner_kind,
         co.iso2, c.name_ar,
         (SELECT count(*) FROM public.mkt_store_items i
          WHERE i.storefront_id = s.id AND i.deleted_at IS NULL),
         (SELECT count(*) FROM public.mkt_reports r
          JOIN public.mkt_listings rl ON rl.id = r.listing_id
          WHERE rl.storefront_id = s.id),
         s.created_at, s.suspension_reason
  FROM public.mkt_storefronts s
  LEFT JOIN public.mkt_cities c ON c.id = s.city_id
  LEFT JOIN public.mkt_countries co ON co.id = s.country_id
  LEFT JOIN public.mkt_business_profiles b ON b.tenant_id = s.tenant_id
  LEFT JOIN public.mkt_user_profiles p ON p.user_id = s.owner_user_id
  WHERE public.mkt_store_admin()
    AND s.deleted_at IS NULL
    AND (_status IS NULL OR s.status = _status)
    AND (_store_type IS NULL OR s.store_type = _store_type)
    AND (
      nullif(btrim(coalesce(_q, '')), '') IS NULL
      OR s.name_ar ILIKE '%' || btrim(_q) || '%'
      OR s.name_en ILIKE '%' || btrim(_q) || '%'
      OR s.slug ILIKE '%' || btrim(_q) || '%'
    )
  ORDER BY s.created_at DESC
  LIMIT least(coalesce(_limit, 30), 100) OFFSET greatest(coalesce(_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_store_action(
  _storefront_id uuid,
  _action text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_old text;
  v_new text;
BEGIN
  IF NOT public.mkt_store_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action NOT IN ('suspend', 'reinstate', 'request_changes') THEN
    RAISE EXCEPTION 'action_invalid';
  END IF;
  IF _action IN ('suspend', 'request_changes') AND coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT status INTO v_old FROM public.mkt_storefronts
  WHERE id = _storefront_id AND deleted_at IS NULL;
  IF v_old IS NULL THEN RAISE EXCEPTION 'store_not_found'; END IF;

  v_new := CASE _action
             WHEN 'suspend' THEN 'suspended'
             WHEN 'reinstate' THEN 'published'
             ELSE 'draft'
           END;

  UPDATE public.mkt_storefronts
  SET status = v_new,
      suspension_reason = CASE WHEN _action = 'reinstate' THEN NULL ELSE btrim(_reason) END,
      accepts_orders = CASE WHEN v_new = 'published' THEN accepts_orders ELSE false END,
      updated_at = now()
  WHERE id = _storefront_id;

  INSERT INTO public.mkt_store_audit
    (storefront_id, entity_type, entity_id, action, actor_user_id, is_admin_action, reason, old_value, new_value)
  VALUES
    (_storefront_id, 'storefront', _storefront_id, 'admin_' || _action, auth.uid(), true, btrim(_reason),
     jsonb_build_object('status', v_old), jsonb_build_object('status', v_new));

  RETURN jsonb_build_object('ok', true, 'status', v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_store_audit(_storefront_id uuid, _limit integer DEFAULT 30)
RETURNS TABLE(action text, reason text, is_admin_action boolean, old_value jsonb, new_value jsonb, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT a.action, a.reason, a.is_admin_action, a.old_value, a.new_value, a.created_at
  FROM public.mkt_store_audit a
  WHERE public.mkt_store_admin() AND a.storefront_id = _storefront_id
  ORDER BY a.created_at DESC
  LIMIT least(coalesce(_limit, 30), 100)
$$;

/* ── 11. QA cleanup (tagged rows only) ─────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.mkt_store_qa_cleanup(_batch text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_ids uuid[]; v_stores int; v_items int;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(btrim(_batch), '') = '' THEN RAISE EXCEPTION 'batch_required'; END IF;

  SELECT array_agg(id) INTO v_ids FROM public.mkt_storefronts WHERE qa_batch_id = _batch;
  IF v_ids IS NULL THEN RETURN jsonb_build_object('stores', 0, 'items', 0); END IF;

  UPDATE public.mkt_listings SET storefront_id = NULL WHERE storefront_id = ANY(v_ids);
  DELETE FROM public.mkt_store_items WHERE storefront_id = ANY(v_ids);
  GET DIAGNOSTICS v_items = ROW_COUNT;
  DELETE FROM public.mkt_store_sections WHERE storefront_id = ANY(v_ids);
  DELETE FROM public.mkt_storefronts WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_stores = ROW_COUNT;

  RETURN jsonb_build_object('stores', v_stores, 'items', v_items, 'batch', _batch);
END;
$$;

/* ── 12. grants ────────────────────────────────────────────────────────── */

REVOKE ALL ON FUNCTION public.mkt_store_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_search_stores(text, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mkt_store_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_search_stores(text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_store_overview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_store_linkable_listings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_stores(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_store_action(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_store_audit(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_store_qa_cleanup(text) TO authenticated;