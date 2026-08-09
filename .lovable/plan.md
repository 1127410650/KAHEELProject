# جرد كامل قبل التنظيف — قاعدة البيانات والمشروع

لم يُعدّل أي شيء. كل رقم أدناه مقروء الآن من قاعدة الإنتاج `rgpnhzovtceitqxpiilf` ومن ملفات الكود.

## 1) صورة عامة

- جداول `public`: 190 جدولًا (منها 111 تبدأ بـ `mkt_`).
- RLS مُفعّل على **كل** الجداول. جدول واحد فقط بلا أي سياسة: `rate_events` (RLS مفعّل + 0 سياسة ⇒ مغلق فعليًا لكل الأدوار).
- حاويات التخزين: 5.

## 2) جداول النظام القديم (تحقّق) غير المستخدمة في گحيل

مجموعة كاملة لا يستدعيها كود گحيل ولا أي سياسة/دالة `mkt_*` (الأعداد = صفوف فعلية):

| المجموعة | الجداول | الصفوف |
|---|---|---|
| المشاريع | `projects` 24، `project_members` 6، `project_supervisors` 5، `supervisors` 31 | 66 |
| الطلبات | `requests` 38، `request_status_history` 89، `request_messages` 10، `request_reminders` 5، `request_message_reads` 0، `request_change_requests` 0، `request_field_versions` 0 | 142 |
| العهدة | `custody_transactions` 28 | 28 |
| الفواتير | `invoices` 2، `invoice_line_items` 2، `invoice_status_history` 3، `invoice_verifications` 1 | 8 |
| الموردون والمنتجات | `suppliers` 3، `unified_products` 0، `product_catalog` 0، `product_aliases` 0، `product_price_history` 0، `product_unit_conversions` 0 | 3 |
| الملف العقاري | 17 جدول `property_*` | **0 كلها** |
| تحليل المستندات | `document_analyses`، `document_analysis_runs`، `document_analysis_fields`، `document_analysis_conflicts` | **0 كلها** |
| المواعيد (نموذج مستقل) | 12 جدول `appt_*` | **0 كلها** |
| مرافق قديمة | `attachments` 3، `audit_log` 602، `app_settings` 5، `login_attempts` 2، `rate_events` 8، `profile_private_details` 0، `account_link_reviews` 9 | 629 |

نقاط ربط يجب الانتباه لها قبل أي حذف:
- `tenants` ليست جدولًا قديمًا: 18 مفتاحًا أجنبيًا من جداول `mkt_*` تشير إليها، و24 دالة `mkt_*` تستعملها. **تبقى.**
- 71 مفتاحًا أجنبيًا يشير إلى `tenants`، و25 إلى `projects`، و10 إلى `requests`. أي حذف يجب أن يكون بترتيب التبعية أو بـ `CASCADE` محسوب.
- `notifications` (54 صفًا) جدول النظام القديم؛ گحيل تستخدم `mkt_notifications` (95 صفًا). لا يوجد `from("notifications")` في الكود، لكن 9 دوال قديمة تكتب فيه — يحتاج تأكيدًا قبل الحذف.

## 3) الجداول المستخدمة فعليًا في گحيل

- كل `mkt_*` الفعّالة: `mkt_listings` 66، `mkt_listing_images` 64، `mkt_activities` 141، `mkt_categories` 93، `mkt_cities` 110، `mkt_storefronts` 4، `mkt_store_items` 6، `mkt_conversations`/`mkt_messages`، `mkt_reports`، `mkt_notifications`، `mkt_analytics_events` 1701، `mkt_syria_*` (6677 + 895 + 105)، إلخ.
- الجداول المشتركة التي تخدم گحيل ولا تُحذف: `profiles` 100، `user_roles` 9، `user_permissions` 46، `tenants` 112، `tenant_memberships` 87، `tenant_invitations` 18.
- 31 جدول `mkt_*` بـ 0 صف (سلة/مكالمات/دمج أنشطة…) — ميزات مبنية غير مستعملة بعد، ليست بقايا قديمة.

## 4) المسارات في الكود

- گحيل — عام: `/`، `/search`، `/categories/$slug`، `/ads/$slug`، `/u/$username`، `/businesses/$slug`، `/stores/$slug`، `/services*`، `/demo*`، `/syria-guide`، `/student-tools`، `/about`،`/help`،`/terms`،`/privacy`،`/contact`، `/auth`، `/register`، `/forgot-password`، `/reset-password`، `/invite/$token`.
- گحيل — لوحات: 16 مسار `/dashboard/*`، و`/admin/*` (24 مسارًا)، `/choose-account`، `/join`، `/me`، `/more`، `/market-setup`، `/welcome`.
- قديم/إعادة توجيه فقط: `/audit` (يحوّل إلى `/admin/audit-log` أو `/me`)، `/appointments` (يحوّل إلى `/services`)، `/business/new`، والمسارات القديمة كلها (`/projects`, `/requests`, `/invoices`, `/custody`, `/supervisors`, `/verify-invoice` …) لم تعد ملفات مستقلة بل تُحل عبر `src/routes/$.tsx` و`src/lib/routes-map.ts`.
- ملفات كود قديمة غير مربوطة بأي مسار (يتيمة): `src/appointments/*` (4 ملفات، `AppointmentsApp` غير مستورد)، `src/components/InvoiceVerifier.tsx` + `src/lib/invoice-parse.ts`/`invoice-save.ts`/`invoice-scan.ts`/`zatca.ts`/`pdf-extract.ts` (تستورد بعضها فقط)، `src/lib/requests.ts`، `src/lib/project-link.ts` (غير مستورد إطلاقًا).
- `/dashboard/requests` اسم قديم لكن يقرأ `mkt_quote_requests` — مسار گحيل، لا يُلمس.

## 5) حالة RLS

- 190/190 جدولًا بـ RLS مُفعّل؛ لا جدول مكشوف بلا حماية.
- القراءة العامة (`anon`) ممنوحة لـ 26 جدولًا، وكلها محتوى عام مقصود ومقيّد: `mkt_listings`، `mkt_listing_images`، `mkt_categories`، `mkt_cities`، `mkt_countries`، `mkt_activities`، `mkt_user_profiles` و`mkt_business_profiles` بشرط `is_published`، ودليل سوريا.
- ثلاث سياسات `anon` بشرط `true` (بلا فلترة): `mkt_activity_aliases`، `mkt_syria_technical_institutes`، `mkt_syria_university_programs` — بيانات مرجعية عامة، مقبول لكنه يستحق مراجعة صريحة.
- `mkt_join_applications` + مستنداتها + أحداثها: سياسة `USING (false)` لكل الأدوار (يمر عبر دوال آمنة فقط) — سليم.
- جداول `appt_*` (0 صف) تمنح `anon` قراءة الدلائل — نموذج مواعيد غير مستخدم؛ تُغلق مع تقاعده.
- `rate_events`: 0 سياسة ⇒ لا يقرأ منه أحد عبر الـ API؛ لا حاجة لسياسة إن كان سيُحذف.

## 6) حاويات التخزين

| الحاوية | عام؟ | كائنات | الحجم | المحتوى |
|---|---|---|---|---|
| `mkt-media` | لا | 27 | 5.7 MB | صور إعلانات گحيل ومتاجرها — **مستخدمة** |
| `mkt-chat` | لا | 2 | 87 KB | مرفقات المحادثات — **مستخدمة** |
| `attachments` | لا | 8 | 1.8 MB | مرفقات النظام القديم (طلبات/مشاريع) |
| `invoice-files` | لا | 0 | 0 | فواتير النظام القديم — فارغة |
| `database_export_06_08_26` | لا | 0 | 0 | حاوية تصدير مؤقتة — فارغة |

## 7) التنظيف المقترح لاحقًا (للموافقة عليه في دفعة منفصلة)

1. **دفعة صفرية المخاطر**: حذف الجداول الفارغة تمامًا (17 `property_*` + 4 تحليل مستندات + 12 `appt_*` + 4 منتجات) وحذف الحاويتين الفارغتين، وحذف ملفات الكود اليتيمة أعلاه.
2. **دفعة تحتاج أرشفة أولًا**: `projects`/`requests`/`custody_transactions`/`invoices`/`supervisors`/`suppliers`/`attachments`/`audit_log`/`notifications` — تصدير CSV لكل جدول إلى `/mnt/documents/` قبل الحذف، ثم حذف بترتيب التبعية، ثم حذف الدوال والمشغّلات المرتبطة فقط بها.
3. **لا تُلمس**: `profiles`، `user_roles`، `user_permissions`، `tenants`، `tenant_memberships`، `tenant_invitations`، وكل `mkt_*`، وحاويتا `mkt-media`/`mkt-chat`.
4. تحقق بعد كل دفعة: تشغيل الـ linter، فتح الرئيسية + إعلان + لوحة الحساب + `/admin` والتأكد من صفر أخطاء وحدة التحكم.

## تفاصيل تقنية

- الأعداد من `pg_stat_user_tables.n_live_tup`؛ RLS والسياسات من `pg_class.relrowsecurity` و`pg_policies`؛ التبعيات من `pg_constraint` و`pg_proc.prosrc`؛ التخزين من `storage.buckets`/`storage.objects`.
- عدّاد «دوال تشير إلى الجدول» يعتمد مطابقة نصية داخل نص الدالة، فقد يشمل تطابقات جزئية (مثل `requests` داخل `mkt_quote_requests`)؛ سيُتحقق منها جدولًا بجدول قبل أي حذف.
- يظل حظر الـ canonical guard كما هو؛ لا شيء في هذا الجرد يعدّله.
