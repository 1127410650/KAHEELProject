# تقرير جرد — الدفعة 3 (جرد فقط، بدون أي تنفيذ)

لم يُعدَّل أو يُحذف أي ملف في هذه المهمة، ولم تُلمس قاعدة البيانات. كل رقم أدناه من قراءة فعلية للمستودع أو من استعلام على القاعدة.

المسح: 79 ملفًا في `src/routes` (منها 78 مسارًا + `README.md`)، مع عدّ كل إشارة نصية داخل `src/` خارج ملف المسار نفسه وخارج `routes-map.ts` و`routeTree.gen.ts`.

## 1) جرد المسارات المشتبه بها

| المسار | الملف | في ROUTE_MAP / 301 | الإشارات في الكود | وصول من الواجهة | جدول أو حاوية | التصنيف | مخاطر الحذف |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/me` | **لا ملف** | نعم / نعم → `/go` (302 غير قابل للتخزين) | 0 | لا | لا | تحويل فقط — لا شيء ليُحذف | حذف القاعدة يُنتج 404 لروابط قديمة |
| `/audit` | **لا ملف** | نعم / نعم → `/go?next=audit-log` (302) | 0 | لا | لا | تحويل فقط | نفس ما سبق |
| `/demo` | `routes/demo.tsx` | نعم / لا | 2: `MarketHome.tsx:316`، `MarketShell.tsx:345` | **نعم** — بطاقة «البيئة التجريبية» في الرئيسية | **صفر** — لا `.from(` ولا `supabase` في `demo.tsx` ولا `live-demo.ts` | **حيّ يُستخدم** | كسر زر ظاهر للزوار في الرئيسية |
| `/demo-stores/$worldId` | `routes/demo-stores.$worldId.tsx` | نعم / لا | 2: `LiveDemoEnvironment.tsx:175`، `MarketShell.tsx:357` | فقط من داخل `/demo` | **صفر** — `demo-store-worlds.ts` ثابت | **حيّ (تابع لـ `/demo`)** | تعطيل روابط داخل `/demo` |
| `/categories/$slug` | `routes/categories.$slug.tsx` | نعم / لا (وهو **هدف** توحيد «عقار ديل») | 0 داخلة (يشير لنفسه فقط) | لا زر ولا قائمة | **يقرأ** `mkt_countries` + `mkt_listings` (قراءة فقط) | **مشكوك فيه — لا يُحذف** | صفحة عامة مفهرسة وهدف canonical؛ الحذف يكسر SEO |
| `/my/quotes` | `routes/my/quotes.tsx` | نعم / نعم من `/dashboard/requests` | 1: `more-menu.ts:67` (أُضيف في الدفعة السابقة) | **نعم الآن** | **يقرأ** `mkt_quote_requests` | **حيّ ومكتشَف** | فقدان شاشة عروض الأسعار الوحيدة |
| `/invite/$token` | `routes/invite.$token.tsx` | نعم / لا | 0 | لا (يأتي من بريد الدعوة) | يقرأ/يكتب الدعوات | **حيّ** | كسر الدعوات |
| `/reset-password` | `routes/reset-password.tsx` | نعم / لا | 1: `forgot-password.tsx` | لا (رابط بريد Supabase) | جلسة Supabase | **حيّ** | كسر استعادة كلمة المرور |
| `/admin/{listings,users,businesses,verifications}_/$id` | ملفات `_.$id` | نعم / لا | 0 لصيغة `_/` | نعم (من جداول الإدارة بالـ URL النظيف) | نعم | **حيّ** — صفر الإشارات فرق صياغة لا موت | لا شيء؛ ليست ميتة |
| بقية `/admin/*` (12 مسارًا) | `routes/admin/*` | نعم / لا | 1 لكل واحد: `AdminShell.tsx` | نعم | نعم | **حيّ** | — |
| `/$` (splat) | `routes/$.tsx` | يحلّ كل التحويلات | — | — | لا | **حيّ وحرج** | تعطيل كل الروابط القديمة والـ 404 الحقيقي |

**النتيجة: لا يوجد اليوم أي مسار «ميت مؤكد».** المكوّنات السبعة الميتة التي رصدها جرد أمس (`MarketCategoryTiles`, `MarketDemoListings`, `MarketDemoShowcases`, `MarketFeaturedBanner`, `MarketStoreTemplates`, `MarketStorefrontHero`, `SyriaUtilityHub`) **حُذفت فعلًا** في الدفعة السابقة؛ المجلد `components/marketplace/home/` يحتوي الآن على 3 ملفات حيّة فقط. `demo` و`me` و`audit` ليست مرشحة للحذف لأسباب مختلفة موضّحة أعلاه.

## 2) تحذير Hydration

**تم إصلاحه، والقياس الحالي صفر.**

- المصدر الأصلي: `src/routes/__root.tsx` — دالة `useShellScope` كانت تقرأ `window.location.pathname` داخل الرندر (فرع خادم/عميل)، فيرسل الخادم `class="market-surface …"` بينما يحسب العميل `""` على مسارات `/admin/*` → اختلاف `className`.
- الإصلاح المطبَّق (سطر واحد، بلا إعادة هيكلة) في `__root.tsx:41`: `useRouterState({ select: (state) => state.location.pathname })` — نفس القيمة على الجانبين.
- قياس اليوم في المتصفح: `/`, `/demo`, `/more`, `/admin`, `/admin/users`, `/my/ads`, `/business/orders` → **صفر تحذير** على كل واحد منها.

**ملاحظة واحدة تحتاج تحققًا في الإنتاج (لا إصلاحًا الآن):** أول طلب لمسار محمي بعد إعادة تشغيل خادم التطوير رسم الصفحة مرة واحدة قبل أن يعمل الحارس، ثم صار يحوّل إلى `/auth` في كل الطلبات التالية. سلوك متوقع من تحميل الوحدات البارد في `vite dev`، لكنه يجب أن يُقاس على نسخة منشورة قبل اعتباره غير موجود.

## 3) فحص سلامة الحارس (Structure Guard)

المصدر: `public.structure_guard_ddl()` — `SECURITY DEFINER`, `search_path = public`, مرتبط بـ `ddl_command_end` وبالوسمين `CREATE TABLE`, `CREATE SCHEMA` فقط، والحالة `enabled`.

- **مقيّد بمخطط public؟ نعم لجداول الجداول:** شرط `cmd.schema_name = 'public'` يعني أن `auth`, `storage`, `extensions`, `realtime`, `cron`, `supabase_*` **لا تتأثر** بقاعدة البادئة `mkt_`.
- **لكن فرع `CREATE SCHEMA` غير مقيّد إطلاقًا:** أي `CREATE SCHEMA` من أي فاعل يُرفض، بما في ذلك ترحيلات منصة Supabase أو تثبيت امتداد ينشئ مخططه الخاص. هذه **أخطر ملاحظة في التقرير**: احتمال تعطيل ترقية منصة لا علاقة لها بنا. العلاج المقترح (لاحقًا، بموافقتك): استثناء أدوار المنصة (`supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`) وقائمة مخططات الامتدادات المعروفة، مع الإبقاء على الرفض لأي مخطط تطبيقي جديد.
- **هل `guard:structure` يوقف النشر؟ لا.** `package.json`: `build` = `vite build` فقط، و`guard:structure` = `node scripts/check-structure.mjs` أمر مستقل. لا استدعاء له في `vercel.json` ولا في أي workflow (`canonical-repository.yml` يستدعي `guard:canonical` وحده). فحص الحارس اليوم: OK — 282 ملفًا، 64 مرجع جدول، الحاويات محصورة بـ `mkt-media`, `mkt-chat`.
- **أمر التعطيل الطارئ** (بحساب مسؤول المنصة، مؤقت وينتهي تلقائيًا):

```sql
select public.structure_guard_disable('سبب مشروع مكتوب', 30);
-- ثم بعد الانتهاء فورًا:
select public.structure_guard_enable();
```

الدوال المتاحة: `structure_guard_disable`, `structure_guard_enable`, `structure_guard_is_enabled`, `structure_guard_allows_table`, `structure_guard_allows_bucket`, `structure_guard_log_rejection`، وسجل `mkt_structure_guard_events`.

## ترتيب تنفيذ آمن مقترح (عند موافقتك، كل خطوة قابلة للتراجع وحدها)

1. **تقييد فرع `CREATE SCHEMA` في الحارس** — الخطوة الوحيدة العاجلة فعلًا: استثناء أدوار منصة Supabase ومخططات الامتدادات. تحقق: محاولة `create schema app_x` تُرفض، و`create table public.foo` تُرفض، و`create table public.mkt_foo` تُقبل، ثم إسقاطها.
2. **إظهار `/categories/$slug` أو تحويله** — قرارك: إما ربطه من صفحة التصنيفات ليصبح مكتشَفًا، أو 301 إلى `/search?category=…`. لا حذف بأي حال (هدف canonical مفهرس).
3. **قياس تحذير Hydration على نسخة منشورة** — تأكيد الصفر خارج `vite dev`، خصوصًا أول طلب لمسار محمي.
4. **مراقبة سجل `[legacy-route]`** — تقاعد أي قاعدة legacy يُقرَّر من حركة حقيقية بعد فترة مراقبة، لا الآن.
5. **إبقاء `/demo` و`/demo-stores` كما هما** — أو حذف الحزمة كوحدة واحدة إن قررت إيقاف العرض العام (يشمل `demo.tsx`, `demo-stores.$worldId.tsx`, `LiveDemoEnvironment.tsx`, `live-demo.ts`, `demo-store-worlds.ts`, بطاقة الرئيسية، وقاعدتَي ROUTE_MAP). حذف واحد منهما فقط يُنتج روابط مكسورة.

### ما يحتاج أرشفة قبل الحذف

- **لا شيء في هذه الدفعة**: لا مرشّح حذف قائم. المكوّنات السبعة حُذفت أمس ونسختها في تاريخ Git.
- **لا شيء يحتاج أرشفة بيانات**: أيٌّ من الصفحات المشتبه بها لا يملك جدولًا ولا حاوية تخزين خاصة به؛ `/categories/$slug` و`/my/quotes` **يقرأان** جداول مشتركة ولا يكتبان فيها. حزمة `/demo` بيانات ثابتة في الكود بصفر لمسة لقاعدة البيانات.
