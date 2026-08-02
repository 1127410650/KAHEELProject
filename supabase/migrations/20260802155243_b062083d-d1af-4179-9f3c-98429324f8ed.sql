-- 1) Listing location columns
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS address_text text,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_visibility text NOT NULL DEFAULT 'approximate';

DO $$ BEGIN
  ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_location_source_check
    CHECK (location_source IS NULL OR location_source IN ('device','account','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_location_visibility_check
    CHECK (location_visibility IN ('approximate','exact'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_latlng_check
    CHECK ((latitude IS NULL AND longitude IS NULL)
        OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Real-estate purposes as listing types
INSERT INTO public.mkt_listing_types (code, name_ar, name_en, is_request, sort_order, is_active) VALUES
  ('property_sale',        'عقار للبيع',      'Property for sale',   false, 7,  true),
  ('property_rent',        'عقار للإيجار',    'Property for rent',   false, 8,  true),
  ('property_wanted_buy',  'مطلوب شراء عقار', 'Property wanted (buy)',  true, 9,  true),
  ('property_wanted_rent', 'مطلوب استئجار عقار','Property wanted (rent)', true, 10, true)
ON CONFLICT (code) DO NOTHING;

-- 3) Subcategories under the existing roots (no duplicate roots)
INSERT INTO public.mkt_categories (parent_id, slug, name_ar, name_en, sort_order, is_active)
SELECT p.id, v.slug, v.name_ar, v.name_en, v.sort_order, true
FROM (VALUES
  ('real-estate','re-apartments','شقق','Apartments',1),
  ('real-estate','re-villas','فلل','Villas',2),
  ('real-estate','re-land','أراضٍ','Land',3),
  ('real-estate','re-buildings','عمائر','Buildings',4),
  ('real-estate','re-offices','مكاتب','Offices',5),
  ('real-estate','re-shops','محلات','Shops',6),
  ('real-estate','re-warehouses','مستودعات','Warehouses',7),
  ('real-estate','re-farms','مزارع','Farms',8),
  ('real-estate','re-chalets','استراحات وشاليهات','Rest houses & chalets',9),
  ('real-estate','re-rooms','غرف وسكن مشترك','Rooms & shared housing',10),
  ('real-estate','re-investment','عقارات استثمارية','Investment properties',11),
  ('equipment','eq-excavators','حفارات','Excavators',1),
  ('equipment','eq-loaders','لوادر','Loaders',2),
  ('equipment','eq-cranes','رافعات','Cranes',3),
  ('equipment','eq-trucks','شاحنات ومقاطر','Trucks & trailers',4),
  ('equipment','eq-concrete','مضخات وخلاطات خرسانة','Concrete pumps & mixers',5),
  ('equipment','eq-generators','مولدات وكومبريسورات','Generators & compressors',6),
  ('equipment','eq-scaffolding','سقالات وقوالب','Scaffolding & formwork',7),
  ('equipment','eq-forklifts','رافعات شوكية','Forklifts',8),
  ('building-materials','bm-steel','حديد','Steel',1),
  ('building-materials','bm-cement','أسمنت','Cement',2),
  ('building-materials','bm-blocks','بلوك وطوب','Blocks & bricks',3),
  ('building-materials','bm-tiles','بلاط ورخام','Tiles & marble',4),
  ('building-materials','bm-wood','أخشاب','Wood',5),
  ('building-materials','bm-insulation','عزل','Insulation',6),
  ('building-materials','bm-aggregates','رمل وحصى','Sand & aggregates',7),
  ('building-materials','bm-paints','دهانات','Paints',8),
  ('building-materials','bm-plumbing-materials','مواد سباكة','Plumbing materials',9),
  ('building-materials','bm-electrical-materials','مواد كهرباء','Electrical materials',10),
  ('maintenance','mn-ac','صيانة تكييف','AC maintenance',1),
  ('maintenance','mn-electrical','صيانة كهرباء','Electrical maintenance',2),
  ('maintenance','mn-plumbing','صيانة سباكة','Plumbing maintenance',3),
  ('maintenance','mn-elevators','مصاعد','Elevators',4),
  ('maintenance','mn-cleaning','نظافة وتشغيل','Cleaning & operations',5),
  ('maintenance','mn-general','صيانة عامة','General maintenance',6),
  ('factories','fc-readymix','خرسانة جاهزة','Ready-mix concrete',1),
  ('factories','fc-precast','مسبقات خرسانية','Precast concrete',2),
  ('factories','fc-steel','مصانع حديد','Steel factories',3),
  ('factories','fc-aluminum','ألمنيوم وزجاج','Aluminium & glass',4),
  ('factories','fc-suppliers','موردون عامون','General suppliers',5)
) AS v(parent_slug, slug, name_ar, name_en, sort_order)
JOIN public.mkt_categories p ON p.slug = v.parent_slug AND p.parent_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM public.mkt_categories c WHERE c.slug = v.slug);

-- 4) Server-side validation of title, geography, category path and ownership
CREATE OR REPLACE FUNCTION public.mkt_listing_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_country uuid;
  v_city_country uuid;
  v_root_slug text;
  v_cat_parent uuid;
  v_sub_parent uuid;
  v_title text;
BEGIN
  -- Ownership is never chosen by the client on insert, never changed on update.
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT public.mkt_is_platform_admin() THEN
      NEW.owner_user_id := auth.uid();
      IF NEW.tenant_id IS NOT NULL AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
        RAISE EXCEPTION 'BUSINESS_NOT_ALLOWED';
      END IF;
    END IF;
  ELSE
    NEW.owner_user_id := OLD.owner_user_id;
    NEW.tenant_id := OLD.tenant_id;
  END IF;

  -- Title: 5..120 characters, and not made of symbols only.
  v_title := btrim(coalesce(NEW.title, ''));
  NEW.title := v_title;
  IF char_length(v_title) < 5 OR char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'TITLE_LENGTH';
  END IF;
  IF v_title !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION 'TITLE_INVALID';
  END IF;

  -- The country always comes from the owner's account, never from the client.
  SELECT country_id INTO v_account_country
    FROM public.mkt_user_profiles WHERE user_id = NEW.owner_user_id;
  IF v_account_country IS NULL THEN
    SELECT id INTO v_account_country FROM public.mkt_countries
      WHERE iso2 = 'SA' AND is_active ORDER BY sort_order LIMIT 1;
  END IF;
  IF v_account_country IS NOT NULL THEN
    NEW.country_id := v_account_country;
  END IF;

  -- The city must belong to that country.
  IF NEW.city_id IS NOT NULL THEN
    SELECT country_id INTO v_city_country FROM public.mkt_cities WHERE id = NEW.city_id;
    IF v_city_country IS NULL OR v_city_country IS DISTINCT FROM NEW.country_id THEN
      RAISE EXCEPTION 'CITY_COUNTRY_MISMATCH';
    END IF;
  END IF;

  -- Category path: the main field is a root, the subcategory is its child.
  IF NEW.category_id IS NOT NULL THEN
    SELECT parent_id, slug INTO v_cat_parent, v_root_slug
      FROM public.mkt_categories WHERE id = NEW.category_id AND is_active;
    IF v_root_slug IS NULL OR v_cat_parent IS NOT NULL THEN
      RAISE EXCEPTION 'CATEGORY_INVALID';
    END IF;
  END IF;
  IF NEW.subcategory_id IS NOT NULL THEN
    SELECT parent_id INTO v_sub_parent
      FROM public.mkt_categories WHERE id = NEW.subcategory_id AND is_active;
    IF v_sub_parent IS NULL OR v_sub_parent IS DISTINCT FROM NEW.category_id THEN
      RAISE EXCEPTION 'CATEGORY_PATH_INVALID';
    END IF;
  END IF;

  -- Type must match the main field.
  IF NEW.type_code LIKE 'property\_%' AND v_root_slug IS DISTINCT FROM 'real-estate' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF NEW.type_code LIKE 'equipment\_%' AND v_root_slug IS DISTINCT FROM 'equipment' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF v_root_slug = 'real-estate' AND NEW.type_code NOT LIKE 'property\_%' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF v_root_slug = 'equipment' AND NEW.type_code NOT LIKE 'equipment\_%'
     AND NEW.type_code <> 'need_supplier' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;

  -- Coordinates only make sense together.
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.latitude := NULL; NEW.longitude := NULL; NEW.location_accuracy := NULL;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.mkt_listing_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_listing_validate() FROM anon;

DROP TRIGGER IF EXISTS mkt_listings_validate ON public.mkt_listings;
CREATE TRIGGER mkt_listings_validate
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_validate();