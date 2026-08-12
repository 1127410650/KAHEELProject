-- ============================================================================
-- لوحة الاستديو والمحتوى — طبقة تحكم/تصميم/كود فوق الموجود
-- ملف مُحضَّر للقاعدة الظلية فقط. لا يُطبَّق على الإنتاج إلا بموافقة المالك.
-- لا يمسّ أي منطق وظيفي (حجز/مطابقة/دفع/مسافة): جداول ودوال جديدة فقط.
-- idempotent + forward-only.
-- ============================================================================

-- 1) سجل الفتحات القابلة للتحرير ونطاق كل فتحة ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_editable_slots (
  slot_key    text PRIMARY KEY,
  scope       text NOT NULL CHECK (scope IN ('platform', 'store', 'listing', 'functional')),
  module      text NOT NULL DEFAULT 'core',
  label_ar    text NOT NULL,
  fields      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_editable_slots TO anon, authenticated;
GRANT ALL ON public.mkt_editable_slots TO service_role;
ALTER TABLE public.mkt_editable_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editable slots readable" ON public.mkt_editable_slots;
CREATE POLICY "editable slots readable" ON public.mkt_editable_slots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "editable slots admin write" ON public.mkt_editable_slots;
CREATE POLICY "editable slots admin write" ON public.mkt_editable_slots
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

-- الفتحات الوظيفية المشتركة: ثابتة لأي أحد، بما فيهم المالك.
INSERT INTO public.mkt_editable_slots (slot_key, scope, module, label_ar, fields) VALUES
  ('store.header',        'store',      'stores',   'ترويسة المتجر',        ARRAY['cover_path','logo_path','tagline','accent']),
  ('store.about',         'store',      'stores',   'نبذة المتجر',          ARRAY['about_text']),
  ('store.sections',      'store',      'stores',   'ترتيب أقسام المتجر',   ARRAY['section_order']),
  ('store.theme',         'store',      'stores',   'ثيم صفحة المتجر',      ARRAY['theme_id']),
  ('store.cart',          'functional', 'stores',   'السلة والدفع',         ARRAY[]::text[]),
  ('store.delivery_calc', 'functional', 'stores',   'حساب التوصيل والمسافة', ARRAY[]::text[]),
  ('aqar.listing_header', 'listing',    'aqar',     'ترويسة الوحدة العقارية', ARRAY['cover_path','about_text']),
  ('aqar.gallery',        'listing',    'aqar',     'معرض صور الوحدة',       ARRAY['photo_order']),
  ('aqar.booking',        'functional', 'aqar',     'محرك الحجز والتسعير',   ARRAY[]::text[]),
  ('errand.request_form', 'functional', 'errands',  'نموذج طلب سيارة/مهمة',  ARRAY[]::text[]),
  ('errand.matching',     'functional', 'errands',  'محرك مطابقة الكباتن',   ARRAY[]::text[]),
  ('platform.home_hero',  'platform',   'core',     'واجهة الرئيسية',        ARRAY['bg_color','grad_from','grad_to','path'])
ON CONFLICT (slot_key) DO UPDATE
  SET scope = EXCLUDED.scope,
      module = EXCLUDED.module,
      label_ar = EXCLUDED.label_ar,
      fields = EXCLUDED.fields,
      updated_at = now();

-- 2) ملكية المتجر (SECURITY DEFINER, لا اعتماد على الواجهة) ───────────────────
CREATE OR REPLACE FUNCTION public.mkt_owns_storefront(_storefront_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_storefronts s
    WHERE s.id = _storefront_id AND s.owner_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.mkt_owns_storefront(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_owns_storefront(uuid) TO authenticated, service_role;

-- 3) تصميم صفحة المتجر — عزل تام بين المتاجر ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_store_design (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id  uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  slot_key       text NOT NULL REFERENCES public.mkt_editable_slots(slot_key),
  patch          jsonb NOT NULL DEFAULT '{}'::jsonb,
  published      boolean NOT NULL DEFAULT true,
  updated_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_id, slot_key)
);

GRANT SELECT ON public.mkt_store_design TO anon, authenticated;
GRANT INSERT, UPDATE ON public.mkt_store_design TO authenticated;
GRANT ALL ON public.mkt_store_design TO service_role;
ALTER TABLE public.mkt_store_design ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store design public read" ON public.mkt_store_design;
CREATE POLICY "store design public read" ON public.mkt_store_design
  FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "store design owner read" ON public.mkt_store_design;
CREATE POLICY "store design owner read" ON public.mkt_store_design
  FOR SELECT TO authenticated
  USING (public.mkt_owns_storefront(storefront_id) OR public.mkt_is_platform_admin());

DROP POLICY IF EXISTS "store design owner insert" ON public.mkt_store_design;
CREATE POLICY "store design owner insert" ON public.mkt_store_design
  FOR INSERT TO authenticated
  WITH CHECK (
    public.mkt_owns_storefront(storefront_id)
    AND slot_key IN (SELECT slot_key FROM public.mkt_editable_slots WHERE scope = 'store')
  );

DROP POLICY IF EXISTS "store design owner update" ON public.mkt_store_design;
CREATE POLICY "store design owner update" ON public.mkt_store_design
  FOR UPDATE TO authenticated
  USING (public.mkt_owns_storefront(storefront_id))
  WITH CHECK (
    public.mkt_owns_storefront(storefront_id)
    AND slot_key IN (SELECT slot_key FROM public.mkt_editable_slots WHERE scope = 'store')
  );

-- 4) تخصيصات صفحات المنصة (مدير المنصة فقط) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_page_design (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path  text NOT NULL,
  slot_key    text NOT NULL REFERENCES public.mkt_editable_slots(slot_key),
  patch       jsonb NOT NULL DEFAULT '{}'::jsonb,
  published   boolean NOT NULL DEFAULT false,
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_path, slot_key)
);

GRANT SELECT ON public.mkt_page_design TO anon, authenticated;
GRANT ALL ON public.mkt_page_design TO service_role;
ALTER TABLE public.mkt_page_design ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page design public read" ON public.mkt_page_design;
CREATE POLICY "page design public read" ON public.mkt_page_design
  FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "page design admin all" ON public.mkt_page_design;
CREATE POLICY "page design admin all" ON public.mkt_page_design
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

-- 5) دوال الحفظ — ترفض النطاق الوظيفي في القاعدة نفسها ───────────────────────
CREATE OR REPLACE FUNCTION public.mkt_store_design_save(
  _storefront_id uuid,
  _slot_key text,
  _patch jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT scope INTO v_scope FROM public.mkt_editable_slots WHERE slot_key = _slot_key;
  IF v_scope IS NULL THEN RAISE EXCEPTION 'UNKNOWN_SLOT'; END IF;

  -- القيد الصارم: المكوّن الوظيفي المشترك ثابت لأي مستدعٍ.
  IF v_scope = 'functional' THEN RAISE EXCEPTION 'FUNCTIONAL_SLOT_IMMUTABLE'; END IF;
  IF v_scope <> 'store' THEN RAISE EXCEPTION 'SLOT_NOT_STORE_SCOPED'; END IF;

  -- العزل: ملكية فعلية في القاعدة، لا فحص واجهة.
  IF NOT public.mkt_owns_storefront(_storefront_id) THEN
    RAISE EXCEPTION 'NOT_STORE_OWNER';
  END IF;

  INSERT INTO public.mkt_store_design (storefront_id, slot_key, patch, updated_by)
  VALUES (_storefront_id, _slot_key, COALESCE(_patch, '{}'::jsonb), auth.uid())
  ON CONFLICT (storefront_id, slot_key) DO UPDATE
    SET patch = COALESCE(EXCLUDED.patch, '{}'::jsonb),
        updated_by = auth.uid(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_store_design_save(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_store_design_save(uuid, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_page_design_save(
  _route_path text,
  _slot_key text,
  _patch jsonb,
  _published boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
  v_id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  SELECT scope INTO v_scope FROM public.mkt_editable_slots WHERE slot_key = _slot_key;
  IF v_scope IS NULL THEN RAISE EXCEPTION 'UNKNOWN_SLOT'; END IF;
  IF v_scope = 'functional' THEN RAISE EXCEPTION 'FUNCTIONAL_SLOT_IMMUTABLE'; END IF;

  IF _route_path IS NULL OR left(_route_path, 1) <> '/' THEN RAISE EXCEPTION 'BAD_ROUTE'; END IF;

  INSERT INTO public.mkt_page_design (route_path, slot_key, patch, published, updated_by)
  VALUES (_route_path, _slot_key, COALESCE(_patch, '{}'::jsonb), COALESCE(_published, false), auth.uid())
  ON CONFLICT (route_path, slot_key) DO UPDATE
    SET patch = COALESCE(EXCLUDED.patch, '{}'::jsonb),
        published = COALESCE(EXCLUDED.published, false),
        updated_by = auth.uid(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_page_design_save(text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_page_design_save(text, text, jsonb, boolean) TO authenticated, service_role;

-- قراءة عامة لتصميم متجر واحد بالمُعرِّف اللطيف (لصفحة المتجر العامة).
CREATE OR REPLACE FUNCTION public.mkt_store_design_public(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(d.slot_key, d.patch), '{}'::jsonb)
  FROM public.mkt_store_design d
  JOIN public.mkt_storefronts s ON s.id = d.storefront_id
  WHERE s.slug = _slug AND d.published = true;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_store_design_public(text) TO anon, authenticated, service_role;

-- 6) لقطات محرر الكود — المالك حصرًا ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_code_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path      text NOT NULL,
  before_content text,
  before_sha256  text,
  byte_size      integer NOT NULL DEFAULT 0,
  existed        boolean NOT NULL DEFAULT true,
  reason         text NOT NULL DEFAULT 'write' CHECK (reason IN ('write', 'restore', 'manual')),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mkt_code_snapshots_path_idx
  ON public.mkt_code_snapshots (file_path, created_at DESC);

GRANT ALL ON public.mkt_code_snapshots TO service_role;
GRANT SELECT ON public.mkt_code_snapshots TO authenticated;
ALTER TABLE public.mkt_code_snapshots ENABLE ROW LEVEL SECURITY;

-- لا anon إطلاقًا، والقراءة للمالك وحده.
DROP POLICY IF EXISTS "code snapshots owner only" ON public.mkt_code_snapshots;
CREATE POLICY "code snapshots owner only" ON public.mkt_code_snapshots
  FOR SELECT TO authenticated
  USING (public.mkt_is_system_owner());

CREATE OR REPLACE FUNCTION public.mkt_code_snapshot_add(
  _file_path text,
  _before_content text,
  _before_sha256 text,
  _existed boolean,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'NOT_OWNER'; END IF;
  INSERT INTO public.mkt_code_snapshots
    (file_path, before_content, before_sha256, byte_size, existed, reason, created_by)
  VALUES
    (_file_path, _before_content, _before_sha256,
     COALESCE(length(COALESCE(_before_content, '')), 0),
     COALESCE(_existed, true), COALESCE(_reason, 'write'), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_code_snapshot_add(text, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_code_snapshot_add(text, text, text, boolean, text) TO authenticated, service_role;

-- 7) تحديث الطوابع ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mkt_store_design_touch') THEN
    CREATE TRIGGER mkt_store_design_touch BEFORE UPDATE ON public.mkt_store_design
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mkt_page_design_touch') THEN
    CREATE TRIGGER mkt_page_design_touch BEFORE UPDATE ON public.mkt_page_design
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
