SELECT set_config('mkt.system_action', 'license_expiry', true);

UPDATE public.mkt_listings
SET status = 'deleted', published_at = NULL
WHERE (title ILIKE '%QA%'
   OR title ILIKE '%اختبار%'
   OR title ILIKE '%تجريب%'
   OR title ILIKE '%للتدقيق%'
   OR title ILIKE '%مؤقتة%')
  AND status <> 'deleted';