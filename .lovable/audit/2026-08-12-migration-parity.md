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

---

# الجزء الثاني — تنفيذ استعادة التكافؤ (12/08/2026)

**التزام صريح:** لم تُكتب أي عبارة على الإنتاج في هذه الجولة. كل استعلامات الإنتاج قراءة-فقط
(`SELECT` على `pg_catalog`/`information_schema`). لم يُمسّ سجل الهجرات، ولم تُطبَّق ملفات
الاستعادة على الإنتاج (الإنتاج يحمل حالتها أصلًا). لا Order 2، لا Batch 4، لا نشر، ولا مساس
بالعقار/المطاعم/البانوراما.

## 1) آلية قاعدة الاختبار (بلا تكلفة)
- **PostgreSQL 17.9 محلية داخل الحاوية**، مقبس `/tmp/pgshadow` منفذ 5433، قاعدة `shadow`
  تُنشأ من الصفر (`TEMPLATE template0 ENCODING 'UTF8'`) في كل جولة.
- لم يُستخدم فرع Supabase (يكلّف مالًا) ولم يُستخدم الإنتاج كقاعدة اختبار.
- `supabase` CLI و`docker` غير متوفرين، فبُنيت البنية التحتية يدويًا في
  `/tmp/shadow/bootstrap.sql`: الأدوار (anon/authenticated/service_role/…)، مخططات
  `auth`/`storage`/`extensions`/`vault`/`cron`، دوال `auth.uid()/role()/jwt()/email()`،
  جداول `auth.users` و`storage.objects/buckets`، `storage.foldername/filename/extension/operation`،
  منشور `supabase_realtime`، والامتيازات الافتراضية (`ALTER DEFAULT PRIVILEGES`) **كما هي في
  الإنتاج** (مأخوذة قراءة-فقط من `pg_default_acl`).
- استبدال واحد على مستوى المشغّل فقط: `CREATE EXTENSION pg_cron` غير قابل للتركيب محليًا،
  فيُحيَّد سطره في نسخة العمل المؤقتة (`/tmp/shadow/prepped/`) دون تعديل ملفات المستودع.

أوامر التشغيل: `/tmp/shadow/run.sh shadow` ثم `psql -d shadow -f /tmp/shadow/compare.sql`.

## 2) جرد الـ29 نسخة المفقودة وأثرها الفعلي (مستخرج من `statements` في سجل الإنتاج، لا من الأسماء)

| النسخة | الاسم | الأثر الفعلي | القرار |
|---|---|---|---|
| 20260808031847 | kaheel_appointments_phone_otp | دوال/جداول `appt_*` | **غير مستعادة** — `appt_*` أُزيلت من الإنتاج في 20260809035004 |
| 20260808031915 | kaheel_appointments_nearby_directory | دوال `appt_*` | غير مستعادة (نفس السبب) |
| 20260808032154 | kaheel_appointments_distance_hardening | إحكام دوال `appt_*` | غير مستعادة |
| 20260808090916 | kaheel_appointments_market_bridge_v1 | جسر `appt_*`↔سوق | غير مستعادة |
| 20260808091434 | …_bridge_hardening | إحكام الجسر | غير مستعادة |
| 20260808092229 | …_bridge_contract_fix | تصحيح العقد | غير مستعادة |
| 20260808152319 | kaheel_unified_customer_bookings | `kaheel_unified_customer_bookings` | غير مستعادة (الدالة غير موجودة في الإنتاج) |
| 20260808152330 | real_unified_bookings_and_syria_directory | جزء `appt/unified` **+** مخطط `mkt_private`، دوال `mkt_syria_normalize` و`mkt_syria_directory_name_requires_review`، جداول `mkt_syria_directory_entries`/`mkt_syria_university_programs`/`mkt_syria_technical_institutes`/`mkt_private.syria_directory_raw`، فهارس، 4 مشغّلات، 3 سياسات، منح، وبذور `mkt_workforce_*` | **مستعادة جزئيًا**: الجزء الحيّ فقط |
| 20260808152341 … 20260808152719 (15 نسخة) | استيراد دليل سوريا | **بيانات مرجعية فقط** (~8.3 ميغابايت INSERT: 6640 منشور + 37 قيد تصحيح + 895 برنامج + 105 معهد) | غير مستعادة — مصنّفة «بيانات إنتاج لم تُنسخ» |
| 20260808152726 | verify_syria_directory_import | `DO` يتحقق من العدّادات ويرفع استثناء | غير مستعادة (حرّاس عدّ مرتبطون بالبذور؛ سيفشلون على قاعدة نظيفة) |
| 20260808152846 | harden_syria_directory_raw_rls | سياسة منع anon/authenticated على `mkt_private.syria_directory_raw` | **مستعادة** |
| 20260812180555 | harden_access_control_fn_grants | REVOKE/GRANT لخمس دوال إدارية | **مستعادة** |
| 20260812180628 | harden_set_staff_perm_grant | REVOKE/GRANT لـ `mkt_admin_set_staff_perm` | **مستعادة** |

## 3) ملفات الاستعادة المضافة (أمام-فقط، idempotent، أسماء/طوابع جديدة — لا انتحال لأرقام النسخ المفقودة)

```
supabase/migrations/20260808153001_restore_parity_syria_directory.sql
supabase/migrations/20260808153002_restore_parity_harden_syria_directory_raw_rls.sql
supabase/migrations/20260808231318_restore_parity_storage_allow_any_operation.sql
supabase/migrations/20260812203011_restore_parity_harden_access_control_fn_grants.sql
supabase/migrations/20260812203012_restore_parity_harden_set_staff_perm_grant.sql
```

- الطابعان `20260808153001/2` يقعان **قبل** `20260810003047` الذي يعتمد على
  `mkt_syria_directory_entries`؛ لا يمكن ترتيبهما بعده. هما طابعان جديدان لم يُستخدما قط
  ولا يحملان أرقام النسخ المفقودة (الشرط 6 محفوظ).
- `20260808231318`: كشف جديد — `storage.allow_any_operation(text[])` موجود في الإنتاج
  ويُستخدَم في `20260808231319` المُلتزَم، لكنه **لم يُنشأ في أي ملف هجرة** (أُنشئ خارج
  الهجرات)، فكان البناء النظيف يفشل عليه. أُخذ التعريف حرفيًا من الإنتاج.
- التعديلات الوحيدة على SQL المستخرَج: حرّاس تكرار إضافية
  (`IF NOT EXISTS` / `DROP TRIGGER|POLICY IF EXISTS`). لا `DROP` للكائنات ولا حذف بيانات.

## 4) هجرتان محليتان غير مسجَّلتين — الحكم

`20260808202325` و`20260808202353` **لم تُطبَّقا على الإنتاج**، والإثبات قراءة-فقط:
- `public.mkt_can_review_identity_for(uuid)` غير موجودة في الإنتاج.
- سياسة الإنتاج: `mkt_business_registry_read = (mkt_can_manage_business(tenant_id) OR mkt_can_review_identity())`
  أي الصيغة الأقدم، لا الصيغة الأضيق التي في الملفين.

إبقاؤهما في `supabase/migrations` كان يجعل البناء النظيف يخالف الإنتاج (3 دوال زائدة + سياسة
مختلفة). نُقلا إلى `.archive/2026-08-12-unapplied-migrations/` مع README. تبنّيهما = كتابة على
الإنتاج، ويحتاج موافقتك (الشرط 18).

## 5) نتيجة البناء الكامل من ملفات المستودع وحدها

356 ملفًا (بعد النقل والإضافة) طُبِّقت على قاعدة فارغة. **4 ملفات فقط لم تكتمل، وكلها DML صرف**
(لا تحتوي أي عبارة DDL — تم التحقق سطرًا سطرًا):

| الملف | سبب التوقف | التصنيف |
|---|---|---|
| 20260802041618_b7e831cb… | `mkt_staff_permissions_user_id_fkey` | بيانات إنتاج (تعتمد مستخدم auth حقيقي) |
| 20260802041851_02331d68… | نفس القيد | بيانات إنتاج |
| 20260803000018_07ebbe50… | `owner_user_id` NOT NULL | بيانات إنتاج (إعلانات عرض) |
| 20260803000135_7bc73a12… | `TITLE_INVALID` من حرّاس التحقق | بيانات إنتاج |

لا خسارة هيكلية على الإطلاق نتيجة هذه الأربعة.

## 6) مقارنة الظل ↔ الإنتاج (نفس الاستعلام حرفيًا على الجهتين)

| العنصر | الإنتاج (عدد/بصمة) | الظل (عدد/بصمة) | النتيجة |
|---|---|---|---|
| tables (public) | 229 / d07cc3a8… | 229 / d07cc3a8… | **مطابق** |
| columns (نوع + قابلية NULL) | 2928 / 3596cb8c… | 2928 / 3596cb8c… | **مطابق** |
| triggers | 227 / 44bd17dc… | 227 / 44bd17dc… | **مطابق** |
| جداول RLS مفعّلة | 229 / d07cc3a8… | 229 / d07cc3a8… | **مطابق** |
| السياسات (اسم+أمر+أدوار+USING+CHECK) | 473 / 42bf60ac… | 473 / 42bf60ac… | **مطابق** |
| قيم الـ enum | 36 / 5e82a75a… | 36 / 5e82a75a… | **مطابق** |
| المخططات المطلوبة | 5 / c6ad028f… | 5 / c6ad028f… | **مطابق** |
| عدد الدوال (public) | 821 | 821 | **العدد مطابق** (البصمة تختلف — البند 7) |
| الفهارس | 576 / 1b790125… | 576 / 0692bbdf… | العدد مطابق، البصمة تختلف |
| القيود | 1001 / f8b26217… | 1001 / 67748454… | العدد مطابق، البصمة تختلف |
| EXECUTE لـ anon على دوال المشروع | 481 من 633 | 203 من 636 | فرق جوهري — البند 7 |

أهم نتيجة أمنية: **السياسات وRLS متطابقة تمامًا** بين البناء النظيف والإنتاج.

## 7) تصنيف الفروق المتبقية

1. **مقصود / بيئي:** فروق بصمة الفهارس والقيود ترجع لتأهيل المخطط في تعريفات
   `opclass`/الدوال (`extensions.` مقابل `public.`) لاختلاف مكان تركيب الامتدادات في
   الحاوية المحلية؛ العدد والأسماء متطابقة.
2. **بيانات إنتاج لم تُنسخ (مقصود):** بذور دليل سوريا (6640/37/895/105)، بذور صلاحيات
   الموظفين وإعلانات العرض المرتبطة بمستخدمي `auth.users` حقيقيين، وأي أسرار. غير مستعادة
   عمدًا ولا تُخزَّن في المستودع.
3. **عيب حقيقي يحتاج قرارك (انحراف ACL في الإنتاج):** الإنتاج يمنح `anon` صلاحية
   `EXECUTE` على **481** دالة مشروع، بينما البناء النظيف من المستودع يمنحها **203** فقط
   (أي الإنتاج **أوسع** من المستودع بـ278 دالة، منها 55 من `mkt_admin_*` و33 `mkt_listing_*`
   و31 `mkt_workforce_*`). السبب المرجَّح: إعادة إنشاء دوال خارج الهجرات (SQL Editor) أعادت
   ACL إلى الامتيازات الافتراضية لـ Supabase التي تمنح `anon`.
   - **لا يشكّل تصعيد صلاحيات مثبتًا**: الدوال الحسّاسة تفرض التحقق داخليًا وترفع `FORBIDDEN`،
     وقد أُثبت سابقًا أن الدوال الاثنتي عشرة الحسّاسة **مسحوبة عن anon في الإنتاج**.
   - **المقترح (لم يُنفَّذ):** هجرة إحكام واحدة تسحب `EXECUTE` عن `anon` عن كل دالة لا
     تحتاجها المسارات العامة، مع قائمة استثناءات صريحة للدوال العامة (`mkt_public_*`،
     `mkt_syria_*` للقراءة العامة…). هذه **كتابة على الإنتاج** ⇒ تحتاج موافقتك الصريحة.

## 8) حالة المرحلة

- شرط الإغلاق مُستوفى هيكليًا وأمنيًا في الجداول/الأعمدة/المشغّلات/RLS/السياسات/الـ enum،
  بعد استعادة 5 ملفات وأرشفة ملفين لم يُطبَّقا.
- الفارق الوحيد المصنَّف كعيب هو انحراف ACL في الإنتاج (البند 7-3)، ومعالجته تحتاج موافقة كتابة.
- Batch 4: **موقوف**. Order 2 (البانوراما/العقار): **لم يُلمس**. النشر: **لم يحدث**.
- لم تتغير أي ملفات واجهة أمامية في هذه الجولة (SQL وتوثيق فقط).
