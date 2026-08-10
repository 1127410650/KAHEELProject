-- =========================================================
-- 1) UI LABELS
-- =========================================================
CREATE TABLE public.mkt_ui_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key text NOT NULL UNIQUE,
  default_text text NOT NULL,
  custom_text text,
  screen text NOT NULL DEFAULT '',
  context_ar text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ui_labels_key_shape CHECK (label_key ~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'),
  CONSTRAINT mkt_ui_labels_default_len CHECK (char_length(default_text) BETWEEN 1 AND 80),
  CONSTRAINT mkt_ui_labels_custom_len CHECK (
    custom_text IS NULL
    OR (char_length(btrim(custom_text)) BETWEEN 1 AND 80 AND custom_text !~ '[<>]')
  )
);

GRANT SELECT ON public.mkt_ui_labels TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_ui_labels TO authenticated;
GRANT ALL ON public.mkt_ui_labels TO service_role;

ALTER TABLE public.mkt_ui_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_labels_public_read" ON public.mkt_ui_labels
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ui_labels_admin_write" ON public.mkt_ui_labels
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.mkt_ui_labels_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_ui_labels_touch
BEFORE INSERT OR UPDATE ON public.mkt_ui_labels
FOR EACH ROW EXECUTE FUNCTION public.mkt_ui_labels_touch();

-- Seed: كل مسميات قسم كَحيل عقار
INSERT INTO public.mkt_ui_labels (label_key, default_text, screen, context_ar) VALUES
  ('aqar.brand',              'كَحيل عقار',        '/aqar',        'اسم القسم في الهيدر'),
  ('aqar.back',               'عقار',              '/aqar/*',      'زر الرجوع في الهيدر'),
  ('aqar.provider',           'المزوّد',            '/aqar/{id}',   'عنوان بطاقة صاحب الإعلان'),
  ('aqar.provider_office',    'مكتب عقاري',        '/aqar/*',      'نوع المعلن'),
  ('aqar.provider_hotel',     'فندق',              '/aqar/*',      'نوع المعلن'),
  ('aqar.provider_individual','فرد',               '/aqar/*',      'نوع المعلن'),
  ('aqar.verified',           'موثّق',              '/aqar/*',      'شارة التوثيق'),
  ('aqar.listing_details',    'تفاصيل العقار',      '/aqar/{id}',   'عنوان قسم التفاصيل'),
  ('aqar.amenities',          'المزايا',            '/aqar/{id}',   'عنوان قسم المزايا'),
  ('aqar.description',        'الوصف',              '/aqar/{id}',   'عنوان قسم الوصف'),
  ('aqar.room_types',         'أنواع الغرف',        '/aqar/{id}',   'عنوان قسم الغرف'),
  ('aqar.location',           'الموقع',             '/aqar/{id}',   'عنوان قسم الخريطة'),
  ('aqar.area',               'المساحة',            '/aqar/{id}',   'مواصفة'),
  ('aqar.rooms',              'الغرف',              '/aqar/{id}',   'مواصفة'),
  ('aqar.bathrooms',          'الحمّامات',          '/aqar/{id}',   'مواصفة'),
  ('aqar.floor',              'الطابق',             '/aqar/{id}',   'مواصفة'),
  ('aqar.build_year',         'سنة البناء',         '/aqar/{id}',   'مواصفة'),
  ('aqar.furnishing',         'الفرش',              '/aqar/{id}',   'مواصفة'),
  ('aqar.furnished',          'مفروش',              '/aqar/{id}',   'قيمة الفرش'),
  ('aqar.unfurnished',        'غير مفروش',          '/aqar/{id}',   'قيمة الفرش'),
  ('aqar.type',               'النوع',              '/aqar/{id}',   'مواصفة'),
  ('aqar.available',          'متاح',               '/aqar/{id}',   'حالة الغرفة'),
  ('aqar.full',               'مكتمل',              '/aqar/{id}',   'حالة الغرفة'),
  ('aqar.request_booking',    'طلب حجز',            '/aqar/{id}',   'زر الشريط السفلي'),
  ('aqar.request_visit',      'طلب معاينة',         '/aqar/{id}',   'زر الشريط السفلي'),
  ('aqar.favorites',          'المفضلة',            '/aqar/*',      'شريط التنقل'),
  ('aqar.add_favorite',       'إضافة إلى المفضلة',  '/aqar/{id}',   'زر القلب'),
  ('aqar.remove_favorite',    'إزالة من المفضلة',   '/aqar/{id}',   'زر القلب'),
  ('aqar.chats',              'المحادثات',          '/aqar/*',      'شريط التنقل'),
  ('aqar.requests',           'طلباتي',             '/aqar/*',      'شريط التنقل'),
  ('aqar.browse',             'تصفّح',              '/aqar/*',      'شريط التنقل'),
  ('aqar.home',               'الرئيسية',           '/aqar/*',      'شريط التنقل'),
  ('aqar.loading',            'جارٍ التحميل…',      '/aqar/*',      'حالة انتظار'),
  ('aqar.not_available',      'هذا الإعلان غير متاح أو تم إيقاف نشره.', '/aqar/{id}', 'رسالة غياب الإعلان'),
  ('aqar.back_to_aqar',       'رجوع إلى كَحيل عقار', '/aqar/{id}',  'رابط رجوع'),
  ('aqar.demo_notice',        'إعلان تجريبي لعرض شكل المنصة',        '/aqar/{id}', 'تنبيه الإعلان التجريبي'),
  ('aqar.map_credit',         'خرائط © المساهمون في OpenStreetMap',  '/aqar/{id}', 'نسب الخريطة'),
  ('aqar.map_approx',         'الموقع تقريبي لحماية خصوصية العقار.', '/aqar/{id}', 'ملاحظة الخريطة'),
  ('aqar.price_note',         'الأسعار كما أدخلها المزوّد',           '/aqar',      'ملاحظة الأسعار'),
  ('aqar.track_daily',        'إيجار يومي',         '/aqar',        'مسار الصفقة'),
  ('aqar.track_long',         'إيجار طويل',         '/aqar',        'مسار الصفقة'),
  ('aqar.track_sale',         'بيع',                '/aqar',        'مسار الصفقة'),
  ('aqar.profile_listings',   'إعلانات المعلن',     '/p/{slug}',    'عنوان شبكة الإعلانات'),
  ('aqar.profile_stats',      'إحصاءات',            '/p/{slug}',    'عنوان الإحصاءات'),
  ('aqar.profile_active',     'إعلانات نشطة',       '/p/{slug}',    'إحصاءة'),
  ('aqar.profile_response',   'متوسط سرعة الرد',    '/p/{slug}',    'إحصاءة');

UPDATE public.mkt_ui_labels SET custom_text = 'المعلن' WHERE label_key = 'aqar.provider';

-- =========================================================
-- 2) PROVIDER PUBLIC PROFILE FIELDS
-- =========================================================
ALTER TABLE public.mkt_realestate_providers
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_email text;

CREATE OR REPLACE FUNCTION public.mkt_re_provider_slugify(_name text, _id uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base text;
BEGIN
  base := lower(btrim(coalesce(_name, '')));
  base := regexp_replace(base, '[^a-z0-9\u0621-\u064a]+', '-', 'g');
  base := btrim(base, '-');
  IF base IS NULL OR base = '' OR char_length(base) < 2 THEN
    base := 'p';
  END IF;
  RETURN left(base, 40) || '-' || left(replace(_id::text, '-', ''), 6);
END;
$$;

UPDATE public.mkt_realestate_providers
SET slug = public.mkt_re_provider_slugify(display_name, id)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mkt_re_providers_slug_key
  ON public.mkt_realestate_providers (lower(slug));

CREATE OR REPLACE FUNCTION public.mkt_re_providers_slug_fill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.mkt_re_provider_slugify(NEW.display_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_re_providers_slug_fill ON public.mkt_realestate_providers;
CREATE TRIGGER mkt_re_providers_slug_fill
BEFORE INSERT ON public.mkt_realestate_providers
FOR EACH ROW EXECUTE FUNCTION public.mkt_re_providers_slug_fill();

-- Privacy: phone/whatsapp/public_email are no longer readable through the Data API.
REVOKE SELECT ON public.mkt_realestate_providers FROM anon, authenticated;
GRANT SELECT (
  id, owner_user_id, tenant_id, provider_type, provider_type_locked, management_mode,
  display_name, city, verification_status, verified_at, response_deadline_minutes,
  created_at, updated_at, is_demo, deleted_at, slug, bio, show_phone, show_email
) ON public.mkt_realestate_providers TO anon, authenticated;

-- =========================================================
-- 3) PUBLIC PROFILE READ (field-limited, honest stats)
-- =========================================================
CREATE OR REPLACE FUNCTION public.mkt_re_provider_public(_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  display_name text,
  provider_type text,
  city text,
  verification_status text,
  is_demo boolean,
  bio text,
  created_at timestamptz,
  phone text,
  whatsapp text,
  public_email text,
  active_listings integer,
  avg_response_minutes integer,
  rating numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.slug,
    coalesce(nullif(btrim(p.display_name), ''), 'معلن') AS display_name,
    p.provider_type,
    p.city,
    p.verification_status,
    p.is_demo,
    p.bio,
    p.created_at,
    CASE WHEN p.show_phone THEN p.phone END AS phone,
    CASE WHEN p.show_phone THEN p.whatsapp END AS whatsapp,
    CASE WHEN p.show_email THEN p.public_email END AS public_email,
    (
      SELECT count(*)::integer FROM public.mkt_realestate_listings l
      WHERE l.provider_id = p.id AND l.status = 'published' AND l.deleted_at IS NULL
    ) AS active_listings,
    (
      SELECT round(avg(extract(epoch FROM (b.decided_at - b.created_at)) / 60.0))::integer
      FROM public.mkt_realestate_bookings b
      WHERE b.provider_id = p.id AND b.decided_at IS NOT NULL AND b.deleted_at IS NULL
    ) AS avg_response_minutes,
    NULL::numeric AS rating
  FROM public.mkt_realestate_providers p
  WHERE p.deleted_at IS NULL AND lower(p.slug) = lower(btrim(_slug))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_provider_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_re_provider_public(text) TO anon, authenticated;