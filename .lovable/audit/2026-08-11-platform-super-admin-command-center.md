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

## Batch 7 (final) — the 20 remaining runtime assertions, executed with real sessions

Fixtures: three temporary users created with the service key and deleted afterwards —
`qa-user-*` (no permission), `qa-staff-*` (`support.view` only), `qa-exec-*`
(`support.manage`, `reports.manage`, `audit.view`, `data.export`, `staff.sessions_revoke`).
Harness: `/tmp/qa/run.mjs` (real password sign-in against the Data API) and
`/tmp/qa/browser2.py` (Playwright, real session in the running app).

16. plain user rpc mkt_admin_ops_log returns nothing — PASS. status 200, rows 0
17. plain user rpc mkt_admin_export_record refused — PASS. not_authorized
18. plain user rpc mkt_admin_revoke_user_sessions refused — PASS. not_authorized
19. plain user rpc mkt_admin_message_reports refused/empty — PASS. status 200 []
20. plain user opens own ticket (sequential ref_no) — PASS. SUP-2608-00001
21. plain user reads only own tickets — PASS. rows 1
22. staff with support.view reads the ticket — PASS. rows 1
23. staff without support.manage cannot reply nor update — PASS. reply 403 new row violates row-level security poli / update 200 rows 0
24. staff sees no ops log and cannot export — PASS. ops rows 0, export not_authorized
25. support.manage posts public reply and internal note — PASS. public 201 / internal 201
26. internal note invisible to the requester — PASS. rows 1: QA public reply from support
27. closed ticket refuses a requester reply — PASS. closed=true, reply 403 new row violates row-level security policy for tab
28. closing stamped closed_at/closed_by server-side — PASS. closed_at=2026-08-11T01:14:28.464795+00:00 by=true
29. ref_no and owner identity frozen — PASS. attempt 200 [{"id":"4d7a708d-77e6-415b-9d3c-58bf7a3e6e70","ref → ref SUP-2608-00001
30. requester reports a message that is not theirs — PASS. status 201 [{"id":"0e5e48b9-f53d-453d-94e4-af28a73ef0c9","message_id":"
31. reporter cannot edit the report after creating it — PASS. patch 200 rows 0
32. hide_message applied and written to mkt_chat_audit — PASS. state hidden, audit rows 1
33. every admin action above has an ops-log line with the right actor — PASS. found support.replied, support.internal_note_added, support.ticket_updated, chat_report.hide_message
34. export without a reason refused — PASS. reason_required
35. 21st export refused with daily_export_limit_reached — PASS. daily_export_limit_reached
36. each export mirrored into export log and ops log — PASS. export rows 20, ops rows 20
37. revoke ends the target sessions and its next request fails — PASS. ended 1, refresh 400 refresh_token_not_found
38. self revoke refused — PASS. cannot_revoke_self
39. revoking a platform admin refused — PASS. cannot_revoke_platform_admin
40. revoke logged with the ended-session count — PASS. {"sessions_ended":1}
41. plain user is refused on every /admin/* URL typed directly — PASS. /admin:denied, /admin/dashboard:denied, /admin/support:denied, /admin/ops-log:denied, /admin/chat-reports:denied, /admin/users:denied, /admin/settings:denied
42. staff with support.view opens only the granted support module — PASS. support screen rendered
43. staff nav shows no unauthorised module (no ops log / accounts / settings) — PASS. nav limited to work box + support
44. staff sees the ticket read-only, no processing controls — PASS. ticket visible=True, action buttons=[]
45. staff without audit.view is refused on the operations log — PASS. denied

Result: 30/30 executed assertions PASS (25 API + 5 browser). Screenshots under `/tmp/qa/*.png`.

### Defects found by these tests and fixed in the same pass

- Admin actions on support tickets and chat reports were not written to the unified
  operations log. Fixed: `replySupportTicket`, `updateSupportTicket` and
  `reviewMessageReport` now call `writeOpsLog` (assertion 33).
- Staff holding a module permission but not the platform-admin flag were refused by
  `AdminShell`. Fixed: `/admin/support`, `/admin/ops-log` and `/admin/chat-reports`
  now pass `staffAccess` / `staffChecking` (assertions 42, 45).
- A refused screen could hang on skeletons forever: the "no access" effect dropped the
  cached identity, which made the shell think it was still checking. Fixed with
  `useClearAdminData` (keeps identity, drops admin data) and a `checking` flag that
  depends on load state only (assertion 41 — `/admin/users` was reachable-looking before).

### Cleanup

The three QA users were deleted from Auth (verify → 404 each) together with the demo
ticket, its messages, the chat report, the demo conversation/message and their staff
permission rows. Append-only rows stay by design and are accounted for here:
25 `mkt_ops_log` lines and 20 `mkt_export_log` lines with QA actors, plus 1
`mkt_chat_audit` line. The delete attempt on the export log was itself refused with
`P0001: mkt_ops_log is append-only`, which is the guard working as intended.

## Final summary

1. **What was built.** A super-admin command centre across four migrations: reported-chat
   moderation (`mkt_message_reports` + admin RPCs + `/admin/chat-reports`), the support
   desk (`mkt_support_tickets` with sequential `SUP-YYMM-#####`, `mkt_support_messages`
   with internal notes, `/admin/support`), server-side session revocation
   (`mkt_admin_revoke_user_sessions`), the append-only unified operations log
   (`mkt_ops_log` + `mkt_admin_ops_log` + `/admin/ops-log`), and audited export
   (`mkt_export_log` + `mkt_admin_export_record`, 20/day/staff, reason mandatory).
2. **What was reused.** `AdminShell` and its navigation groups, `AdminPage` scaffolding,
   the existing `mkt_staff_permissions` / `mkt_platform_admins` permission model,
   `usePlatformIdentity`, the theme tokens, and the existing i18n dictionary.
3. **Security decisions.** Actor identity always taken from `auth.uid()`, never from the
   request. Every admin RPC is `security definer` with a fixed `search_path` and a
   permission gate. Logs are append-only at the database level (three triggers, no
   UPDATE/DELETE grants). Internal notes are invisible to requesters through RLS, not
   through the UI. `ref_no` and ticket ownership are frozen by trigger. Revocation
   refuses self-revoke and refuses targeting another platform admin.
4. **Numbers.** 4 migrations, 5 new tables/log surfaces, 5 new permission keys, 3 admin
   screens, 30/30 runtime assertions passing, 15 earlier schema/anon assertions passing,
   `tsgo --noEmit` clean.
5. **Remaining notes.** QA rows in the append-only logs cannot be removed by design.
   `mkt_admin_overview` returns 400 for a staff user without dashboard permissions; the
   screen still renders correctly, but the call should be gated to silence the noise.
6. **Path.** `.lovable/audit/2026-08-11-platform-super-admin-command-center.md`.
7. **Report name.** Platform Super Admin Command Center — Batches 1-7 acceptance report.

No Publish performed.
