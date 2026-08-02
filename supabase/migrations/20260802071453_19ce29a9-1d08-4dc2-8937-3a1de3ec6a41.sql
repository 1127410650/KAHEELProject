insert into public.mkt_listings (owner_user_id, tenant_id, type_code, category_id, title, summary, description, price, price_on_request, city, status, published_at)
select l.owner_user_id, null, l.type_code, l.category_id,
       'QA-SEED إعلان اختبار ' || g, 'ملخص اختبار ' || g, 'وصف اختبار ' || g,
       (1000 + g * 10)::numeric, false, 'الرياض', 'published', now() - (g || ' minutes')::interval
from generate_series(1, 45) g
cross join lateral (select owner_user_id, type_code, category_id from public.mkt_listings order by created_at limit 1) l;