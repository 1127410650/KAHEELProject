ALTER TABLE public.mkt_listings DISABLE TRIGGER USER;

INSERT INTO public.mkt_listings (
  id, owner_user_id, tenant_id, type_code,
  category_id, subcategory_id, title, slug, summary, description,
  price, price_on_request, currency, duration_days,
  country_id, city_id, city, region, status, published_at, expires_at,
  keywords, qa_batch_id, specs, location_visibility, moderation_state
)
SELECT
  'a0000000-0000-4000-8000-000000000041',
  l.owner_user_id, l.tenant_id, 'service',
  'b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94',
  '7fb68939-f327-4180-a978-fb707a162a55',
  'إعلان تجريبي: مدرسة أهلية في الرياض',
  'اعلان-تجريبي-مدرسة-اهلية-في-الرياض-a00041',
  'إعلان تجريبي لاختبار مجال مدارس وجامعات',
  'هذا إعلان تجريبي أُنشئ لاختبار واجهات السوق فقط، ولا يمثل مدرسة أو جهة حقيقية، ولا يُقصد به عرض خدمة فعلية.',
  1500, false, l.currency, 7,
  l.country_id, l.city_id, l.city, l.region,
  'published', now(), now() + interval '7 days',
  ARRAY['تجريبي','qa','مدارس'],
  'qa-listings-2026-08-04-v1', '{}'::jsonb, 'approximate', 'clean'
FROM public.mkt_listings l
WHERE l.id = 'a0000000-0000-4000-8000-000000000010'
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mkt_listings ENABLE TRIGGER USER;