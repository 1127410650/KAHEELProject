-- [PARITY RESTORATION] Forward-only, idempotent.
-- Verbatim effect of production ledger version 20260808152330 ("real_unified_bookings_and_syria_directory"),
-- which was applied to production on 2026-08-08/12 without a repo file.
-- Purpose: let a fresh database be rebuilt from repo files alone.
-- This file is NOT applied to production (production already holds this state).
-- Only additive idempotency guards were introduced (IF NOT EXISTS / DROP ... IF EXISTS).
-- NOTE: the kaheel_unified_customer_bookings_v2 / appt_* portion of this ledger
-- version was intentionally removed from production on 2026-08-09 (legacy cleanup
-- migration 20260809035004). It is deliberately NOT restored here; only the
-- KAHEEL Syria Directory objects, which still exist in production, are restored.

-- ---------------------------------------------------------------------------
-- KAHEEL Syria Directory: public-safe records and private import evidence.
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS mkt_private;
REVOKE ALL ON SCHEMA mkt_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mkt_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_syria_normalize(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        regexp_replace(lower(COALESCE(_value, '')), '[ًٌٍَُِّْـ]', '', 'g'),
        'أإآةىؤئ',
        'اااهيوي'
      ),
      '[^[:alnum:]ء-ي]+',
      ' ',
      'g'
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_syria_directory_name_requires_review(
  _name_ar text,
  _name_en text DEFAULT NULL,
  _aliases text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT (' ' || public.mkt_syria_normalize(
    concat_ws(' ', _name_ar, _name_en, _aliases)
  ) || ' ') LIKE '% الاسد %'
  OR (' ' || public.mkt_syria_normalize(
    concat_ws(' ', _name_ar, _name_en, _aliases)
  ) || ' ') LIKE '% assad %'
$$;

REVOKE ALL ON FUNCTION public.mkt_syria_normalize(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_syria_directory_name_requires_review(text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_syria_normalize(text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_syria_directory_name_requires_review(text, text, text)
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.mkt_syria_directory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  aliases text,
  sector text NOT NULL,
  category text NOT NULL,
  subcategory text,
  ownership text,
  governorate text,
  city text,
  district text,
  subdistrict text,
  neighborhood text,
  address text,
  address_status text,
  latitude double precision,
  longitude double precision,
  map_url text,
  map_status text,
  website text,
  specialties_services text,
  operational_status text,
  source_primary text,
  source_secondary text,
  source_type text NOT NULL,
  source_date text,
  retrieved_on date,
  verification_status text NOT NULL,
  completeness_score numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completeness_score BETWEEN 0 AND 100),
  notes text,
  publication_status text NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('published','pending_correction','rejected','archived')),
  review_reason text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mkt_syria_directory_public_idx
  ON public.mkt_syria_directory_entries
  (publication_status, sector, governorate, completeness_score DESC);
CREATE INDEX IF NOT EXISTS mkt_syria_directory_category_idx
  ON public.mkt_syria_directory_entries
  (publication_status, category, subcategory);
CREATE INDEX IF NOT EXISTS mkt_syria_directory_search_idx
  ON public.mkt_syria_directory_entries
  USING gin (search_text extensions.gin_trgm_ops);

CREATE TABLE IF NOT EXISTS mkt_private.syria_directory_raw (
  entry_id uuid PRIMARY KEY REFERENCES public.mkt_syria_directory_entries(id) ON DELETE CASCADE,
  source_record_id text NOT NULL UNIQUE,
  raw_payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mkt_private.syria_directory_raw ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mkt_private.syria_directory_raw FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE mkt_private.syria_directory_raw TO service_role;

CREATE TABLE IF NOT EXISTS public.mkt_syria_university_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_program_id text NOT NULL UNIQUE,
  institution text NOT NULL,
  ownership text,
  governorate text,
  study_location text,
  faculty_institute text,
  program_name text NOT NULL,
  admission_track text,
  academic_year text,
  source_url text,
  source_type text,
  verification_status text,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_syria_programs_search_idx
  ON public.mkt_syria_university_programs
  USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mkt_syria_programs_location_idx
  ON public.mkt_syria_university_programs (governorate, institution);

CREATE TABLE IF NOT EXISTS public.mkt_syria_technical_institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_institute_id text NOT NULL UNIQUE,
  institute_name text NOT NULL,
  affiliated_entity text,
  governorate text,
  location text,
  specialties text,
  academic_year text,
  source_url text,
  source_type text,
  verification_status text,
  notes text,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_syria_institutes_search_idx
  ON public.mkt_syria_technical_institutes
  USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mkt_syria_institutes_location_idx
  ON public.mkt_syria_technical_institutes (governorate, institute_name);

CREATE OR REPLACE FUNCTION public.mkt_syria_directory_entry_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
BEGIN
  NEW.name_ar := btrim(NEW.name_ar);
  IF NEW.name_ar = '' THEN RAISE EXCEPTION 'directory_name_required'; END IF;
  NEW.search_text := public.mkt_syria_normalize(concat_ws(' ',
    NEW.name_ar, NEW.name_en, NEW.aliases, NEW.sector, NEW.category,
    NEW.subcategory, NEW.governorate, NEW.city, NEW.district,
    NEW.subdistrict, NEW.neighborhood, NEW.address, NEW.specialties_services
  ));

  IF public.mkt_syria_directory_name_requires_review(
    NEW.name_ar, NEW.name_en, NEW.aliases
  ) THEN
    NEW.publication_status := 'pending_correction';
    NEW.review_reason := COALESCE(NULLIF(NEW.review_reason, ''), 'restricted_name_review');
    NEW.published_at := NULL;
  ELSIF NEW.publication_status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_mkt_syria_directory_entry_guard ON public.mkt_syria_directory_entries;
CREATE TRIGGER trg_mkt_syria_directory_entry_guard
  BEFORE INSERT OR UPDATE OF
    name_ar, name_en, aliases, sector, category, subcategory, governorate, city,
    district, subdistrict, neighborhood, address, specialties_services,
    publication_status
  ON public.mkt_syria_directory_entries
  FOR EACH ROW EXECUTE FUNCTION public.mkt_syria_directory_entry_guard();

CREATE OR REPLACE FUNCTION public.mkt_syria_program_search_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
BEGIN
  NEW.search_text := public.mkt_syria_normalize(concat_ws(' ',
    NEW.institution, NEW.ownership, NEW.governorate, NEW.study_location,
    NEW.faculty_institute, NEW.program_name, NEW.admission_track
  ));
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_mkt_syria_program_search_guard ON public.mkt_syria_university_programs;
CREATE TRIGGER trg_mkt_syria_program_search_guard
  BEFORE INSERT OR UPDATE ON public.mkt_syria_university_programs
  FOR EACH ROW EXECUTE FUNCTION public.mkt_syria_program_search_guard();

CREATE OR REPLACE FUNCTION public.mkt_syria_institute_search_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
BEGIN
  NEW.search_text := public.mkt_syria_normalize(concat_ws(' ',
    NEW.institute_name, NEW.affiliated_entity, NEW.governorate,
    NEW.location, NEW.specialties
  ));
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_mkt_syria_institute_search_guard ON public.mkt_syria_technical_institutes;
CREATE TRIGGER trg_mkt_syria_institute_search_guard
  BEFORE INSERT OR UPDATE ON public.mkt_syria_technical_institutes
  FOR EACH ROW EXECUTE FUNCTION public.mkt_syria_institute_search_guard();

-- One curation queue shared with the existing workforce system.
INSERT INTO public.mkt_workforce_specialties (
  code, name_ar, name_en, department_code, sort_order
)
VALUES (
  'directory_curation', 'تدقيق بيانات الدليل', 'Directory data curation', 'activities', 55
)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  department_code = EXCLUDED.department_code,
  is_active = true,
  updated_at = now();

INSERT INTO public.mkt_workforce_kinds (
  kind, name_ar, name_en, department_code, required_specialty,
  default_priority, sla_minutes, allow_general, sort_order
)
VALUES (
  'directory_review', 'مراجعة اسم في دليل سوريا', 'Syria Directory name review',
  'activities', 'directory_curation', 'high', 1440, true, 55
)
ON CONFLICT (kind) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  department_code = EXCLUDED.department_code,
  required_specialty = EXCLUDED.required_specialty,
  default_priority = EXCLUDED.default_priority,
  sla_minutes = EXCLUDED.sla_minutes,
  allow_general = EXCLUDED.allow_general,
  is_active = true,
  updated_at = now();

UPDATE public.mkt_workforce_departments
SET queue_kinds = CASE
      WHEN 'directory_review' = ANY(queue_kinds) THEN queue_kinds
      ELSE array_append(queue_kinds, 'directory_review')
    END,
    updated_at = now()
WHERE code = 'activities';

CREATE OR REPLACE FUNCTION public.mkt_queue_perm(_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT CASE _kind
    WHEN 'listing_review'      THEN 'listings.review'
    WHEN 'report'              THEN 'reports.manage'
    WHEN 'verification'        THEN 'verifications.manage'
    WHEN 'activity_suggestion' THEN 'listings.review'
    WHEN 'directory_review'    THEN 'listings.review'
    WHEN 'account_review'      THEN 'users.manage'
    WHEN 'business_review'     THEN 'businesses.manage'
    WHEN 'security_review'     THEN 'restrictions.manage'
    WHEN 'admin_request'       THEN 'restrictions.manage'
    ELSE 'restrictions.manage'
  END
$$;
REVOKE ALL ON FUNCTION public.mkt_queue_perm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_queue_perm(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_syria_directory_workforce_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.publication_status = 'pending_correction' THEN
    -- Data migrations run without a human auth.uid(). In that context, keep
    -- the item safely visible in the workforce queue without auto-assigning it
    -- (auto-assignment writes a human audit event). Normal authenticated writes
    -- continue to use the workforce distributor.
    IF auth.uid() IS NULL THEN
      INSERT INTO public.mkt_admin_assignments (
        kind, subject_id, priority, auto_assigned
      )
      VALUES ('directory_review', NEW.id, 'high', false)
      ON CONFLICT (kind, subject_id)
        WHERE released_at IS NULL AND closed_at IS NULL
      DO NOTHING;
    ELSE
      PERFORM public.mkt_workforce_autoqueue('directory_review', NEW.id, 'high');
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.publication_status IS DISTINCT FROM NEW.publication_status
    AND NEW.publication_status IN ('published','rejected','archived') THEN
    PERFORM public.mkt_workforce_close_item('directory_review', NEW.id);
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.mkt_syria_directory_workforce_sync()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_mkt_syria_directory_workforce_sync ON public.mkt_syria_directory_entries;
CREATE TRIGGER trg_mkt_syria_directory_workforce_sync
  AFTER INSERT OR UPDATE OF publication_status
  ON public.mkt_syria_directory_entries
  FOR EACH ROW EXECUTE FUNCTION public.mkt_syria_directory_workforce_sync();

ALTER TABLE public.mkt_syria_directory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_syria_university_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_syria_technical_institutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_syria_directory_public_read ON public.mkt_syria_directory_entries;
CREATE POLICY mkt_syria_directory_public_read
  ON public.mkt_syria_directory_entries
  FOR SELECT TO anon, authenticated
  USING (publication_status = 'published');
DROP POLICY IF EXISTS mkt_syria_programs_public_read ON public.mkt_syria_university_programs;
CREATE POLICY mkt_syria_programs_public_read
  ON public.mkt_syria_university_programs
  FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS mkt_syria_institutes_public_read ON public.mkt_syria_technical_institutes;
CREATE POLICY mkt_syria_institutes_public_read
  ON public.mkt_syria_technical_institutes
  FOR SELECT TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.mkt_syria_directory_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, source_record_id, name_ar, name_en, aliases, sector, category,
  subcategory, ownership, governorate, city, district, subdistrict,
  neighborhood, address, address_status, latitude, longitude, map_url,
  map_status, website, specialties_services, operational_status,
  source_primary, source_secondary, source_type, source_date, retrieved_on,
  verification_status, completeness_score, notes, publication_status,
  published_at, search_text, created_at, updated_at
) ON public.mkt_syria_directory_entries TO anon, authenticated;
GRANT ALL ON TABLE public.mkt_syria_directory_entries TO service_role;

REVOKE ALL ON TABLE public.mkt_syria_university_programs FROM PUBLIC;
REVOKE ALL ON TABLE public.mkt_syria_technical_institutes FROM PUBLIC;
GRANT SELECT ON TABLE public.mkt_syria_university_programs,
  public.mkt_syria_technical_institutes TO anon, authenticated;
GRANT ALL ON TABLE public.mkt_syria_university_programs,
  public.mkt_syria_technical_institutes TO service_role;

CREATE OR REPLACE FUNCTION public.mkt_syria_guide_search_v1(
  _q text DEFAULT NULL,
  _kind text DEFAULT 'all',
  _sector text DEFAULT NULL,
  _governorate text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  WITH normalized AS (
    SELECT NULLIF(public.mkt_syria_normalize(_q), '') AS q
  ),
  combined AS (
    SELECT
      'entity'::text AS kind,
      e.id,
      e.name_ar AS title,
      COALESCE(e.subcategory, e.category) AS subtitle,
      e.sector,
      e.category,
      e.governorate,
      e.city,
      e.address,
      e.map_url,
      e.website,
      e.source_type,
      e.verification_status,
      e.completeness_score,
      e.search_text,
      jsonb_build_object(
        'source_record_id', e.source_record_id,
        'name_en', e.name_en,
        'aliases', e.aliases,
        'subcategory', e.subcategory,
        'ownership', e.ownership,
        'district', e.district,
        'subdistrict', e.subdistrict,
        'neighborhood', e.neighborhood,
        'address_status', e.address_status,
        'map_status', e.map_status,
        'specialties_services', e.specialties_services,
        'operational_status', e.operational_status,
        'source_primary', e.source_primary,
        'source_date', e.source_date,
        'retrieved_on', e.retrieved_on,
        'notes', e.notes
      ) AS details
    FROM public.mkt_syria_directory_entries e
    WHERE e.publication_status = 'published'

    UNION ALL

    SELECT
      'program'::text,
      p.id,
      p.program_name,
      p.institution,
      'التعليم'::text,
      'اختصاص جامعي'::text,
      p.governorate,
      p.study_location,
      p.study_location,
      NULL::text,
      p.source_url,
      COALESCE(p.source_type, 'رسمي'),
      COALESCE(p.verification_status, 'يحتاج تدقيق نهائي'),
      75::numeric,
      p.search_text,
      jsonb_build_object(
        'source_program_id', p.source_program_id,
        'ownership', p.ownership,
        'faculty_institute', p.faculty_institute,
        'admission_track', p.admission_track,
        'academic_year', p.academic_year
      )
    FROM public.mkt_syria_university_programs p

    UNION ALL

    SELECT
      'institute'::text,
      i.id,
      i.institute_name,
      COALESCE(i.affiliated_entity, 'معهد تقني'),
      'التعليم'::text,
      'معهد تقني'::text,
      i.governorate,
      i.location,
      i.location,
      NULL::text,
      i.source_url,
      COALESCE(i.source_type, 'رسمي'),
      COALESCE(i.verification_status, 'يحتاج تدقيق لغوي'),
      70::numeric,
      i.search_text,
      jsonb_build_object(
        'source_institute_id', i.source_institute_id,
        'specialties', i.specialties,
        'academic_year', i.academic_year,
        'notes', i.notes
      )
    FROM public.mkt_syria_technical_institutes i
  ),
  filtered AS (
    SELECT c.*
    FROM combined c
    CROSS JOIN normalized n
    WHERE (COALESCE(NULLIF(_kind, ''), 'all') = 'all' OR c.kind = _kind)
      AND (_sector IS NULL OR c.sector = _sector)
      AND (_governorate IS NULL OR c.governorate = _governorate)
      AND (n.q IS NULL OR c.search_text ILIKE '%' || n.q || '%')
  ),
  page AS (
    SELECT *
    FROM filtered
    ORDER BY
      (source_type LIKE 'رسمي%') DESC,
      completeness_score DESC,
      title,
      id
    LIMIT LEAST(GREATEST(COALESCE(_limit, 24), 1), 60)
    OFFSET LEAST(GREATEST(COALESCE(_offset, 0), 0), 10000)
  )
  SELECT jsonb_build_object(
    'contract_version', '1.0',
    'total', (SELECT count(*) FROM filtered),
    'items', COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb)
  )
  FROM page
$$;

CREATE OR REPLACE FUNCTION public.mkt_syria_guide_facets_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'contract_version', '1.0',
    'sectors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', sector, 'count', amount)
        ORDER BY amount DESC, sector)
      FROM (
        SELECT sector, count(*) AS amount
        FROM public.mkt_syria_directory_entries
        WHERE publication_status = 'published'
        GROUP BY sector
      ) sectors
    ), '[]'::jsonb),
    'governorates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', governorate, 'count', amount)
        ORDER BY amount DESC, governorate)
      FROM (
        SELECT governorate, count(*) AS amount
        FROM public.mkt_syria_directory_entries
        WHERE publication_status = 'published' AND governorate IS NOT NULL
        GROUP BY governorate
      ) governorates
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_syria_guide_search_v1(text, text, text, text, integer, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_syria_guide_facets_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_syria_guide_search_v1(text, text, text, text, integer, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_syria_guide_facets_v1()
  TO anon, authenticated, service_role;

-- Administrative functions live in a non-exposed schema. Public functions
-- below are SECURITY INVOKER wrappers only.
CREATE OR REPLACE FUNCTION mkt_private.admin_syria_directory_queue(
  _status text DEFAULT 'pending_correction',
  _q text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, mkt_private, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_admin_can('listings.review') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(_status, 'pending_correction') NOT IN (
    'all','published','pending_correction','rejected','archived'
  ) THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT jsonb_build_object(
    'contract_version', '1.0',
    'items', COALESCE(jsonb_agg(row_payload ORDER BY created_at, id), '[]'::jsonb)
  ) INTO result
  FROM (
    SELECT
      e.created_at,
      e.id,
      to_jsonb(e) || jsonb_build_object(
        'raw_payload', raw.raw_payload,
        'assignee', assignment.assignee,
        'claimed_at', assignment.claimed_at
      ) AS row_payload
    FROM public.mkt_syria_directory_entries e
    LEFT JOIN mkt_private.syria_directory_raw raw ON raw.entry_id = e.id
    LEFT JOIN public.mkt_admin_assignments assignment
      ON assignment.kind = 'directory_review'
      AND assignment.subject_id = e.id
      AND assignment.released_at IS NULL
      AND assignment.closed_at IS NULL
    WHERE (_status = 'all' OR e.publication_status = _status)
      AND (
        NULLIF(public.mkt_syria_normalize(_q), '') IS NULL
        OR e.search_text ILIKE '%' || public.mkt_syria_normalize(_q) || '%'
      )
    ORDER BY e.created_at, e.id
    LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 200)
  ) rows;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION mkt_private.admin_syria_directory_review(
  _entry_id uuid,
  _action text,
  _corrected_name_ar text DEFAULT NULL,
  _corrected_name_en text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mkt_private, pg_temp
AS $$
DECLARE
  old_row public.mkt_syria_directory_entries;
  new_row public.mkt_syria_directory_entries;
  next_name_ar text;
  next_name_en text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_admin_can('listings.review') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action NOT IN ('publish_corrected','keep_pending','reject') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF NULLIF(btrim(COALESCE(_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'note_required';
  END IF;

  SELECT * INTO old_row
  FROM public.mkt_syria_directory_entries
  WHERE id = _entry_id
  FOR UPDATE;
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'entry_not_found'; END IF;
  IF old_row.publication_status <> 'pending_correction' THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  next_name_ar := COALESCE(NULLIF(btrim(COALESCE(_corrected_name_ar, '')), ''), old_row.name_ar);
  next_name_en := CASE
    WHEN _corrected_name_en IS NULL THEN old_row.name_en
    ELSE NULLIF(btrim(_corrected_name_en), '')
  END;

  IF _action = 'publish_corrected' AND public.mkt_syria_directory_name_requires_review(
    next_name_ar, next_name_en, NULL
  ) THEN
    RAISE EXCEPTION 'name_still_requires_review';
  END IF;

  UPDATE public.mkt_syria_directory_entries
  SET name_ar = next_name_ar,
      name_en = next_name_en,
      aliases = CASE
        WHEN _action = 'publish_corrected'
          AND public.mkt_syria_directory_name_requires_review(NULL, NULL, old_row.aliases)
        THEN NULL
        ELSE aliases
      END,
      publication_status = CASE _action
        WHEN 'publish_corrected' THEN 'published'
        WHEN 'reject' THEN 'rejected'
        ELSE 'pending_correction'
      END,
      review_note = btrim(_note),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      published_at = CASE WHEN _action = 'publish_corrected' THEN now() ELSE NULL END
  WHERE id = _entry_id
  RETURNING * INTO new_row;

  PERFORM public.log_audit(
    'mkt_syria_directory_entries',
    'directory_' || _action,
    _entry_id,
    to_jsonb(old_row),
    to_jsonb(new_row),
    btrim(_note)
  );

  RETURN to_jsonb(new_row);
END
$$;

REVOKE ALL ON FUNCTION mkt_private.admin_syria_directory_queue(text, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mkt_private.admin_syria_directory_review(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mkt_private.admin_syria_directory_queue(text, text, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mkt_private.admin_syria_directory_review(uuid, text, text, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_syria_directory_queue(
  _status text DEFAULT 'pending_correction',
  _q text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public, mkt_private, pg_temp
AS $$
  SELECT mkt_private.admin_syria_directory_queue(_status, _q, _limit)
$$;

CREATE OR REPLACE FUNCTION public.mkt_admin_syria_directory_review(
  _entry_id uuid,
  _action text,
  _corrected_name_ar text DEFAULT NULL,
  _corrected_name_en text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO public, mkt_private, pg_temp
AS $$
  SELECT mkt_private.admin_syria_directory_review(
    _entry_id, _action, _corrected_name_ar, _corrected_name_en, _note
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_syria_directory_queue(text, text, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_syria_directory_review(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_syria_directory_queue(text, text, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_admin_syria_directory_review(uuid, text, text, text, text)
  TO authenticated, service_role;

COMMENT ON TABLE public.mkt_syria_directory_entries
  IS 'Public-safe KAHEEL Syria Directory records. Raw imported contacts and moderation evidence are kept outside the exposed schema.';
COMMENT ON TABLE mkt_private.syria_directory_raw
  IS 'Private raw import evidence for Syria Directory review. Never exposed to public clients.';
