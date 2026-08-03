DO $$
DECLARE
  v_owner uuid; v_listing uuid; v_cat uuid; v_sub uuid; v_country uuid; v_city uuid; v_type text;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.mkt_listings LIMIT 1;
  IF v_owner IS NULL THEN SELECT id INTO v_owner FROM auth.users LIMIT 1; END IF;
  SELECT id INTO v_cat FROM public.mkt_categories WHERE parent_id IS NULL AND slug = 'real-estate';
  SELECT id INTO v_sub FROM public.mkt_categories WHERE parent_id = v_cat AND is_active LIMIT 1;
  SELECT country_id INTO v_country FROM public.mkt_user_profiles WHERE user_id = v_owner;
  IF v_country IS NULL THEN
    SELECT id INTO v_country FROM public.mkt_countries WHERE iso2 = 'SA' AND is_active LIMIT 1;
  END IF;
  SELECT id INTO v_city FROM public.mkt_cities WHERE country_id = v_country LIMIT 1;
  SELECT code INTO v_type FROM public.mkt_listing_types WHERE code LIKE 'property%' LIMIT 1;

  INSERT INTO public.mkt_listings(
    slug, owner_user_id, type_code, category_id, subcategory_id, title, summary, description,
    status, country_id, city_id, city, region, district, address_text,
    latitude, longitude, location_visibility, currency, price, deal_kind)
  VALUES ('zz-audit-live', v_owner, v_type, v_cat, v_sub,
    'شقة اختبارية مؤقتة للتدقيق الأمني', 'إعلان اختباري مؤقت يُحذف بعد الفحص.',
    'هذا إعلان اختباري مؤقت أُنشئ لفحص خصوصية الموقع وبيانات الترخيص، وسيُحذف فورًا بعد الفحص.',
    'draft', v_country, v_city, 'Riyadh', 'Riyadh Region', 'العليا', 'شارع التخصصي، مبنى 12',
    24.7136123, 46.6752987, 'approximate', 'SAR', 750000, 'sale')
  RETURNING id INTO v_listing;

  INSERT INTO public.mkt_listing_licenses(
    listing_id, advertiser_role, ad_license_number, ad_license_expiry)
  VALUES (v_listing, 'broker_individual', '7200123456', current_date + 180);
  UPDATE public.mkt_listing_licenses SET practice_license_number = '1100223344'
   WHERE listing_id = v_listing;

  INSERT INTO public.mkt_listing_license_private(listing_id, deed_number, brokerage_contract_number, internal_note)
  VALUES (v_listing, '310108041234', 'BRK-2026-0099', 'ملاحظة داخلية اختبارية');

  ALTER TABLE public.mkt_listings DISABLE TRIGGER mkt_listings_before_write;
  ALTER TABLE public.mkt_listings DISABLE TRIGGER mkt_listings_guard_status;
  UPDATE public.mkt_listings SET status = 'published', published_at = now() WHERE id = v_listing;
  ALTER TABLE public.mkt_listings ENABLE TRIGGER mkt_listings_before_write;
  ALTER TABLE public.mkt_listings ENABLE TRIGGER mkt_listings_guard_status;
END $$;