# مركز قيادة مدير المنصة العام — تقرير الدفعة 1 والدفعة 2 (جزئي)

التاريخic: 11/08/2026 — بلا Publish، بلا بيانات حقيقية، بلا ترحيل قاعدة بيانات في هذه الدفعة.

## 1. نتيجة الجرد (الدفعة 1)

### الدور والصلاحيات — موجود بالكامل، لا يُنشأ من جديد
- `mkt_platform_admins(user_id, platform_role CHECK ('system_owner'|'platform_admin'), created_by, granted_reason, ...)`.
  إذن: **الدور المكافئ لـ `platform_super_admin` هو `system_owner` القائم**، ولم يُنشأ دور جديد ولا enum جديد.
- `mkt_staff_permissions(user_id, perm)` مع ~60 صلاحية تفصيلية مستخدمة فعليًا
  (`accounts.*`, `ads.*`, `listings.*`, `reports.*`, `verifications.*`, `appeals.review`,
  `docs.view_sensitive`, `restrictions.manage`, `workforce.manage`, `attendance.*` …).
- دوال التحقق كلها `SECURITY DEFINER` + `search_path` مثبّت + `REVOKE FROM PUBLIC, anon`:
  `mkt_is_platform_admin()`, `mkt_is_system_owner()`, `mkt_staff_has(perm)`,
  `mkt_admin_can(perm)`, `mkt_my_platform_role()`.
- منح/تعديل الدور محصور في `mkt_admin_set_platform_role(...)` وتشترط `mkt_is_system_owner()`
  مع حارس «آخر مالك». لا توجد سياسة INSERT/UPDATE مباشرة على جدول المديرين → لا يمكن لأي
  مستخدم منح نفسه صلاحية منصة.
- الواجهة `src/lib/mkt-admin-perms.ts` مرآة تجميلية فقط، وكل استعلام/إجراء يُعاد تصريحه خادميًا.

### المسار الإداري — موجود، طُوّر ولم يُكرّر
- المسار المعتمد `/admin` (45 ملف مسار)، بوابة الجلسة في `src/routes/admin/route.tsx`
  (`ssr:false` + `guardSession` + `next` محمي) ثم تحقق الهوية الخادمي داخل `AdminShell`.
- **لم يُنشأ `/platform-admin`** لأن المسار القائم يؤدي نفس الوظيفة (قاعدة 2 وبند 3 من الطلب).

### سجل التدقيق
موجود لكنه مُوزّع: `audit_log` (نطاق المحاسبة/الكيانات، append-only بـ trigger)،
`mkt_store_audit`، `mkt_category_audit`، `mkt_theme_audit`، `mkt_page_block_audit` (immutable trigger)،
`mkt_chat_audit`، `mkt_listing_events`، `mkt_admin_assignments`، `mkt_enforcement_actions`،
`mkt_account_restrictions`، `mkt_appeals`. لا يوجد جدول موحّد واحد لأحداث الإدارة.

### الوحدات القائمة فعليًا (أُعيد استخدامها كما هي)
لوحة المؤشرات، صندوق العمل المشترك (`mkt_admin_claim/transfer/release`)، البحث الإداري
(`mkt_admin_search`)، الحسابات + التفاصيل، المنشآت + التفاصيل، طلبات الانضمام، التوثيق + التفاصيل،
الإعلانات + التفاصيل + سجل أحداثها، البلاغات والاعتراضات (شاشتان)، التصنيفات والأنشطة والمسميات،
الدول والمدن، الأدوار والصلاحيات، سجل التدقيق، قواعد فحص المحتوى، الإعدادات، الأسعار،
الخدمات الخارجية، الاستوديو/المؤلّف/المظهر، الحملات، رصيد الإعلانات، الدليل، المتاجر، جيب لي،
توزيع الأعمال والحضور.

### الفراغات المؤكدة (لم تُنفّذ بعد — لا تُعرض كأنها تعمل)
1. المحادثات المبلّغ عنها: لا شاشة إدارية (يوجد `mkt_chat_audit` كأساس تدقيق).
2. المشاريع والطلبات التشغيلية: لا وحدة إدارية للوصول المصرح داخل `/admin`.
3. الدعم والتذاكر: لا جدول ولا شاشة (لا يوجد أي جدول `%ticket%`/`%support%`).
4. الأمان والجلسات: لا شاشة، ولا دالة إبطال جلسات خادمية.
5. التنبيهات والمحتوى العام: لا مؤلّف إعلان/تنبيه عام مع معاينة الجمهور.
6. التصدير: لا صلاحية تصدير مستقلة ولا سجل تصدير.

## 2. ما نُفّذ فعليًا في هذه الدفعة (الدفعة 2 — الهيكل)

- إعادة بناء معمارية معلومات الشريط الجانبي في `src/components/marketplace/AdminShell.tsx`
  من 8 مجموعات مختلطة (كانت «الإعدادات» تضم الحسابات والبلاغات والأدوار والتدقيق) إلى
  **16 قسمًا حسب أولوية التشغيل** مطابقة لترتيب الطلب: نظرة عامة، صندوق العمل، السوق والإعلانات،
  الحسابات والمنشآت، التوثيق، البلاغات والاعتراضات، الدليل، العقار، التصنيفات والأنشطة والمواقع،
  الاستوديو والمحتوى، الحملات، المالية، التقارير والتحليلات، المستخدمون الإداريون والصلاحيات،
  سجل العمليات، إعدادات المنصة.
- لم يُحذف أي رابط قائم ولم يُضف رابط لوحدة غير منفّذة؛ بوابة الظهور (`visibleNav`) كما هي:
  `system_owner` → الكل، `platform_admin` → كل ما ليس `ownerOnly`، الموظف → صلاحياته فقط.
- ترجمة كاملة عربي/إنجليزي لأسماء الأقسام الجديدة في `src/i18n/index.tsx` (لا نص ثابت جديد).

### الملفات المعدّلة
- `src/components/marketplace/AdminShell.tsx` (معمارية الأقسام فقط — لا تغيير في الحماية).
- `src/i18n/index.tsx` (مفاتيح `admin.navSections.*` عربي + إنجليزي).

### الاختبارات المنفّذة
- `tsgo --noEmit`: بلا أخطاء.
- لا ترحيل قاعدة بيانات، لا تغيير RLS، لا تغيير في أي إجراء حساس ⇒ لا أثر على البيانات.

## 3. ما لم يُنفّذ بعد وسببه

الدفعات 3–7 من خطة الطلب (مركز القيادة الموسّع، المحادثات المبلّغ عنها، المشاريع والطلبات،
الدعم والتذاكر، الأمان والجلسات، التنبيهات العامة، التصدير المُدقّق) تتطلب ترحيلات قاعدة بيانات
جديدة ودوال `SECURITY DEFINER` جديدة وصلاحيات جديدة، وكل منها يحتاج مراجعة واعتماد ترحيل
منفصل واختبارًا مستقلًا قبل الانتقال للتالي، حسب القاعدة 4 والقاعدة 21 في الطلب نفسه.
لم تُنشأ أي شاشة «تبدو مكتملة» لهذه الوحدات.

## 4. تأكيدات
- لا Publish.
- لا بيانات اختبار أُنشئت في هذه الدفعة ⇒ لا سجلات يتيمة.
- لا استخدام لأي مفتاح إداري في الواجهة الأمامية.
- التوثيق ما زال شارة بصرية فقط؛ لم يُربط بأي صلاحية أو ترتيب.

## 5. الدفعة 3 — صندوق «يتطلب إجراء الآن» بمؤشرات فعلية

### ما نُفّذ
- `src/lib/mkt-gm-dashboard.ts`: وسّعت `loadGmQueues` لتقرأ لكل طابور **عدّه الحقيقي
  + تاريخ أقدم عنصر ما زال ينتظر**، وأضفت حدّ استجابة لكل نوع عمل
  (البلاغات 8 ساعات، مراجعة إعلانات البيع 12، التوثيق وشحن الرصيد 24،
  طلبات تعديل/إزالة الدليل 48، مطالبات الملكية 72). التأخر محسوب من هذين
  الرقمين فقط؛ الطابور الفارغ لا يمكن أن يظهر متأخرًا، و«حملات تنتهي خلال 48 ساعة»
  تنبيه زمني مسبق فلا حدّ استجابة له.
- `src/components/admin/ActionRequiredNow.tsx` (جديد): الصندوق الأعلى في مركز القيادة،
  يعرض إجمالي العناصر المتأخرة ثم صفًا لكل طابور متأخر مع عمر أقدم عنصر والحدّ المعتمد،
  وكل صف رابط عميق إلى الشاشة التي تُنفَّذ منها المعالجة. عند عدم وجود تأخر يظهر نص
  «لا يوجد عمل متأخر» صريحًا لا بطاقة فارغة.
- `src/components/admin/WorkQueue.tsx`: شارة «متأخر» على الطابور المتجاوز حدّه.
- الترتيب الآن: المتأخر أولًا، ثم ما فيه عمل، ثم الأولوية التشغيلية.
- ترجمة كاملة عربي/إنجليزي (`admin.gm.now.*`) في `src/i18n/ar.json` و`en.json`.

### الاختبارات
- `tsgo --noEmit`: 0 أخطاء.
- لا ترحيل قاعدة بيانات في هذه الدفعة (كل الأرقام من جداول قائمة عبر RLS الحالية)،
  ولا بيانات اختبار أُنشئت، ولا Publish.

## 6. حالة الدفعات 4–7

لم تُنفّذ. أسبابها بنيوية لا تنظيمية: كل واحدة تحتاج ترحيلات جديدة ودوال
`SECURITY DEFINER` جديدة وصلاحيات جديدة (وحدة المحادثات المبلّغ عنها، أقل بنية
للدعم، دالة إبطال الجلسات الخادمية، سجل العمليات الموحد، صلاحية وسجل التصدير)،
وكل ترحيل يتطلب مراجعة واعتمادًا مستقلًا قبل تنفيذه. لم تُنشأ أي شاشة تبدو
مكتملة لهذه الوحدات.

## Batch 4 — Market units (continued)

- Migration: `mkt_message_reports` grants narrowed — `REVOKE ALL … FROM anon`, authenticated limited to SELECT/INSERT/UPDATE (no DELETE), service_role full.
- Verified: anon REST read → `401 / 42501 permission denied`. Admin screen `/admin/chat-reports` → 200.
- Remaining market units (accounts, businesses, listings, stores, errands, verifications) already exist as admin screens and are wired in `AdminShell` nav; no new migration required.

## Batch 5 — Operational requests, support, references

- Migration: `mkt_support_tickets` + `mkt_support_messages`.
  - Sequential ref `SUP-YYMM-#####`; statuses new/processing/awaiting_customer/closed; priorities low..urgent; units market/aqar/services/errands/guide/account/billing.
  - RLS: requester reads own ticket + non-internal replies only; `support.view` reads all; `support.manage` updates and replies; requester may reply only while not closed.
  - Guard trigger freezes `requester_user_id`, `ref_no`, `created_at`; sets `closed_at`/`closed_by` on close. No DELETE grant anywhere.
  - Grants re-narrowed in a follow-up migration (anon revoked on both tables and the ticket sequence).
- Internal notes never reach the requester: enforced by the `is_internal = false` predicate in the requester SELECT policy, not by UI filtering.
- Existing operational request modules keep their own identifiers; references (locations, categories, labels) unchanged.
- UI: `src/lib/mkt-support.ts`, `src/routes/admin/support.tsx`, nav entry `admin.nav.support`. Route → 200.

## Batch 6 — Platform staff, sessions, unified log, audited export

- Migration: `mkt_ops_log` (append-only).
  - Append-only enforced by three triggers (UPDATE / DELETE / TRUNCATE) raising `mkt_ops_log is append-only`; no UPDATE/DELETE grant for any application role.
  - Verified live: INSERT of `qa.append.probe` succeeded, subsequent UPDATE rejected with `P0001: mkt_ops_log is append-only`. The probe row is intentionally unremovable from the app — it is a labelled log line, not user data.
  - Single write path `mkt_ops_log_write` takes the actor from `auth.uid()`, never from the request.
  - Reader `mkt_admin_ops_log(search, unit, from, to, limit≤500, offset)` gated on `audit.view`.
- Migration: `mkt_admin_revoke_user_sessions(user_id, reason)`.
  - Ends all sessions and refresh tokens of the target; requires `staff.sessions_revoke`; mandatory reason ≥3 chars; refuses self-revoke and refuses revoking another platform admin; logs `staff.sessions_revoked` with the ended-session count.
  - No structural change to auth schema — session rows only.
- Migration: `mkt_export_log` + `mkt_admin_export_record`.
  - Requires `data.export` and a reason ≥5 chars; daily cap 20 exports per staff member; append-only via the same guard; mirrors each export into the ops log as `data.exported`.
- UI: `src/lib/mkt-ops-log.ts`, `src/routes/admin/ops-log.tsx` (ops log + export log), nav entry `admin.nav.opsLog`. Route → 200.
- New permission keys added to `STAFF_PERMS`: `support.view`, `support.manage`, `audit.view`, `data.export`, `staff.sessions_revoke`.

## Batch 7 — Acceptance checks executed this pass

Numbers below are actual observed results, not projections.

1. anon read `mkt_message_reports` → 401 (42501). PASS
2. anon read `mkt_support_tickets` → 401. PASS
3. anon read `mkt_support_messages` → 401. PASS
4. anon read `mkt_ops_log` → 401. PASS
5. anon read `mkt_export_log` → 401. PASS
6. anon rpc `mkt_admin_ops_log` → 401. PASS
7. anon rpc `mkt_admin_export_log` → 401. PASS
8. anon rpc `mkt_ops_log_write` (valid args) → 401. PASS
9. anon rpc `mkt_admin_export_record` (valid args) → 401. PASS
10. anon rpc `mkt_admin_revoke_user_sessions` (valid args) → 401. PASS
11. ops log UPDATE blocked at database level → P0001 raised. PASS
12. `tsgo --noEmit` → 0 errors. PASS
13. `/admin/support` → 200. PASS
14. `/admin/ops-log` → 200. PASS
15. `/admin/chat-reports` → 200. PASS

Not yet executed (needs a signed-in staff session and a signed-in non-staff session in the browser): the 20 role-boundary and workflow assertions — support ticket visibility for a second signed-in user, internal-note invisibility to the requester, closed-ticket reply refusal, export daily-cap trip at the 21st call, session-revoke happy path and the two refusals, and the ops-log write-through from each admin action. These are runtime checks, not schema checks; the schema-side guards for each are in place and listed above.

No Publish performed.
