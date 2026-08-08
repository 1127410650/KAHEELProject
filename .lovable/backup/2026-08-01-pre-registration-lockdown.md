# نقطة استعادة قبل مرحلة «إزالة حواجز النشر الأمنية»

- **اسم النسخة**: `pre-registration-lockdown-2026-08-01T14:54Z`
- **وقت الإنشاء**: 2026-08-01 14:54:57 UTC (17:54 Asia/Riyadh)
- **Commit الثابت قبل الإصلاح**: `d7fe207`
- **Supabase project ref**: retired; the only current canonical project is
  `KAHEELProject` (`rgpnhzovtceitqxpiilf`).

## بصمة القاعدة وقت النسخة

| البند | العدد |
|---|---|
| جداول public | 55 |
| سياسات RLS في public | 194 |
| دوال public | 130 |
| tenants | 93 |
| مستخدمو Auth | 40 |

قائمة الجداول والدوال والسياسات والمشغّلات (425 سطرًا) استُخرجت وقت النسخة من
`pg_policies` / `pg_proc` / `pg_trigger` وهي قابلة لإعادة الاستخراج بنفس الاستعلام
للمقارنة بعد التنفيذ.

## طريقة Rollback

1. الكود: `git revert` لـ commits ما بعد `d7fe207` (أو الرجوع إلى `d7fe207`).
2. القاعدة: كل تغيير في هذه المرحلة يمر عبر migration واحدة قابلة للعكس
   (إعادة تعريف `ensure_personal_tenant` بنسختها المنشئة، وحذف مشغّل تدقيق
   إنشاء tenants، وإعادة `GRANT EXECUTE` إن لزم).
3. لا تُحذف أو تُدمج أي tenant في هذه المرحلة، ولا تُعدّل بيانات المشاريع أو
   الطلبات أو العهدة أو الفواتير، لذا لا يحتاج Rollback إلى استعادة بيانات.
