# إعادة تنظيم مسارات گحيل — دراسة وخطة

دراسة فقط، لا تنفيذ. كل ما يلي مقروء الآن من `src/routes/` (84 تعريف مسار) ومن `src/lib/routes-map.ts`.

## 1) خريطة المسارات الحالية

### أ. عام (زائر) — طبقة السوق `MarketShell`
| المسار | الوظيفة |
|---|---|
| `/` | الرئيسية (إعلانات + مجالات + قوالب متاجر) |
| `/search` | البحث والتصفية |
| `/categories/$slug` | صفحة مجال/تصنيف |
| `/ads/$slug` | صفحة إعلان |
| `/stores/$slug` | صفحة متجر عامة |
| `/businesses/$slug` | صفحة منشأة |
| `/u/$username` | ملف مستخدم عام |
| `/services` (+ `/services/`) | دليل الخدمات (المسار الأب طبقة، والمحتوى في `services.index`) |
| `/services/$slug/$itemId/book` | حجز خدمة |
| `/syria-guide` · `/student-tools` | محتوى مرجعي (دليل سوريا، أدوات الطلاب) |
| `/about` · `/help` · `/terms` · `/privacy` | صفحات ثابتة |
| `/contact` | **تحويل** إلى `/help#contact` |
| `/welcome` | صفحة تعريفية بالمنصة — محتواها يكرر `/` |
| `/demo` · `/demo-stores/$worldId` | بيئة تجريبية (noindex، محجوبة بعلم `LIVE_DEMO_VISIBLE`) |
| `/more` | قائمة «المزيد» للجوال (public في الخريطة لكنها تعرض إدارة حسابات) |

### ب. الدخول والانتقال (بلا طبقة)
`/auth` (دخول) · `/register` (تسجيل) · `/forgot-password` · `/reset-password` · `/invite/$token` (دعوة) · `/choose-account` (اختيار الحساب) · `/join` (طلب حساب بائع/مزوّد) · `/market-setup` (إكمال بيانات سوريا) · `/me` (تحويل ذكي حسب الهوية) · `/audit` (تحويل) · `/appointments` · `/business/new` · `/$` (معالج المسارات القديمة المركزي)

### ج. لوحة المستخدم `/dashboard/*` — `DashboardShell`
- حساب شخصي أو منشأة: `profile` · `notifications` · `messages` · `favorites` · `bookings` · `my-ads` · `points` · `ads/new` · `ads/$id/edit` · `requests` · `reports` · `reports/$id` · `violations`
- منشأة فقط (تشغيلي): `operations` · `orders` · `store/` · `store/new` · `store/catalog` · `network` · `service` · `service/settings` · `business`

### د. الإدارة `/admin/*` — `AdminShell`
`/admin` (طبقة + `index`) · `dashboard` (تحليلات) · `my-work` · `search` · `listings` + `listings_/$id` · `listing-events` · `listing-reports` · `reports` + `reports/$id` · `verifications` + `verifications_/$id` · `join-applications` · `businesses` + `businesses_/$id` · `users` + `users_/$id` · `stores` · `activities` · `geo` · `roles` · `content-rules` · `attendance` · `workforce` · `audit-log` · `settings`

## 2) تقييم التنظيم الحالي

**تكرار وتداخل**
- `/welcome` يكرر الرئيسية `/` بمحتوى تسويقي؛ لا رابط داخلي يقوده كصفحة أولى.
- `/contact` صفحة كاملة صارت مجرد تحويل، ومع ذلك ما زالت مسجّلة كـ `public` في الخريطة — تناقض يجعلها قابلة للظهور في التنقل والفهرسة.
- ثلاث بوابات دخول للأعمال: `/join` و `/business/new` (تحويل) و `/market-setup`؛ وثلاث بوابات تحويل ذكي: `/me` و `/audit` و `/$`.
- تقارير في مكانين بنفس الاسم: `/dashboard/reports` (بلاغاتي) و `/admin/reports` (البلاغات إدارياً) و `/admin/listing-reports` (بلاغات الإعلانات) — الفرق بين الأخيرين غير واضح من الاسم.
- `/admin` و `/admin/dashboard` و `/admin/my-work` ثلاث «نقاط بداية» للإدارة.

**أسماء لا تعكس الوظيفة**
- `/dashboard/requests` = طلبات عروض الأسعار (`mkt_quote_requests`) — الاسم عام ومورث من النظام القديم.
- `/dashboard/operations` = لوحة تشغيل المنشأة؛ اسم غامض للمستخدم.
- `/dashboard/network` = شبكة المزوّدين. `/dashboard/points` = المحفظة والنقاط. `/dashboard/violations` = المخالفات.
- `/dashboard/my-ads` مقابل `/dashboard/ads/new` — مساران لنفس الكيان باسمين مختلفين.
- `/u/$username` اختصار غير مفهوم.
- `/admin/geo` · `/admin/content-rules` · `/admin/listing-events` أسماء تقنية.
- بادئة `/dashboard` نفسها مورثة من لوحة «تحقّق» القديمة.

**التسلسل الهرمي**
- الفصل الأساسي سليم: عام → دخول → `/dashboard` → `/admin`، وطبقة `admin/route.tsx` تحمي فرعها، و`DashboardShell` يفرض الدخول والحساب النشط.
- لكن لا يوجد `dashboard/route.tsx` كطبقة أب: كل صفحة تستورد `DashboardShell` بنفسها، فالحماية متكررة لا مركزية، ولا يوجد `/dashboard` كصفحة (مسجّل legacy → `/me`).
- خلط في المستويات: `/join` و`/choose-account` و`/market-setup` و`/me` مسارات جذرية مع أنها كلها «انتقال بعد الدخول».
- المنشأة والحساب الشخصي يتشاركان نفس الفرع `/dashboard` دون تمييز في الرابط، والفصل يحدث فقط عبر `allowed_identity_types` في الخريطة.

**فراغات في خريطة المسارات (مهم)** — مسارات موجودة فعلاً وغير مسجّلة في `ROUTE_MAP`، فلا تحصل على قاعدة صلاحية ولا طبقة معلنة:
`/welcome` · `/forgot-password` · `/reset-password` · `/demo-stores/$worldId` · `/dashboard/violations` · `/admin/dashboard` · `/admin/my-work` · `/admin/search` · `/admin/attendance` · `/admin/workforce` · `/admin/content-rules` · وكل صفحات التفصيل `listings_/$id` · `businesses_/$id` · `users_/$id` · `verifications_/$id`.

**مسارات يتيمة أو شبه ميتة**
- `/welcome` (لا رابط داخلي يشير إليها كمدخل).
- `/demo` و `/demo-stores/$worldId` معطّلتان بعلم؛ تبقى فقط للعرض الداخلي.
- `/audit` و `/business/new` و `/appointments` ملفات مسار كاملة لمجرد تحويل، ويمكن استيعاب اثنين منها في `/$`.
- 40+ قاعدة `legacy` في الخريطة كلها من النظام القديم؛ عدّاد الاستخدام موجود (`logLegacyRoute`) لكن التخزين محلي في المتصفح فقط، فلا يمكن معرفة أي رابط قديم ما زال مستخدماً فعلياً.

**نقطة SEO حرجة**: كل التحويلات الحالية تحدث في المتصفح (`ssr: false` + `beforeLoad` + `redirect`)، وليست 301. جوجل لا يمرّر إشارات الفهرسة عبرها، والزاحف يرى صفحة فارغة أولاً. أي إعادة تسمية تحتاج تحويلاً على الخادم لتبقى الروابط المفهرسة سليمة.

## 3) الهيكل المقترح

المبدأ: **الرابط الظاهر يشرح نفسه** · فصل صريح بين ثلاث مناطق · مسار واحد لكل وظيفة · طبقة أب واحدة لكل منطقة.

```text
عام (SSR + فهرسة)
  /                         الرئيسية
  /search                   البحث
  /c/$slug        →  /categories/$slug   (يبقى كما هو)
  /ads/$slug                إعلان
  /stores/$slug             متجر
  /businesses/$slug         منشأة
  /profiles/$username       ملف عام            (بديل /u/$username)
  /services · /services/$slug/$itemId/book
  /guides/syria · /guides/students             (بديل /syria-guide · /student-tools)
  /about · /help · /terms · /privacy
  /more                     قائمة الجوال (noindex)

الدخول والانتقال  /account/*
  /auth · /auth/register · /auth/forgot · /auth/reset · /auth/invite/$token
  /account/choose           اختيار الحساب      (بديل /choose-account)
  /account/apply            طلب حساب بائع/مزوّد (بديل /join)
  /account/setup            إكمال بيانات سوريا (بديل /market-setup)
  /go                       تحويل ذكي واحد     (يستوعب /me + /audit)

لوحة الحساب  /my/*            (طبقة أب واحدة: دخول + حساب نشط)
  /my                       نظرة عامة (جديدة، تحل مكان /dashboard الميت)
  /my/profile · /my/notifications · /my/messages · /my/favorites
  /my/ads · /my/ads/new · /my/ads/$id/edit
  /my/bookings · /my/quotes            (بديل requests)
  /my/wallet                           (بديل points)
  /my/reports · /my/reports/$id · /my/violations

لوحة المنشأة  /business/*      (طبقة أب: حساب نشط من نوع business)
  /business                 لوحة التشغيل        (بديل operations)
  /business/profile         (بديل dashboard/business)
  /business/orders
  /business/store · /business/store/new · /business/store/catalog
  /business/services · /business/services/settings
  /business/partners        (بديل network)

الإدارة  /admin/*            (كما هي، مع توضيح أسماء)
  /admin                    نقطة واحدة (تدمج index + dashboard + my-work تبويبات)
  /admin/listings (+ /$id) · /admin/listings/events
  /admin/reports (+ /$id) · /admin/reports/listings   (بديل listing-reports)
  /admin/verifications (+ /$id) · /admin/applications (بديل join-applications)
  /admin/users (+ /$id) · /admin/businesses (+ /$id) · /admin/stores
  /admin/taxonomy (بديل activities) · /admin/locations (بديل geo)
  /admin/roles · /admin/moderation (بديل content-rules)
  /admin/staff/attendance · /admin/staff/workforce
  /admin/audit-log · /admin/settings · /admin/search
```

**قرار مطلوب قبل التنفيذ — شكل «الأسماء العربية-الودية»:**
1. **موصى به**: روابط لاتينية قصيرة مفهومة (`/my/quotes`, `/business/store`) وعنوان عربي واضح في الواجهة و`head()`. آمن للنسخ والمشاركة والفهرسة وبلا ترميز `%D8`.
2. روابط عربية حرفية (`/حسابي/عروض-الأسعار`). ممكنة تقنياً لكن تظهر مشفّرة في الواتساب والتحليلات، وتضاعف التحويلات.
3. هجين: عربي للمحتوى العام فقط (`/خدمات`) ولاتيني للوحات.

الشجرة أعلاه مكتوبة على الخيار 1؛ إن اخترت 2 أو 3 أعيد صياغتها قبل أي تنفيذ.

## 4) خطة التنفيذ المرحلية

**دفعة 0 — أساس التحويل الدائم (بدون أي تغيير مرئي)**
- إضافة تحويل 301 على الخادم لكل مسار قديم/متغيّر بدل التحويل في المتصفح، مع الحفاظ على `?query` و`#hash`.
- إضافة `canonical` لكل صفحة عامة.
- **الخطر**: منخفض؛ حلقة تحويل إن تعارضت قاعدة خادمية مع `beforeLoad`. **الاختبار**: كل مسار قديم يعيد 301 مرة واحدة إلى هدف يعيد 200.

**دفعة 1 — إغلاق فراغات الخريطة (بلا إعادة تسمية)**
- تسجيل الـ 15 مسارًا الناقص في `ROUTE_MAP` بقواعده الصحيحة، وتصحيح `/contact` إلى legacy و`/more` إلى authenticated-ish حسب محتواها الفعلي.
- **الخطر**: منخفض–متوسط؛ قاعدة أضيق مما يجب تخفي رابطاً في التنقل. **الاختبار**: فتح كل مسار بأربع هويات (زائر/فرد/منشأة/إدارة).

**دفعة 2 — طبقات أب مركزية**
- `dashboard/route.tsx` (لاحقاً `my/route.tsx`) و`business/route.tsx` تحملان الحماية والصدفة مرة واحدة، وتُنظّف الصفحات من تكرار `DashboardShell`.
- **الخطر**: متوسط؛ خطأ في الطبقة يعطّل كل الفرع. **الاختبار**: كل صفحة داخل الفرع + تحديث الصفحة + رجوع المتصفح.

**دفعة 3 — تنظيف الميت**
- حذف `/welcome` (أو دمج أقسامها المفيدة في `/`) و`/contact` كملف، وإلغاء ملفي `/appointments` و`/business/new` لصالح `/$`، وتوحيد `/me` + `/audit` في `/go`.
- **الخطر**: منخفض بشرط أن يسبقها 301. **الاختبار**: الروابط القديمة كلها تصل لهدف صحيح.

**دفعة 4 — إعادة تسمية منطقة الحساب** `/dashboard/* → /my/*` + فصل `/business/*`
- الأكبر: تغيير أسماء ملفات، وتحديث كل `<Link to>` و`navigate` و`add-listing.ts` و`more-menu.ts` و`session`/`me` والأهداف بعد الدخول.
- **الخطر**: عالٍ؛ أي رابط منسي يسقط في 404، وروابط `next=` المحفوظة قد تشير للقديم. **التقليل**: 301 من الدفعة 0 يغطي القديم، ومنع دمج أي `to="/dashboard`. **الاختبار**: بحث نصي شامل لصفر إشارة للمسارات القديمة + جولة Playwright على كل صفحة.

**دفعة 5 — إعادة تسمية العام** (`/u` → `/profiles`، `/syria-guide` → `/guides/syria`)
- **الخطر**: عالٍ على SEO — هذه هي الروابط المفهرسة والمشاركة. **التقليل**: 301 + `canonical` + إبقاء القديم عاملاً بلا حد زمني. **الاختبار**: فحص فهرسة بعد النشر.

**دفعة 6 — تسمية الإدارة**
- داخلي بالكامل، لا أثر SEO. **الخطر**: منخفض. **الاختبار**: تنقل `AdminShell` + الصلاحيات.

**دفعة 7 — إغلاق**
- تحديث `src/routes/README.md` وخريطة الروابط، وسجل خادمي لعدد طلبات المسارات القديمة (بدل التخزين المحلي) لتقرير التقاعد لاحقاً.

## تفاصيل تقنية

- المصدر الوحيد للصلاحيات يبقى `src/lib/routes-map.ts`؛ قاعدة البيانات (RLS + `has_perm` + `mkt_account_context`) تبقى الجهة الوحيدة التي تمنح، ولا شيء في الخطة يمسّها.
- التحويل الدائم يحتاج مسارات خادمية (`server.handlers`) أو معالجة على الحافة، لأن `beforeLoad` مع `ssr:false` تحويل عميل لا 301.
- إعادة التسمية تتم بنقل ملفات وتحديث سلسلة `createFileRoute` المطابقة للاسم؛ `src/routeTree.gen.ts` يُعاد توليده تلقائياً ولا يُحرَّر.
- لا تغيير في قاعدة البيانات ولا في المخطط ولا في التخزين في أي دفعة.
- حظر الـ canonical guard يبقى موقوفاً كما هو؛ لا شيء هنا يعدّله.
