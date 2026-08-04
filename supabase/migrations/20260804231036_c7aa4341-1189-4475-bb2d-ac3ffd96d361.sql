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
    'latitude', CASE WHEN s.latitude IS NULL THEN NULL
                     WHEN v_exact THEN s.latitude ELSE round(s.latitude::numeric, 2)::double precision END,
    'longitude', CASE WHEN s.longitude IS NULL THEN NULL
                      WHEN v_exact THEN s.longitude ELSE round(s.longitude::numeric, 2)::double precision END,
    'location_precision', s.location_precision,
    'verification_status', s.verification_status,
    'currency_code', s.currency_code,
    'pickup_enabled', s.pickup_enabled,
    'delivery_enabled', s.merchant_delivery_enabled,
    'delivery_fee', s.delivery_fee,
    'minimum_order_amount', s.minimum_order_amount,
    'chat_enabled', s.chat_enabled,
    'call_enabled', s.call_enabled AND s.public_phone_enabled,
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
               'description_ar', x.description_ar, 'description_en', x.description_en,
               'sort_order', x.sort_order)
             ORDER BY x.sort_order, x.created_at)
      FROM public.mkt_store_sections x
      WHERE x.storefront_id = s.id AND x.deleted_at IS NULL AND x.is_active
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'section_id', i.section_id, 'item_type', i.item_type,
               'name_ar', i.name_ar, 'name_en', i.name_en,
               'description_ar', i.description_ar, 'description_en', i.description_en,
               'base_price', i.base_price, 'compare_at_price', i.compare_at_price,
               'currency_code', i.currency_code,
               'image_path', i.image_path, 'is_available', i.is_available,
               'is_featured', i.is_featured,
               'preparation_minutes', i.preparation_minutes,
               'duration_minutes', i.duration_minutes,
               'track_inventory', i.track_inventory,
               'stock_quantity', CASE WHEN i.track_inventory THEN i.stock_quantity ELSE NULL END,
               'sort_order', i.sort_order,
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
               'price_unit', l.price_unit,
               'currency', l.currency, 'cover_image_url', l.cover_image_url,
               'city', l.city)
             ORDER BY l.published_at DESC NULLS LAST)
      FROM public.mkt_listings l
      WHERE l.storefront_id = s.id AND l.deleted_at IS NULL AND l.status = 'published'
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_store_public(text) TO anon, authenticated;