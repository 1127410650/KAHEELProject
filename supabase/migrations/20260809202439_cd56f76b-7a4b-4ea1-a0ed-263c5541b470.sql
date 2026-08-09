-- ============================================================
-- Seasonal backdrops + exclusive offers.
--
-- One decorative layer behind the header / store sections that switches
-- itself on and off by date (Ramadan, back-to-school, Eid, openings), plus a
-- curated "exclusive offers" rail. Both are admin-managed: the browser only
-- ever reads the live rows, so a draft season is invisible until published.
--
-- Assets may be either a CDN pointer URL shipped with the app, or an object
-- uploaded by an admin under the public campaigns prefix — never an arbitrary
-- remote host, so the layer cannot be pointed at third-party trackers.
-- ============================================================

CREATE TABLE public.mkt_seasonal_backdrops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label_ar text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  -- where the layer paints
  placement text NOT NULL DEFAULT 'header',
  section_key text NOT NULL DEFAULT '',
  -- base image: CDN pointer url OR uploaded object path (either may be null)
  image_url text,
  image_path text,
  image_width integer NOT NULL DEFAULT 1600,
  image_height integer NOT NULL DEFAULT 906,
  -- optional scattered-elements layer that floats slowly above the base
  decor_url text,
  decor_path text,
  -- CSS-generated motion motif drawn on top (no extra bytes)
  motif text NOT NULL DEFAULT 'stars',
  -- readability guard: how strong the gradient scrim over the image is
  overlay text NOT NULL DEFAULT 'strong',
  accent text NOT NULL DEFAULT '#f59e0b',
  -- optional character peeking from the top edge
  mascot text NOT NULL DEFAULT 'none',
  mascot_url text,
  mascot_path text,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_seasonal_status_chk CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  CONSTRAINT mkt_seasonal_placement_chk
    CHECK (placement IN ('header', 'stores', 'exclusive', 'section')),
  CONSTRAINT mkt_seasonal_motif_chk
    CHECK (motif IN ('none', 'stars', 'school', 'lanterns', 'sparks', 'confetti')),
  CONSTRAINT mkt_seasonal_overlay_chk CHECK (overlay IN ('soft', 'medium', 'strong')),
  CONSTRAINT mkt_seasonal_mascot_chk
    CHECK (mascot IN ('none', 'kaheel', 'kaheelan', 'custom')),
  CONSTRAINT mkt_seasonal_accent_chk CHECK (accent ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT mkt_seasonal_window_chk CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT mkt_seasonal_dims_chk
    CHECK (image_width BETWEEN 320 AND 4096 AND image_height BETWEEN 120 AND 4096),
  -- only app-shipped CDN pointers or our own public storage prefix
  CONSTRAINT mkt_seasonal_image_url_chk
    CHECK (image_url IS NULL OR image_url LIKE '/__l5e/assets-v1/%'),
  CONSTRAINT mkt_seasonal_decor_url_chk
    CHECK (decor_url IS NULL OR decor_url LIKE '/__l5e/assets-v1/%'),
  CONSTRAINT mkt_seasonal_mascot_url_chk
    CHECK (mascot_url IS NULL OR mascot_url LIKE '/__l5e/assets-v1/%'),
  CONSTRAINT mkt_seasonal_image_path_chk
    CHECK (image_path IS NULL OR image_path LIKE 'public/campaigns/%'),
  CONSTRAINT mkt_seasonal_decor_path_chk
    CHECK (decor_path IS NULL OR decor_path LIKE 'public/campaigns/%'),
  CONSTRAINT mkt_seasonal_mascot_path_chk
    CHECK (mascot_path IS NULL OR mascot_path LIKE 'public/campaigns/%'),
  CONSTRAINT mkt_seasonal_section_chk
    CHECK (placement <> 'section' OR section_key <> '')
);

CREATE INDEX mkt_seasonal_live_idx
  ON public.mkt_seasonal_backdrops (placement, priority DESC, starts_at DESC)
  WHERE status = 'active';

GRANT SELECT ON public.mkt_seasonal_backdrops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_seasonal_backdrops TO authenticated;
GRANT ALL ON public.mkt_seasonal_backdrops TO service_role;
ALTER TABLE public.mkt_seasonal_backdrops ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_seasonal_public_read
  ON public.mkt_seasonal_backdrops FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY mkt_seasonal_admin_read
  ON public.mkt_seasonal_backdrops FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY mkt_seasonal_admin_insert
  ON public.mkt_seasonal_backdrops FOR INSERT TO authenticated
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_seasonal_admin_update
  ON public.mkt_seasonal_backdrops FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_seasonal_admin_delete
  ON public.mkt_seasonal_backdrops FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_seasonal_backdrops_touch
  BEFORE UPDATE ON public.mkt_seasonal_backdrops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Exclusive offers ────────────────────────────────────────
CREATE TABLE public.mkt_exclusive_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  subtitle_ar text NOT NULL DEFAULT '',
  subtitle_en text NOT NULL DEFAULT '',
  badge_ar text NOT NULL DEFAULT '',
  badge_en text NOT NULL DEFAULT '',
  cta_ar text NOT NULL DEFAULT '',
  cta_en text NOT NULL DEFAULT '',
  click_url text NOT NULL DEFAULT '/search',
  image_url text,
  image_path text,
  listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  storefront_id uuid REFERENCES public.mkt_storefronts(id) ON DELETE SET NULL,
  backdrop_id uuid REFERENCES public.mkt_seasonal_backdrops(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_exclusive_status_chk CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  CONSTRAINT mkt_exclusive_window_chk CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT mkt_exclusive_url_chk CHECK (click_url LIKE '/%'),
  CONSTRAINT mkt_exclusive_image_url_chk
    CHECK (image_url IS NULL OR image_url LIKE '/__l5e/assets-v1/%'),
  CONSTRAINT mkt_exclusive_image_path_chk
    CHECK (image_path IS NULL OR image_path LIKE 'public/campaigns/%')
);

CREATE INDEX mkt_exclusive_live_idx
  ON public.mkt_exclusive_offers (priority DESC, starts_at DESC)
  WHERE status = 'active';

GRANT SELECT ON public.mkt_exclusive_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_exclusive_offers TO authenticated;
GRANT ALL ON public.mkt_exclusive_offers TO service_role;
ALTER TABLE public.mkt_exclusive_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_exclusive_public_read
  ON public.mkt_exclusive_offers FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY mkt_exclusive_admin_read
  ON public.mkt_exclusive_offers FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY mkt_exclusive_admin_insert
  ON public.mkt_exclusive_offers FOR INSERT TO authenticated
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_exclusive_admin_update
  ON public.mkt_exclusive_offers FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_exclusive_admin_delete
  ON public.mkt_exclusive_offers FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_exclusive_offers_touch
  BEFORE UPDATE ON public.mkt_exclusive_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Demo season, live now so the preview shows the feature ──
INSERT INTO public.mkt_seasonal_backdrops
  (slug, label_ar, label_en, placement, image_url, image_width, image_height,
   decor_url, motif, overlay, accent, mascot, priority, status, starts_at, ends_at)
VALUES
  ('school-2026', 'العودة للمدارس', 'Back to school', 'header',
   '/__l5e/assets-v1/315cb1d6-70ec-476f-90ed-294149486a90/kaheel-season-school-hero.webp',
   1600, 906,
   '/__l5e/assets-v1/0e0e23f3-8463-481a-8a4f-8c265bb8dc5b/kaheel-season-school-decor.webp',
   'school', 'strong', '#f59e0b', 'kaheelan', 10, 'active', now(), now() + interval '30 days');

INSERT INTO public.mkt_exclusive_offers
  (slug, title_ar, title_en, subtitle_ar, subtitle_en, badge_ar, badge_en,
   cta_ar, cta_en, click_url, priority, status, starts_at, ends_at)
VALUES
  ('school-kits', 'قرطاسية المدارس', 'School supplies',
   'كل لوازم المدرسة من متاجر قريبة منك', 'Everything for the new term, from nearby stores',
   'حصري', 'Exclusive', 'تسوّق الآن', 'Shop now', '/search?q=%D9%82%D8%B1%D8%B7%D8%A7%D8%B3%D9%8A%D8%A9',
   20, 'active', now(), now() + interval '30 days'),
  ('restaurant-week', 'أسبوع المطاعم', 'Restaurant week',
   'عروض مختارة من مطاعم مميزة', 'Hand-picked deals from featured restaurants',
   'مختار بعناية', 'Curated', 'اطلب الآن', 'Order now', '/search?category=restaurants',
   10, 'active', now(), now() + interval '30 days');