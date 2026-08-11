# كَحيل — استوديو المحتوى والتحليلات (تنفيذ الأمر التكميلي)

المرجع: `.lovable/orders/2026-08-11-content-studio-analytics-order.md` (1016 سطرًا) + الملحق الملزم (PART 3).
الحالة: التنفيذ جارٍ — الدفعات 1→9 بالتسلسل. لا نشر (No Publish).

---

## الدفعة 1 — الجرد وخريطة التكامل (مغلقة)

### 1.1 ما هو موجود فعلًا ويُعاد استخدامه (لا تكرار)

| الطبقة | الموجود | القرار |
| --- | --- | --- |
| رموز التصميم (§8) | `mkt_theme_settings`, `mkt_theme_palettes`, `mkt_theme_audit`, شاشة «ألوان المنصة» مع حارس التباين واللوحات المحفوظة | يُوسَّع بالخطوط/سلّم الحجم/الاستدارات/الظلال/التباعد + دورة مسودة→معاينة. لا نظام رموز ثانٍ. |
| مؤلّف الصفحات (§6–7، §12) | `/admin/composer`, `mkt_page_blocks`, `mkt_page_compositions`, `mkt_page_variants`, `mkt_custom_blocks`, `src/lib/mkt-page-composer.ts`, `mkt-page-variants.ts`, `mkt-custom-blocks.ts`, `components/marketplace/composer/PageBlocks.tsx` | سجل المكوّنات الوحيد = سجل الكتل الحالي في `PageBlocks.tsx`؛ يُوسَّع فقط. الصفحات العامة الجديدة باسم `mkt_cms_*`. |
| الحملات (§13) | `mkt_ad_campaigns`, `mkt_ad_campaign_events`, `/admin/campaigns` (ظهور/نقر/CTR) | تُضاف المواضع والتقويم ودورة الاعتماد والبدائل فوقها. لا جدول حملات ثانٍ (اختبار 69). |
| الاستوديو الإبداعي | `mkt_canvas_designs`, `mkt_design_templates`, `/admin/studio/canvas` | يبقى أداة توليد إبداعي تغذّي مكتبة الوسائط وإبداعات الحملات — ليس محرر صفحات ثانيًا. |
| الوسائط والمظهر | `mkt_media_slots`, `mkt_media_slot_drafts`, `mkt_media_slot_history`, `/admin/appearance` | فتحات الشعار الجديدة والشخصية الثالثة تُسجَّل هنا. |
| الشخصيات | `mkt_mascot_phrases`, `src/lib/mascot-stage.ts`, `mascot-presence.ts`, `MascotWalk`, `/admin/mascots` | طبقة نظام محمية (Overlay عائم بقواعد إيقاعه) — ليست كتلة صفحة قابلة للحذف. |
| الأحداث الحالية | `mkt_analytics_events`, `mkt_listing_events`, `mkt_story_events`, `mkt_guide_place_promo_events` | تبقى كما هي؛ الاستقبال الموحّد الجديد يكتب في مخطط `analytics` غير المعروض عبر Data API. |
| الصلاحيات والتشغيل | `mkt_platform_admins`, `mkt_staff_permissions`, `usePlatformIdentity`, `mkt_ops_log`, صندوق العمل `/admin/my-work`, صحّة SLA | يُعاد استخدامها كلها. المفاتيح الجديدة بأسلوب `content.*` / `analytics.*` فقط وبأقل عدد. |
| إعادة التوجيه عند تغيير المسار (§9) | `mkt_category_redirects` + آلية `legacy_redirect` الخادمية (تدمج معاملات الاستعلام) | تُعاد استخدامها لمسارات الصفحات. |

### 1.2 المسارات المعتمدة (الملحق B)

- الإدارة: `/admin/content/*` و`/admin/analytics/*` (لا وجود لشجرة `/platform-admin`).
- إحصاءات صاحب الهوية: داخل `/my` و`/business` مع مبدّل الهوية الحالي.
- الجداول العامة: `mkt_cms_*` (إرضاءً لحارس الهيكل). الأحداث الخام: مخطط `analytics.*` غير معروض، مع استثناء موثّق لحارس الهيكل.

### 1.3 خريطة تدفق المحتوى والحدث والملكية

```text
المحتوى:  مسودة صفحة (mkt_cms_pages/versions) → معاينة → Preflight → نشر نسخة
          الكتل ← سجل المكوّنات الواحد (PageBlocks) ← رموز التصميم (theme engine)
الحدث:    SDK موحّد (متصفح) → Ingestion خادمي (تحقق/Rate limit/Dedup) → analytics.events_raw
          → تجميع ساعي/يومي (analytics.agg_*) → RPC آمنة → شاشات المدير/صاحب الهوية
الملكية:  الحدث يحمل entity_id + tenant_id → RLS تمنع تسرّب الكيان → تحليلات الهوية النشطة
```

### 1.4 قواعد البيانات (الملحق F) — تُنفَّذ في الدفعة 2

- الأحداث الخام: 90 يومًا ثم حذف؛ التجميعات الساعية/اليومية دائمة. المدة قابلة للتعديل بصلاحية + تسجيل في `mkt_ops_log`.
- استبعاد `is_demo` وحركة المالك/الموظفين من المقاييس الافتراضية (موثّق في الشاشة).
- أحداث وضع الاختبار بعلم `is_test` وتُحذف عند الإغلاق.

### 1.5 حماية الرئيسية والشخصيات (الملحق C)

- استيراد الرئيسية إلى نموذج الصفحات يجب أن ينتج نسخة **مطابقة بصريًا** أولًا (قبول بلقطات 390px و1366px).
- الرئيسية المضبوطة يدويًا تبقى الحيّة حتى ينشر المالك نسخة CMS صراحةً.
- شخصية ثالثة «كحيلا» (Kahila): تُسجَّل الآن في نظام الشخصيات (عبارات بإدارة المسؤول، تدوير مع كَحيل وكَحيلان، فتحة وسائط خاصة في `/admin/appearance`) وتبقى مخفية حتى يرفع المالك رسمها بنفسه.

### 1.6 الشعار الجديد (الملحق D)

فتحات مطلوبة في نظام المظهر: شعار الهيدر (فاتح/داكن)، شعار الفوتر، مجموعة الأيقونة المفضّلة، صورة المشاركة الاجتماعية — بمقاسات متعددة والشعار الحالي كبديل. الهيدر/الفوتر/الميتا تقرأ من الفتحات. الرفع يقوم به المالك من `/admin/appearance`.

### 1.7 قرارات الدولة والاستعادة (الملحق E) — الدفعة 2

- رمز الاتصال: استنتاج دولة الزائر من IP الطلب لحظيًا (لا تُخزَّن أبدًا) لاختيار رمز الاتصال مسبقًا في `DialPhoneField`، قابل للتغيير، والبديل `+963`.
- استعادة كلمة المرور: البريد متاح للجميع دائمًا؛ خيار الهاتف يظهر إذا كان هاتف الحساب `+963` أو كان الزائر في سوريا، ويُبنى كاملًا لكن خاملًا خلف فحص مفاتيح مزوّد SMS/WhatsApp مع الإشعار الصريح الحالي.

### 1.8 إصلاح الملحق G (منفَّذ في هذه الدفعة)

`mkt_admin_overview` دالة `SECURITY DEFINER` ترفع `Not authorized` لغير مدير المنصة، فكان الموظفون بلا صلاحية اللوحة يرون 400 في الكونسول. تم تقييد الاستدعاء على العميل:

- `src/components/marketplace/AdminShell.tsx` → `<AdminAlerts enabled={allowed && admin} />`.
- `src/routes/admin/index.tsx` → `useStudioStats()` تستدعي الآن `usePlatformIdentity()` وتُمرّر `enabled: canOverview`.

لا تغييرات واسعة أخرى في الدفعة 1 (وفق الأمر: الجرد فقط).

## Batch 2 — Data & security foundation (DONE)

- `mkt_cms_pages` / `mkt_cms_page_versions` / `mkt_cms_page_redirects` / `mkt_cms_page_locks` created with GRANTs, RLS (public reads published only; staff via `mkt_content_can`), and updated_at triggers.
- Campaigns EXTENDED, not duplicated: `mkt_cms_ad_placements` (6 seeded placements) + `mkt_cms_campaign_placements` reference the existing `mkt_ad_campaigns`; approval cycle columns (`review_status`, `reviewed_by`, `reviewed_at`, `review_note`, `fallback_campaign_id`) added to that same table. Acceptance test 69 holds: no second campaigns table.
- Theme engine EXTENDED: `mkt_theme_settings.category` (color/font/type/radius/shadow/space) + `draft_value` for the draft→preview cycle. No second tokens system.
- Third character «كحيلا» registered (`mkt_mascot_phrases` check widened to kaheel/kaheelan/kahila) with two hidden media slots; new brand logo slots added (header light/dark, footer, favicon, social share).
- Analytics isolated in a NON-exposed `analytics` schema (events_raw + agg_hourly + agg_daily + settings), no anon/authenticated grants, RLS on, service_role only. Retention default 90 days, adjustable through `mkt_analytics_retention_set` (permission + written reason + audit log); `mkt_analytics_purge_expired`, `mkt_analytics_purge_test`, `mkt_analytics_rollup` exclude `is_test` / `is_internal` / `is_demo`.
- Structure-guard exception: guard disabled and re-enabled inside the same migration, both events written to `mkt_structure_guard_events`. Verified `enabled = true` afterwards.
- Fixed PK error from the first attempt: `COALESCE(...)` is not allowed in a PRIMARY KEY, so the aggregation keys use NOT NULL sentinel-UUID columns instead.

## الدفعة 3 — محرّر الصفحات (مكتملة)

- `src/lib/mkt-cms.ts`: طبقة بيانات الصفحات والنسخ — تنظيف نصوص إلزامي (لا HTML/Script)،
  رفض الأنواع غير المعروفة، حد 40 كتلة، قفل تحرير نابض (90 ثانية) وحرس تعارض
  عبر `updated_at`، رجوع بنسخة كاملة مُنشورة لا تعديل نسخة قديمة، وتغيير المسار
  يُسجّل Redirect ويمنع التعارض.
- `src/components/admin/cms/BlockFieldEditor.tsx`: محرّر الحقول المشترك — سُحب من
  `/admin/composer` فصار مكوّنًا واحدًا للاستوديو والمؤلّف (لا سجل مكوّنات ثانٍ).
- `src/routes/admin/content.index.tsx`: قائمة الصفحات وإنشاء صفحة كمسودة.
- `src/routes/admin/content.pages.$id.tsx`: لوحة الرسم بثلاثة مقاسات (390/768/1366)
  + المكتبة + لوحة الخصائص + حفظ تلقائي بعد سكون ثانيتين + تراجع/إعادة (50 خطوة)
  + قائمة النسخ والرجوع، وعارض المعاينة هو نفسه `PageBlocks` العام.
- `AdminShell`: بند تنقّل «استوديو المحتوى» داخل مجموعة الاستوديو + مفاتيح i18n عربي/إنجليزي.
- التحقق: `tsgo --noEmit` نظيف، و`/admin/content` يرد 200. الرئيسية الحالية تبقى المنشورة.

## الدفعة 6 — محرك التتبع الموحّد (مكتملة)

- `analytics.mkt_analytics_ingest` (دفعة ≤20 حدثًا، تعقيم، اكتشاف حركة الفريق والوضع
  التجريبي)، `mkt_analytics_report` بحرس صلاحية `analytics.view`، و`mkt_analytics_purge_test`.
- `src/lib/track.ts`: SDK واحد — مفتاح جلسة في `sessionStorage` فقط (§24)، تجميع
  الأحداث (10 أحداث أو 3 ثوانٍ)، و`sendBeacon` عند `pagehide`، ودعم وضع الاختبار.
- `src/routes/api/public/track.ts`: تحقق Zod صارم + حد معدل لكل جلسة + عميل خادمي
  للمخطط المعزول (لا سطح PostgREST على `analytics`).
- منع الاحتساب المزدوج: `useAnalyticsInstrumentation` يبثّ `page.view` في المحرك
  الموحّد، ويبقى `mkt_analytics_events` لإشارات الأخطاء والسرعة التشغيلية فقط.

## الدفعة 5 — مواضع الحملات (مكتملة)

- `src/routes/admin/content.placements.tsx`: ربط حملة قائمة بموضع + وزن (1–100) +
  نافذة زمنية + حملة بديلة، مع كشف تعارض صريح عند تجاوز `max_active` للحملات
  المتقاطعة زمنيًا، وجدول زمني مقروء. اختبار القبول 69 قائم: لا جدول حملات ثانٍ —
  الشاشة تقرأ `mkt_ad_campaigns` نفسها.
- بند تنقّل «مواضع الحملات» داخل مجموعة الحملات.

## الدفعة 7 — شاشات تحليلات المدير (مكتملة)

- `src/lib/analytics.functions.ts`: قراءة التقارير عبر دالة قاعدة بيانات تتحقق من
  الصلاحية بنفسها (لا قراءة مباشرة للمخطط المعزول).
- `src/routes/admin/analytics.index.tsx`: مؤشرات (أحداث/جلسات/زوّار)، أعمدة يومية،
  أكثر الصفحات والأحداث، مدد 7/30/90، مفتاح إظهار حركة الفريق للمقارنة، وحذف
  أحداث الاختبار. الاستبعاد الافتراضي موثّق على الشاشة نفسها.

### تحقق هذه الدفعات

- `tsgo --noEmit` نظيف.
- `/admin/analytics` و`/admin/content/placements` تُحوَّل إلى `/auth?next=…` بلا جلسة
  وبلا أخطاء كونسول — البوابة تعمل. التحقق بجلسة مالك حقيقية غير متاح في هذه البيئة
  (`LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`)، فيلزم فحص المالك من الرابط المنشور.

### المتبقي من البرنامج

- الدفعة 8: إحصاءات هوية المعلن داخل `/my` و`/business`.
- الدفعة 9: الإغلاق — EXPLAIN، انحدار الاستجابة، المستشارون، حذف بيانات الاختبار،
  ونتائج القبول 68+1 والإجابة التسعية.

## دفعة 4 — البقايا (مكتملة)

| البند | الحالة | الدليل |
| --- | --- | --- |
| بطاقة إعدادات الصفحة (SEO عربي/إنجليزي + فتحة og) | مكتمل | `src/components/admin/cms/PageSettingsCard.tsx` |
| تغيير مسار الصفحة مع فحص التعارض وصف تحويل | مكتمل | `changeRoutePath` في `src/lib/mkt-cms.ts` |
| الأرشفة وإلغاء النشر | مكتمل | `setPageArchived` |
| فحص ما قبل النشر مع حجب النشر | مكتمل | `preflightPage` + `PreflightList.tsx` |
| الهيدر والتذييل والشعار عبر الأنظمة القائمة | مكتمل | `BrandLogo.tsx` يقرأ فتحات `brand.logo.*`؛ الهيدر والتذييل يتبعانها |
| رموز التصميم (خط/حجم/استدارة/ظل/تباعد) بمسودة ← معاينة ← اعتماد | مكتمل | `DESIGN_TOKENS` في `theme-tokens.ts`، `DesignTokensCard.tsx` داخل شاشة «المظهر» |

لا نظام رموز موازٍ: نفس `mkt_theme_settings` ونفس اللوحة المفعّلة، والقراءة
العامة تمر باستعلام `mkt_theme_active` المخزَّن نفسه (`select` لا `queryFn`
ثانٍ)، والقيم الافتراضية مطبوعة في `styles.css` فلا وميض عند التحميل.

## دفعة 8 — إحصاءات المالك (مكتملة)

- الشاشة: `/my/stats` داخل سياق الحساب النشط (`useActiveAccount`)، مُسجّلة في
  `routes-map.ts` وظاهرة في قائمة «نشاطي».
- المصدر الوحيد: `public.mkt_owner_analytics(_days, _tenant_id)` —
  SECURITY DEFINER، يحلّ الملكية من `auth.uid()` والهوية النشطة.
- البطاقات: مرات الظهور، زيارات التفاصيل، نقرات التواصل، المفضلة، المشاركات،
  الجلسات.
- الخصوصية: الشرائح < 5 جلسات تُدمج في «أخرى»، وحركة الفريق والتجريبي
  والاختباري مستثناة (`is_internal/is_demo/is_test`).
- اختبار العزل: تمرير كيان لا ينتمي إليه المتصل يرفع `FORBIDDEN`؛ ومحاولة
  التنفيذ بدور غير مصادَق تُرفض على مستوى الصلاحيات
  (`permission denied for function mkt_owner_analytics` — مُتحقَّق).
- تغذية الأحداث: `listing.view` في `/ads/$slug`، `listing.contact_click` في
  `ListingActions`، `listing.favorite` عند الحفظ، `listing.share` من
  `trackListingEvent`.

## دفعة 9 — التحقق والإغلاق (مكتملة)

### 0) تتبّع الظهور (المخاطرة المُغلقة)

- `src/lib/use-impression.ts`: مراقب تقاطع (IntersectionObserver) يرسل الحدث
  عند بقاء 50% من البطاقة داخل الشاشة 600ms، مرة واحدة لكل بطاقة في كل عرض
  صفحة (مفتاح `path|kind|id`)، ويتوقف تلقائيًا في مسارات `/admin` و`/studio`.
- `src/components/marketplace/ListingCard.tsx`: `impressionRef` على العنصر
  الجذر (سطر 337) — فبطاقة «مرات الظهور» في `/my/stats` أصبحت مُغذّاة.

### 1) نتائج القبول 68 + 1

الترميز: PASS = مُتحقَّق آليًا (استعلام/طلب فعلي)، INSP = مُتحقَّق بمراجعة
الكود والسياسات، DEFER = مؤجَّل بسبب غياب جلسة موظف قابلة للأتمتة.

| # | نتيجة | الدليل |
|---|---|---|
| 1 | PASS | 6 جداول `mkt_cms_*` موجودة، لا جدول موازٍ |
| 2 | PASS | RLS مفعّل على كل جداول `public` (فحص `pg_class.relrowsecurity` = لا استثناء) |
| 3 | PASS | صلاحيات واجهة البيانات مُضافة لجداول المحتوى في هذه الجولة (كانت مفقودة) |
| 4 | PASS | الزائر: عرض فقط؛ الإضافة تُرفض 401/42501 |
| 5 | PASS | سحب الكتابة من الزائر على الجداول الستة؛ الأقفال بلا عرض للزائر (401) |
| 6 | INSP | سياسة الموظفين تعتمد دالة الصلاحية لا الدور المخزَّن في الملف |
| 7 | PASS | إنشاء صفحة مسودة + نسخة نجح (مُدخَل فحص، ثم حُذف) |
| 8 | PASS | ترقيم النسخ فريد لكل صفحة (`mkt_cms_page_versions_unique`) |
| 9 | INSP | «حفظ كمسودة» يكتب نسخة جديدة ولا يلمس المنشور |
| 10 | INSP | النشر يحدّث `published_version_id` + `published_at/by` |
| 11 | INSP | الاستعادة تنسخ نسخة قديمة إلى نسخة جديدة (لا تعديل تاريخي) |
| 12 | INSP | مقارنة النسخ تعرض الفروق بالكتل |
| 13 | INSP | قفل التحرير النابض (`mkt_cms_page_locks`) + تحرير عند الخروج |
| 14 | INSP | القفل ينتهي بعد مهلة، ومحرّر ثانٍ يرى «قيد التحرير» |
| 15 | PASS | لا حذف نهائي: `archive/unpublish` تغيّر الحالة فقط |
| 16 | INSP | تغيير المسار يفحص التعارض ثم يُنشئ صف إعادة توجيه |
| 17 | PASS | `mkt_cms_page_redirects.from_path` فريد (قيد `_from_path_key`) |
| 18 | INSP | فحص ما قبل النشر: ترجمة ناقصة/زر بلا هدف/كتلة مجهولة/حقل مطلوب فارغ |
| 19 | INSP | قائمة الفحص تُعرض للناشر ولا تُخفى |
| 20 | PASS | حالات الصفحة: `draft/published/archived` (افتراضي `draft`) |
| 21 | PASS | المسودة غير مرئية للزائر: صفحة مسودة حقيقية → استجابة `[]` عبر الزائر |
| 22 | PASS | نسخة المسودة غير مرئية للزائر → `[]` |
| 23 | INSP | حقول SEO عربي/إنجليزي + فتحة صورة المشاركة داخل بطاقة الإعدادات |
| 24 | INSP | `robots` قابل للضبط (`index` افتراضيًا) |
| 25 | INSP | معاينة بثلاثة مقاسات داخل المحرّر |
| 26 | INSP | ثلاثة أعمدة على الحاسب وتنقّل بأشرطة على الجوال |
| 27 | PASS | سياسة الزائر تقصر العرض على `status='published'` |
| 28 | PASS | الأقفال داخلية بالكامل (لا صلاحية عرض للزائر) |
| 29 | PASS | 6 مواضع إعلانية مفعّلة تُقرأ عامًّا |
| 30 | PASS | تعديل الزائر للمواضع لا يغيّر شيئًا (6/6 مفعّلة قبل وبعد) |
| 31 | PASS | ربط الموضع بالحملة فريد (`mkt_cms_campaign_placements_unique`) |
| 32 | PASS | لا جدول حملات ثانٍ: `mkt_ad_campaigns` هو الوحيد |
| 33 | PASS | `analytics.events_raw.event_id` فريد → لا احتساب مزدوج |
| 34 | PASS | مخطط `analytics` غير مكشوف عبر واجهة البيانات (`PGRST205`) |
| 35 | PASS | صفر صلاحيات للزائر والمسجّل على مخطط `analytics` |
| 36 | INSP | `src/lib/track.ts` هو المُرسل الوحيد (لا نداءات مباشرة) |
| 37 | INSP | نقطة الاستقبال عامة وتتحقق من الشكل قبل الكتابة |
| 38 | PASS | استبقاء 90 يومًا للأحداث الخام (دالة التطهير موجودة) |
| 39 | INSP | التجميع دائم ولا يُحذف مع التطهير |
| 40 | PASS | `mkt_owner_analytics` يستثني `is_internal/is_demo/is_test` |
| 41 | PASS | دمج الشرائح < 5 جلسات في «أخرى» |
| 42 | PASS | كيان لا يملكه المتصل → `FORBIDDEN` |
| 43 | PASS | الزائر لا ينفّذ `mkt_owner_analytics` (`42501`) |
| 44 | PASS | الزائر لا ينفّذ التطهير ولا ملخص الإدارة (`Not authorized`) |
| 45 | PASS | خطأ 400 في `mkt_admin_overview` للموظفين مُصلَح (دفعة 1) |
| 46 | PASS | صفر أحداث اختبارية متبقية |
| 47 | PASS | فحص الأنواع نظيف (`TSC_EXIT=0`) |
| 48 | PASS | بناء الإنتاج ناجح (`BUILD_EXIT=0`) |
| 49–54 | PASS | لا فائض أفقي على 320/390/768/1024/1366/1440 في المسارات الستة |
| 55 | PASS | بوابة الحماية تعمل: مسارات الإدارة و`/my/stats` تُحوَّل إلى `/auth?next=…` |
| 56 | INSP | الهيدر والتذييل يقرآن فتحات الشعار الجديدة |
| 57 | INSP | «كحيلا» مُسجَّلة مع الشخصيتين القائمتين دون المساس بهما |
| 58 | INSP | كشف الدولة للهاتف مع الرجوع إلى +963 |
| 59 | INSP | رموز التصميم (خط/نوع/استدارة/ظل/تباعد) بمسار مسودة→معاينة→تطبيق |
| 60 | INSP | لا نظام رموز موازٍ (نفس `mkt_theme_settings`) |
| 61 | INSP | الترجمة مركزية عبر `src/i18n` لكل الشاشات الجديدة |
| 62 | PASS | الأرقام إنجليزية والتاريخ DD/MM/YYYY عبر `src/lib/format.ts` |
| 63 | INSP | لا لون مكتوب مباشرة في الشاشات الجديدة (رموز `--kt-*`) |
| 64 | INSP | أهداف اللمس ≥ 44px في الجداول والأزرار الجديدة |
| 65 | PASS | لا حذف سجلات نهائي في أي هجرة من هذه الدفعات |
| 66 | PASS | كل الجداول الجديدة تبدأ بـ `mkt_` |
| 67 | PASS | المستودع ومشروع القاعدة المعتمدان دون تغيير |
| 68 | INSP | تقرير التدقيق محدَّث بالمسارات والجداول والدوال |
| 69 | PASS | لا جدول حملات ثانٍ (مطابق للبند 32) |

DEFER الوحيد: لا شيء حُذف من القائمة، لكن بنود INSP المتعلقة بشاشات الإدارة
لم تُلتقط لها صور لأن نوع ارتباط القاعدة خارجي (`external_unmanaged`) فلا
يمكن إنشاء جلسة موظف آليًا في بيئة الفحص؛ تم التحقق منها بمراجعة الكود
والسياسات وبإثبات عمل بوابة الحماية.

### 2) الفحوص التقنية

- فحص الأنواع: 0 أخطاء. بناء الإنتاج: ناجح (`✓ built`, نيترو أنشأ الحزمة).
- الطرفية: التحذير الوحيد المتكرر هو عدم تطابق التصيير الأولي على `/auth`،
  وهو سابق لهذه الدفعة وغير مرتبط بها (يظهر أيضًا قبل تغييرات الدفعة).
- المقاسات الستة: لا فائض أفقي في أي مسار (`scrollWidth == viewport`).

### 3) فرز مستشاري الأمن والأداء

جديد وأُصلح في هذه الجولة:

1. جداول استوديو المحتوى الستة كانت بلا صلاحيات واجهة بيانات → مُنحت
   للمسجّل ولدور الخدمة، والعرض فقط للزائر.
2. الزائر كان يملك صلاحيات كتابة موروثة على الجداول نفسها → سُحبت.
3. الزائر كان قادرًا نظريًا على استدعاء دالة تطهير الأحداث وملخص الإدارة
   وإحصاءات المالك → سُحب حق التنفيذ.

سابق وقائم (خارج نطاق هذه الدفعة): تنبيهات «امتداد في المخطط العام»،
و«جدول بحماية بلا سياسة» على جداول داخلية، وتنبيهات صلاحيات تنفيذ لدوال
قديمة، إضافة إلى تنبيهات الأداء المتعلقة بفهارس مفاتيح خارجية.

### 4) تنظيف بيانات الفحص

- `analytics.events_raw`: 0 سجل اختباري (`is_test = true`).
- صفحة الفحص `qa-batch9-draft` ونسختها حُذفتا بعد إثبات إخفاء المسودة.
- دالة `mkt_analytics_purge_test` غير قابلة للتنفيذ إلا بجلسة موظف مصادَقة،
  ولذلك أُثبت التنظيف بالعدّ المباشر لا باستدعائها من بيئة الفحص.

### المتبقي والمخاطر (بصراحة)

1. إعادة الترتيب في مُركّب الصفحات بالأزرار لا بالسحب والإفلات.
2. دورة اعتماد الحملات موجودة كبيانات وحالات، وعمق واجهتها (مسار مراجعة
   متعدد الخطوات وتعليقات المراجع) أبسط من المطلوب مستقبلًا.
3. مدى التحليلات محدود بسياسة الاستبقاء 90 يومًا للأحداث الخام؛ ما قبلها
   متاح عبر التجميع الدائم فقط.
4. بنود INSP أعلاه لم تُختبر بجلسة موظف حقيقية آليًا (ارتباط قاعدة خارجي)،
   ويُنصح بمرور يدوي واحد من حساب المالك على `/admin/content` و`/my/stats`.
5. جداول المحتوى فارغة حتى الآن؛ أول صفحة حقيقية يجب أن تُنشأ من المحرّر
   للتأكد من مسار النشر من الطرف إلى الطرف على بيانات فعلية.
