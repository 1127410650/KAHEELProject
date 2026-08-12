# تقرير تكافؤ الهجرات (قراءة فقط) — 12/08/2026 19:50 UTC

النطاق: فحص قراءة فقط. لم يُعدَّل سجل الإنتاج (`supabase_migrations.schema_migrations`)، ولم يُنفَّذ أي SQL، ولم تُنشأ/تُعدَّل ملفات هجرة في هذه الجولة. لا Order 2، لا Batch 4، لا نشر، ولا مساس بالعقار/المطاعم/البانوراما.

## 1) ملفات الهجرة المتعلقة بالتحكم في الوصول/الصلاحيات

| الملف | الغرض بسطر واحد |
|---|---|
| `20260803213811_f332e4f4-883a-4d79-bc8a-8b9695b0e3aa.sql` | تعريف أولي لدوال الإدارة: `mkt_admin_roles`, `mkt_admin_set_platform_role`, `mkt_admin_set_staff_perm`. |
| `20260811010033_f8756093-8732-4017-a9e2-edac2f1b1d3a.sql` | تعريف `mkt_admin_ops_log` (سجل العمليات الموحّد). |
| `20260811055431_63e5f1ea-ceee-4e74-aa60-da5397cccba6.sql` | دوال الموثوقية/الأداء: `mkt_perf_summary`, `mkt_flag_change_request/decide`, `mkt_content_health_scan/open`, `mkt_cms_preflight_override`. |
| `20260811055526_e6fa365d-5470-47a6-b9e8-104ee3893ffa.sql` | تصحيحات وإعادة إعلان للدوال أعلاه. |
| `20260812175607_372136a9-4ee6-4d5f-bc73-3eb9aebdabaa.sql` | إنشاء `mkt_permission_catalog` + GRANT الجدول، وإعلان `mkt_admin_save_staff_perms` و`mkt_permission_catalog_list` مع `REVOKE ALL ... FROM PUBLIC` + `GRANT ... TO authenticated`. |
| `20260812181646_6dde5f97-bc49-4879-bd4d-5fe7da601102.sql` | إصلاح `mkt_admin_save_staff_perms` (تعارض UUID/Text) + REVOKE/GRANT لخمس دوال إدارية. |
| `20260812183325_74974eda-4a75-4edb-8cef-b34198c233ce.sql` | جعل `mkt_content_health_open` يرفع `FORBIDDEN` صراحة + REVOKE/GRANT لتسع دوال حسّاسة. |
| `20260812184520_994afb20-9565-43d9-926e-cd8ffa54f808.sql` | ملف تكافؤ idempotent يعيد إعلان REVOKE/GRANT النهائي لست دوال (بديل وظيفي للنسختين المفقودتين اسميًّا). |

## 2) هل الملفان المذكوران موجودان في المستودع؟

```
$ ls -l supabase/migrations/20260812180555_harden_access_control_fn_grants.sql \
        supabase/migrations/20260812180628_harden_set_staff_perm_grant.sql
ls: cannot access '20260812180555_harden_access_control_fn_grants.sql': No such file or directory
ls: cannot access '20260812180628_harden_set_staff_perm_grant.sql': No such file or directory

$ git ls-files supabase/migrations | grep 20260812
supabase/migrations/20260812175607_372136a9-4ee6-4d5f-bc73-3eb9aebdabaa.sql
supabase/migrations/20260812181646_6dde5f97-bc49-4879-bd4d-5fe7da601102.sql
supabase/migrations/20260812183325_74974eda-4a75-4edb-8cef-b34198c233ce.sql
supabase/migrations/20260812184520_994afb20-9565-43d9-926e-cd8ffa54f808.sql
```

- `20260812180555_harden_access_control_fn_grants.sql` → **لا (No)**
- `20260812180628_harden_set_staff_perm_grant.sql` → **لا (No)**

السبب: أداة الهجرة تسمّي الملفات بلاحقة UUID ولا تقبل تسمية يدوية؛ النسختان طُبِّقتا على الإنتاج ولم يُكتب لهما ملف في المستودع.

## 3) الملفات المُلتزَمة التي تحتوي SQL المكافئ

`supabase/migrations/20260812181646_6dde5f97-bc49-4879-bd4d-5fe7da601102.sql`
```
85: REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) FROM PUBLIC, anon;
86: GRANT  EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) TO authenticated;
87: REVOKE EXECUTE ON FUNCTION public.mkt_admin_roles() FROM PUBLIC, anon;
88: GRANT  EXECUTE ON FUNCTION public.mkt_admin_roles() TO authenticated;
91: REVOKE EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC, anon;
92: GRANT  EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;
93: REVOKE EXECUTE ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC, anon;
94: GRANT  EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;
95: REVOKE EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
96: GRANT  EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated;
```

`supabase/migrations/20260812183325_74974eda-4a75-4edb-8cef-b34198c233ce.sql`
```
23-31: REVOKE EXECUTE ... FROM PUBLIC, anon  (9 دوال حسّاسة)
33-41: GRANT  EXECUTE ... TO authenticated   (نفس الدوال التسع)
 1-10: CREATE OR REPLACE FUNCTION public.mkt_content_health_open(...)  ... RAISE EXCEPTION 'FORBIDDEN';
```

`supabase/migrations/20260812184520_994afb20-9565-43d9-926e-cd8ffa54f808.sql`
```
 4-5 : mkt_admin_save_staff_perms(uuid, text[], text)      REVOKE ALL FROM PUBLIC, anon / GRANT EXECUTE TO authenticated
 7-8 : mkt_admin_set_staff_perm(uuid, text, boolean, text)  REVOKE / GRANT
10-11: mkt_permission_catalog_list()                        REVOKE / GRANT
13-14: mkt_admin_set_platform_role(uuid, text, text)        REVOKE / GRANT
16-17: mkt_admin_roles()                                    REVOKE / GRANT
19-20: mkt_admin_ops_log(text, text, timestamptz, timestamptz, integer, integer) REVOKE / GRANT
```

## 4) إثبات أن بناءً جديدًا من ملفات المستودع وحدها يعطي نفس الوضع الأمني النهائي

الترتيب في البناء الجديد تصاعدي بالنسخة، لذا آخر عبارة تُحدِّد الحالة النهائية. الخريطة (دالة → الملف الذي يثبّت الحالة النهائية):

| الدالة | anon/PUBLIC EXECUTE = مسحوب | authenticated = ممنوح | الملف النهائي |
|---|---|---|---|
| `mkt_admin_save_staff_perms(uuid,text[],text)` | ✔ | ✔ | 20260812184520 (سطر 4–5) |
| `mkt_admin_set_staff_perm(uuid,text,boolean,text)` | ✔ | ✔ | 20260812184520 (7–8) |
| `mkt_permission_catalog_list()` | ✔ | ✔ | 20260812184520 (10–11) |
| `mkt_admin_set_platform_role(uuid,text,text)` | ✔ | ✔ | 20260812184520 (13–14) |
| `mkt_admin_roles()` | ✔ | ✔ | 20260812184520 (16–17) |
| `mkt_admin_ops_log(text,text,timestamptz,timestamptz,int,int)` | ✔ | ✔ | 20260812184520 (19–20) |
| `mkt_perf_summary(integer)` | ✔ | ✔ | 20260812183325 (26 / 36) |
| `mkt_flag_change_request(text,text,text,integer)` | ✔ | ✔ | 20260812183325 (27 / 37) |
| `mkt_flag_change_decide(uuid,boolean,text)` | ✔ | ✔ | 20260812183325 (28 / 38) |
| `mkt_content_health_scan()` | ✔ | ✔ | 20260812183325 (29 / 39) |
| `mkt_content_health_open(integer)` | ✔ + يرفع `FORBIDDEN` | ✔ | 20260812183325 (1–10, 30 / 40) |
| `mkt_cms_preflight_override(uuid,text[],text)` | ✔ | ✔ | 20260812183325 (31 / 41) |

مطابقة التوقيعات مع الإنتاج (قراءة فقط من `pg_proc`): كل التوقيعات الاثنتي عشرة أعلاه موجودة حرفيًا، و`has_function_privilege('anon', …, 'EXECUTE') = false` و`('authenticated', …) = true`، وACL الفعلي لكل واحدة:
`postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres` (لا `=X/` لـ PUBLIC ولا `anon=X`).

خلاصة النقطة 4: **بالنسبة لهذه الدوال الاثنتي عشرة**، غياب ملفَي 180555/180628 لا يترك أي فرق في الحالة الأمنية النهائية؛ إعادة الإعلان الـ idempotent في 183325 و184520 تُنتج نفس الوضع تمامًا.

## 5) مقارنة السجل: ملفات المستودع مقابل سجل الإنتاج

- عدد ملفات المستودع: **356**
- عدد نسخ سجل الإنتاج: **383**

مقارنة يومية:

| اليوم | السجل | المستودع | فرق |
|---|---|---|---|
| 20260731 | 45 | 45 | 0 |
| 20260801 | 47 | 47 | 0 |
| 20260802 | 42 | 42 | 0 |
| 20260803 | 41 | 41 | 0 |
| 20260804 | 41 | 41 | 0 |
| 20260806 | 1 | 1 | 0 |
| 20260807 | 5 | 5 | 0 |
| **20260808** | **41** | **16** | **-25** |
| 20260809 | 51 | 51 | 0 |
| 20260810 | 41 | 41 | 0 |
| 20260811 | 22 | 22 | 0 |
| **20260812** | **6** | **4** | **-2** |

### 5.1 موجود في السجل ومفقود كملف في المستودع (29 نسخة)
```
20260808031847, 20260808031915, 20260808032154,
20260808090916, 20260808091434, 20260808092229,
20260808152319, 20260808152330, 20260808152341, 20260808152352,
20260808152403, 20260808152414, 20260808152424, 20260808152437,
20260808152448, 20260808152500, 20260808152512, 20260808152529,
20260808152546, 20260808152601, 20260808152632, 20260808152641,
20260808152655, 20260808152707, 20260808152719, 20260808152726,
20260808152846,
20260812180555, 20260812180628
```

### 5.2 موجود كملف في المستودع وغير مسجَّل في سجل الإنتاج (نسختان)
```
20260808202325, 20260808202353
```

قراءة صريحة: الانحراف ليس محصورًا في نسختَي إحكام التحكم في الوصول. هناك **27 نسخة إضافية من 08/08** مطبَّقة على الإنتاج بلا ملفات مقابلة، ونسختان محليتان غير مسجَّلتين. لذلك لا يمكنني أن أزعم أن بناءً جديدًا من المستودع يعيد **كامل** المخطط؛ ما أثبتُّه في النقطة 4 يشمل الوضع الأمني للدوال الاثنتي عشرة الحسّاسة فقط.

## 6) خطة معالجة مقترحة (لم تُنفَّذ — بانتظار الاعتماد)

**أ. تكافؤ التحكم في الوصول (منجَز فعليًا):** الملف `20260812184520` يغطي 180555/180628 بصيغة idempotent؛ لا حاجة لعمل إضافي هنا.

**ب. انحراف 08/08 (27 نسخة):** إضافة ملف/ملفات هجرة **للأمام فقط** و**idempotent** تعيد إعلان الحالة النهائية للكائنات التي أنشأتها تلك النسخ (جداول/دوال/سياسات/منح)، مبنية على مقارنة قراءة-فقط بين كائنات الإنتاج الحالية وما تنتجه ملفات المستودع. لا `DROP`، ولا حذف بيانات، ولا لمس السجل.

**ج. النسختان المحليتان غير المسجَّلتين (20260808202325, 20260808202353):** التحقق قراءة-فقط من أن SQL فيهما مطبَّق فعلًا في الإنتاج بطريق آخر؛ إن كان مطبَّقًا فلا إجراء (سجل الإنتاج لا يُعدَّل)، وإن لم يكن فيُعاد إعلانه ضمن ملف الأمام-فقط في (ب).

**د. حاجز مستقبلي:** بعد كل هجرة، مقارنة عدّ السجل بعدّ الملفات وإصدار تحذير عند أي فرق، ضمن التوثيق التشغيلي.

توقّف هنا بانتظار اعتماد المالك. لا تنفيذ لأي بند من (ب)/(ج)/(د) قبل موافقة صريحة.
