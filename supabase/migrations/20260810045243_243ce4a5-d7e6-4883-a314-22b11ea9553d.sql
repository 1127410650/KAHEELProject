ALTER TABLE public.mkt_media_slots
  ADD COLUMN IF NOT EXISTS path_original text,
  ADD COLUMN IF NOT EXISTS rotate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotate_period text,
  ADD COLUMN IF NOT EXISTS rotate_template_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS rotate_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.mkt_slot_rotation_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rotate_period IS NOT NULL AND NEW.rotate_period NOT IN ('daily','weekly','monthly') THEN
    RAISE EXCEPTION 'BAD_ROTATE_PERIOD';
  END IF;
  IF coalesce(array_length(NEW.rotate_template_ids, 1), 0) > 12 THEN
    RAISE EXCEPTION 'TOO_MANY_ROTATION_TEMPLATES';
  END IF;
  IF NEW.rotate_enabled AND (
       NEW.rotate_period IS NULL
       OR coalesce(array_length(NEW.rotate_template_ids, 1), 0) < 2
     ) THEN
    RAISE EXCEPTION 'ROTATION_NEEDS_TWO_TEMPLATES';
  END IF;
  IF NEW.rotate_enabled AND NEW.rotate_started_at IS NULL THEN
    NEW.rotate_started_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_slot_rotation_check ON public.mkt_media_slots;
CREATE TRIGGER trg_mkt_slot_rotation_check
BEFORE INSERT OR UPDATE ON public.mkt_media_slots
FOR EACH ROW EXECUTE FUNCTION public.mkt_slot_rotation_check();

ALTER TABLE public.mkt_design_templates
  ADD COLUMN IF NOT EXISTS brand_stamp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS layout_key text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS variation_of uuid REFERENCES public.mkt_design_templates(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.mkt_template_layout_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.layout_key NOT IN ('classic','centered','split') THEN
    RAISE EXCEPTION 'BAD_LAYOUT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_template_layout_check ON public.mkt_design_templates;
CREATE TRIGGER trg_mkt_template_layout_check
BEFORE INSERT OR UPDATE ON public.mkt_design_templates
FOR EACH ROW EXECUTE FUNCTION public.mkt_template_layout_check();

CREATE OR REPLACE FUNCTION public.mkt_admin_design_template_save(_id uuid, _patch jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out uuid;
  _kind text := _patch->>'kind';
  _layout text := coalesce(nullif(_patch->>'layout_key',''), 'classic');
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
  IF _layout NOT IN ('classic','centered','split') THEN
    RAISE EXCEPTION 'BAD_LAYOUT';
  END IF;

  INSERT INTO public.mkt_design_templates AS d (
    id, kind, name_ar, title_ar, body_ar, discount_pct,
    bg_color, grad_from, grad_to, grad_angle, image_path,
    shape_key, shape_color, shape_opacity, shape_size, shape_pos,
    motion_key, motion_state, motion_speed,
    link_path, campaign_id, starts_at, ends_at, is_active,
    brand_stamp, layout_key, variation_of, created_by
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
    coalesce((_patch->>'brand_stamp')::boolean, false),
    _layout,
    nullif(_patch->>'variation_of','')::uuid,
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
    brand_stamp = EXCLUDED.brand_stamp,
    layout_key = EXCLUDED.layout_key,
    variation_of = EXCLUDED.variation_of,
    updated_at = now()
  RETURNING d.id INTO _out;

  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_slot_sanitize_patch(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _k text;
  _v jsonb;
  _s text;
  _out jsonb := '{}'::jsonb;
  _hex text := '^#[0-9a-fA-F]{6}$';
  _item jsonb;
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

    ELSIF _k = 'rotate_template_ids' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, '[]'::jsonb);
      ELSIF jsonb_typeof(_v) = 'array' AND jsonb_array_length(_v) <= 12 THEN
        FOR _item IN SELECT value FROM jsonb_array_elements(_v) LOOP
          IF jsonb_typeof(_item) <> 'string'
            OR NOT EXISTS (
              SELECT 1 FROM public.mkt_design_templates d WHERE d.id = (_item #>> '{}')::uuid
            ) THEN
            RAISE EXCEPTION 'BAD_TEMPLATE';
          END IF;
        END LOOP;
        _out := _out || jsonb_build_object(_k, _v);
      ELSE
        RAISE EXCEPTION 'BAD_ROTATION_LIST';
      END IF;

    ELSIF _k = 'rotate_period' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND _s IN ('daily','weekly','monthly') THEN
        _out := _out || jsonb_build_object(_k, _s);
      ELSE
        RAISE EXCEPTION 'BAD_ROTATE_PERIOD';
      END IF;

    ELSIF _k = 'rotate_enabled' THEN
      IF jsonb_typeof(_v) = 'boolean' THEN
        _out := _out || jsonb_build_object(_k, _v);
      ELSE
        RAISE EXCEPTION 'BAD_ROTATE_FLAG';
      END IF;

    ELSIF _k = 'rotate_started_at' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' THEN
        _out := _out || jsonb_build_object(_k, (_s::timestamptz)::text);
      ELSE
        RAISE EXCEPTION 'BAD_DATE:%', _k;
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

    ELSIF _k IN ('path', 'path_original') THEN
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
$$;

CREATE OR REPLACE FUNCTION public.mkt_slot_apply(_slot_key text, _clean jsonb)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
         path_original = CASE WHEN _clean ? 'path_original' THEN _clean->>'path_original' ELSE s.path_original END,
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
         rotate_enabled = CASE WHEN _clean ? 'rotate_enabled' THEN (_clean->>'rotate_enabled')::boolean ELSE s.rotate_enabled END,
         rotate_period  = CASE WHEN _clean ? 'rotate_period' THEN _clean->>'rotate_period' ELSE s.rotate_period END,
         rotate_started_at = CASE WHEN _clean ? 'rotate_started_at' THEN (_clean->>'rotate_started_at')::timestamptz ELSE s.rotate_started_at END,
         rotate_template_ids = CASE
             WHEN _clean ? 'rotate_template_ids'
               THEN coalesce((
                 SELECT array_agg((value #>> '{}')::uuid)
                   FROM jsonb_array_elements(_clean->'rotate_template_ids')
               ), '{}'::uuid[])
             ELSE s.rotate_template_ids END,
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
$$;