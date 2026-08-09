# تقرير جرد — الدفعة 3 (بدون أي تنفيذ)

جرد فقط. لم يُعدَّل أو يُحذف أي ملف، ولم تُلمس قاعدة البيانات.

نتيجة أولية مهمة: `me.tsx` و`audit.tsx` **غير موجودين أصلًا** كملفات مسار — تم حذفهما في دفعة سابقة، وبقي لكل منهما تحويل 301 فقط (`/me → /go`، `/audit → /go?next=audit-log`). أما `demo` فهو **حيّ ومربوط من الصفحة الرئيسية**. الموت الحقيقي وجدته في مكان آخر: مكوّنات صفحة رئيسية غير مستوردة من أي ملف.

## 1) جرد المسارات المشتبه بها

المسح: 78 ملف مسار، مقابل `ROUTE_MAP` (482 سطرًا)، مع عدّ كل إشارة نصية في `src/` خارج ملف المسار نفسه.

| المسار | الملف | في ROUTE_MAP؟ | 301 | إشارات في الكود | وصول من الواجهة | قاعدة بيانات / تخزين | التصنيف | مخاطر الحذف |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/me` | لا ملف | نعم (legacy) | نعم → `/go` | 0 | لا | لا | **تحويل فقط — لا شيء ليُحذف** | حذف القاعدة يُنتج 404 لروابط قديمة |
| `/audit` | لا ملف | نعم (legacy) | نعم → `/go?next=audit-log` | 0 | لا | لا | **تحويل فقط** | نفس ما سبق |
| `/demo` | `routes/demo.tsx` | نعم (public) | لا | 2: `MarketHome.tsx:316`، `MarketShell.tsx:345` | **نعم** — بطاقة «البيئة التجريبية» في الرئيسية | **صفر** — `live-demo.ts` بيانات ثابتة بالكامل | **حيّ يُستخدم** | إخفاء واجهة عرض تسويقية ظاهرة للزوار |
| `/demo-stores/$worldId` | `routes/demo-stores.$worldId.tsx` | نعم (public) | لا | 3: `LiveDemoEnvironment.tsx:175`، `MarketDemoShowcases.tsx:116,167` (**ميت**) | فقط من داخل `/demo` | **صفر** — `demo-store-worlds.ts` ثابت | **حيّ (تابع لـ `/demo`)** | تعطيل روابط داخل `/demo` |
| `/categories/$slug` | `routes/categories.$slug.tsx` | نعم (public) | لا (لكنه **هدف** توحيد «عقار ديل») | 0 إشارة داخلة؛ يشير لنفسه فقط | لا يوجد أي زر أو قائمة | **يقرأ**: `mkt_listings` + التصنيفات | **مشكوك فيه — لكن لا يُحذف** | صفحة عامة قابلة للفهرسة وهدف canonical لأسماء «عقار ديل»؛ حذفه يكسر SEO |
| `/my/quotes` | `routes/my/quotes.tsx` | نعم (account) | نعم من `/dashboard/requests` | 0 | **لا** — غير مدرج في `more-menu.ts` | **يقرأ**: `mkt_quote_requests` | **حيّ لكن غير مكتشف** — النقص في القائمة لا في المسار | حذفه يفقد الشاشة الوحيدة لعروض الأسعار؛ الإصلاح إضافته للقائمة |
| `/reset-password` | `routes/reset-password.tsx` | نعم | لا | 0 | لا (يأتي من بريد Supabase) | جلسة Supabase | **حيّ** | كسر استعادة كلمة المرور |
| `/invite/$token` | `routes/invite.$token.tsx` | نعم | لا | 0 | لا (يأتي من رابط دعوة) | يقرأ/يكتب الدعوات | **حيّ** | كسر الدعوات |
| `/admin/my-work` | `routes/admin/my-work.tsx` | نعم | لا | 1: `AdminShell.tsx:80` | نعم (قائمة الإدارة) | نعم | **حيّ** | — |
| `/admin/{listings,users,businesses,verifications}_/$id` | ملفات `_.$id` | نعم | لا | 0 لصيغة `_/` (الروابط تستخدم الـ URL النظيف) | نعم | نعم | **حيّ** — صفر الإشارات مجرد فرق في الصياغة | لا شيء؛ ليست ميتة |
| `/$` (splat) | `routes/$.tsx` | — | يحلّ كل التحويلات | — | — | لا | **حيّ وحرج** | تعطيل كل الروابط القديمة والـ 404 الحقيقي |

### الموت الحقيقي: مكوّنات غير مستوردة من أي ملف

`MarketHome.tsx` يستورد من `components/marketplace/home/` عنصرًا واحدًا فقط (`SyriaHomeGateway`). الباقي بلا أي مستورد في المستودع:

| الملف | مستوردون | يقرأ قاعدة بيانات؟ |
| --- | --- | --- |
| `home/MarketCategoryTiles.tsx` | 0 | لا |
| `home/MarketDemoListings.tsx` | 0 | نعم (إعلانات) |
| `home/MarketDemoShowcases.tsx` | 0 | لا |
| `home/MarketFeaturedBanner.tsx` | 0 | لا |
| `home/MarketStoreTemplates.tsx` | 0 | لا |
| `home/MarketStorefrontHero.tsx` | 0 | لا |
| `home/SyriaUtilityHub.tsx` | 0 | لا |

`home/useAutoLoopRail.ts` مستخدم من `MarketCategoryStrip` (حيّ) ومن اثنين من الميتة أعلاه — يبقى.

هذه **ميتة مؤكدة**: حذفها لا يغيّر بكسل واحد في الواجهة ولا يلمس أي جدول. الخطر الوحيد أنها قد تكون «نسخة قادمة» للرئيسية محفوظة عن قصد.

## 2) تحذير Hydration — المصدر الدقيق

**المكان:** `src/routes/__root.tsx:33-36`

```ts
function useShellScope() {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  return pathname.startsWith("/admin") ? "" : "market-surface";
}
```

**السبب التقني:** فرع خادم/عميل داخل الرندر. على الخادم `pathname = ""`، و`"".startsWith("/admin")` تساوي `false`، فيُرسل `class="market-surface …"`. في المتصفح يُقرأ المسار الحقيقي، فإن كان تحت `/admin` تصبح النتيجة `""` → اختلاف سمة `className` بين HTML الخادم والعميل. يظهر فقط في `NotFoundView` و`ErrorView` لأنهما المكوّنان الوحيدان اللذان ينادونه، وقد ظهر بعد تحويل 404 إلى SSR في هذه الدفعة.

**تأكيد بالتجربة:**
- `curl /admin/no-such-xyz` → HTML الخادم يحتوي `class="market-surface flex min-h-dvh …"`.
- المتصفح على نفس الرابط: `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties… - A server/client branch \`if (typeof window !== 'undefined')\``.
- بقية المسارات المفحوصة (`/`, `/about`, `/search`, `/auth`, `/help`, `/guides/syria`, `/demo`, 404 عام) → صفر تحذير.

**أبسط إصلاح (سطران، بلا إعادة هيكلة):** استبدال قراءة `window` بمسار الراوتر نفسه، وهو متاح ومتطابق بين الخادم والعميل:

```ts
const pathname = useRouterState({ select: (s) => s.location.pathname });
return pathname.startsWith("/admin") ? "" : "market-surface";
```

بديل أبسط منه إن أردنا صفر تغيير سلوكي: تثبيت `""` كقيمة أولية على الجانبين وتطبيق النطاق داخل `useEffect` — لكن حل `useRouterState` أنظف ويحفظ الشكل الصحيح من أول رندر.

## 3) ترتيب تنفيذ آمن (عند الموافقة)

كل خطوة مستقلة وقابلة للتراجع وحدها.

1. **إصلاح Hydration** — `__root.tsx` فقط. لا علاقة له بالحذف، وأقل خطرًا، لذا أولًا. التحقق: `/admin/no-such-xyz` بلا تحذير + 404 يظل 404 حقيقيًا.
2. **إظهار `/my/quotes` في القائمة** — إضافة مدخل في `more-menu.ts`. إصلاح اكتشاف، لا حذف.
3. **قرار المكوّنات الميتة السبعة** — لا أحذفها قبل جوابك: هل هي مسودة رئيسية قادمة أم مخلّفات؟ إن كانت مخلّفات: أرشفة نصية للملفات السبعة في `.lovable/audit/` ثم الحذف، ثم `guard:structure` وفحص متصفح للرئيسية.
4. **إبقاء `/demo` و`/demo-stores` كما هما** — أو حذف الاثنين معًا كوحدة واحدة إن قررت أن البيئة التجريبية لم تعد مطلوبة للعرض العام (يشمل `demo.tsx`, `demo-stores.$worldId.tsx`, `LiveDemoEnvironment.tsx`, `live-demo.ts`, `demo-store-worlds.ts`, بطاقة الرئيسية، وقاعدتَي ROUTE_MAP). حذف واحد منهما فقط يُنتج روابط مكسورة.
5. **إبقاء `/categories/$slug`** — ليس ميتًا وظيفيًا: هدف canonical مفهرس. إن أردت تقليصه لاحقًا فبتحويل 301 إلى `/search?category=…` لا بحذف.
6. **إبقاء كل قواعد legacy في ROUTE_MAP** — التقاعد يُقرَّر من سجل `[legacy-route]` بعد فترة مراقبة حقيقية، لا الآن.

### ما يحتاج أرشفة قبل الحذف
- الملفات السبعة الميتة (خطوة 3) — أرشفة نصية فقط.
- حزمة `/demo` كاملة (خطوة 4) إن اختِير حذفها — أرشفة نصية فقط.
- **لا شيء يحتاج أرشفة بيانات**: لا مسار من المرشحين للحذف يملك جدولًا أو حاوية تخزين خاصة به. `MarketDemoListings` و`/categories/$slug` و`/my/quotes` **يقرأون** جداول مشتركة ولا يكتبون فيها ولا يملكونها.
