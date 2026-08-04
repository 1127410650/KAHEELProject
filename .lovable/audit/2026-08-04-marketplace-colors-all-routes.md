# تدقيق هوية الألوان «كحلي» على جميع مسارات السوق — 2026-08-04

النطاق: واجهات السوق العامة + صفحات الحساب + الحالات الاستثنائية. لم تُعدّل قاعدة البيانات ولا أي وظيفة، ولم يُلمس `/admin` ولا النظام الداخلي، ولم يتم النشر.

## 1. المسارات المفحوصة (Computed Styles، مقاسان: 390×852 و1366×768)

`/` · `/welcome` · `/search` · `/categories/real-estate` · `/more` · `/about` · `/help` · `/terms` · `/privacy` · `/contact` · `/auth` · `/register` · `/no-such-page-404` (404) · `/ads/does-not-exist-xyz` (الإعلان غير متوفر) · `/dashboard/profile` · `/dashboard/messages` · `/dashboard/notifications` · `/choose-account`

ملاحظة: صفحات `/dashboard/**` تُحوّل إلى `/auth` في بيئة الاختبار (لا جلسة مُتاحة: `LOVABLE_BROWSER_AUTH_STATUS=signed_out`)، لكن جميعها تُركّب `DashboardShell → MarketShell` أي داخل نطاق `market-surface` (تحقق ثابت: 13/13 ملف).

## 2. الألوان القديمة التي وُجدت فعلًا

| # | الموضع | الخاصية | القيمة القديمة |
|---|--------|---------|----------------|
| 1 | صفحة «تعذر تحميل الصفحة» و404 (مكوّنات جذر الراوتر) | `background-color` للزر الرئيسي | البترولي عبر `bg-primary` خارج نطاق `market-surface` |
| 2 | كل بطاقة/سطح يستخدم `shadow-panel` / `shadow-raised` داخل السوق | `box-shadow` | `oklch(0.2651 0.0319 198.75)` (حبر بترولي) |
| 3 | الحدود بلا لون صريح (إعادة ضبط Tailwind تُحلّ على `:root`) | `border-color` | `oklch(0.894 0.0182 196.83)` |

لم يُعثر على أي `teal/emerald/cyan/turquoise` أو Hex بترولي داخل ملفات السوق (بحث نصي)، فالبقايا كانت كلها عبر توكنات مشتركة، وهو ما كشفته Computed Styles فقط.

## 3. الملفات المصححة

- `src/routes/__root.tsx` — صفحتا «تعذر تحميل الصفحة» و«404» أصبحتا داخل نطاق `market-surface` (وتُستثنى مسارات `/admin` فتبقى بهويتها)، زر «إعادة المحاولة» كحلي `#0B1739` بنص أبيض و`hover` أغمق `#07112C`، زر «الرئيسية» أبيض بحد هادئ، حلقة تركيز واضحة، ارتفاع لا يقل عن 44px، `min-h-dvh` لتوازن رأسي. لا شريط سفلي ولا أي زر عائم في هذه الصفحات.
- `src/styles.css` — ظلال السوق أعيد صبغها بالكحلي داخل `.market-surface` (وداخل بورتالات Radix عبر `body:has(.market-surface)`)، وأُعيد ضبط لون الحدود الافتراضي داخل النطاق إلى الفضي `--border` باستخدام `:where()` بصفر Specificity كي تفوز أي أداة حدود صريحة ولا يتأثر `/admin`.

لم تُضف أقسام أو أزرار، ولم يتغير الترتيب أو الشريط السفلي أو الهيدر/الفوتر.

## 4. نتيجة التدقيق الآلي (Computed Styles)

السكربت: `/tmp/browser/colors/audit2.py` — يفتح كل مسار، يمرّ على كل عنصر ظاهر ويفحص `color`, `background-color`, `border-color` (بعرض > 0)، `outline-color`, `box-shadow`, SVG `fill`/`stroke`، ويرصد `oklch` بدرجة لون 150–215 وChroma ≥ 0.012 أو RGB من عائلة التركواز.

- قبل التصحيح: 4 مسارات مُعلَّمة (36 حالة فحص) — 7 عناصر في `/` (390)، 14 في `/welcome`، 1 في `/` (1366)، 14 في `/welcome` (1366).
- بعد التصحيح: **Old market teal occurrences = 0** على كل المسارات في المقاسين (`report5.json`).
- Horizontal overflow = 0 على كل المسارات في المقاسين.
- Console errors = 0 (390 و1366).

## 5. الحالات التفاعلية واللغتان

على `/auth` (العربية RTL والإنجليزية LTR، 390 و1366):
- Default: زر رئيسي `oklch(0.2171 0.0682 266.19)` = `#0B1739` بنص أبيض.
- Hover: كحلي أغمق (`oklab(0.2171 … / 0.9)`) بلا أي تركواز.
- Focus بالحقل وبالتنقل عبر Tab: حدود/حلقة كحلية-فضية، لا بترولي.
- الألوان متطابقة في اللغتين، ولا يوجد Theme مختلف ولا وميض لون قديم (الهوية تُطبّق عبر نطاق CSS واحد لا عبر Local Storage).

الحدود الظاهرة داخل السوق قياسًا مباشرًا: `oklch(0.8976 0.0133 251.57)` = `#D7DEE6` فضي على كل العناصر المفحوصة في `/welcome`.

## 6. عزل الإدارة

- التغييران محصوران داخل `.market-surface` (ونطاق البورتالات المرتبط به)؛ لا توكن عام ولا صنف عالمي عُدّل، ولم يُلمس أي ملف تحت `src/routes/admin/**` أو النظام الداخلي.
- مكوّنا الخطأ/404 في الجذر يتحققان من المسار: `/admin/**` يبقى بالهوية الداخلية كما كان.
- لقطة `/admin` في بيئة الاختبار تُظهر التحويل إلى `/auth` لعدم توفر جلسة مدير (`signed_out`)، لذا لم يتم التحقق البصري داخل لوحة الإدارة؛ الإثبات هنا كودي (لا تغيير في ملفاتها ولا في التوكنات العامة).

## 7. الفحوصات التقنية

- `bunx tsgo --noEmit` → نجح بلا أخطاء.
- `bunx vite build` → `✓ built` بلا أخطاء (Client + Server + Nitro).
- Cache: الهوية تأتي من `src/styles.css` وحده؛ البناء الجديد يولّد Hash جديدًا ولا يوجد ملف Theme ثانٍ متعارض.

## 8. اللقطات

المجلد: `.lovable/audit/2026-08-04-marketplace-colors/`

390: `m390_home.png` · `m390_search.png` · `m390_listing.png` · `m390_addad.png` · `m390_messages.png` · `m390_notifications.png` · `m390_more.png` · `m390_settings.png` · `m390_login.png` · `m390_register.png` · `m_err_listing.png` (تعذر التحميل/الإعلان غير متوفر) · `m390_notfound.png` (404) · `m390_empty.png` (حالة فارغة)

1366: `d1366_home.png` · `d1366_search.png` · `d1366_login.png` · `d1366_notfound.png` · `d1366_admin.png`

إضافيًا: `m_welcome.png`, `d_welcome.png`, `m_categories_real-estate.png`, `m_about/help/terms/privacy/contact` بالمقاسين.
