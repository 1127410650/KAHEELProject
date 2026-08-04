-- 1) Normalization helper: spaces, hamza variants, punctuation, dashes, case.
CREATE OR REPLACE FUNCTION public.mkt_norm_label(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    translate(
      lower(coalesce(_v, '')),
      'أإآٱىئؤةـ',
      'اااايياه '
    ),
    '[^a-z0-9\u0621-\u064a]+', '', 'g'
  )
$$;

-- 2) Legacy alias registry (public read, admin write).
CREATE TABLE IF NOT EXISTS public.mkt_category_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.mkt_categories(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (public.mkt_norm_label(alias)) STORED,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mkt_category_aliases_norm_key
  ON public.mkt_category_aliases (alias_norm);

GRANT SELECT ON public.mkt_category_aliases TO anon;
GRANT SELECT ON public.mkt_category_aliases TO authenticated;
GRANT ALL ON public.mkt_category_aliases TO service_role;

ALTER TABLE public.mkt_category_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_category_aliases_public_read"
  ON public.mkt_category_aliases FOR SELECT
  USING (true);

CREATE POLICY "mkt_category_aliases_admin_write"
  ON public.mkt_category_aliases FOR ALL
  TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_category_aliases_touch
  BEFORE UPDATE ON public.mkt_category_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Seed the legacy "عقار ديل" names onto the canonical real-estate record.
INSERT INTO public.mkt_category_aliases (category_id, alias, note)
SELECT c.id, a.alias, 'merged from realdeal duplicate 2026-08-04'
FROM public.mkt_categories c
CROSS JOIN (VALUES
  ('عقار ديل'),
  ('عقار دليل'),
  ('عقارديل'),
  ('Real Estate Deal'),
  ('Property deals'),
  ('real-estate-deal'),
  ('real_estate_deal'),
  ('aqar-deal'),
  ('aqar_deal'),
  ('aqardeal'),
  ('realdeal'),
  ('real-estate'),
  ('عقارات'),
  ('العقارات'),
  ('Real estate')
) AS a(alias)
WHERE c.slug = 'real-estate' AND c.parent_id IS NULL
ON CONFLICT (alias_norm) DO NOTHING;

-- 4) Guard: no new top-level category may duplicate an existing one or an alias.
CREATE OR REPLACE FUNCTION public.mkt_categories_no_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clash uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO _clash
  FROM public.mkt_categories c
  WHERE c.parent_id IS NULL
    AND c.id <> NEW.id
    AND (
      public.mkt_norm_label(c.slug) = public.mkt_norm_label(NEW.slug)
      OR public.mkt_norm_label(c.name_ar) = public.mkt_norm_label(NEW.name_ar)
      OR (
        coalesce(NEW.name_en, '') <> ''
        AND public.mkt_norm_label(c.name_en) = public.mkt_norm_label(NEW.name_en)
      )
    )
  LIMIT 1;

  IF _clash IS NULL THEN
    SELECT al.category_id INTO _clash
    FROM public.mkt_category_aliases al
    WHERE al.category_id <> NEW.id
      AND al.alias_norm IN (
        public.mkt_norm_label(NEW.slug),
        public.mkt_norm_label(NEW.name_ar),
        public.mkt_norm_label(coalesce(NEW.name_en, ''))
      )
    LIMIT 1;
  END IF;

  IF _clash IS NOT NULL THEN
    RAISE EXCEPTION 'يوجد تصنيف مطابق أو مسمى بديل مرتبط بتصنيف عقارات.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_categories_no_duplicate ON public.mkt_categories;
CREATE TRIGGER mkt_categories_no_duplicate
  BEFORE INSERT OR UPDATE OF slug, name_ar, name_en, parent_id ON public.mkt_categories
  FOR EACH ROW EXECUTE FUNCTION public.mkt_categories_no_duplicate();