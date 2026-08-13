# إغلاق البند UNVERIFIED — نداء HTTP مُصادَق من حساب غير مالك على `/admin/content/code`

التاريخ: 13/08/2026 — المنطقة Asia/Riyadh
النطاق: التحقق فقط. **لا كتابة على الإنتاج ولا نشر.** لم تُلمس أي جداول حسابات دائمة،
ولم تُحذف أي بيانات؛ حسابات الاختبار مؤقتة وأُزيلت بالكامل في نهاية الفحص.

## 1. طريقة الفحص (تجاوز كامل للواجهة)

- أُنشئت 3 حسابات اختبار عبر **Supabase Auth Admin API** (بريد `*.gate@kaheel-probe.invalid`)،
  ثم سُجّل الدخول بها عبر `POST /auth/v1/token?grant_type=password` للحصول على **Access Token حقيقي**.
- استُدعيت دوال الخادم مباشرة عبر HTTP على مسار `_serverFn` بمعرّفاتها الحقيقية
  (`codeListDir` / `codeReadFile` / `codeWriteFile` / `codeRestoreSnapshot`) مع ترويسات
  `Authorization: Bearer <token>` و`Origin` و`x-tsr-serverFn` وحمولة Seroval مطابقة لما يرسله المتصفح.
  أي لا واجهة، ولا بوابة UI، ولا `StoreEditGate` في المسار.
- قبل كل محاولة استُدعيت `mkt_is_system_owner()` بنفس التوكن للإثبات المستقل لحالة الحساب.

## 2. الحسابات المختبَرة

| الحساب | الوصف | `mkt_is_system_owner()` |
| --- | --- | --- |
| admin عادي | صف `mkt_platform_admins.platform_role='platform_admin'` | `false` |
| staff | `platform_admin` + `mkt_staff_permissions('reports.inbox_view')` | `false` |
| مالك متجر | مستخدم سوق عادي بلا أي صف إداري | `false` |

## 3. النتائج — 12/12 رفض

| الدالة | admin عادي | staff | مالك متجر |
| --- | --- | --- | --- |
| `codeListDir` (تصفّح) | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** |
| `codeReadFile` (قراءة) | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** |
| `codeWriteFile` (كتابة) | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** |
| `codeRestoreSnapshot` (استرجاع) | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** | **403 `NOT_OWNER`** |

رسالة الرفض في كل حالة: `NOT_OWNER` داخل مغلّف الخطأ، مع رمز الحالة `HTTP 403`.

## 4. إثبات أن المصدر هو فحص القاعدة

`assertOwner` في `src/lib/code-editor.functions.ts` هو أول سطر في كل معالِج، ولا يستدعي نظام
الملفات إطلاقًا قبل النتيجة:

```
const { data, error } = await context.supabase.rpc("mkt_is_system_owner");
if (data !== true) { setResponseStatus(403); throw new Error("NOT_OWNER"); }
```

- `context.supabase` من `requireSupabaseAuth` يعمل بهوية صاحب التوكن، فالدالة تُقيَّم في القاعدة
  على `auth.uid()` لا على أي قيمة من العميل.
- نفس النداء المباشر لـ`mkt_is_system_owner()` بالتوكن نفسه أعاد `false` لكل حساب (العمود الثالث
  في §2) — أي أن الرفض ورمز 403 نتيجة حرفية لقيمة الدالة في القاعدة.
- محاولة `codeWriteFile` لم تُنتج أي لقطة في `mkt_code_snapshots` ولم تُعدّل أي ملف، لأن الرفض
  يسبق كل من اللقطة والكتابة.

## 5. تصحيح مصاحب (وحيد)

سابقًا كان الرفض يخرج بغلاف خطأ عام؛ الآن يخرج بـ**403 صريح**:

- `src/lib/code-editor.functions.ts`: `setResponseStatus(403)` قبل رفع `NOT_OWNER` /
  `OWNER_CHECK_FAILED`.
- `src/start.ts`: وسيط الخطأ يمرّر أي `Response` مقصود كما هو بدل تحويله إلى 500.

## 6. النظافة بعد الفحص

حُذفت صفوف `mkt_staff_permissions` و`mkt_platform_admins` للحسابات المؤقتة (204)، ثم حُذفت
الحسابات نفسها من Auth (200). لا أثر باقٍ.

## 7. الحالة

البند الوحيد الموسوم UNVERIFIED في تقرير الاختبار الظلي **مُغلق ومُتحقَّق منه**.
لا تزال جميع الأوامر الأخرى موقوفة: **لا كتابة إنتاج، ولا نشر**، بانتظار موافقة المالك الصريحة.
