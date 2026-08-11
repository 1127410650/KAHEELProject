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

### المتبقي والمخاطر (بصراحة)

1. `listing.impression` غير مُرسَل بعد من بطاقات القوائم، فبطاقة «مرات الظهور»
   تبقى صفرًا حتى تُضاف ملاحظة الظهور (IntersectionObserver) في `ListingCard`.
2. مدى البيانات محدود بسياسة الاستبقاء 90 يومًا للأحداث الخام.
3. إعادة الترتيب في مُركّب الصفحات بالأزرار لا بالسحب والإفلات.
4. دفعة 9 (تشغيل قائمة القبول 68+1 وقياسات 320→1440 وفرز مستشاري الأمن
   والأداء وتنظيف أحداث الاختبار) لم تُنفَّذ في هذه الجولة؛ المُتحقَّق منها الآن
   فقط: فحص الأنواع نظيف وبناء الإنتاج ناجح.
