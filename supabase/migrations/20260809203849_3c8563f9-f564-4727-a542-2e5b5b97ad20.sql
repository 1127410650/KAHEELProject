ALTER TABLE public.mkt_seasonal_backdrops
  DROP CONSTRAINT mkt_seasonal_motif_chk,
  ADD CONSTRAINT mkt_seasonal_motif_chk CHECK (motif = ANY (ARRAY['none','stars','school','lanterns','sparks','confetti','flag'])),
  ADD COLUMN IF NOT EXISTS headline_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS headline_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subheadline_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subheadline_en text NOT NULL DEFAULT '';

INSERT INTO public.mkt_seasonal_backdrops
  (slug, label_ar, label_en, placement, section_key, image_url, image_width, image_height,
   motif, overlay, accent, mascot, priority, status, starts_at,
   headline_ar, headline_en, subheadline_ar, subheadline_en)
VALUES
  ('syria-national', 'جيناكم سوريا', 'Hello Syria', 'header', '',
   '/__l5e/assets-v1/b4ac5eb0-9136-4922-8740-002e6a5602a4/syria-sky.webp', 1600, 560,
   'flag', 'medium', '#ffd166', 'none', 40, 'draft', now(),
   'جيناكم سوريا 🇸🇾', 'Hello Syria 🇸🇾',
   'سوقك الأول… من أرضك ولأهلك', 'Your first marketplace — from your land, for your people')
ON CONFLICT (slug) DO NOTHING;