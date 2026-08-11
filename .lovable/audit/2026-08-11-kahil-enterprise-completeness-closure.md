# الإغلاق الشامل والتكامل التشغيلي لمنصة كَحيل — تقرير التدقيق

الأمر المصدر: `.lovable/orders/2026-08-11-enterprise-closure-order.md` (1167 سطرًا، الأجزاء 1+2)
الملحق التنفيذي المُلزم: رسالة المالك «PART 3 of 3» — عند تعارض الأسماء يفوز الملحق، وعند تعارض النية والقواعد يفوز نص الأمر.

الحالة: **الدفعة 1 مكتملة (تدقيق وجرد بلا تغييرات واسعة). الدفعات 2→10 لم تبدأ.**
لا Publish. لا هجرات في هذه الدفعة (الدفعة 1 تدقيقية بحكم §28).

---

## 0) العلاقة مع المرحلتين السابقتين

| المرحلة | التقرير | ما تعتمد عليه هذه المرحلة |
|---|---|---|
| مركز قيادة مدير المنصة العام | `.lovable/audit/2026-08-11-platform-super-admin-command-center.md` (254 سطرًا) | `mkt_ops_log` (append-only مثبت بـ`P0001`)، `/admin/my-work`، `mkt_support_tickets`، `mkt_message_reports`، `mkt_admin_can` + `mkt_staff_permissions`، `mkt_export_log` |
| استوديو المحتوى والتحليلات | `.lovable/audit/2026-08-11-kahil-content-studio-and-analytics.md` (292 سطرًا) | `mkt_cms_pages/page_versions/page_locks/page_redirects`، `mkt_cms_ad_placements` + `mkt_cms_campaign_placements`، مخطط `analytics.*`، `src/lib/track.ts` → `/api/public/track`، `mkt_theme_settings`، `preflightPage` + `PreflightList.tsx`، `mkt_owner_analytics` + `/my/stats` |

بوابة البدء (§1.7): راجعتُ خاتمة تقرير المرحلة 2 — لا يوجد Critical/Error مفتوح؛ الثغرات الثلاث التي كشفها مستشار الأمن (صلاحيات جداول CMS، كتابة موروثة للزائر، حق تنفيذ دوال حساسة للزائر) **مغلقة بثلاث هجرات** في تلك المرحلة. التنبيهات الباقية موصوفة هناك كـ«سابقة وقائمة» لا كأخطاء المرحلة. ⇒ **البوابة مفتوحة، التنفيذ مسموح.**

---

## 1) خريطة الأسماء الفعلية (الملحق §A) — مُثبتة بالفحص

| مفهوم الأمر §25 | الاسم الفعلي المعتمد | الحالة |
|---|---|---|
| `cms_campaigns` | `mkt_ad_campaigns` (33 عمودًا) | قائم — يُوسَّع |
| `cms_placements` | `mkt_cms_ad_placements` (`placement_key, surface, aspect, max_active, is_active, sort_order`) + `mkt_cms_campaign_placements` | قائم — يُوسَّع (مخزون/تقويم/حجوزات) |
| `platform_feature_flags` | `mkt_feature_flags` (جديد) | غير منفذ — لا يوجد أي جدول `%flag%` في `public` |
| `platform_feature_overrides` | `mkt_feature_overrides` (جديد) | غير منفذ |
| `platform_jobs` / `platform_job_definitions` | `mkt_platform_job_definitions` + توسيع `mkt_job_runs` القائم (`id, job, source, started_at, finished_at, duration_ms, ok, result, error`) | جزئي — سجل تشغيل موجود، بلا تعريفات/محاولات/قفل/dead-letter |
| `platform_slos` / `platform_health_checks` / `platform_health_runs` | `mkt_platform_slos` / `mkt_health_checks` / `mkt_health_runs` (جديدة) | غير منفذ |
| `platform_alert_rules` / `platform_incidents` / `platform_runbooks` | `mkt_alert_rules` / `mkt_platform_incidents` / `mkt_platform_runbooks` (جديدة) | غير منفذ |
| `platform_dependencies` | `mkt_platform_dependencies` (جديد) | غير منفذ |
| `search_documents` / `search_synonyms` / `search_index_jobs` | `mkt_search_synonyms` + مستند بحث مشتق (`mkt_search_documents`) عند إثبات الحاجة بـ`EXPLAIN` | غير منفذ — البحث الحالي استعلامات مباشرة |
| `experiments*` | `mkt_experiments` / `mkt_experiment_variants` / `mkt_experiment_assignments` / `mkt_experiment_metrics` / `mkt_experiment_daily_results` | غير منفذ |
| `ad_packages` / `ad_rate_cards` / `ad_orders*` | `mkt_ad_packages` / `mkt_ad_rate_cards` / `mkt_ad_orders` / `mkt_ad_order_items` | غير منفذ |
| `platform_invoices*` / `platform_credit_notes` / `platform_payment_evidence` | `mkt_platform_invoices` / `mkt_platform_invoice_items` / `mkt_platform_credit_notes` / `mkt_platform_payment_evidence` | غير منفذ |
| `recommendations*` | `mkt_recommendations` / `mkt_recommendation_actions` | غير منفذ |
| `report_schedules` / `report_runs` / `alert_subscriptions` | `mkt_report_schedules` / `mkt_report_runs` / `mkt_alert_subscriptions` | غير منفذ |
| `backup_catalog` / `restore_drills` | `mkt_backup_catalog` / `mkt_restore_drills` (Metadata فقط) | غير منفذ |
| أحداث البحث / Web Vitals / تعرّض التجارب | `analytics.events_raw` عبر `src/lib/track.ts` — لا نظام أحداث ثانٍ | مسار قائم يُعاد استخدامه |

قاعدة البادئة مثبتة: كل جدول عام جديد يبدأ بـ`mkt_` (حارس الهيكل `mkt_structure_guard` مفعّل)، والاستثناء الموثق الوحيد هو مخطط `analytics` المعزول (4 كائنات: `events_raw, agg_hourly, agg_daily, settings`، بصفر صلاحيات للزائر والمسجّل).

---

## 2) تعريف الاكتمال الموحّد (Definition of Done) — 20 بندًا

البنود كما في §2 من الأمر، وتُطبّق حرفيًا: الهدف والمستفيد • المالك التشغيلي • المسارات • مصدر البيانات وعدم التكرار • الحالات والانتقالات • الأدوار والصلاحيات الخادمية • RLS/Grants/RPC • حالات Loading/Empty/Error/Forbidden/Degraded • سجل العمليات والأثر قبل/بعد • الأحداث وتعريف المقاييس • التنبيهات والتصعيد • المهام/Queues/Retries • حدود الأداء والتكلفة • الاستبقاء والأرشفة • النسخ والاستعادة • سلوك فشل الاعتماد الخارجي • Feature Flag وKill switch • الاختبارات • Runbook • دليل قابل للتحقق.

قاعدة التقييم في هذا التقرير: **أي وحدة ينقصها بند ضروري تبقى «جزئي» ولو كانت شاشتها تعمل.** لم أرفع أي وحدة إلى «مكتمل» في الدفعة 1؛ التقييم النهائي يُحدَّث بعد كل دفعة بدليلها.

---

## 3) مصفوفة الاكتمال (الدفعة 1 — خط الأساس)

الحالة: ✅ مكتمل • ◐ جزئي • ✖ غير منفذ • ⏸ مؤجل • ⛔ محظور • ➖ غير منطبق

| # | الوحدة | الحالة | المسارات | المصدر الرئيسي | الأحداث | التنبيهات | الفجوة الأساسية (DoD الناقص) |
|---|---|---|---|---|---|---|---|
| 1 | الدخول والتسجيل والاسترداد | ◐ | `/auth`, `/register`, `/forgot-password`, `/reset-password`, `/invite/$token` | `auth.users`, `mkt_login_otps`, `login_attempts`, `mkt_otp_sends` | ✖ | ✖ | لا SLO/مراقبة، لا حدث تتبع، MFA إعداد فقط (`security.mfa_required`) |
| 2 | الجلسات والأجهزة | ◐ | `/my/profile`, `/admin/users/$id` | `auth.sessions` + `mkt_admin_revoke_user_sessions` | ✖ | ✖ | لا عرض أجهزة للمستخدم، لا إبطال آلي بعد سحب دور |
| 3 | اختيار الهوية والكيانات | ◐ | `/choose-account`, `/market-setup` | `mkt_tenants`/`memberships`, `activate_account` | ✖ | ➖ | لا أحداث، لا Flag |
| 4 | المنشآت والتوثيق والأنشطة | ◐ | `/business/*`, `/admin/verifications`, `/admin/taxonomy` | `mkt_business_profiles`, `mkt_verification_requests`, `mkt_activities` | ✖ | ◐ (my-work) | لا حدود أداء، لا Flag، تتبع غائب |
| 5 | السوق والإعلانات والتصنيفات | ◐ | `/`, `/categories/$slug`, `/my/ads*`, `/admin/listings` | `mkt_listings` (72 عمودًا), `mkt_categories` | ◐ `listing.view/impression/contact_click/favorite/share` | ◐ | لا ميزانية أداء، لا Kill switch، لا SLO |
| 6 | المفضلة والمتابعة | ◐ | `/my/favorites` | `mkt_favorites`, `mkt_follows` | ◐ | ➖ | لا تعريف مقاييس موحّد |
| 7 | البحث والاكتشاف | ◐ | `/search` (1042 سطرًا), `mkt_search_activities/stores` | استعلامات مباشرة على `mkt_listings` وغيره | ✖ **لا حدث بحث واحد** | ✖ | لا Ranking موثق، لا Synonyms، لا Fuzzy، لا Autocomplete آمن، لا EXPLAIN، لا Fallback، لا تحليلات بحث |
| 8 | ملفات الأفراد والمنشآت والمتاجر | ◐ | `/p/$slug`, `/businesses/$slug`, `/stores/$slug`, `/profiles/$username` | `mkt_user_profiles`, `mkt_storefronts` | ✖ | ➖ | تتبع غائب، لا ميزانية أداء |
| 9 | المنتجات والمتاجر الصغيرة | ◐ | `/business/store.*` | `mkt_store_items` + 12 جدولًا | ✖ | ✖ | التجارة خلف إعدادات `commerce.*` لا نظام Flags مركزي |
| 10 | التواصل والرسائل والبلاغات عليها | ◐ | `/my/messages`, `/admin/chat-reports` | `mkt_conversations`, `mkt_messages`, `mkt_message_reports` | ✖ | ◐ | لا SLO، لا Kill switch، لا حدث وظيفي |
| 11 | الفرص وطلبات عروض الأسعار | ◐ | `/my/quotes` | `mkt_quote_requests` | ✖ | ✖ | تتبع/تنبيهات/Flag |
| 12 | المشاريع والطلبات والعهدة (تحقّق) | ◐ | مسارات النظام الداخلي | `projects/requests/custody` | ➖ | ◐ | لا تُلمس دورتها (اختبار 4) — تُوثَّق فقط |
| 13 | المحتوى العام والصفحات | ◐ | `/admin/content`, `/admin/content/pages/$id`, `/c/$slug` | `mkt_cms_pages` + `page_versions` | ✖ | ✖ | الجداول فارغة (خطر مورَّث)، لا ميزانية أداء في Preflight، لا فحص روابط |
| 14 | الهيدر/الفوتر/التنقل والمظهر | ◐ | `/admin/appearance`, `/admin/appearance/variants`, `/admin/labels` | `mkt_media_slots`, `mkt_theme_settings` | ✖ | ➖ | لا خريطة اعتماد، لا منع حذف أصل مستخدم |
| 15 | الحملات والمواضع | ◐ | `/admin/campaigns`, `/admin/content/placements` | `mkt_ad_campaigns`, `mkt_cms_ad_placements`, `mkt_cms_campaign_placements` | ◐ `mkt_ad_campaign_events` | ✖ | لا مخزون قابل للبيع، لا تقويم/حجز، لا مقاومة تلاعب، عمق واجهة الاعتماد بسيط (خطر مورَّث) |
| 16 | تحليلات المدير | ◐ | `/admin/analytics` | `analytics.*` + 15 RPC | ✅ مسار موحّد | ✖ | لا تحليلات بحث، لا ضبط تكلفة، لا لحظي |
| 17 | تحليلات أصحاب الحسابات | ◐ | `/my/stats` | `mkt_owner_analytics` | ✅ | ✖ | لا توصيات، لا تقارير دورية، الظهور حديث الربط |
| 18 | البلاغات والاعتراضات والإشراف | ◐ | `/admin/reports*`, `/admin/moderation`, `/my/reports*`, `/my/violations` | `mkt_reports`, `mkt_appeals`, `mkt_moderation_*` | ✖ | ✅ my-work | لا SLO، لا تتبع |
| 19 | الدعم والتذاكر | ◐ | `/admin/support`, `/help` | `mkt_support_tickets` | ✖ | ✅ | لا تقارير دورية، لا SLA مراقب كـSLO |
| 20 | الإشعارات | ◐ | `/my/notifications` | `mkt_notifications` | ✖ | ◐ | لا Quiet hours، لا Frequency cap، لا اشتراكات |
| 21 | التقارير المجدولة | ✖ | — | — | — | — | غير منفذة كليًا (الدفعة 9) |
| 22 | المساحات الإعلانية والباقات والفواتير | ✖ | — | — | — | — | غير منفذة كليًا (الدفعة 8) |
| 23 | تجارب A/B | ✖ | — | — | — | — | غير منفذة كليًا (الدفعة 7) |
| 24 | التوصيات | ✖ | — | — | — | — | غير منفذة كليًا (الدفعة 9) |
| 25 | الإعدادات والمرجعيات والدول | ◐ | `/admin/settings`, `/admin/locations`, `/admin/pricing` | `mkt_platform_settings` (34 مفتاحًا), `mkt_countries`, `mkt_cities` | ✖ | ✖ | الإعدادات ليست نظام Flags (لا نطاق/نسبة/انتهاء/مالك/اعتماديات) |
| 26 | Feature Flags | ✖ | — | `mkt_platform_settings` بديل جزئي | — | — | لا جدول، لا نطاق، لا Kill switch (الدفعة 2) |
| 27 | الأمان وسجل العمليات | ◐ | `/admin/ops-log`, `/admin/audit-log`, `/admin/roles`, `/admin/staff.*` | `mkt_ops_log` (append-only), `audit_log`, `mkt_staff_permissions` (16 مفتاحًا فقط) | ✖ | ◐ | مفاتيح §26 غير مضافة، لا مراجعة دورية للصلاحيات |
| 28 | الأداء والمراقبة والحوادث | ✖ | — | — | — | — | لا Web Vitals، لا ميزانيات، لا SLO، لا حوادث (الدفعتان 2 و3) |
| 29 | الطوارئ والوضع الآمن | ✖ | `market.maintenance` مفتاح واحد | `mkt_platform_settings` | — | — | لا مستويات، لا موافقتان، لا Expiry، لا Fallback موثق (الدفعة 3) |
| 30 | النسخ والاستعادة | ✖ | — | — | — | — | غير منفذ؛ جزء منه مرشح لـ«غير منطبق بيئيًا» (الدفعة 4) |
| 31 | المهام المجدولة والQueues | ◐ | `/admin/integrations` جزئيًا | `mkt_run_scheduled_jobs` + `mkt_job_runs` | ✖ | ✖ | لا تعريفات، لا idempotency key، لا قفل `SKIP LOCKED`، لا backoff، لا dead-letter، لا لوحة |

**الأرقام (خط الأساس، 31 وحدة):** ✅ 0 • ◐ 21 • ✖ 10 • ⏸ 0 • ⛔ 0 • ➖ 0.
لا شيء صُنّف «مكتمل» في الدفعة 1 لأن دليل DoD لم يُجمع بعد لأي وحدة — هذا مقصود ويطابق مطلب المالك بالصدق على التجميل.

---

## 4) خريطة الاعتماد والتأثير (نموذج الدفعة 1 — قبل التنفيذ في الدفعة 3)

العلاقات المرصودة فعليًا في الكود والقاعدة:

```text
mkt_cms_pages ──1:n── mkt_cms_page_versions ──n:1── blocks JSONB (schema_version)
      │                        │
      │                        └── يشير إلى: mkt_media_slots (أصول) • mkt_custom_blocks
      ├── mkt_cms_page_redirects (from_path فريد)   ├── روابط داخلية → routes-map.ts
      └── mkt_cms_page_locks (قفل تحرير)            └── أهداف: mkt_listings / mkt_storefronts / categories

mkt_cms_ad_placements ──n:m── mkt_cms_campaign_placements ──n:1── mkt_ad_campaigns
      │ (max_active, is_active, surface)                              └── mkt_ad_campaign_events
      └── Fallback عند غياب حملة: غير معرّف حاليًا ← فجوة (§4)

mkt_theme_settings ──> رموز --kt-* ──> كل الشاشات (لا لون مباشر)
mkt_media_slots ──> الهيدر/التذييل/الشعار (brand.logo.*) + الصفحات + الحملات

src/lib/track.ts ──> /api/public/track ──> analytics.events_raw
      └──> analytics.agg_hourly/agg_daily (Rollup) ──> mkt_analytics_* RPC ──> /admin/analytics
                                                   └──> mkt_owner_analytics ──> /my/stats
mkt_ops_log <── كل إجراء إداري حساس (append-only، محروس بـ P0001)
mkt_staff_permissions + mkt_platform_admins ──> mkt_admin_can / mkt_content_can ──> بوابات RLS + AdminShell
```

فجوات الاعتماد المحسومة للتنفيذ في الدفعة 3:
1. لا جدول اعتماد فعلي (`mkt_platform_dependencies`) ⇒ لا يمكن اليوم عرض «أين يُستخدم هذا الأصل» قبل الحذف.
2. `mkt_cms_ad_placements` بلا عمود بديل/Fallback ⇒ اختبارا §29-12 و§29-32 لا يمكن أن ينجحا قبل إضافته.
3. لا فحص Redirect loop على `mkt_cms_page_redirects` (القيد يمنع التكرار لا الحلقات).
4. لا ارتباط بين نشر الصفحة وتحديث فهرس/مستند بحث (البحث مباشر بلا فهرس مشتق).

---

## 5) المخاطر المورَّثة المُدرجة في المصفوفة (الملحق §C)

| # | الخطر المورَّث من الأمر 2 | الوحدة المتأثرة | المعالجة المخطط لها |
|---|---|---|---|
| 1 | إعادة الترتيب بالأزرار لا بالسحب والإفلات | 13 | يبقى + بديل أزرار مقبول في §23 (وصولية) — يُوثَّق «غير منطبق تصميميًا» لا «ناقص» |
| 2 | عمق واجهة اعتماد الحملات بسيط | 15 | الدفعة 8 (اعتماد محتوى/دفع منفصلان) |
| 3 | استبقاء 90 يومًا للأحداث الخام | 16 | الدفعة 6 (تجميع دائم + توثيق النافذة) |
| 4 | جداول CMS فارغة، لا مرور من الطرف إلى الطرف على بيانات فعلية | 13 | الدفعة 3 (Preflight + فحص روابط على صفحة اختبار تُحذف عند الإغلاق) |
| 5 | بنود INSP بلا جلسة موظف آلية (`external_unmanaged`) | كل شاشات الإدارة | يبقى قيدًا بيئيًا موثقًا؛ التحقق بمراجعة الكود والسياسات وبإثبات بوابة الحماية |

## 6) القيود البيئية المعلنة مسبقًا (الملحق §B)

| البند | التقييم المتوقع | السبب |
|---|---|---|
| Restore drill إنتاجي / PITR | ➖ غير منطبق — سبب بيئي | ارتباط Supabase خارجي (`external_unmanaged`) ولا وصول لخطة النسخ أو بيئة استعادة |
| MFA فعلي | ◐ | المفتاح موجود (`security.mfa_required`) وتفعيل المزوّد بيد المالك في لوحة Supabase |
| تسليم بريد حقيقي | ➖ في الاختبار | ممنوع إرسال بريد حقيقي أثناء الفحص |
| مقاييس بنية تحتية (CPU/الاتصالات) | ◐ | تُقاس من داخل التطبيق (Latency/Errors) لا من مزود مراقبة خارجي |
| CMS export + إعادة استيراد | متوقَّع تنفيذه | ممكن داخل القاعدة نفسها بسياق اختبار |
| RUM | متوقَّع تنفيذه | أحداث Web Vitals عبر `src/lib/track.ts` من تحميلات حقيقية |

## 7) قرار الدفعة 1

- لا هجرات، لا تغييرات في الكود، لا Publish.
- لا Critical/Error ولا تسرب عزل ⇒ لا حاصر. **الدفعة 2 مأذون ببدئها** (Feature flags → Job registry → SLI/SLO/health checks → Correlation IDs والتنبيهات والحوادث)، وتنتهي باختباراتها وتحديث هذا التقرير قبل الدفعة 3.
- بيانات اختبار: لا شيء أُنشئ في هذه الدفعة (0 سجل).

### سجل تحديث التقرير
| الدفعة | الحالة | التاريخ |
|---|---|---|
| 1 — التدقيق الشامل | مكتملة | 11/08/2026 |
| 2→10 | لم تبدأ | — |

## الدفعة 2 — أساس التشغيل (مفاتيح الميزات، المهام الخلفية، الصحة والحوادث)

### ما نُفّذ
- **قاعدة البيانات (إضافة فقط)**: 12 جدولًا جديدًا بسابقة `mkt_`: `mkt_feature_flags`, `mkt_feature_overrides`, `mkt_platform_job_definitions`, `mkt_platform_job_queue`, `mkt_platform_slos`, `mkt_health_checks`, `mkt_health_runs`, `mkt_platform_runbooks`, `mkt_alert_rules`, `mkt_platform_incidents`, `mkt_incident_timeline`, `mkt_platform_dependencies`.
- **دوال التشغيل (SECURITY DEFINER، search_path مثبّت)**: `mkt_jobs_enqueue` (إدراج بمفتاح تفرّد)، `mkt_jobs_claim` (سحب بـ `FOR UPDATE SKIP LOCKED`)، `mkt_jobs_finish` (تأجيل متزايد ثم رسائل ميتة عند تجاوز `max_attempts`)، `mkt_incident_open` (تجميع التنبيه المتكرر في حادثة واحدة بعدّاد تكرار)، `mkt_platform_health_summary` (أرقام فعلية من `analytics.events_raw` + الطابور + `mkt_ops_log`)، `mkt_feature_state` (حل المفتاح مع استثناءات الدولة/نوع الحساب والانتهاء).
- **الواجهة**: `src/lib/mkt-reliability.ts` (طبقة قراءة/كتابة عميلة آمنة) + شاشة `/admin/reliability` بثلاثة تبويبات (الصحة والأهداف، المهام الخلفية، الحوادث والتنبيهات) داخل مركز القيادة القائم، ببوابة صلاحيات، وعنصر تنقل في قسم «التدقيق».
- **الصلاحيات**: أُضيفت المفاتيح `platform.health.view`, `platform.incidents.manage`, `platform.dependencies.view`, `jobs.manage`, `flags.manage`, `settings.manage` إلى نظام `STAFF_PERMS`/`mkt_admin_can` القائم — بلا نظام صلاحيات موازٍ.

### اختبارات الدفعة 2 (منفّذة فعليًا)
| # | الاختبار | النتيجة | الدليل |
|---|---|---|---|
| B2-T1 | الزائر غير المسجّل لا يملك تنفيذ أي من الدوال السبع | نجح | `has_function_privilege('anon',…)=false` ×7 |
| B2-T2 | المستخدم المسجّل يملك التنفيذ والبوابة داخل الدالة | نجح | `has_function_privilege('authenticated',…)=true` ×6 |
| B2-T3 | `search_path` مثبّت في كل دالة جديدة | نجح | `search_path=public, pg_temp` ×7 |
| B2-T4 | سحب المهمة لا يسمح لعاملين بأخذ الصف نفسه | نجح | وجود `SKIP LOCKED` في تعريف `mkt_jobs_claim` |
| B2-T5 | تفرّد الإدراج (idempotency) مفروض في القاعدة | نجح | قيد `mkt_job_queue_idem_unique` |
| B2-T6 | الجداول الجديدة محجوبة عن `anon` (قراءة وكتابة) | نجح | `has_table_privilege('anon',…)=false` ×12 |
| B2-T7 | مفاتيح الصلاحيات الجديدة معروفة للبوابة المشتركة | نجح | `mkt_admin_can` يحتوي المفاتيح |
| B2-T8 | فحص الأنواع وبناء الإنتاج | نجح | `tsgo --noEmit` بلا أخطاء، `npm run build` مكتمل |
| B2-T9 | لا صفوف اختبار متبقية | نجح | 9 أهداف خدمة (تهيئة)، 0 مهام، 0 حوادث |

### حالة صريحة
- **جزئي**: `mkt_health_checks` بلا فحوص مفعّلة بعد، وخطوط أساس الأهداف (`baseline_value`) غير مقيسة — تُقاس فعليًا في الدفعة 3 (الأداء والوضع الآمن)، والشاشة تعرض «لم يُقس بعد» بدل رقم مُفترض.
- **مؤجل**: شاشة إدارة مفاتيح الميزات المستقلة (`/admin/flags`) — المكتبة والدوال جاهزة، والعرض يُضاف مع أدوات الوضع الآمن في الدفعة 3.
- **لا تنفيذ تلقائي بعد**: طابور المهام يعمل يدويًا/بالإدراج؛ ربط المشغّل الدوري يأتي في دفعة المهام الخلفية.

## الدفعة 3 — الأداء والطوارئ وسلامة المحتوى (§28)

### 1) الأداء (RUM حقيقي، بلا نظام موازٍ)
- `src/lib/perf-rum.ts`: قياس LCP وCLS وINP ووزن الأصول من واجهات المتصفح نفسها (بلا مكتبة خارجية)، ويُرسل عبر **محرك التتبع الحالي** `src/lib/track.ts` إلى `analytics.events_raw` بأسماء `perf.web_vital` و`perf.asset`. لا نقطة استقبال ثانية ولا جدول ثانٍ.
- التشغيل مرة واحدة داخل `src/hooks/use-analytics.ts` (نفس نقطة قياس مشاهدات الصفحات).
- `mkt_perf_budgets`: ميزانيات لـ 6 أنواع صفحات (بيانات فعلية مُدخلة في الهجرة).
- `mkt_perf_summary(_days)`: p75/p95 لكل مقياس وجهاز، أبطأ 25 مسارًا، أثقل 25 أصلًا، مع استثناء حركة الاختبار والموظفين والعرض التجريبي.
- واجهة: لسان «الأداء والميزانيات» في `/admin/reliability` (`src/components/admin/reliability/PerfPanel.tsx`).
- توسيع `preflightPage` في `src/lib/mkt-cms.ts` بسياق أداء اختياري: أصل يتجاوز الميزانية أو إزاحة تصميم أو LCP فوق الحد ⇒ تحذير، وفوق الضعف ⇒ **مانع للنشر**. مربوط فعليًا في محرّر الصفحة `content.pages.$id.tsx` بأرقام مقيسة للمسار نفسه.

### 2) مركز الإيقاف الطارئ (Safe Mode)
- فوق `mkt_feature_flags` + `mkt_feature_overrides` الحاليين: أعمدة `switch_level` و`expected_minutes` و`activated_at/by` و`is_protected` (إضافة فقط).
- `mkt_flag_change_requests` + `mkt_flag_change_request` / `mkt_flag_change_decide`: السبب (≥10 أحرف) والمدة (5د–7أيام) إلزاميان، الإيقاف يشترط وجود «بديل التعطيل»، والمستوى `global` لا يُطبَّق إلا بموافقة **شخص ثانٍ مختلف عن مقدّم الطلب** (مفروض خادميًا لا في الواجهة).
- المفاتيح المحمية (`auth.*` / `admin.*` / وحدة auth أو admin) ترفض أي إيقاف: `PROTECTED_FLAG`.
- `mkt_feature_guard(_flag_key)` لفرض الإيقاف داخل العمليات الحسّاسة خادميًا.
- واجهة: لسان «الإيقاف الطارئ» (`KillSwitchPanel.tsx`) مع طابور الموافقات المعلّقة.

### 3) سلامة المحتوى والروابط كمهام خلفية
- `mkt_content_health_findings` بمفتاح تجميع فريد وعدد تكرار وإغلاق تلقائي عند زوال السبب.
- `mkt_content_health_scan()` يفحص فعليًا: تحويلات غير صالحة/حلقية، فتحات وسائط ظاهرة بلا مصدر، حملات منتهية ما زالت مفعّلة، مواضع إعلانية مفعّلة بلا حملة صالحة، صفحات «منشورة» بلا نسخة منشورة.
- ثلاث مهام مُعرَّفة في **الطابور الحالي** `mkt_platform_job_definitions`: `content_health_scan` (كل ٦ ساعات)، `link_health_scan`، `perf_budget_audit`.
- الظهور التشغيلي: صندوق «سلامة المحتوى والروابط» داخل `/admin/my-work` (`ContentHealthBox.tsx`) مع زر «فحص الآن».
- تجاوز تحذيرات ما قبل النشر يُسجَّل: `mkt_cms_preflight_overrides` + `mkt_cms_preflight_override(...)` بسبب إلزامي وتسجيل في سجل العمليات.

### 4) نتائج الفحص التقني
- `npx tsgo --noEmit`: **نظيف** (لا أخطاء).
- `npm run build`: **ناجح**.
- قاعدة البيانات: 6 ميزانيات أداء، 3 مهام جديدة، 7 دوال جديدة، 5 سياسات RLS جديدة، و**صفر** صلاحية تنفيذ لـ `anon` على دوال الدفعة (تمّ REVOKE صريح).
- كل تغيير في المفاتيح والفحوص والتجاوزات يُكتب في `mkt_ops_log` بالحالة قبل وبعد.

### 5) صدق بيئي (§B)
- `is_protected` حاليًا = 0 صفًا لأن المنصة لا تملك بعد مفاتيح باسم `auth.*` أو `admin.*`؛ الحماية مفروضة بالشرط نفسه فور إنشاء أي مفتاح كهذا.
- لوحات الأداء تبدأ فارغة بشكل مقصود: لا أرقام تجريبية، والقياس يظهر بعد أول زيارات حقيقية للنسخة المنشورة.
- تنفيذ المهام الثلاث مجدول عبر تعريفات الطابور؛ ربط `pg_cron` بنقطة تشغيل خارجية لم يُنفَّذ في هذه الدفعة ويبقى للدفعة التالية.
