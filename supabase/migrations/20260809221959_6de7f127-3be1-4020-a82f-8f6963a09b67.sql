CREATE OR REPLACE FUNCTION public.mkt_guide_provider_category(_sector text, _category text, _subcategory text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN blob ~ 'مطعم|مقهى|كافي|مطبخ' THEN 'restaurant'
    WHEN blob ~ 'صيدل' THEN 'pharmacy'
    WHEN blob ~ 'عياد|مستشف|مركز صحي|مخبر|أسنان' THEN 'clinic'
    WHEN blob ~ 'طبيب|مختص' THEN 'doctor'
    WHEN blob ~ 'تعليم|مدرس|جامع|معهد|تدريب|حضان' THEN 'education_training'
    WHEN blob ~ 'بقال|سوبرماركت|مقاضي' THEN 'grocery'
    WHEN blob ~ 'عقار|وساطة' THEN 'real_estate'
    WHEN blob ~ 'صيانة|مقاول' THEN 'maintenance'
    WHEN blob ~ 'شحن|نقل' THEN 'shipping_company'
    WHEN blob ~ 'صالون|تجميل|حلاق' THEN 'salon_spa'
    ELSE 'other'
  END
  FROM (SELECT coalesce(_sector,'')||' '||coalesce(_category,'')||' '||coalesce(_subcategory,'') AS blob) s
$$;

CREATE OR REPLACE FUNCTION public.mkt_guide_review_claim(_claim_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mkt_guide_place_claims;
  v_place public.mkt_guide_places;
  v_code text;
  v_type text;
  v_slug text;
  v_store uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_row FROM public.mkt_guide_place_claims WHERE id = _claim_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CLAIM_NOT_FOUND';
  END IF;

  UPDATE public.mkt_guide_place_claims
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         reject_reason = CASE WHEN _approve THEN NULL ELSE _reason END
   WHERE id = _claim_id;

  -- On approval: give the owner a draft provider page matching the entity's category.
  IF _approve THEN
    SELECT * INTO v_place FROM public.mkt_guide_places WHERE id = v_row.place_id;
    IF v_place.id IS NOT NULL THEN
      v_code := public.mkt_guide_provider_category(v_place.sector, v_place.category, v_place.subcategory);
      SELECT default_store_type INTO v_type
        FROM public.mkt_provider_categories WHERE code = v_code;

      v_slug := left(coalesce(v_place.slug, 'kaheel'), 48) || '-' || left(replace(v_row.id::text, '-', ''), 6);

      IF NOT EXISTS (
        SELECT 1 FROM public.mkt_storefronts
        WHERE owner_user_id = v_row.user_id AND slug = v_slug
      ) THEN
        INSERT INTO public.mkt_storefronts (
          owner_user_id, store_type, slug, name_ar, name_en,
          address_text, district, status, verification_status, currency_code, draft_step
        ) VALUES (
          v_row.user_id, coalesce(v_type, 'mixed'), v_slug, v_place.name_ar, v_place.name_en,
          v_place.address, v_place.district, 'draft', 'none', 'SAR', 1
        )
        RETURNING id INTO v_store;

        INSERT INTO public.mkt_provider_profiles (storefront_id, category_code, created_by)
        VALUES (v_store, v_code, v_row.user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  PERFORM public.mkt_notify(
    v_row.user_id,
    NULL,
    CASE WHEN _approve THEN 'guide_claim_approved' ELSE 'guide_claim_rejected' END,
    CASE WHEN _approve THEN 'تم اعتماد مطالبتك بالجهة' ELSE 'لم تُعتمد مطالبتك بالجهة' END,
    CASE WHEN _approve THEN 'أُنشئت لك صفحة مقدّم خدمة بحالة مسوّدة حسب تصنيف جهتك — أكملها لتديروا الصور والوصف وأوقات العمل والعروض والردّ على التقييمات، وتُنشر بعد مراجعة الإدارة.'
         ELSE 'السبب: ' || COALESCE(_reason, 'لم تكفِ الإثباتات') END
  );
END;
$$;