ALTER TABLE public.mkt_guide_places
  ADD COLUMN IF NOT EXISTS country_iso2 text NOT NULL DEFAULT 'SY';

UPDATE public.mkt_guide_places SET country_iso2 = 'SY' WHERE country_iso2 IS NULL OR country_iso2 = '';

CREATE INDEX IF NOT EXISTS mkt_guide_places_country_idx
  ON public.mkt_guide_places (country_iso2, is_published);