-- ══════════════════════════════════════════════════════════════════════════
-- Page Composer: كل شاشة عامة = قائمة كتل مرتّبة تُقرأ من القاعدة.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.mkt_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  block_type text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- قائمة مغلقة: لا نوع كتلة خارج المكتبة المنفّذة في الكود.
ALTER TABLE public.mkt_page_blocks
  ADD CONSTRAINT mkt_page_blocks_type_chk CHECK (block_type IN (
    'hero_image','hero_gradient','search_field','text_strip','campaign_mosaic',
    'sponsored_banner','category_grid','listing_rail','type_cards','city_circles',
    'link_tile','design_banner','spacer','shape_layer'
  ));

ALTER TABLE public.mkt_page_blocks
  ADD CONSTRAINT mkt_page_blocks_page_chk CHECK (page IN (
    'market.home','aqar.home','category.world'
  ));

CREATE INDEX mkt_page_blocks_page_idx
  ON public.mkt_page_blocks (page, sort_order)
  WHERE deleted_at IS NULL;

GRANT SELECT ON public.mkt_page_blocks TO anon, authenticated;
GRANT ALL ON public.mkt_page_blocks TO service_role;
ALTER TABLE public.mkt_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "الكتل المرئية معروضة للجميع"
  ON public.mkt_page_blocks FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL AND hidden = false);

CREATE POLICY "مسؤول المنصة يرى كل الكتل"
  ON public.mkt_page_blocks FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

-- ── نسخ التصميم: تركيبة كاملة محفوظة باسم، مع تاريخ واسترجاع ──────────────
CREATE TABLE public.mkt_page_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  name_ar text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL DEFAULT 'manual',
  block_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT mkt_page_compositions_kind_chk CHECK (kind IN ('manual','auto_before_apply'))
);

CREATE INDEX mkt_page_compositions_page_idx
  ON public.mkt_page_compositions (page, created_at DESC);

GRANT ALL ON public.mkt_page_compositions TO service_role;
ALTER TABLE public.mkt_page_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "النسخ لمسؤولي المنصة"
  ON public.mkt_page_compositions FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

-- ── سجل التعديلات: من، ماذا، متى ─────────────────────────────────────────
CREATE TABLE public.mkt_page_block_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  block_id uuid,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_page_block_audit_page_idx
  ON public.mkt_page_block_audit (page, created_at DESC);

GRANT ALL ON public.mkt_page_block_audit TO service_role;
ALTER TABLE public.mkt_page_block_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "السجل لمسؤولي المنصة"
  ON public.mkt_page_block_audit FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

-- منع أي تعديل على السجل بعد كتابته.
CREATE TRIGGER mkt_page_block_audit_immutable
  BEFORE UPDATE OR DELETE ON public.mkt_page_block_audit
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

CREATE TRIGGER mkt_page_blocks_updated_at
  BEFORE UPDATE ON public.mkt_page_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════════
-- دوال الإدارة — كل كتابة تمر من هنا: تحقق من الصلاحية، حد الكتل، ثم سجل.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_page_block_log(
  _page text, _block_id uuid, _action text, _before jsonb, _after jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.mkt_page_block_audit (page, block_id, action, before_data, after_data, actor)
  VALUES (_page, _block_id, _action, _before, _after, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_page_block_save(
  _id uuid,
  _page text,
  _block_type text,
  _settings jsonb DEFAULT '{}'::jsonb,
  _sort_order integer DEFAULT NULL,
  _hidden boolean DEFAULT NULL
) RETURNS public.mkt_page_blocks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.mkt_page_blocks;
  _old jsonb;
  _live integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  IF _id IS NULL THEN
    SELECT count(*) INTO _live
      FROM public.mkt_page_blocks
     WHERE page = _page AND deleted_at IS NULL;
    IF _live >= 20 THEN RAISE EXCEPTION 'BLOCK_LIMIT_REACHED'; END IF;

    INSERT INTO public.mkt_page_blocks (page, block_type, settings, sort_order, hidden, updated_by)
    VALUES (
      _page, _block_type, COALESCE(_settings, '{}'::jsonb),
      COALESCE(_sort_order, (
        SELECT COALESCE(max(sort_order), 0) + 10 FROM public.mkt_page_blocks WHERE page = _page
      )),
      COALESCE(_hidden, false), auth.uid()
    )
    RETURNING * INTO _row;
    PERFORM public.mkt_page_block_log(_page, _row.id, 'create', NULL, to_jsonb(_row));
    RETURN _row;
  END IF;

  SELECT to_jsonb(b) INTO _old FROM public.mkt_page_blocks b WHERE b.id = _id;
  IF _old IS NULL THEN RAISE EXCEPTION 'BLOCK_NOT_FOUND'; END IF;

  UPDATE public.mkt_page_blocks b
     SET settings   = COALESCE(_settings, b.settings),
         sort_order = COALESCE(_sort_order, b.sort_order),
         hidden     = COALESCE(_hidden, b.hidden),
         updated_by = auth.uid()
   WHERE b.id = _id
  RETURNING * INTO _row;

  PERFORM public.mkt_page_block_log(_row.page, _row.id, 'update', _old, to_jsonb(_row));
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_page_block_delete(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old jsonb; _page text;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT to_jsonb(b), b.page INTO _old, _page FROM public.mkt_page_blocks b WHERE b.id = _id;
  IF _old IS NULL THEN RAISE EXCEPTION 'BLOCK_NOT_FOUND'; END IF;
  UPDATE public.mkt_page_blocks SET deleted_at = now(), updated_by = auth.uid() WHERE id = _id;
  PERFORM public.mkt_page_block_log(_page, _id, 'delete', _old, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_page_block_restore(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old jsonb; _page text; _live integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT to_jsonb(b), b.page INTO _old, _page FROM public.mkt_page_blocks b WHERE b.id = _id;
  IF _old IS NULL THEN RAISE EXCEPTION 'BLOCK_NOT_FOUND'; END IF;
  SELECT count(*) INTO _live FROM public.mkt_page_blocks WHERE page = _page AND deleted_at IS NULL;
  IF _live >= 20 THEN RAISE EXCEPTION 'BLOCK_LIMIT_REACHED'; END IF;
  UPDATE public.mkt_page_blocks SET deleted_at = NULL, updated_by = auth.uid() WHERE id = _id;
  PERFORM public.mkt_page_block_log(_page, _id, 'restore', _old, NULL);
END;
$$;

-- إعادة الترتيب: مصفوفة المعرّفات بالترتيب النهائي.
CREATE OR REPLACE FUNCTION public.mkt_admin_page_blocks_reorder(_page text, _ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _i integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  FOR _i IN 1 .. COALESCE(array_length(_ids, 1), 0) LOOP
    UPDATE public.mkt_page_blocks
       SET sort_order = _i * 10, updated_by = auth.uid()
     WHERE id = _ids[_i] AND page = _page;
  END LOOP;
  PERFORM public.mkt_page_block_log(_page, NULL, 'reorder', NULL, to_jsonb(_ids));
END;
$$;

-- حفظ التركيبة الحالية كنسخة مسماة.
CREATE OR REPLACE FUNCTION public.mkt_admin_page_composition_save(
  _page text, _name_ar text, _kind text DEFAULT 'manual'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _blocks jsonb; _id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'block_type', b.block_type,
           'settings',   b.settings,
           'sort_order', b.sort_order,
           'hidden',     b.hidden
         ) ORDER BY b.sort_order), '[]'::jsonb)
    INTO _blocks
    FROM public.mkt_page_blocks b
   WHERE b.page = _page AND b.deleted_at IS NULL;

  INSERT INTO public.mkt_page_compositions (page, name_ar, blocks, kind, block_count, created_by)
  VALUES (_page, _name_ar, _blocks, _kind, jsonb_array_length(_blocks), auth.uid())
  RETURNING id INTO _id;

  PERFORM public.mkt_page_block_log(_page, NULL, 'composition_save', NULL,
                                    jsonb_build_object('composition_id', _id, 'name_ar', _name_ar));
  RETURN _id;
END;
$$;

-- استرجاع نسخة: تُحفظ الحالة الراهنة تلقائيًا أولًا، ثم تُستبدل الكتل.
CREATE OR REPLACE FUNCTION public.mkt_admin_page_composition_apply(_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _c public.mkt_page_compositions; _b jsonb; _n integer := 0;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT * INTO _c FROM public.mkt_page_compositions WHERE id = _id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'COMPOSITION_NOT_FOUND'; END IF;
  IF jsonb_array_length(_c.blocks) > 20 THEN RAISE EXCEPTION 'BLOCK_LIMIT_REACHED'; END IF;

  PERFORM public.mkt_admin_page_composition_save(
    _c.page, 'قبل استرجاع: ' || _c.name_ar, 'auto_before_apply'
  );

  -- لا حذف فعلي: الكتل الحالية تُحذف حذفًا ناعمًا فقط.
  UPDATE public.mkt_page_blocks
     SET deleted_at = now(), updated_by = auth.uid()
   WHERE page = _c.page AND deleted_at IS NULL;

  FOR _b IN SELECT jsonb_array_elements(_c.blocks) LOOP
    INSERT INTO public.mkt_page_blocks (page, block_type, settings, sort_order, hidden, updated_by)
    VALUES (
      _c.page,
      _b->>'block_type',
      COALESCE(_b->'settings', '{}'::jsonb),
      COALESCE((_b->>'sort_order')::int, 0),
      COALESCE((_b->>'hidden')::boolean, false),
      auth.uid()
    );
    _n := _n + 1;
  END LOOP;

  PERFORM public.mkt_page_block_log(_c.page, NULL, 'composition_apply', NULL,
                                    jsonb_build_object('composition_id', _id, 'blocks', _n));
  RETURN _n;
END;
$$;

-- أشكال زخرفية إضافية للمكتبة (مربع، مثلث، دائرة، خط، موجة، نجمة).
INSERT INTO public.mkt_design_shapes (key, label_ar, label_en, view_box, path_d, sort_order)
VALUES
  ('square',   'مربع',  'Square',   '0 0 100 100', 'M10 10H90V90H10Z', 7),
  ('triangle', 'مثلث',  'Triangle', '0 0 100 100', 'M50 10L92 88H8Z', 8),
  ('circle',   'دائرة', 'Circle',   '0 0 100 100', 'M50 8A42 42 0 1 1 49.9 8Z', 9),
  ('line',     'خط',    'Line',     '0 0 100 100', 'M6 50H94V58H6Z', 10),
  ('wave',     'موجة',  'Wave',     '0 0 100 100', 'M2 60Q26 30 50 60T98 60V70Q74 40 50 70T2 70Z', 11),
  ('star',     'نجمة',  'Star',     '0 0 100 100', 'M50 6L62 38L96 40L69 60L78 94L50 74L22 94L31 60L4 40L38 38Z', 12)
ON CONFLICT (key) DO NOTHING;