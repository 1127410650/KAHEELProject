-- ============================================================
-- Kaheel Stories: Instagram-style story rail on the home page.
-- Deliberately image-only (no video): one small WebP + text + a CSS-animated
-- mascot. Kept in its own table so the rail never pays for campaign columns.
-- ============================================================
CREATE TABLE public.mkt_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  cta_ar text NOT NULL DEFAULT '',
  cta_en text NOT NULL DEFAULT '',
  click_url text NOT NULL DEFAULT '',
  -- optional light image; the gradient alone is a valid story background
  image_path text,
  image_width integer NOT NULL DEFAULT 1080,
  image_height integer NOT NULL DEFAULT 1920,
  gradient text NOT NULL DEFAULT 'violet',
  mascot text NOT NULL DEFAULT 'kaheelan',
  mascot_pose text NOT NULL DEFAULT 'idle',
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_stories_status_chk CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  CONSTRAINT mkt_stories_mascot_chk CHECK (mascot IN ('kaheel', 'kaheelan')),
  CONSTRAINT mkt_stories_gradient_chk
    CHECK (gradient IN ('violet', 'sunset', 'mint', 'night', 'gold')),
  CONSTRAINT mkt_stories_window_chk CHECK (ends_at IS NULL OR ends_at > starts_at),
  -- public assets only: the bucket policy exposes the `public/` prefix
  CONSTRAINT mkt_stories_image_prefix_chk
    CHECK (image_path IS NULL OR image_path LIKE 'public/stories/%')
);

CREATE INDEX mkt_stories_live_idx
  ON public.mkt_stories (priority DESC, starts_at DESC)
  WHERE status = 'active';

GRANT SELECT ON public.mkt_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_stories TO authenticated;
GRANT ALL ON public.mkt_stories TO service_role;
ALTER TABLE public.mkt_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_stories_public_read
  ON public.mkt_stories FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY mkt_stories_admin_read
  ON public.mkt_stories FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY mkt_stories_admin_insert
  ON public.mkt_stories FOR INSERT TO authenticated
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_stories_admin_update
  ON public.mkt_stories FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_stories_admin_delete
  ON public.mkt_stories FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_stories_touch
  BEFORE UPDATE ON public.mkt_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Story events ────────────────────────────────────────────
CREATE TABLE public.mkt_story_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.mkt_stories(id) ON DELETE CASCADE,
  kind text NOT NULL,
  user_id uuid,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_story_events_kind_chk CHECK (kind IN ('view', 'click'))
);

CREATE INDEX mkt_story_events_story_idx
  ON public.mkt_story_events (story_id, created_at DESC);

GRANT SELECT ON public.mkt_story_events TO authenticated;
GRANT ALL ON public.mkt_story_events TO service_role;
ALTER TABLE public.mkt_story_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_story_events_admin_read
  ON public.mkt_story_events FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

-- The browser never writes events directly: this definer validates the story is
-- live right now, records the event and bumps the counter.
CREATE OR REPLACE FUNCTION public.mkt_story_track(
  _story_id uuid,
  _kind text,
  _session_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live boolean;
BEGIN
  IF _kind NOT IN ('view', 'click') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  SELECT true INTO _live
  FROM public.mkt_stories s
  WHERE s.id = _story_id
    AND s.status = 'active'
    AND s.starts_at <= now()
    AND (s.ends_at IS NULL OR s.ends_at > now());

  IF _live IS NOT TRUE THEN
    RETURN; -- silently ignore stale clients
  END IF;

  INSERT INTO public.mkt_story_events (story_id, kind, user_id, session_key)
  VALUES (_story_id, _kind, auth.uid(), left(coalesce(_session_key, ''), 64));

  IF _kind = 'view' THEN
    UPDATE public.mkt_stories SET views = views + 1 WHERE id = _story_id;
  ELSE
    UPDATE public.mkt_stories SET clicks = clicks + 1 WHERE id = _story_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_story_track(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_story_track(uuid, text, text) TO anon, authenticated;

-- ── Four ready-to-preview demo stories ──────────────────────
INSERT INTO public.mkt_stories
  (slug, title_ar, title_en, body_ar, body_en, cta_ar, cta_en, click_url,
   gradient, mascot, mascot_pose, priority, status)
VALUES
  ('demo-restaurants-offer',
   'عروض المطاعم اليوم', 'Today''s restaurant offers',
   'أطيب المطاعم القريبة منك، وعروض ما بتتكرر كل يوم.',
   'The tastiest nearby restaurants, with offers that do not come around twice.',
   'شوف العروض', 'See offers', '/search?category=restaurants',
   'sunset', 'kaheelan', 'tray', 100, 'active'),
  ('demo-groceries-offer',
   'مقاضي البيت بسعر أحلى', 'Groceries for less',
   'كل المقاضي من متاجر موثوقة، وتوصيل لعند الباب.',
   'All your groceries from trusted stores, delivered to your door.',
   'ابدأ التسوّق', 'Start shopping', '/search?domain=product',
   'mint', 'kaheelan', 'mustache', 90, 'active'),
  ('demo-kaheel-welcome',
   'أهلًا وسهلًا فيك بكَحيل', 'Welcome to Kaheel',
   'كل شي بتدور عليه بمكان واحد: مطاعم، مقاضي، عقارات، سيارات وخدمات.',
   'Everything you are looking for in one place: food, groceries, property, cars and services.',
   'ابدأ التصفح', 'Start browsing', '/search',
   'violet', 'kaheel', 'welcome', 80, 'active'),
  ('demo-kaheelan-joke',
   'الزعيم كَحيلان بيقول', 'Boss Kaheelan says',
   'جبتلك هالعروض بواسطتي… وما حد يزعل، الطابور من هون.',
   'I pulled these offers in myself... no arguing, the queue starts here.',
   'وين العروض؟', 'Where are the offers?', '/search?featured=1',
   'gold', 'kaheelan', 'wave', 70, 'active');