-- ============================================================
-- Keeta-style animated campaigns: home banner + welcome takeover
-- ============================================================
CREATE TABLE public.mkt_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  placement text NOT NULL DEFAULT 'home_banner',
  asset_kind text NOT NULL DEFAULT 'webp',
  asset_path text NOT NULL,
  poster_path text,
  asset_width integer NOT NULL DEFAULT 1728,
  asset_height integer NOT NULL DEFAULT 920,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  subtitle_ar text NOT NULL DEFAULT '',
  subtitle_en text NOT NULL DEFAULT '',
  badge_ar text NOT NULL DEFAULT '',
  badge_en text NOT NULL DEFAULT '',
  cta_ar text NOT NULL DEFAULT '',
  cta_en text NOT NULL DEFAULT '',
  click_url text NOT NULL DEFAULT '/search',
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ad_campaigns_placement_chk
    CHECK (placement IN ('home_banner', 'welcome_takeover')),
  CONSTRAINT mkt_ad_campaigns_kind_chk
    CHECK (asset_kind IN ('lottie', 'webp', 'mp4', 'image')),
  CONSTRAINT mkt_ad_campaigns_status_chk
    CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  CONSTRAINT mkt_ad_campaigns_window_chk
    CHECK (ends_at IS NULL OR ends_at > starts_at),
  -- public assets only: the bucket policy exposes the `public/` prefix
  CONSTRAINT mkt_ad_campaigns_asset_prefix_chk
    CHECK (asset_path LIKE 'public/campaigns/%'),
  CONSTRAINT mkt_ad_campaigns_poster_prefix_chk
    CHECK (poster_path IS NULL OR poster_path LIKE 'public/campaigns/%')
);

CREATE INDEX mkt_ad_campaigns_live_idx
  ON public.mkt_ad_campaigns (placement, priority DESC, starts_at DESC)
  WHERE status = 'active';

GRANT SELECT ON public.mkt_ad_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_ad_campaigns TO authenticated;
GRANT ALL ON public.mkt_ad_campaigns TO service_role;
ALTER TABLE public.mkt_ad_campaigns ENABLE ROW LEVEL SECURITY;

-- Visitors only ever see a campaign that is live right now.
CREATE POLICY mkt_ad_campaigns_public_read
  ON public.mkt_ad_campaigns FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY mkt_ad_campaigns_admin_read
  ON public.mkt_ad_campaigns FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY mkt_ad_campaigns_admin_write
  ON public.mkt_ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_ad_campaigns_admin_update
  ON public.mkt_ad_campaigns FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY mkt_ad_campaigns_admin_delete
  ON public.mkt_ad_campaigns FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_ad_campaigns_touch
  BEFORE UPDATE ON public.mkt_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Performance events ──────────────────────────────────────
CREATE TABLE public.mkt_ad_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.mkt_ad_campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL,
  user_id uuid,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ad_campaign_events_kind_chk CHECK (kind IN ('impression', 'click'))
);

CREATE INDEX mkt_ad_campaign_events_campaign_idx
  ON public.mkt_ad_campaign_events (campaign_id, created_at DESC);

GRANT SELECT ON public.mkt_ad_campaign_events TO authenticated;
GRANT ALL ON public.mkt_ad_campaign_events TO service_role;
ALTER TABLE public.mkt_ad_campaign_events ENABLE ROW LEVEL SECURITY;

-- Writes happen only through the definer tracker below.
CREATE POLICY mkt_ad_campaign_events_admin_read
  ON public.mkt_ad_campaign_events FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.mkt_ad_campaign_track(
  _campaign_id uuid,
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
  IF _kind NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  SELECT true INTO _live
  FROM public.mkt_ad_campaigns c
  WHERE c.id = _campaign_id
    AND c.status = 'active'
    AND c.starts_at <= now()
    AND (c.ends_at IS NULL OR c.ends_at > now());

  IF _live IS NOT TRUE THEN
    RETURN; -- silently ignore stale clients
  END IF;

  INSERT INTO public.mkt_ad_campaign_events (campaign_id, kind, user_id, session_key)
  VALUES (_campaign_id, _kind, auth.uid(), left(coalesce(_session_key, ''), 64));

  IF _kind = 'impression' THEN
    UPDATE public.mkt_ad_campaigns SET impressions = impressions + 1 WHERE id = _campaign_id;
  ELSE
    UPDATE public.mkt_ad_campaigns SET clicks = clicks + 1 WHERE id = _campaign_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_campaign_track(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_ad_campaign_track(uuid, text, text) TO anon, authenticated;

-- ── Demo Lottie campaign, ready to preview ──────────────────
INSERT INTO public.mkt_ad_campaigns
  (slug, placement, asset_kind, asset_path, asset_width, asset_height,
   title_ar, title_en, subtitle_ar, subtitle_en, badge_ar, badge_en,
   cta_ar, cta_en, click_url, priority, status)
VALUES
  ('kaheel-welcome-lottie', 'welcome_takeover', 'lottie',
   'public/campaigns/kaheel-welcome.json', 1000, 1000,
   'أهلًا بك في كَحيل', 'Welcome to Kaheel',
   'اكتشف آلاف الإعلانات والمتاجر القريبة منك', 'Discover thousands of ads and nearby stores',
   'جديد', 'New', 'ابدأ التصفح', 'Start browsing', '/search', 100, 'active'),
  ('kaheel-banner-lottie', 'home_banner', 'lottie',
   'public/campaigns/kaheel-welcome.json', 1000, 1000,
   'عروض كَحيل المتحركة', 'Kaheel animated offers',
   'حملات مميزة من متاجر موثوقة', 'Featured campaigns from trusted stores',
   'إعلان', 'Ad', 'تصفح العروض', 'Browse offers', '/search', 50, 'active');
