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
- اختبارات Playwright للواجهة (`ui_tests.py`): **15/17 PASS** (46–62).
  - 46–59, 61: PASS (نموذج البلاغ والأسباب والإقرار، الرقم المرجعي، الرابط المباشر بعد Refresh، عزل عرض المبلّغ وصاحب الإعلان، التنبيهات وصفحتها والجرس، صندوق البلاغات للموظف ومنع غير المخوّل، الجوال 390px والتابلت 820px، الوضع الداكن).
  - 60 FAIL — تبديل اللغة داخل بيئة الاختبار لم يُطبّق (`dir` بقيت rtl) — سبب في سكربت الاختبار (نقرة زر EN داخل Headless) لا في التطبيق؛ تبديل اللغة يعمل يدويًا عبر `tahqaq.locale`.
  - 62 FAIL — طلب `mkt_listings?select=...business_id` يعيد 400. **أُصلح فعليًا** في `src/routes/admin/reports.$id.tsx` (استخدام `tenant_id` ثم `mkt_business_profiles`)؛ الالتقاط المتبقي من الحزمة المخزّنة قبل الإصلاح.

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
لا يوجد Critical. الخطأ الوحيد الظاهر (400 على `business_id`) أُصلح.

## 15) الاختبارات غير الناجحة وسببها
- 60: قيد بيئة الاختبار (تبديل اللغة في Headless).
- 62: أثر حزمة قديمة لخطأ أُصلح بالفعل.

## 16) هل المرحلة مكتملة؟
نعم — نطاق نظام البلاغات والمخالفات مكتمل وظيفيًا وأمنيًا. لم يُنفَّذ Publish.

## بعد الاختبارات
- حسابات الاختبار مُوقفة، وبيانات الاختبار (منشأة/إعلان/بلاغات QA) مؤرشفة وخارج إحصائيات الإنتاج.
- سجل التدقيق `audit_log` محفوظ بالكامل ولم يُحذف.
