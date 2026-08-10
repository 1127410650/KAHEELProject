-- 1) أعمدة المظهر على الفتحات
ALTER TABLE public.mkt_media_slots
  ADD COLUMN IF NOT EXISTS bg_color text,
  ADD COLUMN IF NOT EXISTS grad_from text,
  ADD COLUMN IF NOT EXISTS grad_to text,
  ADD COLUMN IF NOT EXISTS grad_angle integer,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.mkt_ad_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_from timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_to timestamptz;

-- 2) المسوّدات (معاينة للمدير قبل النشر)
CREATE TABLE IF NOT EXISTS public.mkt_media_slot_drafts (
  slot_key text PRIMARY KEY REFERENCES public.mkt_media_slots(slot_key) ON DELETE CASCADE,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_media_slot_drafts TO authenticated;
GRANT ALL ON public.mkt_media_slot_drafts TO service_role;
ALTER TABLE public.mkt_media_slot_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_drafts_admin_read" ON public.mkt_media_slot_drafts;
CREATE POLICY "slot_drafts_admin_read" ON public.mkt_media_slot_drafts
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- 3) سجل التعديلات
CREATE TABLE IF NOT EXISTS public.mkt_media_slot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL REFERENCES public.mkt_media_slots(slot_key) ON DELETE CASCADE,
  before_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_media_slot_history_slot_idx
  ON public.mkt_media_slot_history (slot_key, created_at DESC);
GRANT SELECT ON public.mkt_media_slot_history TO authenticated;
GRANT ALL ON public.mkt_media_slot_history TO service_role;
ALTER TABLE public.mkt_media_slot_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_history_admin_read" ON public.mkt_media_slot_history;
CREATE POLICY "slot_history_admin_read" ON public.mkt_media_slot_history
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- 4) تنقية المسوّدة: مفاتيح مسموحة فقط + قيم مقيّدة
CREATE OR REPLACE FUNCTION public.mkt_slot_sanitize_patch(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _k text;
  _v jsonb;
  _out jsonb := '{}'::jsonb;
  _hex text := '^#[0-9a-fA-F]{6}$';
BEGIN
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR _k, _v IN SELECT key, value FROM jsonb_each(_patch) LOOP
    IF _k IN ('bg_color', 'grad_from', 'grad_to') THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND (_v #>> '{}') ~ _hex THEN
        _out := _out || jsonb_build_object(_k, lower(_v #>> '{}'));
      ELSE
        RAISE EXCEPTION 'BAD_COLOR:%', _k;
      END IF;

    ELSIF _k = 'grad_angle' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'number' AND (_v #>> '{}')::numeric BETWEEN 0 AND 360 THEN
        _out := _out || jsonb_build_object(_k, ((_v #>> '{}')::numeric)::int);
      ELSE
        RAISE EXCEPTION 'BAD_ANGLE';
      END IF;

    ELSIF _k = 'campaign_id' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string'
        AND EXISTS (SELECT 1 FROM public.mkt_ad_campaigns c WHERE c.id = (_v #>> '{}')::uuid) THEN
        _out := _out || jsonb_build_object(_k, _v #>> '{}');
      ELSE
        RAISE EXCEPTION 'BAD_CAMPAIGN';
      END IF;

    ELSIF _k IN ('campaign_from', 'campaign_to') THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' THEN
        _out := _out || jsonb_build_object(_k, ((_v #>> '{}')::timestamptz)::text);
      ELSE
        RAISE EXCEPTION 'BAD_DATE:%', _k;
      END IF;

    ELSIF _k = 'path' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND (_v #>> '{}') ~ '^public/media-slots/[A-Za-z0-9._/-]+$' THEN
        _out := _out || jsonb_build_object(_k, _v #>> '{}');
      ELSE
        RAISE EXCEPTION 'BAD_PATH';
      END IF;

    ELSIF _k = 'alt_text' THEN
      IF jsonb_typeof(_v) = 'null' THEN
        _out := _out || jsonb_build_object(_k, NULL);
      ELSIF jsonb_typeof(_v) = 'string' AND length(_v #>> '{}') <= 180
        AND (_v #>> '{}') !~ '[<>]' THEN
        _out := _out || jsonb_build_object(_k, _v #>> '{}');
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
REVOKE ALL ON FUNCTION public.mkt_slot_sanitize_patch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_slot_sanitize_patch(jsonb) TO authenticated, service_role;

-- 5) القيم الحالية للفتحة (لتسجيل «قبل» والتراجع)
CREATE OR REPLACE FUNCTION public.mkt_slot_snapshot(_slot_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
    'hidden', s.hidden
  )
  FROM public.mkt_media_slots s
  WHERE s.slot_key = _slot_key;
$$;
REVOKE ALL ON FUNCTION public.mkt_slot_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_slot_snapshot(text) TO authenticated, service_role;

-- 6) حفظ مسوّدة
CREATE OR REPLACE FUNCTION public.mkt_admin_slot_set_draft(_slot_key text, _patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean jsonb;
  _merged jsonb;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_media_slots WHERE slot_key = _slot_key) THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  _clean := public.mkt_slot_sanitize_patch(_patch);

  INSERT INTO public.mkt_media_slot_drafts (slot_key, patch, updated_by, updated_at)
  VALUES (_slot_key, _clean, auth.uid(), now())
  ON CONFLICT (slot_key) DO UPDATE
    SET patch = public.mkt_media_slot_drafts.patch || EXCLUDED.patch,
        updated_by = auth.uid(),
        updated_at = now()
  RETURNING patch INTO _merged;

  RETURN _merged;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_admin_slot_set_draft(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_slot_set_draft(text, jsonb) TO authenticated, service_role;

-- 7) إلغاء المسوّدة
CREATE OR REPLACE FUNCTION public.mkt_admin_slot_discard_draft(_slot_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  DELETE FROM public.mkt_media_slot_drafts WHERE slot_key = _slot_key;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_admin_slot_discard_draft(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_slot_discard_draft(text) TO authenticated, service_role;

-- 8) تطبيق قيم منقّاة على الفتحة + تسجيل السجل
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
         alt_text      = CASE WHEN _clean ? 'alt_text' THEN _clean->>'alt_text' ELSE s.alt_text END,
         hidden        = CASE WHEN _clean ? 'hidden' THEN (_clean->>'hidden')::boolean ELSE s.hidden END,
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
REVOKE ALL ON FUNCTION public.mkt_slot_apply(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_slot_apply(text, jsonb) TO service_role;

-- 9) نشر المسوّدة
CREATE OR REPLACE FUNCTION public.mkt_admin_slot_publish(_slot_key text)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _patch jsonb;
  _row public.mkt_media_slots;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT patch INTO _patch FROM public.mkt_media_slot_drafts WHERE slot_key = _slot_key;
  IF _patch IS NULL OR _patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'NO_DRAFT';
  END IF;

  _row := public.mkt_slot_apply(_slot_key, public.mkt_slot_sanitize_patch(_patch));
  DELETE FROM public.mkt_media_slot_drafts WHERE slot_key = _slot_key;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_admin_slot_publish(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_slot_publish(text) TO authenticated, service_role;

-- 10) تراجع عن آخر تغيير منشور
CREATE OR REPLACE FUNCTION public.mkt_admin_slot_undo(_slot_key text)
RETURNS public.mkt_media_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before jsonb;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT before_value INTO _before
    FROM public.mkt_media_slot_history
   WHERE slot_key = _slot_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF _before IS NULL THEN
    RAISE EXCEPTION 'NO_HISTORY';
  END IF;

  RETURN public.mkt_slot_apply(_slot_key, public.mkt_slot_sanitize_patch(_before));
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_admin_slot_undo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_slot_undo(text) TO authenticated, service_role;