ALTER TABLE public.mkt_media_slots
  ADD COLUMN IF NOT EXISTS edit_kind text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS variant_page text;

ALTER TABLE public.mkt_media_slots
  DROP CONSTRAINT IF EXISTS mkt_media_slots_edit_kind_chk;
ALTER TABLE public.mkt_media_slots
  ADD CONSTRAINT mkt_media_slots_edit_kind_chk
  CHECK (edit_kind = ANY (ARRAY['media','background','ad','design']));