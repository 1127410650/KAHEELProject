CREATE OR REPLACE FUNCTION public.mkt_listing_duplicate(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- advertiser_type is generated from the identity columns, so it is never copied
  INSERT INTO public.mkt_listings (
    owner_user_id, tenant_id, type_code, category_id, subcategory_id,
    title, summary, description, specs, price, price_on_request, price_unit, currency,
    quantity, unit, item_condition, deal_kind, city, region, country_id, city_id,
    district, address_text, latitude, longitude, location_accuracy, location_source,
    location_visibility, cover_image_url, duration_days, status)
  SELECT owner_user_id, tenant_id, type_code, category_id, subcategory_id,
    left(title || ' (نسخة)', 120), summary, description, specs, price, price_on_request, price_unit, currency,
    quantity, unit, item_condition, deal_kind, city, region, country_id, city_id,
    district, address_text, latitude, longitude, location_accuracy, location_source,
    location_visibility, cover_image_url, duration_days, 'draft'
  FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL
  RETURNING id INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO public.mkt_listing_images (listing_id, storage_path, sort_order)
  SELECT _new, storage_path, sort_order FROM public.mkt_listing_images WHERE listing_id = _id;

  PERFORM public.mkt_log_listing_event(_new, 'duplicated_from', jsonb_build_object('source_id', _id));
  PERFORM public.mkt_log_listing_event(_id, 'duplicated_to', jsonb_build_object('new_id', _new));
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_duplicate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_duplicate(uuid) TO authenticated;