# تقرير إغلاق مرحلة: نظام البلاغات والمخالفات — الواجهات والتنبيهات والاختبارات

التاريخ: 02/08/2026 — Asia/Riyadh

## 1) الجداول والدوال المستخدمة
- الجداول: `mkt_reports`, `mkt_report_reasons`, `mkt_report_files`, `mkt_report_messages`, `mkt_report_internal_notes`, `mkt_report_events`, `mkt_enforcement_actions`, `mkt_account_restrictions`, `mkt_appeals`, `mkt_notifications`, `mkt_staff_permissions`.
- الدوال: `mkt_submit_report`, `mkt_report_assign`, `mkt_report_triage`, `mkt_report_message`, `mkt_report_note`, `mkt_report_decide`, `mkt_report_close`, `mkt_report_reopen`, `mkt_enforce_listing`, `mkt_restrict_subject`, `mkt_lift_restriction`, `mkt_appeal_submit`, `mkt_appeal_decide`, `mkt_is_platform_admin`, `mkt_staff_can`, `log_audit`.

## 2) الواجهات والملفات
- `src/lib/mkt-reports.ts`, `src/lib/mkt-notifications.ts`
- `src/components/marketplace/ReportDialog.tsx`, `ReportThread.tsx`, `MktNotificationsBell.tsx`
- `src/routes/dashboard/reports.index.tsx`, `reports.$id.tsx`, `violations.tsx`, `notifications.tsx`
- `src/routes/admin/reports.index.tsx`, `admin/reports.$id.tsx`

## 3) نظام التنبيهات
جرس في `MarketShell` و`DashboardShell` مع عدّاد غير المقروء وقائمة مختصرة، وصفحة `/dashboard/notifications` لكل التنبيهات، وتحديد تنبيه/الكل كمقروء، وتوجيه مباشر للبلاغ أو الاعتراض أو المخالفة عبر `notificationTarget`. الأحداث المربوطة: الاستلام، طلب معلومات، وصول رد، طلب رد من صاحب الإعلان، اتخاذ إجراء، الإغلاق، إعادة الفتح، تقديم اعتراض، نتيجة الاعتراض، انتهاء قيد مؤقت. لا تكشف التنبيهات هوية المبلّغ ولا بيانات صاحب الإعلان غير العامة.

## 4) نتيجة الاختبارات
- اختبارات API/RLS بتوكنات حقيقية (`api_tests.py`): **45/45 PASS** (1–45).
- اختبارات Playwright للواجهة (`ui_tests.py`): **17/17 PASS** (46–62) بعد الإصلاحات أدناه.

### إغلاق الاختبارين 60 و62
- **60 — «English locale renders LTR»: خلل حقيقي في التطبيق (Bug)، لا في بيئة الاختبار.**
  السبب: `src/lib/session.tsx` كان يستدعي `setLocale(profile.locale ?? "ar")` عند تحميل الجلسة، فيلغي اختيار المستخدم اليدوي للغة بعد تسجيل الدخول (يُعيد `dir` إلى rtl ويكتب `tahqaq.locale=ar`).
  الإصلاح: لغة الملف الشخصي صارت قيمة افتراضية فقط — لا تُطبَّق إذا كان للمستخدم اختيار محفوظ في المتصفح. وأُعيدت كتابة `I18nProvider` (`src/i18n/index.tsx`) لتقرأ اللغة عبر `useSyncExternalStore` من `localStorage`، فلا تتأثر بترتيب التحميل/إعادة التركيب (Hydration timing).
  التحقق: تحميل `/dashboard/reports` مباشرةً مع `tahqaq.locale=en` ينتج `dir=ltr` ونصوصًا إنجليزية (لقطات `screenshots/60_*`).
- **62 — «No console/page errors»: خلل حقيقي في الاستعلام (Bug).**
  السبب: `src/routes/admin/reports.$id.tsx` كان يستعلم `mkt_business_profiles?select=id` مع أن المفتاح الأساسي للجدول هو `tenant_id` → HTTP 400.
  الإصلاح: استخدام `tenant_id` مباشرةً كمعرّف المنشأة وإزالة الاستعلام الزائد. التحقق: لا أخطاء Console/Page خلال كامل جولة الواجهة (لقطات `screenshots/62_*`).

## 5) عزل هوية المبلّغ
PASS — لا يظهر أي معرّف/اسم/بريد للمبلّغ في «مخالفاتي» ولا في قنوات صاحب الإعلان (اختبارات 20–24 و54).

## 6) حماية المرفقات
PASS — مجلد `reports/` خاص، والوصول بروابط موقّعة قصيرة المدة للمخوّلين فقط؛ محاولات الوصول المباشر مرفوضة.

## 7) فصل المراسلات والملاحظات
PASS — قناتان منفصلتان (مبلّغ / صاحب إعلان) + ملاحظات داخلية غير مقروءة لأي طرف غير الموظفين.

## 8) الاعتراضات
PASS — تقديم اعتراض واحد لكل إجراء، منع التكرار، قرار الاعتراض وإشعار النتيجة.

## 9) القيود وإجراءات الإنفاذ
PASS — تنبيه/إخفاء/إيقاف الإعلان، تقييد/تعليق الحساب، إلغاء التوثيق، القيود المؤقتة ورفعها.

## 10) تعارض المصالح
PASS — موظف من نفس منشأة الإعلان يُمنع من الإسناد والقرار.

## 11) الجوال والترجمات
PASS — بلا تجاوز أفقي على 390px و820px و1280px؛ مفاتيح الترجمة عربي/إنجليزي مكتملة لكل شاشات البلاغات.

## 12) `tsgo --noEmit`
صفر أخطاء ✅

## 13) `vite build`
ناجح ✅

## 14) Critical / Error
لا يوجد Critical ولا أخطاء Console/Page. الخطأ 400 على `mkt_business_profiles` أُصلح والتحقق تم.

## 15) الاختبارات غير الناجحة وسببها
لا يوجد — **API 45/45** و**UI 17/17**. الاختباران 60 و62 كانا خللين حقيقيين في التطبيق وأُصلحا (التصنيف والتفاصيل في القسم أعلاه).

## 16) هل المرحلة مكتملة؟
نعم — نطاق نظام البلاغات والمخالفات مكتمل وظيفيًا وأمنيًا. لم يُنفَّذ Publish.

## بعد الاختبارات
- حسابات الاختبار مُوقفة، وبيانات الاختبار (منشأة/إعلان/بلاغات QA) مؤرشفة وخارج إحصائيات الإنتاج.
- سجل التدقيق `audit_log` محفوظ بالكامل ولم يُحذف.
