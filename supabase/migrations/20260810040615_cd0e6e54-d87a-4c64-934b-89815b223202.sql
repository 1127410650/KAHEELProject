-- ============ 1) media slots ============
CREATE TABLE public.mkt_media_slots (
  slot_key     text PRIMARY KEY,
  section      text NOT NULL,
  group_key    text,
  kind         text NOT NULL DEFAULT 'image',
  path         text,
  external_url text,
  title_ar     text,
  subtitle_ar  text,
  alt_text     text,
  sort_order   integer NOT NULL DEFAULT 0,
  hidden       boolean NOT NULL DEFAULT false,
  is_demo      boolean NOT NULL DEFAULT false,
  updated_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_media_slots_kind_chk CHECK (kind IN ('image','video_url'))
);

CREATE INDEX mkt_media_slots_section_idx ON public.mkt_media_slots (section, sort_order, slot_key);

GRANT SELECT ON public.mkt_media_slots TO anon, authenticated;
GRANT ALL ON public.mkt_media_slots TO service_role;

ALTER TABLE public.mkt_media_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_media_slots_public_read ON public.mkt_media_slots
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER mkt_media_slots_touch
  BEFORE UPDATE ON public.mkt_media_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2) page layout variants ============
CREATE TABLE public.mkt_page_variants (
  variant_key    text PRIMARY KEY,
  page           text NOT NULL,
  name_ar        text NOT NULL,
  description_ar text NOT NULL,
  preview_path   text,
  is_active      boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_page_variants_page_idx ON public.mkt_page_variants (page, sort_order);
CREATE UNIQUE INDEX mkt_page_variants_one_active_idx
  ON public.mkt_page_variants (page) WHERE is_active;

GRANT SELECT ON public.mkt_page_variants TO anon, authenticated;
GRANT ALL ON public.mkt_page_variants TO service_role;

ALTER TABLE public.mkt_page_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_page_variants_public_read ON public.mkt_page_variants
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER mkt_page_variants_touch
  BEFORE UPDATE ON public.mkt_page_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3) admin write functions ============
CREATE OR REPLACE FUNCTION public.mkt_admin_save_media_slot(
  _slot_key text,
  _path text DEFAULT NULL,
  _external_url text DEFAULT NULL,
  _alt_text text DEFAULT NULL,
  _title_ar text DEFAULT NULL,
  _subtitle_ar text DEFAULT NULL,
  _kind text DEFAULT NULL,
  _sort_order integer DEFAULT NULL
)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.mkt_media_slots;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  UPDATE public.mkt_media_slots s
     SET path         = COALESCE(_path, s.path),
         external_url = COALESCE(_external_url, s.external_url),
         alt_text     = COALESCE(_alt_text, s.alt_text),
         title_ar     = COALESCE(_title_ar, s.title_ar),
         subtitle_ar  = COALESCE(_subtitle_ar, s.subtitle_ar),
         kind         = COALESCE(_kind, s.kind),
         sort_order   = COALESCE(_sort_order, s.sort_order),
         updated_by   = auth.uid()
   WHERE s.slot_key = _slot_key
   RETURNING * INTO _row;

  IF _row.slot_key IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_clear_media_slot(_slot_key text)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.mkt_media_slots;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  UPDATE public.mkt_media_slots
     SET path = NULL, external_url = NULL, updated_by = auth.uid()
   WHERE slot_key = _slot_key
   RETURNING * INTO _row;
  IF _row.slot_key IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_set_media_slot_hidden(_slot_key text, _hidden boolean)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.mkt_media_slots;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  UPDATE public.mkt_media_slots
     SET hidden = _hidden, updated_by = auth.uid()
   WHERE slot_key = _slot_key
   RETURNING * INTO _row;
  IF _row.slot_key IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_activate_page_variant(_page text, _variant_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_page_variants WHERE page = _page AND variant_key = _variant_key
  ) THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND';
  END IF;
  UPDATE public.mkt_page_variants SET is_active = false
   WHERE page = _page AND is_active AND variant_key <> _variant_key;
  UPDATE public.mkt_page_variants SET is_active = true
   WHERE page = _page AND variant_key = _variant_key;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_save_media_slot(text,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_clear_media_slot(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_set_media_slot_hidden(text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_activate_page_variant(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_save_media_slot(text,text,text,text,text,text,text,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_clear_media_slot(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_media_slot_hidden(text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_activate_page_variant(text,text) TO authenticated, service_role;

-- ============ 4) storage policies for slot media ============
DROP POLICY IF EXISTS mkt_media_slots_admin_write ON storage.objects;
CREATE POLICY mkt_media_slots_admin_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mkt-media'
    AND name LIKE 'public/media-slots/%'
    AND public.mkt_is_platform_admin()
  );

DROP POLICY IF EXISTS mkt_media_slots_admin_update ON storage.objects;
CREATE POLICY mkt_media_slots_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND name LIKE 'public/media-slots/%'
    AND public.mkt_is_platform_admin()
  )
  WITH CHECK (
    bucket_id = 'mkt-media'
    AND name LIKE 'public/media-slots/%'
    AND public.mkt_is_platform_admin()
  );

DROP POLICY IF EXISTS mkt_media_slots_admin_delete ON storage.objects;
CREATE POLICY mkt_media_slots_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND name LIKE 'public/media-slots/%'
    AND public.mkt_is_platform_admin()
  );

-- ============ 5) seed slots ============
INSERT INTO public.mkt_media_slots (slot_key, section, group_key, kind, title_ar, subtitle_ar, sort_order) VALUES
  ('home.hero',              'home',        NULL, 'image', 'هيرو الرئيسية', NULL, 10),
  ('home.tile.guide',        'home_tiles',  NULL, 'image', 'أيقونة بلاطة دليل سوريا', NULL, 20),
  ('home.tile.student',      'home_tiles',  NULL, 'image', 'أيقونة بلاطة دليل الطالب', NULL, 30),
  ('home.tile.appointments', 'home_tiles',  NULL, 'image', 'أيقونة بلاطة مواعيد', NULL, 40),
  ('home.tile.aqar',         'home_tiles',  NULL, 'image', 'أيقونة بلاطة كَحيل عقار', NULL, 50),
  ('home.campaign.1',        'campaigns',   NULL, 'image', 'بانر الحملة الأول', NULL, 60),
  ('home.campaign.2',        'campaigns',   NULL, 'image', 'بانر الحملة الثاني', NULL, 70),
  ('home.campaign.3',        'campaigns',   NULL, 'image', 'بانر الحملة الثالث', NULL, 80),
  ('aqar.hero',              'aqar',        NULL, 'image', 'هيرو كَحيل عقار', NULL, 10),
  ('aqar.type.villa',        'aqar_types',  NULL, 'image', 'خلفية الفلل', NULL, 20),
  ('aqar.type.apartment',    'aqar_types',  NULL, 'image', 'خلفية الشقق', NULL, 30),
  ('aqar.type.building',     'aqar_types',  NULL, 'image', 'خلفية العمائر', NULL, 40),
  ('aqar.type.land',         'aqar_types',  NULL, 'image', 'خلفية الأراضي', NULL, 50),
  ('aqar.type.shop',         'aqar_types',  NULL, 'image', 'خلفية المحلات', NULL, 60),
  ('aqar.type.farm',         'aqar_types',  NULL, 'image', 'خلفية المزارع والشاليهات', NULL, 70),
  ('city.damascus.national-museum', 'cities', 'دمشق',      'image', 'دمشق', 'المتحف الوطني', 100),
  ('city.damascus.azm-palace',      'cities', 'دمشق',      'image', 'دمشق', 'قصر العظم', 110),
  ('city.damascus.hamidiyah',       'cities', 'دمشق',      'image', 'دمشق', 'سوق الحميدية', 120),
  ('city.damascus.qasioun',         'cities', 'دمشق',      'image', 'دمشق', 'جبل قاسيون', 130),
  ('city.damascus.umayyad-square',  'cities', 'دمشق',      'image', 'دمشق', 'ساحة الأمويين', 140),
  ('city.aleppo.citadel-outside',   'cities', 'حلب',       'image', 'حلب', 'القلعة — من الخارج', 150),
  ('city.aleppo.citadel-inside',    'cities', 'حلب',       'image', 'حلب', 'القلعة — من الداخل', 160),
  ('city.palmyra.arch',             'cities', 'تدمر',      'image', 'تدمر', 'قوس النصر', 170),
  ('city.tartus.arwad',             'cities', 'طرطوس',     'image', 'طرطوس', 'جزيرة أرواد', 180),
  ('city.daraa.bosra-theatre',      'cities', 'درعا',      'image', 'درعا', 'مسرح بصرى', 190),
  ('city.deirezzor.bridge',         'cities', 'دير الزور', 'image', 'دير الزور', 'الجسر المعلق', 200),
  ('city.homs.clock',               'cities', 'حمص',       'image', 'حمص', 'ساعة الساحة', 210),
  ('city.hama.norias',              'cities', 'حماة',      'image', 'حماة', 'النواعير', 220),
  ('city.idlib.main',               'cities', 'إدلب',      'image', 'إدلب', NULL, 230),
  ('city.raqqa.main',               'cities', 'الرقة',     'image', 'الرقة', NULL, 240);

-- ============ 6) seed page variants ============
INSERT INTO public.mkt_page_variants (variant_key, page, name_ar, description_ar, is_active, sort_order) VALUES
  ('home.noon',      'home', 'نمط نون',
   'التصميم الحالي: هيدر متكيّف ينكمش مع التمرير، بلاطات سريعة، فسيفساء إعلانات، وصفوف أفقية لكل تصنيف.', true, 10),
  ('home.big-cards', 'home', 'نمط البطاقات الكبيرة',
   'هيرو أكبر في أعلى الصفحة وبطاقات أعرض بصفوف أقل — مناسب لعرض صور الإعلانات بحجم أكبر.', false, 20),
  ('aqar.types',     'aqar', 'بطاقات الأنواع',
   'التصميم الحالي: بطاقات أنواع العقار الكبيرة أولًا ثم دوائر المدن ثم الصفوف الأفقية.', true, 10),
  ('aqar.cities',    'aqar', 'شبكة مدن أولًا',
   'يبدأ بشبكة المدن الكبيرة (صور المعالم) ثم أنواع العقار بشكل مضغوط — مناسب لمن يبحث بالمدينة أولًا.', false, 20);