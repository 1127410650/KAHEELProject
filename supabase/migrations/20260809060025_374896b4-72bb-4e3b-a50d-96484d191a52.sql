CREATE TABLE public.mkt_guide_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ref text,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  sector text,
  category text,
  subcategory text,
  governorate text,
  city text,
  district text,
  address text,
  address_status text,
  latitude double precision,
  longitude double precision,
  map_url text,
  map_url_status text,
  phone text,
  phone_status text,
  whatsapp text,
  whatsapp_status text,
  whatsapp_link text,
  email text,
  website text,
  opening_hours text,
  stars numeric,
  source_label text,
  source_type text,
  source_date text,
  verification_status text NOT NULL DEFAULT 'unverified',
  completeness numeric,
  notes text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_guide_places TO anon;
GRANT SELECT ON public.mkt_guide_places TO authenticated;
GRANT ALL ON public.mkt_guide_places TO service_role;

ALTER TABLE public.mkt_guide_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guide_places_public_read" ON public.mkt_guide_places
FOR SELECT TO anon, authenticated USING (is_published = true);

CREATE POLICY "guide_places_admin_write" ON public.mkt_guide_places
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()));

CREATE INDEX mkt_guide_places_name_idx ON public.mkt_guide_places USING gin (to_tsvector('simple', coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(city,'') || ' ' || coalesce(address,'')));
CREATE INDEX mkt_guide_places_gov_idx ON public.mkt_guide_places (governorate);
CREATE INDEX mkt_guide_places_sector_idx ON public.mkt_guide_places (sector);
CREATE INDEX mkt_guide_places_category_idx ON public.mkt_guide_places (category);
CREATE INDEX mkt_guide_places_published_idx ON public.mkt_guide_places (is_published);

CREATE OR REPLACE FUNCTION public.mkt_guide_places_block_forbidden()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  blob text;
BEGIN
  blob := lower(concat_ws(' ',
    NEW.source_ref, NEW.slug, NEW.name_ar, NEW.name_en, NEW.sector, NEW.category,
    NEW.subcategory, NEW.governorate, NEW.city, NEW.district, NEW.address,
    NEW.map_url, NEW.phone, NEW.whatsapp, NEW.whatsapp_link, NEW.email,
    NEW.website, NEW.opening_hours, NEW.source_label, NEW.source_type, NEW.notes));
  IF blob LIKE '%assad%'
     OR blob LIKE '%' || 'الأسد' || '%'
     OR blob LIKE '%' || 'الاسد' || '%' THEN
    RAISE EXCEPTION 'blocked term is not allowed in mkt_guide_places';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_guide_places_guard
BEFORE INSERT OR UPDATE ON public.mkt_guide_places
FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_places_block_forbidden();