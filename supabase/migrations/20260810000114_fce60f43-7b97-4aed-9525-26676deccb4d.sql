ALTER TABLE public.mkt_user_addresses
  ADD COLUMN IF NOT EXISTS accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS place_label text;