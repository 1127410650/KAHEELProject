# المتاجر المصغرة والمطاعم — الدفعة الأولى (قاعدة البيانات والأمان وأعلام الميزات)

التاريخ: 05/08/2026 — النطاق: قاعدة البيانات، العلاقات، RLS، Feature Flags، مسارات الملكية.
لا توجد أي تغييرات في الواجهة في هذه الدفعة (لم تُلمس الهوية الكحلية، الهيدر، الشريط السفلي، الإعلانات، المحادثات، أو لوحة مدير النظام).

## نموذج الملكية

استُخدم نموذج الحساب النشط نفسه المستخدم في الإعلانات (`mkt_listings`):

- `owner_user_id` (افتراضيًا `auth.uid()`) + `tenant_id` (فارغ = الحساب الشخصي، وغير فارغ = منشأة).
- الإدراج مسموح فقط إذا `owner_user_id = auth.uid()` و(الحساب شخصي أو `mkt_can_publish_as_business(tenant_id)`).
- Trigger يجمّد `owner_user_id` و`tenant_id` و`country_id` بعد الإنشاء ⇒ لا يمكن تبديل المالك من المتصفح.
- متجر واحد لكل حساب: فهرس فريد `mkt_storefronts_one_per_account` على `(owner_user_id, coalesce(tenant_id, zero-uuid))` حيث `deleted_at IS NULL`.
- دالة الملكية للواجهة: `mkt_my_storefront(_account_key)` (للمسجلين فقط).

## الجداول الجديدة (18)

| الجدول | الغرض |
| --- | --- |
| `mkt_store_cuisines` | أنواع المطاعم من قاعدة البيانات (10 صفوف: مطاعم، مقاهي، حلويات، مخابز، وجبات سريعة، مطابخ منزلية، تموين وحفلات، عصائر، آيس كريم، أخرى) |
| `mkt_storefronts` | المتجر المصغر (نوع، slug، أسماء، وصف، شعار، غلاف، موقع ودقّته، الاستلام/التوصيل، الحد الأدنى، الرسوم، الزمن المتوقع، العملة، الحالة، استقبال الطلبات، التوثيق) |
| `mkt_store_private` | البيانات الخاصة: رقم التواصل، رقم تصريح التوصيل وانتهاؤه، مستند التصريح، حالة مراجعة المدير، إقرار المنشأة |
| `mkt_store_branches` | الفروع (فرع رئيسي واحد يُنشأ آليًا؛ البنية جاهزة لتعدد الفروع) |
| `mkt_store_sections` | أقسام المنيو/المنتجات/الخدمات |
| `mkt_store_items` | العناصر (food/drink/product/service/package) + `source_listing_id` |
| `mkt_store_item_variants` | الأحجام والخيارات |
| `mkt_store_addon_groups` | مجموعات الإضافات (single/multiple، حدود الاختيار، إلزامية) |
| `mkt_store_addons` | الإضافات وأسعارها |
| `mkt_store_hours` | أوقات العمل مع فترة ثانية (صباحًا/مساءً) |
| `mkt_store_delivery_zones` | نطاقات التوصيل (مدينة/حي/نطاق كيلومتري + رسوم وحد أدنى وزمن) |
| `mkt_carts` | السلة (سلة مفتوحة واحدة لكل عميل) |
| `mkt_cart_items` | عناصر السلة مع Snapshot للسعر |
| `mkt_cart_item_addons` | إضافات عنصر السلة مع Snapshot |
| `mkt_orders` | الطلبات (الحالات، طريقة الاستلام، طريقة الدفع، الإجماليات، عنوان التوصيل، المحادثة، مفتاح منع التكرار، حقول مستقبلية للدفع) |
| `mkt_order_items` | عناصر الطلب بـ Snapshot كامل |
| `mkt_order_item_addons` | إضافات عنصر الطلب بـ Snapshot |
| `mkt_order_status_history` | سجل تغيّر الحالات |
| `mkt_store_audit` | سجل عمليات المتاجر والطلبات وإجراءات المدير |

الحالات المعتمدة: المتجر `draft/pending_review/published/paused/suspended/archived`؛ الطلب `draft/submitted/accepted/preparing/ready/out_for_delivery/completed/rejected/cancelled`؛ الدفع `unpaid` افتراضيًا مع `cash_on_delivery / cash_on_pickup / bank_transfer_after_confirmation` فقط.

## القيود التشغيلية المفروضة خادميًا

- لا يمكن نشر متجر بلا استلام ولا توصيل (`mkt_storefronts_fulfilment_ck`).
- تفعيل التوصيل يتطلب إقرار المنشأة (`delivery_declaration_accepted_at`) وإلا رُفض التحديث.
- الإيقاف/إعادة التفعيل (`suspended`) إجراء إداري فقط.
- عناصر السلة من متجر واحد فقط (Trigger `mkt_cart_items_guard`).
- منع تكرار الطلب: فهرس فريد `(customer_user_id, idempotency_key)`.
- ترقيم الطلب آليًا: `K-YYMMDD-#####` بتوقيت Asia/Riyadh.
- تجميد إجماليات الطلب بعد الإرسال (إلا بصلاحية إدارية)، وتسجيل كل تغيير حالة في السجل والتدقيق.
- العملة تأتي من المتجر (ودولة المتجر من الحساب عبر `mkt_account_country_id`) لا من المتصفح.

## RLS

- العامة (anon): المتاجر `published` غير المحذوفة فقط، والفروع/الأقسام/العناصر/الأحجام/الإضافات/الأوقات/النطاقات التابعة لها فقط.
- رقم التواصل ووثائق التصريح ليست في الجدول العام إطلاقًا؛ هي في `mkt_store_private` (المالك والمدير فقط)، ويُقرأ الرقم للعامة فقط عبر `mkt_store_public_phone(id)` وشرط `public_phone_enabled`.
- المالك: يدير متجر حسابه النشط فقط وعناصره فقط ويرى طلباته الواردة فقط (عبر `mkt_store_manage`).
- العميل: سلته وطلباته فقط (`customer_user_id = auth.uid()`).
- المدير: `mkt_store_admin()` = مدير منصة أو صلاحيات الطاقم (`ads.moderation_hide/suspend`, `reports.review`).
- كل الدوال SECURITY DEFINER مع `search_path` مثبّت؛ ودوال الإدارة/الملكية مسحوبة من `anon`/`public` ومحصورة بـ `authenticated`، ودوال العرض العام فقط مُتاحة للزوار.
- عدد السياسات لكل جدول: `mkt_storefronts` 5، الطلبات 3، العناصر/الفروع/الأقسام/الأحجام/الإضافات/الأوقات/النطاقات 2 لكل جدول، السلات والسجلات 1 لكل جدول. RLS مفعّلة على الـ 18 جدولًا، وGRANT صريح لكل جدول.

## أعلام الميزات (الإطلاق المجاني)

`mkt_platform_settings` قسم `commerce` + الدالة `mkt_commerce_flags()`:

```
free_launch_mode = true
stores_enabled = true
payments_enabled = false
platform_delivery_enabled = false
commissions_enabled = false
subscriptions_enabled = false
coupons_enabled = false
loyalty_enabled = false
```

## نتائج الفحص

- `mkt_commerce_flags()` تُعيد القيم أعلاه فعليًا.
- لا جدول جديد بلا سياسات (التحذير الوحيد `rate_events` قديم وسابق لهذه الدفعة).
- `tsgo --noEmit` و`vite build` ناجحان بعد تحديث ملف الأنواع.

## المؤجَّل للدفعات القادمة

الدفعة 2 إنشاء المتجر، 3 المنيو والمنتجات، 4 الصفحة العامة `/store/:slug`، 5 السلة وRPC إنشاء الطلب وإعادة الحساب خادميًا، 6 لوحة التاجر، 7 ربط لوحة الإدارة وأنواع البلاغات (`storefront`/`store_item`/`order`)، 8 البحث والتصنيفات وقسم «مطاعم ومتاجر»، 9 الاختبارات وبيانات QA واللقطات.
كما أُجّل: الدفع الإلكتروني عبر مزود مرخص من البنك المركزي، الفوترة وفق «فاتورة» (ZATCA)، المحفظة، العمولات، السائقون، التتبع، القسائم، الولاء، الاشتراكات، وتعدد الفروع في الواجهة.

## تنظيف بيانات QA

الأعمدة `qa_batch_id` متوفرة في `mkt_storefronts` و`mkt_store_items` و`mkt_orders`؛ يتم الحذف بالوسم فقط عند إنشاء بيانات الاختبار في الدفعة التاسعة.
