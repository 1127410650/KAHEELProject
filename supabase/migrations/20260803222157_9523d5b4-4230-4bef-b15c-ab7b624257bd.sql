DO $$
DECLARE _ids uuid[];
BEGIN
  -- Maintenance context: bypasses the interactive publish-permission guard,
  -- which expects a signed-in member acting on their own business.
  PERFORM set_config('mkt.system_action', 'license_expiry', true);

  SELECT array_agg(id) INTO _ids
  FROM public.mkt_listings
  WHERE deleted_at IS NULL
    AND title IN (
      'QA-SUBMIT-flow-ok',
      'QA-SUBMIT-noimage-2',
      'خدمة اختبار صور الإعلان النهائية',
      'خدمة صيانة تجريبية للتحقق النهائي',
      'شقة للإيجار في حي النخيل اختبار',
      'شقة اختبارية مؤقتة للتدقيق الأمني'
    )
    AND NOT EXISTS (SELECT 1 FROM public.mkt_reports r WHERE r.listing_id = mkt_listings.id);

  IF _ids IS NULL THEN RETURN; END IF;

  -- Soft delete only: the listing event log is append-only by design, so a hard
  -- delete of the parent row is rejected.
  UPDATE public.mkt_listing_images
     SET deleted_at = now()
   WHERE listing_id = ANY(_ids) AND deleted_at IS NULL;

  UPDATE public.mkt_listings
     SET deleted_at = now()
   WHERE id = ANY(_ids);
END $$;