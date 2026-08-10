-- 1) توسيع جدول الأقسام: عمق مستويين + عالم القسم + إخفاء ناعم + دمج
ALTER TABLE public.mkt_categories
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_slot_key text,
  ADD COLUMN IF NOT EXISTS tagline_ar text,
  ADD COLUMN IF NOT EXISTS tagline_en text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.mkt_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mkt_categories_parent_idx ON public.mkt_categories(parent_id);
CREATE INDEX IF NOT EXISTS mkt_categories_primary_idx ON public.mkt_categories(is_primary) WHERE deleted_at IS NULL;

-- عمق مستويين فقط: أي قسم أبوه لا يجوز أن يكون له أب
CREATE OR REPLACE FUNCTION public.mkt_categories_depth_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _grand uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'القسم لا يكون أبًا لنفسه';
    END IF;
    SELECT parent_id INTO _grand FROM public.mkt_categories WHERE id = NEW.parent_id;
    IF _grand IS NOT NULL THEN
      RAISE EXCEPTION 'عمق الأقسام مستويان فقط: رئيسي ← فرعي';
    END IF;
    NEW.is_primary := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_categories_depth_guard_trg ON public.mkt_categories;
CREATE TRIGGER mkt_categories_depth_guard_trg
  BEFORE INSERT OR UPDATE OF parent_id ON public.mkt_categories
  FOR EACH ROW EXECUTE FUNCTION public.mkt_categories_depth_guard();

-- 2) تحويلات المسارات (301)
CREATE TABLE IF NOT EXISTS public.mkt_category_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL UNIQUE,
  to_path text NOT NULL,
  reason text NOT NULL DEFAULT 'merge',
  category_id uuid REFERENCES public.mkt_categories(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_category_redirects TO anon, authenticated;
GRANT ALL ON public.mkt_category_redirects TO service_role;
ALTER TABLE public.mkt_category_redirects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "redirects readable" ON public.mkt_category_redirects;
CREATE POLICY "redirects readable" ON public.mkt_category_redirects FOR SELECT USING (true);

-- 3) سجل تدقيق عمليات الأقسام
CREATE TABLE IF NOT EXISTS public.mkt_category_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source_id uuid,
  source_slug text,
  target_id uuid,
  target_slug text,
  moved_listings integer NOT NULL DEFAULT 0,
  moved_children integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_category_audit TO authenticated;
GRANT ALL ON public.mkt_category_audit TO service_role;
ALTER TABLE public.mkt_category_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "category audit admins" ON public.mkt_category_audit;
CREATE POLICY "category audit admins" ON public.mkt_category_audit
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- 4) فتحات وسائط عالم القسم — تُنشأ تلقائيًا مع الترقية
CREATE OR REPLACE FUNCTION public.mkt_category_world_slots(_slug text, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _child record; _i integer := 0;
BEGIN
  INSERT INTO public.mkt_media_slots (slot_key, section, group_key, kind, edit_kind, sort_order, title_ar)
  VALUES ('world.' || _slug || '.hero', 'world_' || _slug, 'hero', 'image', 'media', 0, _name)
  ON CONFLICT (slot_key) DO NOTHING;

  FOR _child IN
    SELECT c.slug, c.name_ar
      FROM public.mkt_categories c
      JOIN public.mkt_categories p ON p.id = c.parent_id
     WHERE p.slug = _slug AND c.deleted_at IS NULL
     ORDER BY c.sort_order, c.name_ar
  LOOP
    _i := _i + 1;
    INSERT INTO public.mkt_media_slots (slot_key, section, group_key, kind, edit_kind, sort_order, title_ar)
    VALUES ('world.' || _slug || '.sub.' || _child.slug, 'world_' || _slug, 'subcategories', 'image', 'media', _i, _child.name_ar)
    ON CONFLICT (slot_key) DO NOTHING;
  END LOOP;
END;
$$;

-- 5) العمليات الإدارية
CREATE OR REPLACE FUNCTION public.mkt_admin_category_upsert(
  _id uuid DEFAULT NULL,
  _parent_id uuid DEFAULT NULL,
  _slug text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _name_en text DEFAULT NULL,
  _icon text DEFAULT NULL,
  _tagline_ar text DEFAULT NULL,
  _sort_order integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _out uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;

  IF _id IS NULL THEN
    IF _slug IS NULL OR _name_ar IS NULL THEN RAISE EXCEPTION 'المعرّف والاسم مطلوبان'; END IF;
    INSERT INTO public.mkt_categories (parent_id, slug, name_ar, name_en, icon, tagline_ar, sort_order)
    VALUES (_parent_id, _slug, _name_ar, COALESCE(_name_en, _name_ar), _icon, _tagline_ar, COALESCE(_sort_order, 0))
    RETURNING id INTO _out;
    INSERT INTO public.mkt_category_audit (action, source_id, source_slug, target_id, actor_id)
    VALUES ('create', _out, _slug, _parent_id, auth.uid());
  ELSE
    UPDATE public.mkt_categories SET
      name_ar = COALESCE(_name_ar, name_ar),
      name_en = COALESCE(_name_en, name_en),
      icon = COALESCE(_icon, icon),
      tagline_ar = COALESCE(_tagline_ar, tagline_ar),
      sort_order = COALESCE(_sort_order, sort_order),
      updated_at = now()
    WHERE id = _id
    RETURNING id INTO _out;
    INSERT INTO public.mkt_category_audit (action, source_id, source_slug, actor_id)
    SELECT 'rename', c.id, c.slug, auth.uid() FROM public.mkt_categories c WHERE c.id = _out;
  END IF;
  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_category_move(_id uuid, _parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;
  UPDATE public.mkt_categories SET parent_id = _parent_id, updated_at = now() WHERE id = _id;
  INSERT INTO public.mkt_category_audit (action, source_id, source_slug, target_id, target_slug, actor_id)
  SELECT 'move', s.id, s.slug, p.id, p.slug, auth.uid()
    FROM public.mkt_categories s LEFT JOIN public.mkt_categories p ON p.id = _parent_id
   WHERE s.id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_category_set_active(_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;
  UPDATE public.mkt_categories SET is_active = _active, updated_at = now() WHERE id = _id;
  INSERT INTO public.mkt_category_audit (action, source_id, source_slug, details, actor_id)
  SELECT CASE WHEN _active THEN 'activate' ELSE 'deactivate' END, c.id, c.slug, '{}'::jsonb, auth.uid()
    FROM public.mkt_categories c WHERE c.id = _id;
END;
$$;

-- ترقية إلى رئيسي: يصبح جذرًا بعالمه، وتُنشأ فتحات وسائطه
CREATE OR REPLACE FUNCTION public.mkt_admin_category_promote(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;
  SELECT * INTO _c FROM public.mkt_categories WHERE id = _id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'القسم غير موجود'; END IF;

  UPDATE public.mkt_categories
     SET parent_id = NULL,
         is_primary = true,
         is_active = true,
         cover_slot_key = 'world.' || _c.slug || '.hero',
         updated_at = now()
   WHERE id = _id;

  PERFORM public.mkt_category_world_slots(_c.slug, _c.name_ar);

  DELETE FROM public.mkt_category_redirects WHERE from_path = '/c/' || _c.slug;

  INSERT INTO public.mkt_category_audit (action, source_id, source_slug, details, actor_id)
  VALUES ('promote', _id, _c.slug, jsonb_build_object('world', '/c/' || _c.slug), auth.uid());
END;
$$;

-- تخفيض إلى فرعي: مع تحويل 301 من مسار عالمه القديم إلى صفحة قسمه
CREATE OR REPLACE FUNCTION public.mkt_admin_category_demote(_id uuid, _parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;
  IF _parent_id IS NULL THEN RAISE EXCEPTION 'اختر القسم الرئيسي الأب'; END IF;
  SELECT * INTO _c FROM public.mkt_categories WHERE id = _id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'القسم غير موجود'; END IF;

  UPDATE public.mkt_categories
     SET is_primary = false, parent_id = _parent_id, cover_slot_key = NULL, updated_at = now()
   WHERE id = _id;

  INSERT INTO public.mkt_category_redirects (from_path, to_path, reason, category_id, created_by)
  VALUES ('/c/' || _c.slug, '/categories/' || _c.slug, 'demote', _id, auth.uid())
  ON CONFLICT (from_path) DO UPDATE
    SET to_path = EXCLUDED.to_path, reason = EXCLUDED.reason, updated_at = now();

  UPDATE public.mkt_media_slots SET hidden = true, updated_at = now()
   WHERE section = 'world_' || _c.slug;

  INSERT INTO public.mkt_category_audit (action, source_id, source_slug, target_id, target_slug, actor_id)
  SELECT 'demote', _c.id, _c.slug, p.id, p.slug, auth.uid()
    FROM public.mkt_categories p WHERE p.id = _parent_id;
END;
$$;

-- دمج قسم في قسم: نقل الإعلانات والفروع، إخفاء ناعم للمصدر، وتحويل 301
CREATE OR REPLACE FUNCTION public.mkt_admin_category_merge(_source_id uuid, _target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _s record; _t record; _listings integer := 0; _children integer := 0;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'للمدراء فقط'; END IF;
  IF _source_id = _target_id THEN RAISE EXCEPTION 'لا يُدمج القسم في نفسه'; END IF;
  SELECT * INTO _s FROM public.mkt_categories WHERE id = _source_id;
  SELECT * INTO _t FROM public.mkt_categories WHERE id = _target_id;
  IF _s.id IS NULL OR _t.id IS NULL THEN RAISE EXCEPTION 'القسم غير موجود'; END IF;
  IF _t.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'القسم الهدف مخفي'; END IF;

  UPDATE public.mkt_listings SET category_id = _target_id, updated_at = now()
   WHERE category_id = _source_id;
  GET DIAGNOSTICS _listings = ROW_COUNT;

  IF _t.parent_id IS NULL THEN
    UPDATE public.mkt_categories SET parent_id = _target_id, updated_at = now()
     WHERE parent_id = _source_id AND deleted_at IS NULL;
    GET DIAGNOSTICS _children = ROW_COUNT;
  ELSE
    UPDATE public.mkt_categories SET parent_id = _t.parent_id, updated_at = now()
     WHERE parent_id = _source_id AND deleted_at IS NULL;
    GET DIAGNOSTICS _children = ROW_COUNT;
  END IF;

  UPDATE public.mkt_categories
     SET deleted_at = now(), is_active = false, is_primary = false,
         merged_into_id = _target_id, updated_at = now()
   WHERE id = _source_id;

  INSERT INTO public.mkt_category_redirects (from_path, to_path, reason, category_id, created_by)
  VALUES ('/categories/' || _s.slug, '/categories/' || _t.slug, 'merge', _target_id, auth.uid())
  ON CONFLICT (from_path) DO UPDATE
    SET to_path = EXCLUDED.to_path, reason = 'merge', updated_at = now();

  INSERT INTO public.mkt_category_redirects (from_path, to_path, reason, category_id, created_by)
  VALUES ('/c/' || _s.slug,
          CASE WHEN _t.is_primary THEN '/c/' || _t.slug ELSE '/categories/' || _t.slug END,
          'merge', _target_id, auth.uid())
  ON CONFLICT (from_path) DO UPDATE
    SET to_path = EXCLUDED.to_path, reason = 'merge', updated_at = now();

  UPDATE public.mkt_media_slots SET hidden = true, updated_at = now()
   WHERE section = 'world_' || _s.slug;

  INSERT INTO public.mkt_category_audit
    (action, source_id, source_slug, target_id, target_slug, moved_listings, moved_children, details, actor_id)
  VALUES ('merge', _s.id, _s.slug, _t.id, _t.slug, _listings, _children,
          jsonb_build_object('redirect_from', '/categories/' || _s.slug, 'redirect_to', '/categories/' || _t.slug),
          auth.uid());

  RETURN jsonb_build_object('moved_listings', _listings, 'moved_children', _children,
                            'source', _s.slug, 'target', _t.slug);
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_category_upsert(uuid,uuid,text,text,text,text,text,integer) FROM public;
REVOKE ALL ON FUNCTION public.mkt_admin_category_move(uuid,uuid) FROM public;
REVOKE ALL ON FUNCTION public.mkt_admin_category_set_active(uuid,boolean) FROM public;
REVOKE ALL ON FUNCTION public.mkt_admin_category_promote(uuid) FROM public;
REVOKE ALL ON FUNCTION public.mkt_admin_category_demote(uuid,uuid) FROM public;
REVOKE ALL ON FUNCTION public.mkt_admin_category_merge(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_upsert(uuid,uuid,text,text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_move(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_set_active(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_promote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_demote(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_category_merge(uuid,uuid) TO authenticated;

-- 6) تعليم الأقسام الجذرية القائمة كأقسام رئيسية لها عوالم
UPDATE public.mkt_categories
   SET is_primary = true,
       cover_slot_key = 'world.' || slug || '.hero'
 WHERE parent_id IS NULL AND deleted_at IS NULL AND is_active = true;

-- 7) قسمان تجريبيان لتوثيق عملية الدمج
INSERT INTO public.mkt_categories (slug, name_ar, name_en, sort_order, is_active)
VALUES ('demo-merge-source', 'قسم تجريبي (مصدر)', 'Demo merge source', 900, true),
       ('demo-merge-target', 'قسم تجريبي (هدف)', 'Demo merge target', 901, true)
ON CONFLICT (slug) DO NOTHING;