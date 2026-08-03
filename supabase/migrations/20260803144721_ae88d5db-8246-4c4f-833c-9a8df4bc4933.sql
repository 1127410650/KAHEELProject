-- ============ 1. normalization helper ============
CREATE OR REPLACE FUNCTION public.mkt_norm_activity_text(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(
    regexp_replace(
      translate(
        regexp_replace(lower(coalesce(_t, '')), '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', 'g'),
        'أإآٱىئءؤةيك٠١٢٣٤٥٦٧٨٩٫',
        'اااااااهيك0123456789.'
      ),
      '[^a-z0-9\u0600-\u06FF]+', '', 'g'
    ), '');
$$;

COMMENT ON FUNCTION public.mkt_norm_activity_text(text) IS 'Arabic/Latin normaliser for activity matching: strips diacritics/tatweel, unifies hamza/alef/ya/ta-marbuta, converts Arabic-Indic digits, drops spaces and dashes.';

-- ============ 2. groups ============
CREATE TABLE public.mkt_activity_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_activity_groups TO anon, authenticated;
GRANT INSERT, UPDATE ON public.mkt_activity_groups TO authenticated;
GRANT ALL ON public.mkt_activity_groups TO service_role;
ALTER TABLE public.mkt_activity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity groups are publicly readable"
  ON public.mkt_activity_groups FOR SELECT TO anon, authenticated USING (is_active OR public.mkt_is_platform_admin());
CREATE POLICY "admins insert activity groups"
  ON public.mkt_activity_groups FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "admins update activity groups"
  ON public.mkt_activity_groups FOR UPDATE TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());

-- ============ 3. activities ============
CREATE TABLE public.mkt_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.mkt_activity_groups(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.mkt_activities(id) ON DELETE RESTRICT,
  name_ar text NOT NULL,
  name_en text,
  norm_ar text GENERATED ALWAYS AS (public.mkt_norm_activity_text(name_ar)) STORED,
  norm_en text GENERATED ALWAYS AS (public.mkt_norm_activity_text(name_en)) STORED,
  official_code text,
  official_source text,
  country_id uuid REFERENCES public.mkt_countries(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  needs_review boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  merged_into_id uuid REFERENCES public.mkt_activities(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_activities_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT mkt_activities_no_self_merge CHECK (merged_into_id IS NULL OR merged_into_id <> id),
  CONSTRAINT mkt_activities_official_code_needs_source
    CHECK (official_code IS NULL OR official_source IS NOT NULL)
);

CREATE INDEX mkt_activities_group_idx ON public.mkt_activities (group_id, parent_id);
CREATE INDEX mkt_activities_parent_idx ON public.mkt_activities (parent_id);
CREATE INDEX mkt_activities_norm_ar_idx ON public.mkt_activities (norm_ar);
CREATE UNIQUE INDEX mkt_activities_unique_norm ON public.mkt_activities (group_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), norm_ar);

GRANT SELECT ON public.mkt_activities TO anon, authenticated;
GRANT INSERT, UPDATE ON public.mkt_activities TO authenticated;
GRANT ALL ON public.mkt_activities TO service_role;
ALTER TABLE public.mkt_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active activities are publicly readable"
  ON public.mkt_activities FOR SELECT TO anon, authenticated
  USING ((is_active AND merged_into_id IS NULL) OR public.mkt_is_platform_admin());
CREATE POLICY "admins insert activities"
  ON public.mkt_activities FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "admins update activities"
  ON public.mkt_activities FOR UPDATE TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());

-- sub-activity must live in the same group as its parent, and nesting stops at 2 levels
CREATE OR REPLACE FUNCTION public.mkt_activities_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT group_id, parent_id INTO p FROM public.mkt_activities WHERE id = NEW.parent_id;
    IF p IS NULL THEN
      RAISE EXCEPTION 'parent activity not found';
    END IF;
    IF p.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'activities support only two levels (main and sub)';
    END IF;
    IF p.group_id <> NEW.group_id THEN
      RAISE EXCEPTION 'sub-activity must belong to the same sector as its main activity';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_activities_guard_trg
  BEFORE INSERT OR UPDATE ON public.mkt_activities
  FOR EACH ROW EXECUTE FUNCTION public.mkt_activities_guard();

CREATE OR REPLACE FUNCTION public.mkt_activities_block_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mkt_entity_activities WHERE activity_id = OLD.id) THEN
    RAISE EXCEPTION 'activity is linked to entities and cannot be deleted; deactivate or merge it instead';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_activities WHERE parent_id = OLD.id) THEN
    RAISE EXCEPTION 'activity has sub-activities and cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

-- ============ 4. aliases ============
CREATE TABLE public.mkt_activity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.mkt_activities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  norm_alias text GENERATED ALWAYS AS (public.mkt_norm_activity_text(alias)) STORED,
  kind text NOT NULL DEFAULT 'synonym' CHECK (kind IN ('synonym', 'misspelling', 'legacy')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mkt_activity_aliases_unique ON public.mkt_activity_aliases (activity_id, norm_alias);
CREATE INDEX mkt_activity_aliases_norm_idx ON public.mkt_activity_aliases (norm_alias);

GRANT SELECT ON public.mkt_activity_aliases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_activity_aliases TO authenticated;
GRANT ALL ON public.mkt_activity_aliases TO service_role;
ALTER TABLE public.mkt_activity_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity aliases are publicly readable"
  ON public.mkt_activity_aliases FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage activity aliases"
  ON public.mkt_activity_aliases FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());

-- ============ 5. entity activities ============
CREATE TABLE public.mkt_entity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.mkt_activities(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'migration', 'document', 'admin')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mkt_entity_activities_unique ON public.mkt_entity_activities (tenant_id, activity_id);
CREATE UNIQUE INDEX mkt_entity_activities_one_primary ON public.mkt_entity_activities (tenant_id) WHERE is_primary;
CREATE INDEX mkt_entity_activities_activity_idx ON public.mkt_entity_activities (activity_id);

GRANT SELECT ON public.mkt_entity_activities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mkt_entity_activities TO authenticated;
GRANT ALL ON public.mkt_entity_activities TO service_role;
ALTER TABLE public.mkt_entity_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity activities readable for published or own entities"
  ON public.mkt_entity_activities FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_business_profiles b
      WHERE b.tenant_id = mkt_entity_activities.tenant_id AND b.is_published
    )
    OR public.is_tenant_member(tenant_id)
    OR public.mkt_is_platform_admin()
  );
CREATE POLICY "members manage own entity activities"
  ON public.mkt_entity_activities FOR ALL TO authenticated
  USING (public.is_active_member(tenant_id) OR public.mkt_is_platform_admin())
  WITH CHECK (public.is_active_member(tenant_id) OR public.mkt_is_platform_admin());

-- a sub-activity may only be linked when its own main activity matches the primary sector
CREATE OR REPLACE FUNCTION public.mkt_entity_activities_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  primary_group uuid;
BEGIN
  SELECT id, group_id, parent_id, is_active, merged_into_id INTO a
  FROM public.mkt_activities WHERE id = NEW.activity_id;

  IF a IS NULL THEN
    RAISE EXCEPTION 'activity not found';
  END IF;
  IF NOT a.is_active OR a.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'activity is not selectable';
  END IF;

  IF NEW.is_primary AND a.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'the primary activity must be a main activity';
  END IF;

  IF NOT NEW.is_primary THEN
    SELECT act.group_id INTO primary_group
    FROM public.mkt_entity_activities ea
    JOIN public.mkt_activities act ON act.id = ea.activity_id
    WHERE ea.tenant_id = NEW.tenant_id AND ea.is_primary
      AND (TG_OP <> 'UPDATE' OR ea.id <> NEW.id);
    IF primary_group IS NOT NULL AND primary_group <> a.group_id THEN
      RAISE EXCEPTION 'sub-activity belongs to a different sector than the primary activity';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_entity_activities_guard_trg
  BEFORE INSERT OR UPDATE ON public.mkt_entity_activities
  FOR EACH ROW EXECUTE FUNCTION public.mkt_entity_activities_guard();

CREATE TRIGGER mkt_activities_block_delete_trg
  BEFORE DELETE ON public.mkt_activities
  FOR EACH ROW EXECUTE FUNCTION public.mkt_activities_block_delete();

-- ============ 6. suggestions ============
CREATE TABLE public.mkt_activity_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text text NOT NULL,
  norm_text text GENERATED ALWAYS AS (public.mkt_norm_activity_text(raw_text)) STORED,
  group_id uuid REFERENCES public.mkt_activity_groups(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.mkt_activities(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  suggested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  review_note text,
  linked_activity_id uuid REFERENCES public.mkt_activities(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_activity_suggestions_status_idx ON public.mkt_activity_suggestions (status, created_at DESC);
CREATE INDEX mkt_activity_suggestions_norm_idx ON public.mkt_activity_suggestions (norm_text);

GRANT SELECT, INSERT ON public.mkt_activity_suggestions TO authenticated;
GRANT UPDATE ON public.mkt_activity_suggestions TO authenticated;
GRANT ALL ON public.mkt_activity_suggestions TO service_role;
ALTER TABLE public.mkt_activity_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own activity suggestions"
  ON public.mkt_activity_suggestions FOR SELECT TO authenticated
  USING (suggested_by = auth.uid() OR public.mkt_is_platform_admin());
CREATE POLICY "users create activity suggestions"
  ON public.mkt_activity_suggestions FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid() AND status = 'pending');
CREATE POLICY "admins review activity suggestions"
  ON public.mkt_activity_suggestions FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());

-- ============ 7. merge audit ============
CREATE TABLE public.mkt_activity_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.mkt_activities(id) ON DELETE RESTRICT,
  target_id uuid NOT NULL REFERENCES public.mkt_activities(id) ON DELETE RESTRICT,
  moved_links integer NOT NULL DEFAULT 0,
  moved_aliases integer NOT NULL DEFAULT 0,
  moved_children integer NOT NULL DEFAULT 0,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_activity_merges TO authenticated;
GRANT ALL ON public.mkt_activity_merges TO service_role;
ALTER TABLE public.mkt_activity_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read activity merges"
  ON public.mkt_activity_merges FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- ============ 8. sectors seed ============
INSERT INTO public.mkt_activity_groups (slug, name_ar, name_en, sort_order) VALUES
  ('contracting', 'المقاولات', 'Contracting', 10),
  ('transport-logistics', 'النقل والخدمات اللوجستية', 'Transport & Logistics', 20),
  ('engineering-consulting', 'المكاتب الهندسية والاستشارات', 'Engineering & Consulting', 30),
  ('real-estate', 'العقارات', 'Real Estate', 40),
  ('trade-supply', 'التجارة والتوريد', 'Trade & Supply', 50),
  ('industry', 'الصناعة', 'Industry', 60),
  ('maintenance-operations', 'الصيانة والتشغيل', 'Maintenance & Operations', 70),
  ('professional-services', 'الخدمات المهنية', 'Professional Services', 80),
  ('information-technology', 'تقنية المعلومات', 'Information Technology', 90),
  ('hospitality-catering', 'الضيافة والإعاشة', 'Hospitality & Catering', 100),
  ('agriculture', 'الزراعة', 'Agriculture', 110),
  ('other', 'أخرى', 'Other', 999);
