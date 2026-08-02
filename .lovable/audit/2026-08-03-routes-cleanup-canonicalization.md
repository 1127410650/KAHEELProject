# تنظيف خريطة المسارات وتوحيدها — 2026-08-03

الهدف: تقليل المسارات المكررة/القديمة المسجَّلة في المشروع (وهي ما تعرضه قائمة Preview في Lovable) دون حذف أي وظيفة، ودون CSS، ودون تعديل RLS، ودون نشر.

## 1. العدد قبل/بعد

| القياس | قبل | بعد |
|---|---|---|
| ملفات مسارات مسجَّلة (createFileRoute) | 64 | 62 |
| ملفات مسارات وحيدة الغرض = تحويل قديم | 2 (`/marketplace`, `/login`) | 0 |
| مسارات قديمة معالَجة مركزيًا | 0 | 8 |
| معالج تحويل مركزي | لا يوجد | `src/routes/$.tsx` (`LegacyRouteRedirect`) |

الصفحات الوظيفية لم يُحذف منها شيء.

## 2. المسارات المعتمدة (Canonical)

عام: `/` · `/search` · `/categories/$slug` · `/ads/$slug` · `/u/$username` · `/businesses/$slug` · `/auth` · `/register` (إنشاء حساب بدعوة) · `/invite/$token` · `/verify-invoice` · `/more`.

حساب السوق (Dashboard): `/dashboard/profile` · `/dashboard/notifications` · `/dashboard/messages` · `/dashboard/favorites` · `/dashboard/my-ads` · `/dashboard/ads/new` · `/dashboard/ads/$id/edit` · `/dashboard/requests` · `/dashboard/reports(/$id)` · `/dashboard/violations` · `/dashboard/business`.

هوية السوق: `/choose-account` · `/market-setup`.

النظام التشغيلي (كيان نشط): `/select-account` · `/me` · `/settings` · `/onboarding` · `/notifications` · `/portal` · `/dashboard` · `/projects(+/$id)` · `/projects_/$id/requests` · `/requests(+/$id)` · `/suppliers` · `/products` · `/invoices` + مساراته · `/custody` · `/my-custody` · `/my-documents` · `/supervisors(+/$id)` · `/team` · `/users` · `/invitations` · `/reports` · `/audit` · `/trash`.

الإدارة: `/admin` · `/admin/listings` · `/admin/verifications` · `/admin/geo` · `/admin/reports(/$id)`.

## 3. المسارات القديمة والمحوَّلة (بدون تعريف Route منفصل)

| المسار القديم | المعتمد | الحفاظ على Query/Hash |
|---|---|---|
| `/marketplace` | `/` | نعم (`/marketplace?q=abc` → `/?q=abc`) |
| `/home`, `/market` | `/` | نعم |
| `/login` | `/auth` | نعم مع `next` (مسار العودة) |
| `/signin`, `/sign-in` | `/auth` | نعم |
| `/signup`, `/sign-up` | `/register` | نعم |

الكل يُعالَج داخل `src/routes/$.tsx` عبر `resolveLegacyTarget()` في `src/lib/routes-map.ts`، مع تسجيل الاستخدام محليًا (`logLegacyRoute`). أي مسار غير معروف → 404 الجذر.

**أُزيل تعريفه المنفصل:** `src/routes/marketplace.tsx` و`src/routes/login.tsx` (كانا مجرد إعادة توجيه؛ سلوكهما محفوظ حرفيًا في المعالج المركزي، لذلك الروابط الخارجية القديمة ما زالت تعمل).

## 4. مسارات لم تُدمج بعد المقارنة (وظائف مستقلة فعلًا)

| المسارين | لماذا لا يُدمجان |
|---|---|
| `/choose-account` ↔ `/select-account` | الأول يختار **هوية السوق** (شخصي/منشأة عبر `mkt_my_accounts` + `mkt_account_context`) بتصميم السوق؛ الثاني يختار **كيان العمل الداخلي (tenant)** عبر `use-accounts` + العضويات. مكوّنان ومصدرا بيانات وصلاحيات مختلفة تمامًا. |
| `/notifications` ↔ `/dashboard/notifications` | الأول تنبيهات النظام التشغيلي (جدول `notifications`، طلبات المشرفين)؛ الثاني تنبيهات السوق (`mkt-notifications`: بلاغات ومخالفات واعتراضات). |
| `/portal` ↔ `/dashboard` | `/portal` بوابة المشرف (طلباته/أفعاله التالية)؛ `/dashboard` لوحة المحاسب/الإدارة التشغيلية بأقسام Accordion. |
| `/reports` ↔ `/dashboard/reports` | تقارير تشغيلية (صلاحية `reports.view`) مقابل بلاغات السوق للحساب. |
| `/requests` ↔ `/dashboard/requests` | طلبات النظام التشغيلي مقابل طلبات/عروض السوق. |
| `/register` ↔ `/auth` | `/register` هو نموذج إنشاء الحساب **بدعوة** (يتحقق من `invitation_preview`) ويستخدمه `/invite/$token` وصفحة «المزيد»؛ ليس نسخة من شاشة الدخول. لذلك أُبقي معتمدًا وحُوِّل إليه `/signup`. |

المسارات التشغيلية (`/projects` … `/trash`) كلها صفحات مستقلة بمكونات وصلاحيات مختلفة → أُبقيت ومحمية بصلاحيتها في `routes-map.ts`.

## 5. الروابط الداخلية

- `src/routes/ads.$slug.tsx`: `/login` → `/auth`.
- `src/components/marketplace/MarketShell.tsx`: رابط الدخول في الفوتر `/login` → `/auth`، وحُذف `/marketplace` من `FULL_FOOTER_PATHS`.
- `src/routes/choose-account.tsx`: التوجيه بعد اختيار الحساب `/marketplace` → `/`.
- تحقّق نهائي: لا يوجد أي `"/login"` أو `"/marketplace"` مكتوب يدويًا في الهيدر أو الشريط السفلي أو قائمة الحساب أو صفحة المزيد أو الفوتر — الوجود الوحيد الآن داخل `routes-map.ts` كقاعدة legacy.

## 6. الحماية

المسار المحوَّل لا يمنح شيئًا: التحويل يحدث في `beforeLoad` ثم يعمل حاجز المسار المعتمد نفسه (تسجيل الدخول، الحساب النشط، العضوية، الدور، الصلاحية، تطابق `tenant_id`/`business_id` في RLS). لم تُلمس أي سياسة RLS.

## 7. نتائج الاختبارات (زائر، 1280px)

| الاختبار | النتيجة |
|---|---|
| `/` | ✅ يعمل |
| `/marketplace?q=abc` | ✅ → `/?q=abc` (Query محفوظ) |
| `/home` | ✅ → `/` |
| `/auth?mode=login` | ✅ يعمل |
| `/login?next=/dashboard/my-ads` | ✅ → `/auth?next=%2Fdashboard%2Fmy-ads` (مسار العودة محفوظ) |
| `/signup` | ✅ → `/register` (وضع إنشاء الحساب بدعوة) |
| `/register` | ✅ يعمل |
| `/select-account` | ✅ محمي → `/auth` |
| `/choose-account` | ✅ محمي → `/auth` |
| `/notifications` | ✅ محمي → `/auth` |
| `/dashboard/notifications` · `/dashboard/messages` | ✅ محمي مع `next` |
| `/dashboard` | ✅ محمي |
| `/admin` | ✅ محمي (`next=/admin`) |
| `/verify-invoice` | ✅ عام ويعمل |
| `/projects` `/requests` `/custody` `/reports` `/portal` | ✅ لا تُفتح دون دخول/صلاحية |
| `/ads/<slug غير موجود>` | ✅ «الإعلان غير متوفر» (404 وظيفي) |
| `/this-does-not-exist` | ✅ صفحة 404 الجذر |
| Redirect Loop | ✅ لا يوجد |
| أخطاء Console | ✅ 0 |
| `tsgo --noEmit` | ✅ |
| `vite build` | ✅ |

## 8. غير محسوم

- التحقق من 403 لمستخدم مسجَّل بلا صلاحية على المسارات التشغيلية: يحتاج جلسة دخول فعلية (الزائر يُحوَّل إلى `/auth` قبل الوصول لطبقة الصلاحية) — مؤجَّل إلى جلسة اختبار بحساب.
- لا سجلات استخدام خارجية للمسارات القديمة؛ لذلك أُبقيت جميعها كتحويل آمن ولم يُحذف أي مسار خارجي بلا بديل.

## 9. الملفات المتغيرة

- محذوف: `src/routes/marketplace.tsx` · `src/routes/login.tsx`
- جديد: `src/routes/$.tsx`
- معدّل: `src/lib/routes-map.ts` · `src/components/marketplace/MarketShell.tsx` · `src/routes/ads.$slug.tsx` · `src/routes/choose-account.tsx`
