-- ═══════════════════════ محرك ألوان المنصة ═══════════════════════
CREATE TABLE public.mkt_theme_palettes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE,
  name_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_builtin boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_theme_palettes TO anon, authenticated;
GRANT ALL ON public.mkt_theme_palettes TO service_role;
ALTER TABLE public.mkt_theme_palettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme palettes are publicly readable"
  ON public.mkt_theme_palettes FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE UNIQUE INDEX mkt_theme_palettes_one_active
  ON public.mkt_theme_palettes (is_active) WHERE is_active;

CREATE TABLE public.mkt_theme_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  palette_id uuid NOT NULL REFERENCES public.mkt_theme_palettes(id) ON DELETE CASCADE,
  token_key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (palette_id, token_key)
);

GRANT SELECT ON public.mkt_theme_settings TO anon, authenticated;
GRANT ALL ON public.mkt_theme_settings TO service_role;
ALTER TABLE public.mkt_theme_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme tokens are publicly readable"
  ON public.mkt_theme_settings FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mkt_theme_palettes p
    WHERE p.id = mkt_theme_settings.palette_id AND p.deleted_at IS NULL
  ));

CREATE TABLE public.mkt_theme_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  palette_id uuid,
  palette_name text,
  action text NOT NULL,
  token_key text,
  old_value text,
  new_value text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_theme_audit TO authenticated;
GRANT ALL ON public.mkt_theme_audit TO service_role;
ALTER TABLE public.mkt_theme_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme audit is admin only"
  ON public.mkt_theme_audit FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

-- ── القراءة العامة: رموز اللوحة المفعّلة ─────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_active()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(s.token_key, s.value)
      FILTER (WHERE s.token_key IS NOT NULL),
    '{}'::jsonb
  ) || jsonb_build_object(
    'palette_id', (SELECT p.id::text FROM public.mkt_theme_palettes p WHERE p.is_active AND p.deleted_at IS NULL LIMIT 1),
    'palette_name', (SELECT p.name_ar FROM public.mkt_theme_palettes p WHERE p.is_active AND p.deleted_at IS NULL LIMIT 1)
  )
  FROM public.mkt_theme_palettes p
  LEFT JOIN public.mkt_theme_settings s ON s.palette_id = p.id
  WHERE p.is_active AND p.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_theme_active() TO anon, authenticated;

-- ── قائمة اللوحات للإدارة ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_palette_list()
RETURNS TABLE (id uuid, name_ar text, is_active boolean, is_builtin boolean, updated_at timestamptz, tokens jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT p.id, p.name_ar, p.is_active, p.is_builtin, p.updated_at,
      COALESCE((SELECT jsonb_object_agg(s.token_key, s.value)
                FROM public.mkt_theme_settings s WHERE s.palette_id = p.id), '{}'::jsonb)
    FROM public.mkt_theme_palettes p
    WHERE p.deleted_at IS NULL
    ORDER BY p.is_builtin DESC, p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_theme_palette_list() TO authenticated;

-- ── حفظ/إنشاء لوحة ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_palette_save(
  _palette_id uuid,
  _name_ar text,
  _tokens jsonb,
  _activate boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := NULLIF(btrim(COALESCE(_name_ar, '')), '');
  v_key text;
  v_val text;
  v_old text;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_name IS NULL OR length(v_name) > 60 THEN
    RAISE EXCEPTION 'invalid palette name';
  END IF;

  IF _palette_id IS NULL THEN
    INSERT INTO public.mkt_theme_palettes (name_ar, created_by)
    VALUES (v_name, auth.uid())
    RETURNING id INTO v_id;
    INSERT INTO public.mkt_theme_audit (palette_id, palette_name, action, actor)
    VALUES (v_id, v_name, 'create', auth.uid());
  ELSE
    SELECT id INTO v_id FROM public.mkt_theme_palettes
    WHERE id = _palette_id AND deleted_at IS NULL;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'palette not found';
    END IF;
    UPDATE public.mkt_theme_palettes
      SET name_ar = v_name, updated_at = now() WHERE id = v_id;
  END IF;

  FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(COALESCE(_tokens, '{}'::jsonb))
  LOOP
    IF v_val IS NULL OR length(v_val) > 40 THEN
      CONTINUE;
    END IF;
    -- لون سداسي أو rgba() فقط — لا CSS حر
    IF v_val !~* '^(#[0-9a-f]{3,8}|rgba?\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*(,\s*(0|1|0?\.[0-9]+)\s*)?\))$' THEN
      CONTINUE;
    END IF;
    SELECT value INTO v_old FROM public.mkt_theme_settings
      WHERE palette_id = v_id AND token_key = v_key;
    IF v_old IS DISTINCT FROM v_val THEN
      INSERT INTO public.mkt_theme_settings (palette_id, token_key, value)
      VALUES (v_id, v_key, v_val)
      ON CONFLICT (palette_id, token_key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      INSERT INTO public.mkt_theme_audit (palette_id, palette_name, action, token_key, old_value, new_value, actor)
      VALUES (v_id, v_name, 'token', v_key, v_old, v_val, auth.uid());
    END IF;
  END LOOP;

  IF _activate THEN
    PERFORM public.mkt_theme_palette_activate(v_id);
  END IF;

  RETURN v_id;
END;
$$;

-- ── تفعيل لوحة ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_palette_activate(_palette_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT name_ar INTO v_old FROM public.mkt_theme_palettes WHERE is_active AND deleted_at IS NULL;
  SELECT name_ar INTO v_new FROM public.mkt_theme_palettes WHERE id = _palette_id AND deleted_at IS NULL;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'palette not found';
  END IF;
  UPDATE public.mkt_theme_palettes SET is_active = false, updated_at = now() WHERE is_active;
  UPDATE public.mkt_theme_palettes SET is_active = true, updated_at = now() WHERE id = _palette_id;
  INSERT INTO public.mkt_theme_audit (palette_id, palette_name, action, token_key, old_value, new_value, actor)
  VALUES (_palette_id, v_new, 'activate', 'palette', v_old, v_new, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_theme_palette_save(uuid, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_theme_palette_activate(uuid) TO authenticated;

-- ── رجوع للافتراضي ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_reset_default()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT id INTO v_id FROM public.mkt_theme_palettes WHERE key = 'kaheel-purple';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'default palette missing';
  END IF;
  PERFORM public.mkt_theme_palette_activate(v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_theme_reset_default() TO authenticated;

-- ── حذف ناعم للوحات غير المدمجة ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_theme_palette_delete(_palette_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mkt_theme_palettes;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO v_row FROM public.mkt_theme_palettes WHERE id = _palette_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'palette not found';
  END IF;
  IF v_row.is_builtin THEN
    RAISE EXCEPTION 'builtin palette cannot be deleted';
  END IF;
  IF v_row.is_active THEN
    RAISE EXCEPTION 'active palette cannot be deleted';
  END IF;
  UPDATE public.mkt_theme_palettes SET deleted_at = now(), updated_at = now() WHERE id = _palette_id;
  INSERT INTO public.mkt_theme_audit (palette_id, palette_name, action, actor)
  VALUES (_palette_id, v_row.name_ar, 'delete', auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_theme_palette_delete(uuid) TO authenticated;

-- ═══════════════════════ بذر اللوحتين المدمجتين ═══════════════════
INSERT INTO public.mkt_theme_palettes (key, name_ar, is_builtin, is_active)
VALUES ('kaheel-purple', 'كَحيل البنفسجي', true, false);

INSERT INTO public.mkt_theme_settings (palette_id, token_key, value)
SELECT p.id, t.k, t.v
FROM public.mkt_theme_palettes p,
(VALUES
  ('primary', '#8A4FFF'),
  ('primary-deep', '#6522D6'),
  ('primary-soft', '#F4EFFF'),
  ('header-from', '#8A4FFF'),
  ('header-to', '#C3ABFF'),
  ('page-bg', '#F7F7F8'),
  ('card', '#FFFFFF'),
  ('divider', '#E5E5EA'),
  ('text-primary', '#1B1B1F'),
  ('text-secondary', '#6E6E7D'),
  ('disabled', '#C7C7CC'),
  ('focus', '#8A4FFF'),
  ('price-color', '#1B1B1F'),
  ('story-ring', '#8A4FFF'),
  ('cta-bg', '#FFFFFF'),
  ('cta-fg', '#6522D6'),
  ('pulse-color', 'rgba(138,79,255,0.5)'),
  ('bottomnav-active', '#8A4FFF')
) AS t(k, v)
WHERE p.key = 'kaheel-purple';

INSERT INTO public.mkt_theme_palettes (key, name_ar, is_builtin, is_active)
VALUES ('green-navy', 'أخضر × كحلي', true, true);

INSERT INTO public.mkt_theme_settings (palette_id, token_key, value)
SELECT p.id, t.k, t.v
FROM public.mkt_theme_palettes p,
(VALUES
  ('primary', '#0E9F6E'),
  ('primary-deep', '#0B7A55'),
  ('primary-soft', '#E6F5EF'),
  ('header-from', '#14324F'),
  ('header-to', '#1E4C77'),
  ('page-bg', '#FFFFFF'),
  ('card', '#FFFFFF'),
  ('divider', '#E5E7EB'),
  ('text-primary', '#14324F'),
  ('text-secondary', '#64748B'),
  ('disabled', '#C7CDD4'),
  ('focus', '#0E9F6E'),
  ('price-color', '#14324F'),
  ('story-ring', '#0E9F6E'),
  ('cta-bg', '#FFFFFF'),
  ('cta-fg', '#0E9F6E'),
  ('pulse-color', 'rgba(14,159,110,0.5)'),
  ('bottomnav-active', '#0E9F6E')
) AS t(k, v)
WHERE p.key = 'green-navy';