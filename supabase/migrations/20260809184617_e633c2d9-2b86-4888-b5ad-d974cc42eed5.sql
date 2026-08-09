CREATE TABLE public.mkt_user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  district text,
  details text,
  lat double precision,
  lng double precision,
  source text NOT NULL DEFAULT 'manual',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_user_addresses_user_idx ON public.mkt_user_addresses (user_id, is_default DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_user_addresses TO authenticated;
GRANT ALL ON public.mkt_user_addresses TO service_role;

ALTER TABLE public.mkt_user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own addresses read" ON public.mkt_user_addresses
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own addresses insert" ON public.mkt_user_addresses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own addresses update" ON public.mkt_user_addresses
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own addresses delete" ON public.mkt_user_addresses
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mkt_user_addresses_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.source NOT IN ('manual', 'device') THEN
    NEW.source := 'manual';
  END IF;
  IF NEW.lat IS NOT NULL AND (NEW.lat < -90 OR NEW.lat > 90) THEN
    RAISE EXCEPTION 'invalid latitude';
  END IF;
  IF NEW.lng IS NOT NULL AND (NEW.lng < -180 OR NEW.lng > 180) THEN
    RAISE EXCEPTION 'invalid longitude';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_user_addresses_touch
BEFORE INSERT OR UPDATE ON public.mkt_user_addresses
FOR EACH ROW EXECUTE FUNCTION public.mkt_user_addresses_touch();

CREATE OR REPLACE FUNCTION public.mkt_user_addresses_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.mkt_user_addresses
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER mkt_user_addresses_single_default
AFTER INSERT OR UPDATE OF is_default ON public.mkt_user_addresses
FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.mkt_user_addresses_single_default();