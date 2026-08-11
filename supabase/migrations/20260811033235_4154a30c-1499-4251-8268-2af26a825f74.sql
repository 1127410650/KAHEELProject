-- ══════════════════════════════════════════════════════════════════
-- Batch 2 — Content Studio & Analytics foundation
-- ══════════════════════════════════════════════════════════════════

-- ── 0. Documented structure-guard exception (owner order, PART 3 annex B) ──
UPDATE public.mkt_structure_guard
   SET enabled = false,
       disabled_reason = 'Owner order PART 3 annex B: raw analytics tables must live in a non-exposed analytics.* schema, never reachable through the Data API.',
       disabled_at = now(), disabled_until = now() + interval '5 minutes', updated_at = now()
 WHERE id;
INSERT INTO public.mkt_structure_guard_events (object_identity, command_tag, outcome, performed_by, reason)
VALUES ('analytics', 'GUARD DISABLED', 'allowed', current_user,
        'Documented exception for the non-exposed analytics.* schema (content studio & analytics order).');

-- ── 1. Permission helper for the new content/analytics keys ──────────
CREATE OR REPLACE FUNCTION public.mkt_content_can(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.mkt_is_platform_admin() OR public.mkt_staff_has(_perm);
$$;

-- ── 2. CMS pages ────────────────────────────────────────────────────
CREATE TABLE public.mkt_cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  route_path text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'page',
  title_ar text NOT NULL,
  title_en text,
  description_ar text,
  description_en text,
  og_image_path text,
  robots text NOT NULL DEFAULT 'index',
  status text NOT NULL DEFAULT 'draft',
  published_version_id uuid,
  is_system boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_cms_pages_kind_chk CHECK (kind IN ('page','landing','legal','system','home')),
  CONSTRAINT mkt_cms_pages_status_chk CHECK (status IN ('draft','published','archived')),
  CONSTRAINT mkt_cms_pages_robots_chk CHECK (robots IN ('index','noindex')),
  CONSTRAINT mkt_cms_pages_path_chk CHECK (route_path ~ '^/[A-Za-z0-9/_.$-]*$'),
  CONSTRAINT mkt_cms_pages_slug_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$')
);

CREATE TABLE public.mkt_cms_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.mkt_cms_pages(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid,
  CONSTRAINT mkt_cms_page_versions_status_chk CHECK (status IN ('draft','preview','published','archived')),
  CONSTRAINT mkt_cms_page_versions_no_chk CHECK (version_no >= 1),
  CONSTRAINT mkt_cms_page_versions_unique UNIQUE (page_id, version_no)
);

ALTER TABLE public.mkt_cms_pages
  ADD CONSTRAINT mkt_cms_pages_published_version_fk
  FOREIGN KEY (published_version_id) REFERENCES public.mkt_cms_page_versions(id) ON DELETE SET NULL;

CREATE INDEX mkt_cms_page_versions_page_idx ON public.mkt_cms_page_versions (page_id, version_no DESC);
CREATE INDEX mkt_cms_pages_status_idx ON public.mkt_cms_pages (status) WHERE status = 'published';

CREATE TABLE public.mkt_cms_page_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL UNIQUE,
  to_path text NOT NULL,
  page_id uuid REFERENCES public.mkt_cms_pages(id) ON DELETE CASCADE,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_cms_page_redirects_shape_chk CHECK (from_path ~ '^/[A-Za-z0-9/_.$-]*$' AND to_path ~ '^/[A-Za-z0-9/_.$-]*$'),
  CONSTRAINT mkt_cms_page_redirects_loop_chk CHECK (from_path <> to_path)
);

CREATE TABLE public.mkt_cms_page_locks (
  page_id uuid PRIMARY KEY REFERENCES public.mkt_cms_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_cms_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_cms_pages TO authenticated;
GRANT ALL ON public.mkt_cms_pages TO service_role;
GRANT SELECT ON public.mkt_cms_page_versions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_cms_page_versions TO authenticated;
GRANT ALL ON public.mkt_cms_page_versions TO service_role;
GRANT SELECT ON public.mkt_cms_page_redirects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_cms_page_redirects TO authenticated;
GRANT ALL ON public.mkt_cms_page_redirects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_page_locks TO authenticated;
GRANT ALL ON public.mkt_cms_page_locks TO service_role;

ALTER TABLE public.mkt_cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cms_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cms_page_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cms_page_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cms pages public read published" ON public.mkt_cms_pages
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY "cms pages staff read" ON public.mkt_cms_pages
  FOR SELECT TO authenticated
  USING (public.mkt_content_can('content.view'));
CREATE POLICY "cms pages staff write" ON public.mkt_cms_pages
  FOR INSERT TO authenticated
  WITH CHECK (public.mkt_content_can('content.edit'));
CREATE POLICY "cms pages staff update" ON public.mkt_cms_pages
  FOR UPDATE TO authenticated
  USING (public.mkt_content_can('content.edit') AND (is_system = false OR public.mkt_is_platform_admin()))
  WITH CHECK (public.mkt_content_can('content.edit'));
CREATE POLICY "cms pages admin delete" ON public.mkt_cms_pages
  FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin() AND is_system = false);

CREATE POLICY "cms versions public read published" ON public.mkt_cms_page_versions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_cms_pages p
                  WHERE p.id = page_id AND p.status = 'published' AND p.published_version_id = mkt_cms_page_versions.id));
CREATE POLICY "cms versions staff read" ON public.mkt_cms_page_versions
  FOR SELECT TO authenticated
  USING (public.mkt_content_can('content.view'));
CREATE POLICY "cms versions staff insert" ON public.mkt_cms_page_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.mkt_content_can('content.edit'));
CREATE POLICY "cms versions staff update" ON public.mkt_cms_page_versions
  FOR UPDATE TO authenticated
  USING (public.mkt_content_can('content.edit'))
  WITH CHECK (public.mkt_content_can('content.edit'));
CREATE POLICY "cms versions admin delete" ON public.mkt_cms_page_versions
  FOR DELETE TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY "cms redirects public read" ON public.mkt_cms_page_redirects
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cms redirects staff write" ON public.mkt_cms_page_redirects
  FOR ALL TO authenticated
  USING (public.mkt_content_can('content.edit'))
  WITH CHECK (public.mkt_content_can('content.edit'));

CREATE POLICY "cms locks staff read" ON public.mkt_cms_page_locks
  FOR SELECT TO authenticated USING (public.mkt_content_can('content.view'));
CREATE POLICY "cms locks own write" ON public.mkt_cms_page_locks
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.mkt_content_can('content.edit'))
  WITH CHECK (user_id = auth.uid() AND public.mkt_content_can('content.edit'));

CREATE TRIGGER mkt_cms_pages_touch BEFORE UPDATE ON public.mkt_cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mkt_cms_page_versions_touch BEFORE UPDATE ON public.mkt_cms_page_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mkt_cms_page_redirects_touch BEFORE UPDATE ON public.mkt_cms_page_redirects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Campaign placements on top of the EXISTING campaigns tables ───
CREATE TABLE public.mkt_cms_ad_placements (
  placement_key text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text,
  surface text NOT NULL DEFAULT 'market',
  aspect text,
  max_active integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_cms_ad_placements_key_chk CHECK (placement_key ~ '^[a-z0-9_]+$'),
  CONSTRAINT mkt_cms_ad_placements_max_chk CHECK (max_active BETWEEN 1 AND 20)
);

CREATE TABLE public.mkt_cms_campaign_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.mkt_ad_campaigns(id) ON DELETE CASCADE,
  placement_key text NOT NULL REFERENCES public.mkt_cms_ad_placements(placement_key) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  fallback_campaign_id uuid REFERENCES public.mkt_ad_campaigns(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_cms_campaign_placements_unique UNIQUE (campaign_id, placement_key),
  CONSTRAINT mkt_cms_campaign_placements_weight_chk CHECK (weight BETWEEN 1 AND 100),
  CONSTRAINT mkt_cms_campaign_placements_window_chk CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT mkt_cms_campaign_placements_fallback_chk CHECK (fallback_campaign_id IS NULL OR fallback_campaign_id <> campaign_id)
);

CREATE INDEX mkt_cms_campaign_placements_placement_idx
  ON public.mkt_cms_campaign_placements (placement_key, weight DESC);

ALTER TABLE public.mkt_ad_campaigns
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS fallback_campaign_id uuid REFERENCES public.mkt_ad_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.mkt_ad_campaigns
  ADD CONSTRAINT mkt_ad_campaigns_review_status_chk
  CHECK (review_status IN ('draft','submitted','approved','rejected'));

GRANT SELECT ON public.mkt_cms_ad_placements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_cms_ad_placements TO authenticated;
GRANT ALL ON public.mkt_cms_ad_placements TO service_role;
GRANT SELECT ON public.mkt_cms_campaign_placements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_cms_campaign_placements TO authenticated;
GRANT ALL ON public.mkt_cms_campaign_placements TO service_role;

ALTER TABLE public.mkt_cms_ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cms_campaign_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placements public read active" ON public.mkt_cms_ad_placements
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "placements staff read" ON public.mkt_cms_ad_placements
  FOR SELECT TO authenticated USING (public.mkt_content_can('content.view'));
CREATE POLICY "placements staff write" ON public.mkt_cms_ad_placements
  FOR ALL TO authenticated
  USING (public.mkt_content_can('content.campaigns'))
  WITH CHECK (public.mkt_content_can('content.campaigns'));

CREATE POLICY "campaign placements public read" ON public.mkt_cms_campaign_placements
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "campaign placements staff write" ON public.mkt_cms_campaign_placements
  FOR ALL TO authenticated
  USING (public.mkt_content_can('content.campaigns'))
  WITH CHECK (public.mkt_content_can('content.campaigns'));

CREATE TRIGGER mkt_cms_ad_placements_touch BEFORE UPDATE ON public.mkt_cms_ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mkt_cms_campaign_placements_touch BEFORE UPDATE ON public.mkt_cms_campaign_placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.mkt_cms_ad_placements (placement_key, name_ar, name_en, surface, max_active, sort_order) VALUES
  ('home_banner',       'بانر الرئيسية',        'Home banner',       'market', 3, 10),
  ('home_strip',        'شريط الرئيسية',        'Home strip',        'market', 5, 20),
  ('welcome_takeover',  'ترحيب كامل الشاشة',    'Welcome takeover',  'market', 1, 30),
  ('search_inline',     'داخل نتائج البحث',     'Search inline',     'market', 3, 40),
  ('category_top',      'أعلى صفحة التصنيف',    'Category top',      'market', 2, 50),
  ('aqar_home',         'رئيسية كَحيل عقار',    'Aqar home',         'aqar',   2, 60)
ON CONFLICT (placement_key) DO NOTHING;

-- ── 4. Extend the EXISTING theme engine with non-color tokens + drafts ──
ALTER TABLE public.mkt_theme_settings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'color',
  ADD COLUMN IF NOT EXISTS draft_value text;

ALTER TABLE public.mkt_theme_settings
  ADD CONSTRAINT mkt_theme_settings_category_chk
  CHECK (category IN ('color','font','type','radius','shadow','space'));

-- ── 5. Third character «كحيلا» (Kahila) + new logo media slots ────────
ALTER TABLE public.mkt_mascot_phrases DROP CONSTRAINT IF EXISTS mkt_mascot_phrases_character_chk;
ALTER TABLE public.mkt_mascot_phrases
  ADD CONSTRAINT mkt_mascot_phrases_character_chk
  CHECK ("character" IN ('kaheel','kaheelan','kahila'));

INSERT INTO public.mkt_media_slots (slot_key, section, group_key, kind, title_ar, subtitle_ar, alt_text, hidden, sort_order) VALUES
  ('mascot.kahila.idle',   'mascots', 'kahila', 'image', 'كحيلا — وقوف',      'ترفعها الإدارة بنفس أسلوب 3D', 'كحيلا',            true,  10),
  ('mascot.kahila.walk',   'mascots', 'kahila', 'image', 'كحيلا — مشي',       'شريط إطارات المشي',            'كحيلا تمشي',       true,  20),
  ('brand.logo.header.light', 'brand', 'logo', 'image', 'شعار الهيدر — فاتح', 'گحيل / Kaheel',                'شعار كَحيل',       false, 10),
  ('brand.logo.header.dark',  'brand', 'logo', 'image', 'شعار الهيدر — داكن', 'گحيل / Kaheel',                'شعار كَحيل داكن',  false, 20),
  ('brand.logo.footer',       'brand', 'logo', 'image', 'شعار الفوتر',        'گحيل / Kaheel',                'شعار كَحيل',       false, 30),
  ('brand.favicon',           'brand', 'logo', 'image', 'الأيقونة المفضّلة',  'مجموعة مقاسات',                'أيقونة كَحيل',     false, 40),
  ('brand.social.share',      'brand', 'logo', 'image', 'صورة المشاركة',      'Open Graph 1200×630',          'كَحيل',            false, 50)
ON CONFLICT (slot_key) DO NOTHING;

-- ── 6. Analytics: dedicated NON-exposed schema ───────────────────────
CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM anon, authenticated;
GRANT USAGE ON SCHEMA analytics TO service_role;

CREATE TABLE IF NOT EXISTS analytics.events_raw (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  surface text,
  route_path text,
  entity_kind text,
  entity_id uuid,
  tenant_id uuid,
  actor_id uuid,
  session_key text,
  country text,
  device text,
  referrer_host text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  is_internal boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS events_raw_time_idx ON analytics.events_raw (occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_raw_name_time_idx ON analytics.events_raw (name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_raw_entity_idx ON analytics.events_raw (entity_kind, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_raw_tenant_idx ON analytics.events_raw (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS analytics.agg_hourly (
  bucket timestamptz NOT NULL,
  name text NOT NULL,
  surface text NOT NULL DEFAULT '-',
  entity_kind text NOT NULL DEFAULT '-',
  entity_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  country text NOT NULL DEFAULT '-',
  events bigint NOT NULL DEFAULT 0,
  sessions bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, name, surface, entity_kind, country, entity_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS analytics.agg_daily (
  day date NOT NULL,
  name text NOT NULL,
  surface text NOT NULL DEFAULT '-',
  entity_kind text NOT NULL DEFAULT '-',
  entity_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  country text NOT NULL DEFAULT '-',
  events bigint NOT NULL DEFAULT 0,
  sessions bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name, surface, entity_kind, country, entity_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS analytics.settings (
  id boolean PRIMARY KEY DEFAULT true,
  raw_retention_days integer NOT NULL DEFAULT 90,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_single CHECK (id = true),
  CONSTRAINT settings_retention_chk CHECK (raw_retention_days BETWEEN 7 AND 400)
);
INSERT INTO analytics.settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE analytics.events_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.agg_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.agg_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.settings ENABLE ROW LEVEL SECURITY;

-- ── 7. Retention controls (permissioned + logged) ────────────────────
CREATE OR REPLACE FUNCTION public.mkt_analytics_retention_get()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, analytics AS $$
  SELECT CASE WHEN public.mkt_content_can('analytics.view')
              THEN (SELECT raw_retention_days FROM analytics.settings WHERE id) END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_analytics_retention_set(_days integer, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, analytics AS $$
BEGIN
  IF NOT public.mkt_content_can('analytics.admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE analytics.settings SET raw_retention_days = _days, updated_by = auth.uid(), updated_at = now() WHERE id;
  PERFORM public.log_audit('analytics_settings', 'retention_set', NULL, NULL,
    jsonb_build_object('days', _days), btrim(_reason));
  RETURN _days;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_analytics_purge_expired()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, analytics AS $$
DECLARE v_days integer; v_deleted integer;
BEGIN
  IF NOT public.mkt_content_can('analytics.admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT raw_retention_days INTO v_days FROM analytics.settings WHERE id;
  DELETE FROM analytics.events_raw WHERE occurred_at < now() - make_interval(days => v_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_analytics_purge_test()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, analytics AS $$
DECLARE v_deleted integer;
BEGIN
  IF NOT public.mkt_content_can('analytics.admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM analytics.events_raw WHERE is_test = true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

-- ── 8. Rollup (hourly + daily), excluding demo/internal/test traffic ──
CREATE OR REPLACE FUNCTION public.mkt_analytics_rollup(_since timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, analytics AS $$
DECLARE v_from timestamptz; v_rows integer;
BEGIN
  IF NOT public.mkt_content_can('analytics.admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_from := date_trunc('hour', COALESCE(_since, now() - interval '3 hours'));

  INSERT INTO analytics.agg_hourly (bucket, name, surface, entity_kind, entity_id, tenant_id, country, events, sessions)
  SELECT date_trunc('hour', occurred_at), name, COALESCE(surface,'-'), COALESCE(entity_kind,'-'),
         COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(country,'-'), count(*), count(DISTINCT session_key)
    FROM analytics.events_raw
   WHERE occurred_at >= v_from AND is_test = false AND is_internal = false AND is_demo = false
   GROUP BY 1,2,3,4,5,6,7
  ON CONFLICT (bucket, name, surface, entity_kind, country, entity_id, tenant_id)
  DO UPDATE SET events = EXCLUDED.events, sessions = EXCLUDED.sessions;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  INSERT INTO analytics.agg_daily (day, name, surface, entity_kind, entity_id, tenant_id, country, events, sessions)
  SELECT (occurred_at AT TIME ZONE 'Asia/Riyadh')::date, name, COALESCE(surface,'-'), COALESCE(entity_kind,'-'),
         COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(country,'-'), count(*), count(DISTINCT session_key)
    FROM analytics.events_raw
   WHERE occurred_at >= v_from AND is_test = false AND is_internal = false AND is_demo = false
   GROUP BY 1,2,3,4,5,6,7
  ON CONFLICT (day, name, surface, entity_kind, country, entity_id, tenant_id)
  DO UPDATE SET events = EXCLUDED.events, sessions = EXCLUDED.sessions;

  RETURN v_rows;
END $$;

REVOKE ALL ON FUNCTION public.mkt_analytics_retention_set(integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_analytics_purge_expired() FROM anon;
REVOKE ALL ON FUNCTION public.mkt_analytics_purge_test() FROM anon;
REVOKE ALL ON FUNCTION public.mkt_analytics_rollup(timestamptz) FROM anon;

-- ── 9. Re-enable the structure guard in the same transaction ──────────
UPDATE public.mkt_structure_guard
   SET enabled = true, disabled_until = NULL, updated_at = now()
 WHERE id;
INSERT INTO public.mkt_structure_guard_events (object_identity, command_tag, outcome, performed_by, reason)
VALUES ('analytics', 'GUARD ENABLED', 'allowed', current_user,
        'Analytics schema created; guard restored immediately.');