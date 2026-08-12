# هجرتان محليتان لم تُطبَّقا على الإنتاج (نُقلتا من supabase/migrations)

- 20260808202325_866d8e36-…: تعريف `public.mkt_can_review_identity_for(uuid)` و`mkt_log_registry_review(uuid)`
  وإعادة تعريف سياسة `mkt_business_registry_read` بصيغة أضيق.
- 20260808202353_3cadaddd-…: REVOKE/GRANT للدالتين أعلاه و`mkt_call_signals_purge_expired()`.

إثبات قراءة-فقط من الإنتاج (12/08/2026):
- `public.mkt_can_review_identity_for(uuid)` **غير موجودة** في الإنتاج.
- سياسة الإنتاج الحالية: `mkt_business_registry_read = (mkt_can_manage_business(tenant_id) OR mkt_can_review_identity())`.

لذلك النسختان غير مسجَّلتين في سجل الإنتاج وأثرهما غير موجود. إبقاؤهما داخل
`supabase/migrations` كان يجعل أي بناء جديد **يختلف** عن الإنتاج (3 دوال زائدة + سياسة مختلفة).
نُقلتا هنا للحفظ. تبنّيهما يتطلب كتابة على الإنتاج بموافقة المالك الصريحة.
