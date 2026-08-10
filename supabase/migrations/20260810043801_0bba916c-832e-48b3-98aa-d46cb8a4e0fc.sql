-- ═══════════ ١. مكتبة الأشكال الزخرفية ═══════════
CREATE TABLE IF NOT EXISTS public.mkt_design_shapes (
  key text PRIMARY KEY,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  view_box text NOT NULL DEFAULT '0 0 100 100'
    CHECK (view_box ~ '^[0-9 .-]{5,32}$'),
  path_d text NOT NULL
    CHECK (length(path_d) <= 2000 AND path_d ~ '^[MmLlHhVvCcSsQqTtAaZz0-9 ,.eE-]+$'),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_design_shapes TO anon, authenticated;
GRANT ALL ON public.mkt_design_shapes TO service_role;
ALTER TABLE public.mkt_design_shapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shapes_public_read" ON public.mkt_design_shapes FOR SELECT USING (is_active);

-- ═══════════ ٢. مكتبة الحركات ═══════════
CREATE TABLE IF NOT EXISTS public.mkt_design_motions (
  key text PRIMARY KEY,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  anim_name text NOT NULL
    CHECK (anim_name IN ('kpulse','kfloat','kspin','kglow','kgradient','kslide')),
  slow_ms int NOT NULL DEFAULT 9000 CHECK (slow_ms BETWEEN 600 AND 60000),
  medium_ms int NOT NULL DEFAULT 4500 CHECK (medium_ms BETWEEN 400 AND 60000),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_design_motions TO anon, authenticated;
GRANT ALL ON public.mkt_design_motions TO service_role;
ALTER TABLE public.mkt_design_motions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motions_public_read" ON public.mkt_design_motions FOR SELECT USING (is_active);

-- ═══════════ ٣. الوجهات المسموحة ═══════════
CREATE TABLE IF NOT EXISTS public.mkt_design_routes (
  path text PRIMARY KEY CHECK (path ~ '^/[A-Za-z0-9/_-]*$'),
  label_ar text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.mkt_design_routes TO anon, authenticated;
GRANT ALL ON public.mkt_design_routes TO service_role;
ALTER TABLE public.mkt_design_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_public_read" ON public.mkt_design_routes FOR SELECT USING (is_active);

-- ═══════════ ٤. مكتبة «تصاميمي» ═══════════
CREATE TABLE IF NOT EXISTS public.mkt_design_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('offer','promo')),
  name_ar text NOT NULL,
  title_ar text,
  body_ar text,
  discount_pct int CHECK (discount_pct IS NULL OR discount_pct BETWEEN 1 AND 99),
  bg_color text CHECK (bg_color IS NULL OR bg_color ~ '^#[0-9a-f]{6}$'),
  grad_from text CHECK (grad_from IS NULL OR grad_from ~ '^#[0-9a-f]{6}$'),
  grad_to text CHECK (grad_to IS NULL OR grad_to ~ '^#[0-9a-f]{6}$'),
  grad_angle int CHECK (grad_angle IS NULL OR grad_angle BETWEEN 0 AND 360),
  image_path text CHECK (image_path IS NULL OR image_path ~ '^public/media-slots/[A-Za-z0-9._/-]+$'),
  shape_key text REFERENCES public.mkt_design_shapes(key) ON DELETE SET NULL,
  shape_color text CHECK (shape_color IS NULL OR shape_color ~ '^#[0-9a-f]{6}$'),
  shape_opacity int NOT NULL DEFAULT 18 CHECK (shape_opacity BETWEEN 0 AND 100),
  shape_size text NOT NULL DEFAULT 'md' CHECK (shape_size IN ('sm','md','lg')),
  shape_pos text NOT NULL DEFAULT 'corner-tr'
    CHECK (shape_pos IN ('corner-tl','corner-tr','corner-bl','corner-br','edge-top','edge-bottom','edge-start','edge-end','behind-title')),
  motion_key text REFERENCES public.mkt_design_motions(key) ON DELETE SET NULL,
  motion_state text NOT NULL DEFAULT 'static' CHECK (motion_state IN ('static','animated')),
  motion_speed text NOT NULL DEFAULT 'slow' CHECK (motion_speed IN ('slow','medium')),
  link_path text REFERENCES public.mkt_design_routes(path) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.mkt_ad_campaigns(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_design_templates TO anon, authenticated;
GRANT ALL ON public.mkt_design_templates TO service_role;
ALTER TABLE public.mkt_design_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_public_read" ON public.mkt_design_templates FOR SELECT USING (is_active);
CREATE POLICY "templates_admin_read" ON public.mkt_design_templates FOR SELECT
  TO authenticated USING (public.mkt_is_platform_admin());

-- ═══════════ ٥. خصائص الفتحات الجديدة ═══════════
ALTER TABLE public.mkt_media_slots
  ADD COLUMN IF NOT EXISTS shape_key text REFERENCES public.mkt_design_shapes(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shape_color text,
  ADD COLUMN IF NOT EXISTS shape_opacity int,
  ADD COLUMN IF NOT EXISTS shape_size text,
  ADD COLUMN IF NOT EXISTS shape_pos text,
  ADD COLUMN IF NOT EXISTS motion_key text REFERENCES public.mkt_design_motions(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motion_state text NOT NULL DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS motion_speed text NOT NULL DEFAULT 'slow',
  ADD COLUMN IF NOT EXISTS tile_size text,
  ADD COLUMN IF NOT EXISTS link_path text REFERENCES public.mkt_design_routes(path) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.mkt_design_templates(id) ON DELETE SET NULL;

ALTER TABLE public.mkt_media_slots
  DROP CONSTRAINT IF EXISTS mkt_media_slots_shape_color_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_shape_opacity_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_shape_size_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_shape_pos_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_motion_state_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_motion_speed_chk,
  DROP CONSTRAINT IF EXISTS mkt_media_slots_tile_size_chk;

ALTER TABLE public.mkt_media_slots
  ADD CONSTRAINT mkt_media_slots_shape_color_chk
    CHECK (shape_color IS NULL OR shape_color ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT mkt_media_slots_shape_opacity_chk
    CHECK (shape_opacity IS NULL OR shape_opacity BETWEEN 0 AND 100),
  ADD CONSTRAINT mkt_media_slots_shape_size_chk
    CHECK (shape_size IS NULL OR shape_size IN ('sm','md','lg')),
  ADD CONSTRAINT mkt_media_slots_shape_pos_chk
    CHECK (shape_pos IS NULL OR shape_pos IN ('corner-tl','corner-tr','corner-bl','corner-br','edge-top','edge-bottom','edge-start','edge-end','behind-title')),
  ADD CONSTRAINT mkt_media_slots_motion_state_chk
    CHECK (motion_state IN ('static','animated')),
  ADD CONSTRAINT mkt_media_slots_motion_speed_chk
    CHECK (motion_speed IN ('slow','medium')),
  ADD CONSTRAINT mkt_media_slots_tile_size_chk
    CHECK (tile_size IS NULL OR tile_size IN ('sm','md','lg'));

-- ═══════════ ٦. تنقية الحقول الجديدة ═══════════
CREATE OR REPLACE FUNCTION public.mkt_slot_sanitize_patch(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _k text;
  _v jsonb;
  _s text;
  _out jsonb := '{}'::jsonb;
  _hex text := '^#[0-9a-fA-F]{6}$';
BEGIN
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR _k, _v IN SELECT key, value FROM jsonb_each(_patch) LOOP
    _s := _v #>> '{}';

    IF _k IN ('bg_color', 'grad_from', 'grad_to', 'shape_color') THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND _s ~ _hex THEN
        _out := _out || jsonb_build_object(_k, lower(_s));
      ELSE
        RAISE EXCEPTION 'BAD_COLOR:%', _k;
      END IF;

    ELSIF _k = 'grad_angle' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'number' AND _s::numeric BETWEEN 0 AND 360 THEN
        _out := _out || jsonb_build_object(_k, (_s::numeric)::int);
      ELSE
        RAISE EXCEPTION 'BAD_ANGLE';
      END IF;

    ELSIF _k = 'shape_opacity' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'number' AND _s::numeric BETWEEN 0 AND 100 THEN
        _out := _out || jsonb_build_object(_k, (_s::numeric)::int);
      ELSE
        RAISE EXCEPTION 'BAD_OPACITY';
      END IF;

    ELSIF _k = 'shape_key' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_design_shapes x WHERE x.key = _s AND x.is_active) THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_SHAPE';
      END IF;

    ELSIF _k = 'motion_key' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_design_motions x WHERE x.key = _s AND x.is_active) THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_MOTION';
      END IF;

    ELSIF _k = 'link_path' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_design_routes r WHERE r.path = _s AND r.is_active) THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_ROUTE';
      END IF;

    ELSIF _k = 'template_id' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_design_templates d WHERE d.id = _s::uuid) THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_TEMPLATE';
      END IF;

    ELSIF _k IN ('shape_size', 'tile_size') THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND _s IN ('sm','md','lg') THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_SIZE:%', _k;
      END IF;

    ELSIF _k = 'shape_pos' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND _s IN
        ('corner-tl','corner-tr','corner-bl','corner-br','edge-top','edge-bottom','edge-start','edge-end','behind-title') THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_POSITION';
      END IF;

    ELSIF _k = 'motion_state' THEN
      IF jsonb_typeof(_v) = 'string' AND _s IN ('static','animated') THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_MOTION_STATE';
      END IF;

    ELSIF _k = 'motion_speed' THEN
      IF jsonb_typeof(_v) = 'string' AND _s IN ('slow','medium') THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_MOTION_SPEED';
      END IF;

    ELSIF _k = 'campaign_id' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_ad_campaigns c WHERE c.id = _s::uuid) THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_CAMPAIGN';
      END IF;

    ELSIF _k IN ('campaign_from', 'campaign_to') THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' THEN
        _out := _out || jsonb_build_object(_k, (_s::timestamptz)::text);
      ELSE
        RAISE EXCEPTION 'BAD_DATE:%', _k;
      END IF;

    ELSIF _k = 'path' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND _s ~ '^public/media-slots/[A-Za-z0-9._/-]+$' THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_PATH';
      END IF;

    ELSIF _k = 'alt_text' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND length(_s) <= 180 AND _s !~ '[<>]' THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_ALT';
      END IF;

    ELSIF _k = 'hidden' THEN
      IF jsonb_typeof(_v) = 'boolean' THEN
        _out := _out || jsonb_build_object(_k, _v);
      ELSE
        RAISE EXCEPTION 'BAD_HIDDEN';
      END IF;

    ELSE
      RAISE EXCEPTION 'FIELD_NOT_ALLOWED:%', _k;
    END IF;
  END LOOP;

  RETURN _out;
END;
$function$;

-- ═══════════ ٧. اللقطة والتطبيق يشملان الجديد ═══════════
CREATE OR REPLACE FUNCTION public.mkt_slot_snapshot(_slot_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'bg_color', s.bg_color,
    'grad_from', s.grad_from,
    'grad_to', s.grad_to,
    'grad_angle', s.grad_angle,
    'campaign_id', s.campaign_id,
    'campaign_from', s.campaign_from,
    'campaign_to', s.campaign_to,
    'path', s.path,
    'alt_text', s.alt_text,
    'hidden', s.hidden,
    'shape_key', s.shape_key,
    'shape_color', s.shape_color,
    'shape_opacity', s.shape_opacity,
    'shape_size', s.shape_size,
    'shape_pos', s.shape_pos,
    'motion_key', s.motion_key,
    'motion_state', s.motion_state,
    'motion_speed', s.motion_speed,
    'tile_size', s.tile_size,
    'link_path', s.link_path,
    'template_id', s.template_id
  )
  FROM public.mkt_media_slots s
  WHERE s.slot_key = _slot_key;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_slot_apply(_slot_key text, _clean jsonb)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _before jsonb;
  _row public.mkt_media_slots;
BEGIN
  _before := public.mkt_slot_snapshot(_slot_key);

  UPDATE public.mkt_media_slots s
     SET bg_color      = CASE WHEN _clean ? 'bg_color' THEN _clean->>'bg_color' ELSE s.bg_color END,
         grad_from     = CASE WHEN _clean ? 'grad_from' THEN _clean->>'grad_from' ELSE s.grad_from END,
         grad_to       = CASE WHEN _clean ? 'grad_to' THEN _clean->>'grad_to' ELSE s.grad_to END,
         grad_angle    = CASE WHEN _clean ? 'grad_angle' THEN (_clean->>'grad_angle')::int ELSE s.grad_angle END,
         campaign_id   = CASE WHEN _clean ? 'campaign_id' THEN (_clean->>'campaign_id')::uuid ELSE s.campaign_id END,
         campaign_from = CASE WHEN _clean ? 'campaign_from' THEN (_clean->>'campaign_from')::timestamptz ELSE s.campaign_from END,
         campaign_to   = CASE WHEN _clean ? 'campaign_to' THEN (_clean->>'campaign_to')::timestamptz ELSE s.campaign_to END,
         path          = CASE WHEN _clean ? 'path' THEN _clean->>'path' ELSE s.path END,
         alt_text      = CASE WHEN _clean ? 'alt_text' THEN _clean->>'alt_text' ELSE s.alt_text END,
         hidden        = CASE WHEN _clean ? 'hidden' THEN (_clean->>'hidden')::boolean ELSE s.hidden END,
         shape_key     = CASE WHEN _clean ? 'shape_key' THEN _clean->>'shape_key' ELSE s.shape_key END,
         shape_color   = CASE WHEN _clean ? 'shape_color' THEN _clean->>'shape_color' ELSE s.shape_color END,
         shape_opacity = CASE WHEN _clean ? 'shape_opacity' THEN (_clean->>'shape_opacity')::int ELSE s.shape_opacity END,
         shape_size    = CASE WHEN _clean ? 'shape_size' THEN _clean->>'shape_size' ELSE s.shape_size END,
         shape_pos     = CASE WHEN _clean ? 'shape_pos' THEN _clean->>'shape_pos' ELSE s.shape_pos END,
         motion_key    = CASE WHEN _clean ? 'motion_key' THEN _clean->>'motion_key' ELSE s.motion_key END,
         motion_state  = CASE WHEN _clean ? 'motion_state' THEN _clean->>'motion_state' ELSE s.motion_state END,
         motion_speed  = CASE WHEN _clean ? 'motion_speed' THEN _clean->>'motion_speed' ELSE s.motion_speed END,
         tile_size     = CASE WHEN _clean ? 'tile_size' THEN _clean->>'tile_size' ELSE s.tile_size END,
         link_path     = CASE WHEN _clean ? 'link_path' THEN _clean->>'link_path' ELSE s.link_path END,
         template_id   = CASE WHEN _clean ? 'template_id' THEN (_clean->>'template_id')::uuid ELSE s.template_id END,
         updated_by    = auth.uid(),
         updated_at    = now()
   WHERE s.slot_key = _slot_key
   RETURNING * INTO _row;

  IF _row.slot_key IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  INSERT INTO public.mkt_media_slot_history (slot_key, before_value, after_value, actor)
  VALUES (_slot_key, _before, public.mkt_slot_snapshot(_slot_key), auth.uid());

  RETURN _row;
END;
$function$;

-- ═══════════ ٨. حفظ وحذف قوالب «تصاميمي» ═══════════
CREATE OR REPLACE FUNCTION public.mkt_admin_design_template_save(_id uuid, _patch jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _out uuid;
  _kind text := _patch->>'kind';
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  IF _kind IS NULL OR _kind NOT IN ('offer','promo') THEN
    RAISE EXCEPTION 'BAD_KIND';
  END IF;
  IF coalesce(_patch->>'name_ar', '') = '' OR length(_patch->>'name_ar') > 80 THEN
    RAISE EXCEPTION 'BAD_NAME';
  END IF;
  IF (_patch->>'title_ar') ~ '[<>]' OR (_patch->>'body_ar') ~ '[<>]' THEN
    RAISE EXCEPTION 'BAD_TEXT';
  END IF;

  INSERT INTO public.mkt_design_templates AS d (
    id, kind, name_ar, title_ar, body_ar, discount_pct,
    bg_color, grad_from, grad_to, grad_angle, image_path,
    shape_key, shape_color, shape_opacity, shape_size, shape_pos,
    motion_key, motion_state, motion_speed,
    link_path, campaign_id, starts_at, ends_at, is_active, created_by
  ) VALUES (
    coalesce(_id, gen_random_uuid()),
    _kind,
    left(_patch->>'name_ar', 80),
    left(_patch->>'title_ar', 120),
    left(_patch->>'body_ar', 300),
    nullif(_patch->>'discount_pct','')::int,
    lower(nullif(_patch->>'bg_color','')),
    lower(nullif(_patch->>'grad_from','')),
    lower(nullif(_patch->>'grad_to','')),
    nullif(_patch->>'grad_angle','')::int,
    nullif(_patch->>'image_path',''),
    nullif(_patch->>'shape_key',''),
    lower(nullif(_patch->>'shape_color','')),
    coalesce(nullif(_patch->>'shape_opacity','')::int, 18),
    coalesce(nullif(_patch->>'shape_size',''), 'md'),
    coalesce(nullif(_patch->>'shape_pos',''), 'corner-tr'),
    nullif(_patch->>'motion_key',''),
    coalesce(nullif(_patch->>'motion_state',''), 'static'),
    coalesce(nullif(_patch->>'motion_speed',''), 'slow'),
    nullif(_patch->>'link_path',''),
    nullif(_patch->>'campaign_id','')::uuid,
    nullif(_patch->>'starts_at','')::timestamptz,
    nullif(_patch->>'ends_at','')::timestamptz,
    coalesce((_patch->>'is_active')::boolean, true),
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    kind = EXCLUDED.kind,
    name_ar = EXCLUDED.name_ar,
    title_ar = EXCLUDED.title_ar,
    body_ar = EXCLUDED.body_ar,
    discount_pct = EXCLUDED.discount_pct,
    bg_color = EXCLUDED.bg_color,
    grad_from = EXCLUDED.grad_from,
    grad_to = EXCLUDED.grad_to,
    grad_angle = EXCLUDED.grad_angle,
    image_path = EXCLUDED.image_path,
    shape_key = EXCLUDED.shape_key,
    shape_color = EXCLUDED.shape_color,
    shape_opacity = EXCLUDED.shape_opacity,
    shape_size = EXCLUDED.shape_size,
    shape_pos = EXCLUDED.shape_pos,
    motion_key = EXCLUDED.motion_key,
    motion_state = EXCLUDED.motion_state,
    motion_speed = EXCLUDED.motion_speed,
    link_path = EXCLUDED.link_path,
    campaign_id = EXCLUDED.campaign_id,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING d.id INTO _out;

  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_admin_design_template_set_active(_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  UPDATE public.mkt_design_templates SET is_active = _active, updated_at = now() WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.mkt_admin_design_template_save(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_design_template_set_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_design_template_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_design_template_set_active(uuid, boolean) TO authenticated;

-- ═══════════ ٩. بذور المكتبات ═══════════
INSERT INTO public.mkt_design_shapes (key, label_ar, label_en, view_box, path_d, sort_order) VALUES
  ('waves','موجات','Waves','0 0 200 100','M0 60 C 30 30, 60 90, 100 60 S 170 30, 200 60 L200 100 L0 100 Z',1),
  ('arcs','أقواس','Arcs','0 0 200 200','M20 180 A 160 160 0 0 1 180 20 M60 180 A 120 120 0 0 1 180 60 M100 180 A 80 80 0 0 1 180 100',2),
  ('dots','نقاط','Dots','0 0 120 120','M10 10 a6 6 0 1 0 0.1 0 Z M50 10 a6 6 0 1 0 0.1 0 Z M90 10 a6 6 0 1 0 0.1 0 Z M10 50 a6 6 0 1 0 0.1 0 Z M50 50 a6 6 0 1 0 0.1 0 Z M90 50 a6 6 0 1 0 0.1 0 Z M10 90 a6 6 0 1 0 0.1 0 Z M50 90 a6 6 0 1 0 0.1 0 Z M90 90 a6 6 0 1 0 0.1 0 Z',3),
  ('lines','خطوط هندسية','Geometric lines','0 0 200 200','M0 0 L200 200 M40 0 L200 160 M80 0 L200 120 M0 40 L160 200 M0 80 L120 200',4),
  ('stars','نجوم','Stars','0 0 200 200','M40 20 L48 44 L72 44 L52 58 L60 82 L40 68 L20 82 L28 58 L8 44 L32 44 Z M140 100 L146 118 L164 118 L149 129 L155 147 L140 136 L125 147 L131 129 L116 118 L134 118 Z',5),
  ('rings','حلقات','Rings','0 0 200 200','M100 20 A 80 80 0 1 0 100.1 20 Z M100 60 A 40 40 0 1 1 99.9 60 Z',6)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.mkt_design_motions (key, label_ar, label_en, anim_name, slow_ms, medium_ms, sort_order) VALUES
  ('pulse','نبض','Pulse','kpulse',6000,3200,1),
  ('float','طفو بطيء','Slow float','kfloat',9000,5000,2),
  ('spin','دوران بطيء','Slow spin','kspin',24000,12000,3),
  ('glow','توهج','Glow','kglow',7000,3600,4),
  ('gradient','تدرج متحرك','Animated gradient','kgradient',12000,6000,5),
  ('slide','دخول انزلاقي','Slide in','kslide',900,600,6)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.mkt_design_routes (path, label_ar, sort_order) VALUES
  ('/','الرئيسية',1),
  ('/search','البحث',2),
  ('/aqar','كَحيل عقار',3),
  ('/services','الخدمات والمواعيد',4),
  ('/stores','المتاجر',5),
  ('/guides/syria','دليل سوريا',6),
  ('/guides/students','دليل الطالب',7),
  ('/errands','الخدمات السريعة',8),
  ('/jobs','الوظائف',9),
  ('/offers','العروض الحصرية',10)
ON CONFLICT (path) DO NOTHING;