DO $$
DECLARE
  v_owner uuid; v_listing uuid; v_cat uuid; v_sub uuid; v_country uuid; v_city uuid;
  v_type text; v_cnt int;
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
    slug, owner_user_id, type_code, category_id, subcategory_id, title, status,
    country_id, city_id, city, district, latitude, longitude, location_visibility, currency)
  VALUES ('zz-audit-lic-' || substr(md5(random()::text), 1, 8), v_owner, v_type, v_cat, v_sub,
    'AUDIT TEMP licence rules', 'draft', v_country, v_city, 'Riyadh', 'Al Olaya',
    24.7136123, 46.6752987, 'approximate', 'SAR')
  RETURNING id INTO v_listing;

  RAISE NOTICE 'exact 24.7136123/46.6752987 -> public %/%',
    (SELECT latitude_public FROM public.mkt_listings WHERE id = v_listing),
    (SELECT longitude_public FROM public.mkt_listings WHERE id = v_listing);

  BEGIN
    UPDATE public.mkt_listings SET status = 'pending' WHERE id = v_listing;
    RAISE NOTICE 'A) no licence -> pending ALLOWED (BAD)';
  EXCEPTION WHEN others THEN RAISE NOTICE 'A) no licence -> blocked: %', SQLERRM;
  END;

  INSERT INTO public.mkt_listing_licenses(
    listing_id, advertiser_role, ad_license_number, ad_license_expiry, verification_status)
  VALUES (v_listing, 'owner', '7200000000', current_date - 5, 'valid');
  RAISE NOTICE 'B) client sent verification_status=valid -> stored as %',
    (SELECT verification_status FROM public.mkt_listing_licenses WHERE listing_id = v_listing);

  BEGIN
    UPDATE public.mkt_listings SET status = 'pending' WHERE id = v_listing;
    RAISE NOTICE 'C) expired licence -> pending ALLOWED (BAD)';
  EXCEPTION WHEN others THEN RAISE NOTICE 'C) expired licence -> blocked: %', SQLERRM;
  END;

  UPDATE public.mkt_listing_licenses
     SET ad_license_expiry = current_date + 90, verification_status = 'valid'
   WHERE listing_id = v_listing;
  BEGIN
    UPDATE public.mkt_listings SET status = 'pending' WHERE id = v_listing;
    RAISE NOTICE 'D) valid licence -> pending allowed (GOOD)';
  EXCEPTION WHEN others THEN RAISE NOTICE 'D) valid licence -> blocked (BAD): %', SQLERRM;
  END;

  -- Publishing is reviewer-only; for the expiry test the audit lifts the review
  -- guards inside this transaction only, then puts them back.
  ALTER TABLE public.mkt_listings DISABLE TRIGGER mkt_listings_before_write;
  ALTER TABLE public.mkt_listings DISABLE TRIGGER mkt_listings_guard_status;
  UPDATE public.mkt_listings SET status = 'published', published_at = now() WHERE id = v_listing;
  ALTER TABLE public.mkt_listings ENABLE TRIGGER mkt_listings_before_write;
  ALTER TABLE public.mkt_listings ENABLE TRIGGER mkt_listings_guard_status;

  RAISE NOTICE 'E) publicly visible while valid: %', public.mkt_re_license_active(v_listing);
  UPDATE public.mkt_listing_licenses SET ad_license_expiry = current_date - 1
   WHERE listing_id = v_listing;
  RAISE NOTICE 'F) publicly visible after expiry: %', public.mkt_re_license_active(v_listing);
  SELECT public.mkt_expire_re_licenses() INTO v_cnt;
  RAISE NOTICE 'G) suspension job touched % ads; this ad status=%, licence=%, reason=%', v_cnt,
    (SELECT status FROM public.mkt_listings WHERE id = v_listing),
    (SELECT verification_status FROM public.mkt_listing_licenses WHERE listing_id = v_listing),
    (SELECT rejection_reason FROM public.mkt_listings WHERE id = v_listing);

  DELETE FROM public.mkt_listing_license_private WHERE listing_id = v_listing;
  DELETE FROM public.mkt_listing_licenses WHERE listing_id = v_listing;
  DELETE FROM public.mkt_listing_status_history WHERE listing_id = v_listing;
  DELETE FROM public.mkt_listings WHERE id = v_listing;
  RAISE NOTICE 'H) temporary audit rows left behind: %',
    (SELECT count(*) FROM public.mkt_listings WHERE id = v_listing);
END $$;