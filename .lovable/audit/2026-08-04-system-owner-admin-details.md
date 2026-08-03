# تقرير: حذف نسخة النظام الداخلية القديمة (/audit) — 2026-08-04

الهدف: إزالة الواجهة الداخلية القديمة نهائيًا وترك نسخة إدارة واحدة فقط (`/admin` + `AdminShell`)
مع السوق الجديد، بدون أي حذف لبيانات قاعدة البيانات أو السجلات التاريخية.

## 1) المسارات القديمة التي أزيلت (ملفات الواجهة فقط)

حُذف مجلد `src/routes/_authenticated/` بالكامل (28 ملف مسار) ومعه الصدفة والشريط الجانبي القديم:

`/dashboard` (لوحة التحكم القديمة) · `/supervisors` و `/supervisors/$id` · `/projects` و `/projects/$id`
و `/projects_/$id/requests` · `/custody` · `/my-custody` · `/requests` و `/requests/$id` · `/suppliers`
· `/invoices` و `/invoices_/$id/lines` و `/invoices_/verified/new` · `/products` · `/reports`
· `/users` · `/team` · `/invitations` · `/trash` · `/audit` (سجل العمليات القديم) · `/settings`
· `/notifications` · `/onboarding` · `/portal` · `/my-documents` · `/select-account`

**لم يُحذف أي جدول أو سجل أو دالة في قاعدة البيانات.** الحذف اقتصر على ملفات الواجهة.

## 2) المكونات القديمة التي حُذفت

- الصدفة والشريط الجانبي: `src/components/AppLayout.tsx` (وأُعيد استخراج `LanguageToggle`
  إلى `src/components/LanguageToggle.tsx` لأن `/register` و `/market-setup` يستخدمانه).
- الطلبات: `RequestCard` · `RequestRow` · `RequestStage` · `RequestChangePanel` ·
  `RequestConversation` · `RequestWorkflowPanel` · `NewRequestWizard` · `ActionNowCard` ·
  `RecordCard` · `StatusBadge` · `PaymentNoBadge` · `PrintPortal` · `CustodyVoucher` ·
  `ProjectMembersCard` · `WorkspaceSwitcher` · `NotificationsBell` · `ForcePasswordChangeDialog` ·
  `InfoTable`.
- الملف العقاري: مجلد `src/components/property/` بالكامل (`PropertyFile` · `PropertyCard` ·
  `PropertySection` · `PropertyDocuments` · `PropertyServices` · `PropertyFormDialog` ·
  `DocumentAnalysisPanel`).
- مكتبات ومساعدات لم يبق لها مستخدم: `src/hooks/use-accounts.ts` · `src/lib/users.functions.ts` ·
  `src/lib/users.server.ts` · `src/lib/request-ui.ts` · `src/lib/property.ts` ·
  `src/lib/attachments.ts` · `src/lib/doc-analysis.ts` · `src/lib/doc-analysis-run.ts` ·
  `src/workers/doc-analysis.worker.ts`.

الحذف تم على دفعات متكررة حتى لم يبق ملف يتيم واحد داخل نطاق النظام القديم.

## 3) التحويل الجديد لمسار `/audit` وبقية الروابط القديمة

- `src/routes/audit.tsx` (مسار منطقي بلا واجهة): يحلّ هوية الطالب خادميًا ثم يحوّل مرة واحدة:
  - مدير النظام → `/admin/audit-log`
  - مستخدم مسجّل غير مدير → `/me` (وهي بدورها توجّهه إلى واجهته المعتمدة)
  - غير مسجّل → `/auth`
- بقية المسارات القديمة صارت `legacy` في `src/lib/routes-map.ts` ويحلّها المعالج المركزي
  `src/routes/$.tsx`: المسارات التشغيلية → `/me` · `/select-account` → `/choose-account` ·
  `/settings` → `/dashboard/profile` · `/notifications` → `/dashboard/notifications` ·
  `/invoices/verified/new` → `/verify-invoice`.
- جُعل `resolveLegacyTarget` يعمل على الأنماط، فصار `/projects/17` و `/requests/9` يُحلّان عبر
  قاعدتي `/projects/$id` و `/requests/$id` بدل السقوط في 404.
- أُزيل رابط `/audit` من التنقل مع حذف الشريط الجانبي القديم؛ لا يوجد الآن أي
  `navigate('/audit')` أو `href="/audit"` في الكود.

## 4) نتيجة الاختبار

شجرة المسارات بعد التنظيف لا تحتوي أي `_authenticated`، والمسارات الجذرية هي:
`/` · `/$` · `/admin/*` · `/audit` (تحويل) · `/auth` · `/choose-account` · `/market-setup` ·
`/me` · `/more` · `/register` · `/search` · `/verify-invoice` · `/business/new` · `/dashboard/*` ·
`/ads/$slug` · `/businesses/$slug` · `/categories/$slug` · `/u/$username` · `/invite/$token`.

| الحالة | الرابط | النتيجة |
| --- | --- | --- |
| مدير النظام | `/audit` | `/admin/audit-log` |
| مدير النظام | `/projects` `/supervisors` `/custody` `/invoices` `/trash` `/users` `/dashboard` `/portal` | `/admin` |
| مدير النظام | `/settings` | `/choose-account?next=%2Fdashboard%2Fprofile` |
| مدير النظام | تحديث الصفحة + رجوع المتصفح على `/audit` | يبقى على `/admin/audit-log` — لا حلقة تحويل |
| غير مسجّل (بعد الخروج) | `/audit` `/projects` `/dashboard` | `/auth` |

- لا 404 ولا Redirect Loop في أي حالة، ولم تظهر الواجهة القديمة أو شريطها الجانبي إطلاقًا.
- `/admin` والسوق (`/`، `/search`) يعملان كما هما: Console = 0، Overflow = 0 عند 1280.
- ملاحظة: أثناء سلسلة التحويل ظهر تحذير React واحد (تحديث حالة على مكوّن أُلغي تركيبه بسبب
  التحويل) ولا يظهر عند الفتح المباشر لأي صفحة.
- `tsgo --noEmit` = 0 أخطاء · `vite build` نجح.

## 5) الوضع النهائي

نسخة إدارة واحدة فقط: `/admin` داخل `AdminShell`. لا واجهة تشغيلية قديمة قابلة للوصول،
ولا صدفة أو شريط جانبي قديم، وبيانات النظام القديم وسجلاته محفوظة كما هي في قاعدة البيانات.
