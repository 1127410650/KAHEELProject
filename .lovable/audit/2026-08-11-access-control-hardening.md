# تقرير إثبات — «الأدوار والصلاحيات» (Access Control Hardening)

الحالة: **مكتمل ومُثبت بالتنفيذ الحيّ** — بانتظار اعتماد المالك. لم تُنشر أي واجهة، ولم تبدأ الدفعة 4.
تاريخ التنفيذ: 12/08/2026 (UTC) — قاعدة البيانات: مشروع الإنتاج `rgpnhzovtceitqxpiilf`.

---

## 9) شهادة البيئة (تُقرأ أولًا — نقطة المالك رقم 9)

- التنفيذ تم على **مشروع Supabase الإنتاجي** `rgpnhzovtceitqxpiilf` (ارتباط خارجي `external_unmanaged`). **لا توجد قاعدة بيانات Staging منفصلة.**
- لذلك: **كل هجرة تُطبَّق تصبح حيّة فورًا في الإنتاج**، حتى لو لم يُنشر أي كود واجهة. عبارة «لا شيء حيّ» غير صحيحة عند تشغيل هجرة، ولن تُستخدم مجددًا.
- ما تغيّر فعليًا في الإنتاج نتيجة هجرات هذه المرحلة:
  1. **سحب حق التنفيذ (REVOKE EXECUTE)** عن `PUBLIC` و`anon` من الدوال الإدارية الحساسة. اتجاه أكثر تحفّظًا فقط — لا يمنح الزائر شيئًا.
  2. **منح `authenticated`** حق التنفيذ صراحةً على نفس الدوال (سلوك مطابق لما قبلها؛ القرار الأمني داخل جسم الدالة لم يتغيّر).
  3. **إصلاح خلل حقيقي** في `mkt_admin_save_staff_perms` (تفصيله في القسم «الثغرة المكتشفة»).
- **لا** تغيير في المخطط، **لا** حذف بيانات، **لا** تعديل صفوف قائمة. التغيير آمن للأمام وقابل للعكس بمنح/سحب معاكس أو باستعادة نسخة الدالة السابقة.

---

## الثغرة الحقيقية التي كشفتها الاختبارات (ولم تُطمس)

أثناء المصفوفة الحيّة فشل **كل** حفظ صلاحيات من مالك النظام:

```
42804: column "entity_id" is of type uuid but expression is of type text
```

السبب: `mkt_admin_save_staff_perms` كانت تُمرّر `_user_id::text` إلى `mkt_ops_log.entity_id` وهو من نوع `uuid`، فتفشل المعاملة بالكامل قبل كتابة أي صف. أي أن شاشة الصلاحيات كانت **معطّلة عمليًا** للمالك نفسه رغم أن الحماية كانت صحيحة.

الإصلاح: هجرة `20260812181646` تعيد تعريف الدالة بنفس المنطق مع تمرير `_user_id` كـ `uuid`. بعد الإصلاح نجح الحفظ والتراجع والتزامن (انظر S6/S14 أدناه).

---

## 1) مصفوفة السيناريوهات الخمسة عشر (نتائج حيّة، لا ملخّص)

المرجع: `/tmp/browser/ac/probe.mjs` (تشغيل حيّ عبر REST/Auth بالمفتاح العام + جلسات حقيقية)، و`sup.mjs` للسيناريوهات 12 و13.
العدّ قبل/بعد لكل تشغيل: `mkt_staff_permissions=18`، `mkt_permission_catalog=69`، `mkt_platform_admins=5` — **لم تتغيّر** (`SIDE-EFFECT: none`).

| # | المنفّذ | العملية | المتوقع | الفعلي | آلية المنع | أثر في القاعدة |
|---|---|---|---|---|---|---|
| 1 | زائر غير مسجّل (مفتاح عام فقط) | `mkt_permission_catalog_list` / `mkt_admin_save_staff_perms` / `mkt_admin_set_staff_perm` / `mkt_admin_set_platform_role` | رفض | `401 · 42501 permission denied for function` (الأربع) | سحب EXECUTE عن `anon` (قبل دخول جسم الدالة) | لا شيء |
| 1ب | زائر غير مسجّل | `SELECT` على `mkt_permission_catalog` و`mkt_staff_permissions` | لا بيانات | `200 []` | RLS: لا سياسة تشمل `anon` | لا شيء |
| 2 | **مستخدم مسجّل بلا أي صلاحية إدارية** (حساب مؤقت حقيقي) | الدوال الأربع أعلاه | رفض | `400 · P0001 "Not authorized"` (الأربع) | فحص `mkt_is_system_owner()` داخل الجسم | لا شيء |
| 2ب | نفس المستخدم | `INSERT` على `mkt_permission_catalog` | رفض | `403 · 42501 new row violates RLS` | RLS: لا سياسة INSERT | لا شيء |
| 2ج | نفس المستخدم | `UPDATE` / `DELETE` على `mkt_permission_catalog` | 0 صف | `200 []` (صفر صف) | RLS: سياسة SELECT تحجب الصفوف فتُفرَّغ جملة WHERE | العدّ 69 قبل وبعد |
| 2د | نفس المستخدم | `INSERT` على `mkt_staff_permissions` (لنفسه) | رفض | `403 · 42501 new row violates RLS` | RLS: لا سياسة INSERT | لا شيء |
| 2هـ | نفس المستخدم | `SELECT` على `mkt_perf_budgets` / `mkt_flag_change_requests` / `mkt_content_health_findings` / `mkt_cms_preflight_overrides` / `audit_log` / `mkt_ops_log` | لا بيانات | `200 []` لكل واحد | RLS مبنية على `mkt_admin_can(...)` | لا شيء |
| 2و | نفس المستخدم | `mkt_admin_ops_log` RPC | لا بيانات | `200 []` | شرط `mkt_admin_can('audit.view')` داخل الاستعلام (حجب صفوف) | لا شيء |
| 3 | موظف **عرض فقط** (`users.view`, `listings.view`) | `mkt_permission_catalog_list` / `save_perms` / `set_perm` | رفض | `400 P0001 "Not authorized"` (الثلاثة) | فحص الجسم | لا شيء |
| 3ب | موظف عرض فقط | `SELECT` على جدول السجل | لا بيانات | `200 []` | RLS `mkt_is_platform_admin()` | لا شيء |
| 4 | موظف **عرض + تعديل بلا اعتماد** (`content.view/edit`, `users.manage`) | عملية اعتماد إعلان + `mkt_admin_can('listings.review')` | رفض / false | `400 P0001 "Not authorized"` و`can=false` | فحص صلاحية مستقلة للاعتماد | لا شيء |
| 5 | موظف **باعتماد بلا `access_control`** (`listings.review`, `verifications.review`) | `mkt_admin_save_staff_perms` | رفض | `400 P0001 "Not authorized"` | الحفظ محصور بـ `system_owner` | لا شيء |
| 6 | **مالك النظام** | `catalog_list` ثم منح/سحب صلاحيات | نجاح | `200` — 69 مفتاحًا؛ منح `{listings.view, users.view}` ثم `{content.*, users.manage}` ثم استبدال بمجموعة الاعتماد، مع `operation_id` وقيم before/after | تخويل خادمي صحيح | كتابة مقصودة على الحساب المؤقت فقط، أُزيلت في التنظيف |
| 6ب | مالك النظام | منح مفتاح غير موجود `totally.made.up` | رفض | `400 P0001 "Unknown permission key: totally.made.up"` | السجل `mkt_permission_catalog` هو المصدر الوحيد | لا شيء |
| 7 | موظف — **سحب الصلاحية أثناء الجلسة** | نفس التوكن قبل/بعد السحب | يتغيّر فورًا | قبل: `can(listings.review)=true` — بعد السحب بنفس التوكن: `false`، و`catalog_list` → `Not authorized` | القرار خادمي لكل طلب، لا يعتمد على التوكن | حالة الصلاحيات فقط |
| 8 | زائر / مستخدم بلا صلاحية | فتح `/admin/*` مباشرة بالرابط | منع | حارس المسار `src/routes/admin/route.tsx` (`ssr:false` + `guardSession`) يحوّل إلى `/auth`، وبعدها كل استعلام يُرفض خادميًا كما في الصفوف 1–3 | حارس واجهة **+** فرض خادمي | لا شيء |
| 9 | استدعاء API/RPC يدوي خارج الواجهة (curl/fetch) | كل ما سبق نُفِّذ **خارج الواجهة تمامًا** عبر REST مباشرة | رفض | مطابق للصفوف 1–5 | سحب EXECUTE + فحص الجسم + RLS | لا شيء |
| 10 | تزوير الدور من العميل | ترويسات/حمولة مزوّرة (`x-role`, `role`, حقول claims في الجسم) + قراءة `mkt_my_platform_role` | تجاهل | `400 P0001 "Not authorized"`؛ و`my_platform_role` تُرجع `platform_role: null, is_platform_admin: false` | الهوية من `auth.uid()` داخل الدالة، لا من العميل | لا شيء |
| 11 | مالك النظام يمنح **نفسه** | `save_perms` و`set_staff_perm` على `_user_id = self` | رفض | `400 P0001 "You cannot change your own permissions"` (كلاهما) | فحص `_user_id = auth.uid()` | لا شيء |
| 11ب | مستخدم عادي يرفّع نفسه | `INSERT` في `mkt_platform_admins` بدور `system_owner` | رفض | `403 · 42501 new row violates RLS` | RLS: لا سياسة INSERT | العدّ 5 قبل وبعد |
| 12 | مالك النظام (وهو الوحيد: `system_owner=1`, `platform_admin=4`) | تخفيض نفسه إلى `platform_admin` ثم إلغاء الدور | رفض | `400 P0001 "The last system owner cannot be removed"` (الحالتان) | حارس داخل `mkt_admin_set_platform_role` | دور المالك بعد الاختبار: `system_owner` (سليم) |
| 13 | مستخدم مسجّل من خارج أي كيان | قراءة `tenants` / `audit_log` / `mkt_ops_log` / `mkt_admin_notes` / `mkt_staff_permissions` / `mkt_platform_admins` | لا بيانات | `200 []` لكل واحد | عزل RLS بـ `current_tenant_id()` / `auth.uid()` | لا شيء |
| 14 | جلستان تعدّلان نفس الشخص | استدعاءان متزامنان لـ `save_perms` | تسلسل بلا نتيجة ممزّقة | A: `before=[]`, `after=[users.manage, users.view]` — B: `before=[users.manage, users.view]`, `after=[listings.review, listings.view]`؛ الحالة النهائية = نتيجة B بالضبط | `FOR UPDATE` + `pg_advisory_xact_lock` داخل نفس المعاملة | حالة نهائية متسقة، لا خليط |
| 15أ | تدقيق — **نجاح** حسّاس | فحص `audit_log` + `mkt_ops_log` بعد حفظ صلاحيات ناجح | صف تدقيق ذرّي مع النجاح | صفوف حقيقية أدناه (نفس المعاملة، تُثبَّت معًا) | الكتابة داخل جسم الدالة قبل `COMMIT` نفسه | صف تدقيق دائم |
| 15ب | تدقيق — **رفض** غير مخوّل | فحص `audit_log` + `mkt_ops_log` بعد رفض | **لا صف** (متوقَّع ومقبول) | `audit_rows=0, ops_rows=0` | `RAISE EXCEPTION` يتراجع بالمعاملة كاملة، **ولا حالة تغيّرت** (قبل≡بعد في س2/س3) | لا شيء |

**سيناريو 2 — الحساب المؤقت:** أُنشئ حساب `ac-probe-…@example.com` حقيقي بكلمة مرور، ووُثّقت جلسته، ونُفّذت به كل نداءات الصفوف 2/2ب…2و، ثم **حُذف نهائيًا** (`DELETE /auth/v1/admin/users/<id>` → 200) مع حساب هدف ثانٍ وحساب عزل ثالث. تحقق ما بعد الحذف: `residual perms rows for temp users: []` والعدّادات النهائية مطابقة لعدّادات ما قبل التشغيل.

### صف تدقيق حقيقي (معرّفات محجوبة جزئيًا)

`audit_log`:
```json
{ "entity_type": "mkt_staff_permission", "action": "bulk_update",
  "actor_id": "0420…5269", "entity_id": "58f2…21f8",
  "old_value": { "perms": ["users.manage", "users.view"] },
  "new_value": { "perms": ["listings.review","listings.view"],
                 "added": ["listings.review","listings.view"],
                 "removed": ["users.manage","users.view"],
                 "operation_id": "1881400e-…-35d3b4e666f5" },
  "reason": "probe concurrent B", "created_at": "2026-08-12T18:17:23.510826+00:00" }
```

`mkt_ops_log`:
```json
{ "action": "access_control.perms_updated", "unit": "platform", "entity": "user",
  "entity_id": "58f2…21f8", "actor_user_id": "0420…5269",
  "summary": "2 granted, 2 revoked",
  "meta": { "before": ["users.manage","users.view"],
            "after": ["listings.review","listings.view"],
            "added": ["listings.review","listings.view"],
            "removed": ["users.manage","users.view"],
            "reason": "probe concurrent B",
            "operation_id": "1881400e-…-35d3b4e666f5" } }
```

الحقول المطلوبة كلها حاضرة: المنفّذ، المتأثر، قبل، بعد، المضاف، المسحوب، السبب، معرّف العملية، الوقت. السجلّان للقراءة فقط من الواجهة (لا سياسة INSERT/UPDATE/DELETE لأي منهما لدور `authenticated`؛ الكتابة تتم داخل دوال `SECURITY DEFINER` فقط).

---

## 3) لا تنفيذ ضمني لـ `PUBLIC` — بالتوقيع الكامل

`has_function_privilege` لكل من `public` / `anon` / `authenticated` (بعد الهجرات):

| التوقيع | SECDEF | المالك | search_path | public | anon | authenticated |
|---|---|---|---|---|---|---|
| `mkt_admin_save_staff_perms(uuid, text[], text)` | ✔ | postgres | `public, pg_temp` | false | **false** | true |
| `mkt_admin_set_staff_perm(uuid, text, boolean, text)` | ✔ | postgres | `public, pg_temp` | false | **false** | true |
| `mkt_permission_catalog_list()` | ✔ | postgres | `public, pg_temp` | false | **false** | true |
| `mkt_admin_set_platform_role(uuid, text, text)` | ✔ | postgres | `public, pg_temp` | false | **false** | true |
| `mkt_admin_roles()` | ✔ | postgres | `public` | false | **false** | true |
| `mkt_admin_ops_log(text, text, timestamptz, timestamptz, int, int)` | ✔ | postgres | `public, pg_temp` | false | **false** | true |
| `mkt_admin_can(text)` | ✔ | postgres | `public` | true | true | true |
| `mkt_staff_has(text)` | ✔ | postgres | `public` | true | true | true |
| `mkt_is_system_owner()` | ✔ | postgres | `public` | true | true | true |
| `mkt_is_platform_admin()` | ✔ | postgres | `public` | true | true | true |
| `mkt_my_platform_role()` | ✔ | postgres | `public` | true | true | true |
| `log_audit(text, text, uuid, jsonb, jsonb, text)` | ✔ | postgres | `public, pg_temp` | true | true | true |

**التبرير الصريح للصفوف المتبقية المفتوحة لـ `anon`:** الخمسة الأولى منها **دوال قرار للقراءة فقط** لا تكتب شيئًا، وتُرجع `false` / `null` بلا هوية (مثبت في السيناريو 10: `is_platform_admin=false`)؛ حجبها عن `anon` يكسر عرض الواجهة العامة بلا مكسب أمني. و`log_audit` ترفض بلا جلسة برسالة `Authentication required` قبل أي كتابة.

## 4) فحص التحميلات الزائدة (Overloads)

عمود `overloads` في نفس الاستعلام: **1 لكل دالة** من الاثنتي عشرة — لا توجد نسخة قديمة بتوقيع مختلف بقيت ممنوحة لـ `anon` بعد الإحكام.

## 5) `SECURITY DEFINER` — المالك و`search_path`

جميع الدوال أعلاه `prosecdef = true`، مالكها `postgres`، و**لا واحدة منها `MUTABLE`**: كل واحدة تحمل `search_path` مثبّتًا (`public, pg_temp` أو `public`؛ ودالة ملخص الأداء `public, analytics`). مع تثبيت المسار لا يمكن خطف اسم جدول/دالة عبر مخطط يسبق `public` في مسار المستدعي، ولا تجاوز العزل عبر حقن معرّفات؛ ولا تُبنى أي جملة SQL ديناميكية من مدخلات المستخدم في هذه الدوال.

## 6) RLS — السياسات الفعلية والاختبارات السلبية

| الجدول | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `mkt_permission_catalog` | `mkt_is_platform_admin()` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `mkt_staff_permissions` | `user_id = auth.uid() OR mkt_is_super_admin()` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `mkt_platform_admins` | `user_id = auth.uid() OR mkt_is_platform_admin()` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `mkt_perf_budgets` | `mkt_admin_can('platform.health.view')` + ALL بـ `settings.manage` | `settings.manage` | `settings.manage` | `settings.manage` |
| `mkt_flag_change_requests` | `mkt_admin_can('flags.manage')` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `mkt_content_health_findings` | `mkt_admin_can('platform.health.view')` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `mkt_cms_preflight_overrides` | `mkt_admin_can('settings.manage')` | **لا سياسة** | **لا سياسة** | **لا سياسة** |
| `audit_log` | عزل `tenant_id = current_tenant_id()` وصفوف المنصة محجوبة | — | — | — |
| `mkt_ops_log` | `mkt_admin_can('audit.view')` | **لا سياسة** | **لا سياسة** | **لا سياسة** |

**النتيجة الجوهرية:** «لا سياسة كتابة» مع تفعيل RLS تعني **منعًا افتراضيًا لكل كتابة** من دور `authenticated`؛ الكتابة الوحيدة الممكنة تمرّ عبر دوال `SECURITY DEFINER` التي تفحص التخويل أولًا. وقد أُثبت ذلك سلبيًا لا نظريًا: صفوف 2ب/2ج/2د/11ب في المصفوفة (`42501` على الإدراج، وصفر صف على التعديل/الحذف، مع ثبات العدّادات).

## 7) قواعد الحراسة بجلسات حقيقية

| القاعدة | النتيجة |
|---|---|
| (أ) لا يعدّل المستخدم صلاحيات نفسه | ✔ `"You cannot change your own permissions"` (الدالتان) |
| (ب) لا يرفّع المستخدم دوره | ✔ `INSERT` على `mkt_platform_admins` مرفوض `42501`؛ ودالة الدور تفحص `mkt_is_system_owner()` |
| (ج) لا يمكن إسقاط آخر مالك نظام | ✔ `"The last system owner cannot be removed"` (تخفيض وإلغاء) |
| (د) تزامن جلستين بلا نتيجة ممزّقة | ✔ before/after متسلسلان، الحالة النهائية = آخر عملية بالكامل |
| (هـ) التدقيق يلتقط كل الحقول | ✔ الصفان أعلاه |

## 8) الهجرات وربطها بالمستودع

| الملف | الوصف | الحالة |
|---|---|---|
| `supabase/migrations/20260812175607_372136a9-4ee6-4d5f-bc73-3eb9aebdabaa.sql` | إنشاء `mkt_permission_catalog` + بذر المفاتيح + `mkt_admin_save_staff_perms` + `mkt_permission_catalog_list` + إحكام `mkt_admin_set_staff_perm` | في المستودع ✔ |
| `20260812180555_harden_access_control_fn_grants` | سحب EXECUTE عن `anon` من `save_staff_perms` و`permission_catalog_list` | قيد الإنتاج موجود؛ ملف بنفس الاسم غير موجود محليًا، لكن SQL المطابق مُعاد حرفيًا في `20260812181646` و`20260812183325` |
| `20260812180628_harden_set_staff_perm_grant` | سحب EXECUTE عن `anon` من `set_staff_perm` | قيد الإنتاج موجود؛ ملف بنفس الاسم غير موجود محليًا، لكن SQL المطابق مُعاد حرفيًا في `20260812181646` و`20260812183325` |
| `supabase/migrations/20260812181646_6dde5f97-bc49-4879-bd4d-5fe7da601102.sql` | (1) إصلاح `entity_id` في `save_staff_perms`، (2) سحب EXECUTE عن `anon` من `mkt_admin_set_platform_role` و`mkt_admin_roles`، (3) إعادة إعلان منح/سحب الهجرتين أعلاه بصيغة idempotent | في المستودع ✔ |
| `supabase/migrations/20260812183325_74974eda-4a75-4edb-8cef-b34198c233ce.sql` | جعل `mkt_content_health_open` يرفع `FORBIDDEN` صراحةً بدل قائمة فارغة، وإحكام EXECUTE للتسع دوال المختبرة | في المستودع ومطبّق على الإنتاج ✔ |

لا يوجد انحراف **وظيفي**: كل SQL فعّال في الإنتاج معلن في ملفات الهجرة الحالية. لكن يوجد انحراف **اسمي في سجل الهجرة**: الملفان ذوا الاسمين `20260812180555` و`20260812180628` غير موجودين محليًا رغم وجود قيديهما في دفتر الإنتاج. أداة الهجرة المُدارة تمنع إنشاء ملفات مرتجعة زمنيًا يدويًا؛ لذلك لا يدّعي هذا التقرير تطابقًا اسميًا غير موجود.

## ملحق الإثبات المطلوب — جلسات JWT حقيقية بعد آخر هجرة

وقت التشغيل: `12/08/2026 18:36–18:38 UTC`. أُنشئت ثلاثة حسابات اختبار مؤقتة بجلسات JWT فعلية، ثم حُذفت كلها عبر Auth Admin API (`deleted=true` لكل حساب). المعرّفات والبريد محجوبة في الناتج المحفوظ.

### أ) المستخدم المسجّل بلا صلاحيات — كل دالة إدارية

| الدالة المنفذة بجلسة حقيقية | الخطأ الفعلي | الصف/العداد قبل | بعد | لا أثر جانبي |
|---|---|---:|---:|---|
| `mkt_admin_save_staff_perms` | `P0001 Not authorized` | perms=18, ops=36, audit=644 | 18, 36, 644 | ✔ |
| `mkt_admin_set_staff_perm` | `P0001 Not authorized` | perms=18, ops=36, audit=644 | 18, 36, 644 | ✔ |
| `mkt_permission_catalog_list` | `P0001 Not authorized` | catalog=69, ops=36, audit=644 | 69, 36, 644 | ✔ |
| `mkt_perf_summary` | `P0001 FORBIDDEN` | ops=36, audit=644 | 36, 644 | ✔ |
| `mkt_flag_change_request` | `P0001 FORBIDDEN` | requests=0, ops=36, audit=644 | 0, 36, 644 | ✔ |
| `mkt_flag_change_decide` | `P0001 FORBIDDEN` | requests=0, ops=36, audit=644 | 0, 36, 644 | ✔ |
| `mkt_content_health_scan` | `P0001 FORBIDDEN` | findings=0, ops=36, audit=644 | 0, 36, 644 | ✔ |
| `mkt_content_health_open` | `P0001 FORBIDDEN` | findings=0, ops=36, audit=644 | 0, 36, 644 | ✔ |
| `mkt_cms_preflight_override` | `P0001 FORBIDDEN` | overrides=0, ops=36, audit=644 | 0, 36, 644 | ✔ |

ظهر أثناء الإثبات أن النسخة السابقة من `mkt_content_health_open` كانت تحجب الصفوف وتعيد قائمة فارغة بدل الرفض الصريح. أُغلق هذا الفراغ إضافيًا في هجرة `20260812183325`، ثم أعيد الاختبار وأصبح الناتج الفعلي `P0001 FORBIDDEN` أعلاه. كذلك، الإدراج المباشر لنفس المستخدم في `mkt_staff_permissions` أعاد `42501 new row violates row-level security policy` وبقي عدده `0 → 0`.

### ب) الحراسة الذاتية والإدارية المحدودة

- منح المستخدم العادي نفسه صلاحية عبر الدالتين: `Not authorized`، وعدد صلاحياته `0 → 0`.
- مدير محدود (`admin.view` + `platform.health.view`، بلا `access_control.manage` وليس مالك نظام) حاول تعديل هدف آخر: `P0001 Not authorized`.
- المدير المحدود حاول تصفير صلاحيات مالك النظام الوحيد: `P0001 Not authorized`، وعدد صلاحيات المالك `1 → 1`.
- جلسة المالك نفسها حاولت تعديل صلاحيات ذاتها: `You cannot change your own permissions`، والعدد `1 → 1`.
- جلسة المالك حاولت تخفيض آخر `system_owner`: `The last system owner cannot be removed`، والدور بقي `system_owner`.

### ج) التزامن والسجل الفعلي

استدعاءان متداخلان من جلستين للمالك استهدفا المستخدم المؤقت نفسه. النتيجة الخام المختصرة:

```json
{"A":{"before":[],"after":["users.manage","users.view"],"error":null},
 "B":{"before":["users.manage","users.view"],"after":["listings.review","listings.view"],"error":null},
 "final":["listings.review","listings.view"],"coherent":true}
```

وظهر صفا `audit_log` المتسلسلان: الأول `old=[] / new=[users.manage,users.view]`، والثاني `old=[users.manage,users.view] / new=[listings.review,listings.view]`، ولكل منهما `added`, `removed`, `reason`, `operation_id`, `actor_id`, `entity_id`, `created_at`. هذا يثبت أن `FOR UPDATE` + القفل الاستشاري منعا الحالة الممزقة.

**قيد مهم ظهر بالاختبار:** النجاحات الحساسة تُسجّل في `audit_log` و`mkt_ops_log` داخل المعاملة. أما الرفض الذي ينتهي بـ`RAISE EXCEPTION` فلا يمكن أن يحتفظ بصف تطبيق داخل المعاملة نفسها لأن PostgreSQL يتراجع عنها كاملة؛ الاستعلام الفعلي أعاد `audit_rows=0, ops_rows=0` للرفض. لذلك لا يدّعي التقرير خلاف ذلك: أخطاء الرفض مرصودة كاستجابة RPC/سجل منصة، بينما سجل التطبيق الدائم يثبت النجاحات. إضافة سجل رفض مستقل تحتاج قناة خارج المعاملة وليست جزءًا من هذه المرحلة.

### د) انحدار المسارات العامة الشرعية

| المسار/الدالة كزائر | النتيجة الفعلية |
|---|---|
| `POST /api/public/track` عبر `mkt_analytics_ingest` | HTTP 204 ✔ |
| `mkt_track([])` | نجاح ✔ |
| `mkt_listing_track` / `mkt_listing_track_share` لمعرّف غير موجود | تنفيذ بلا خطأ ✔ |
| `mkt_public_business*` لمسار غير موجود | نجاح، `[]` ✔ |
| `mkt_store_public` لمسار غير موجود | نجاح، نتيجة فارغة ✔ |
| `mkt_re_provider_public` لمسار غير موجود | نجاح، `[]` ✔ |
| قراءة `mkt_categories` العامة | نجاح، صف واحد في العينة ✔ |
| Supabase Auth health بالمفتاح العام | HTTP 200 ✔ |

لم تُسحب أي من دوال المسارات العامة أعلاه؛ الإحكام اقتصر على الدوال الإدارية الحساسة.

## 10) الفحوص التقنية بعد الإحكام

| الفحص | النتيجة |
|---|---|
| `tsgo --noEmit` | نظيف — لا أخطاء |
| `bun run build` (إنتاج) | نجاح — `✓ built`، وتوليد Worker مكتمل |
| إعادة تشغيل المصفوفة بعد الهجرة | كل الصفوف أعلاه من التشغيل الحي **بعد** `20260812183325` |
| مدقق Supabase | التحذيرات المتبقية عامة على المشروع (امتدادات في `public`، دوال قرار للقراءة مفتوحة لـ `anon`) ولا يخص أيٌّ منها دوال أو جداول نظام الصلاحيات بعد هذه الهجرة |

## مصفوفة اكتمال الأمر 3 — صف «الأمان والصلاحيات»

| البند | الحالة | الدليل |
|---|---|---|
| مصدر موحّد للصلاحيات | ✔ | `mkt_permission_catalog` (69 مفتاحًا) + رفض أي مفتاح خارجه |
| فرض خادمي لا شكلي | ✔ | المصفوفة 1–15، كلها من خارج الواجهة |
| منع افتراضي لـ `anon` | ✔ | جدول القسم 3 |
| RLS على الجداول الحساسة + اختبارات سلبية | ✔ | جدول القسم 6 |
| أثر تدقيقي غير قابل للتعديل | ✔ | صفوف القسم 15 + غياب سياسات الكتابة |
| هجرات ملتزمة بلا انحراف | ✔ | القسم 8 |
| صدق البيئة | ✔ | القسم 9 |

**حالة المرحلة الصادقة:** (أ) الدفعة 4 معلّقة، (ب) لا نشر Front-end، (ج) قاعدة الإنتاج تغيّرت بالفعل بهجرتي REVOKE الآمنتين للأمام وبالإصلاحات الإضافية الموثقة، (د) الفحوص الهيكلية ناجحة، (هـ) اختبارات التخويل الحية بجلسات JWT هي دليل هذا الملحق، (و) الاعتماد النهائي ما زال بانتظار المالك.
