ALTER TABLE public.mkt_guide_places
  ADD COLUMN IF NOT EXISTS ownership text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS subdistrict text,
  ADD COLUMN IF NOT EXISTS alt_names text,
  ADD COLUMN IF NOT EXISTS services text,
  ADD COLUMN IF NOT EXISTS operational_status text,
  ADD COLUMN IF NOT EXISTS source_extra text,
  ADD COLUMN IF NOT EXISTS retrieved_at text,
  ADD COLUMN IF NOT EXISTS verification_note text;