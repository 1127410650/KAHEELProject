
CREATE TABLE IF NOT EXISTS public.mkt_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2 text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  calling_code text NOT NULL,
  currency_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_countries TO anon, authenticated;
GRANT ALL ON public.mkt_countries TO service_role;
ALTER TABLE public.mkt_countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_countries_read ON public.mkt_countries;
CREATE POLICY mkt_countries_read ON public.mkt_countries FOR SELECT TO anon, authenticated USING (is_active);

CREATE TABLE IF NOT EXISTS public.mkt_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.mkt_countries(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name_ar)
);
CREATE INDEX IF NOT EXISTS mkt_cities_country_idx ON public.mkt_cities (country_id, sort_order);
GRANT SELECT ON public.mkt_cities TO anon, authenticated;
GRANT ALL ON public.mkt_cities TO service_role;
ALTER TABLE public.mkt_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_cities_read ON public.mkt_cities;
CREATE POLICY mkt_cities_read ON public.mkt_cities FOR SELECT TO anon, authenticated USING (is_active);

CREATE TABLE IF NOT EXISTS public.mkt_city_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.mkt_countries(id) ON DELETE CASCADE,
  suggested_name text NOT NULL,
  suggested_by uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mkt_city_suggestions TO authenticated;
GRANT ALL ON public.mkt_city_suggestions TO service_role;
ALTER TABLE public.mkt_city_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_city_suggestions_insert ON public.mkt_city_suggestions;
CREATE POLICY mkt_city_suggestions_insert ON public.mkt_city_suggestions
  FOR INSERT TO authenticated WITH CHECK (suggested_by = auth.uid());
DROP POLICY IF EXISTS mkt_city_suggestions_read ON public.mkt_city_suggestions;
CREATE POLICY mkt_city_suggestions_read ON public.mkt_city_suggestions
  FOR SELECT TO authenticated USING (suggested_by = auth.uid() OR public.mkt_is_platform_admin());

CREATE TABLE IF NOT EXISTS public.mkt_user_market_preferences (
  user_id uuid PRIMARY KEY,
  country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_user_market_preferences TO authenticated;
GRANT ALL ON public.mkt_user_market_preferences TO service_role;
ALTER TABLE public.mkt_user_market_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_market_prefs_own ON public.mkt_user_market_preferences;
CREATE POLICY mkt_market_prefs_own ON public.mkt_user_market_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mkt_listings_country_city_idx ON public.mkt_listings (country_id, city_id);

ALTER TABLE public.mkt_user_profiles
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_visibility text NOT NULL DEFAULT 'hidden'
    CHECK (phone_visibility IN ('hidden','on_accept','public'));

ALTER TABLE public.mkt_business_profiles
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL;

INSERT INTO public.mkt_countries (iso2, name_ar, name_en, calling_code, currency_code, sort_order) VALUES
  ('SA','السعودية','Saudi Arabia','+966','SAR',1),
  ('KW','الكويت','Kuwait','+965','KWD',2),
  ('AE','الإمارات العربية المتحدة','United Arab Emirates','+971','AED',3),
  ('JO','الأردن','Jordan','+962','JOD',4),
  ('LB','لبنان','Lebanon','+961','LBP',5),
  ('EG','مصر','Egypt','+20','EGP',6),
  ('SY','سوريا','Syria','+963','SYP',7),
  ('IQ','العراق','Iraq','+964','IQD',8)
ON CONFLICT (iso2) DO NOTHING;

WITH seed(iso2, name_ar, name_en, ord) AS (VALUES
  ('SA','الرياض','Riyadh',1),('SA','جدة','Jeddah',2),('SA','مكة المكرمة','Makkah',3),
  ('SA','المدينة المنورة','Madinah',4),('SA','الدمام','Dammam',5),('SA','الخبر','Khobar',6),
  ('SA','الظهران','Dhahran',7),('SA','الجبيل','Jubail',8),('SA','الأحساء','Al Ahsa',9),
  ('SA','القطيف','Qatif',10),('SA','الطائف','Taif',11),('SA','أبها','Abha',12),
  ('SA','خميس مشيط','Khamis Mushait',13),('SA','تبوك','Tabuk',14),('SA','بريدة','Buraydah',15),
  ('SA','عنيزة','Unaizah',16),('SA','حائل','Hail',17),('SA','جازان','Jazan',18),
  ('SA','نجران','Najran',19),('SA','ينبع','Yanbu',20),('SA','سكاكا','Sakaka',21),('SA','عرعر','Arar',22),
  ('KW','مدينة الكويت','Kuwait City',1),('KW','حولي','Hawalli',2),('KW','السالمية','Salmiya',3),
  ('KW','الفروانية','Farwaniya',4),('KW','الجهراء','Jahra',5),('KW','الأحمدي','Ahmadi',6),
  ('KW','مبارك الكبير','Mubarak Al-Kabeer',7),('KW','الفحيحيل','Fahaheel',8),
  ('AE','أبوظبي','Abu Dhabi',1),('AE','دبي','Dubai',2),('AE','الشارقة','Sharjah',3),
  ('AE','عجمان','Ajman',4),('AE','أم القيوين','Umm Al Quwain',5),('AE','رأس الخيمة','Ras Al Khaimah',6),
  ('AE','الفجيرة','Fujairah',7),('AE','العين','Al Ain',8),('AE','خورفكان','Khorfakkan',9),
  ('JO','عمّان','Amman',1),('JO','الزرقاء','Zarqa',2),('JO','إربد','Irbid',3),('JO','العقبة','Aqaba',4),
  ('JO','السلط','Salt',5),('JO','مادبا','Madaba',6),('JO','جرش','Jerash',7),('JO','المفرق','Mafraq',8),
  ('JO','الكرك','Karak',9),('JO','الطفيلة','Tafilah',10),('JO','معان','Maan',11),('JO','عجلون','Ajloun',12),
  ('LB','بيروت','Beirut',1),('LB','طرابلس','Tripoli',2),('LB','صيدا','Sidon',3),('LB','صور','Tyre',4),
  ('LB','زحلة','Zahle',5),('LB','بعلبك','Baalbek',6),('LB','جونية','Jounieh',7),
  ('LB','النبطية','Nabatieh',8),('LB','جبيل','Byblos',9),
  ('EG','القاهرة','Cairo',1),('EG','الجيزة','Giza',2),('EG','الإسكندرية','Alexandria',3),
  ('EG','بورسعيد','Port Said',4),('EG','السويس','Suez',5),('EG','المنصورة','Mansoura',6),
  ('EG','طنطا','Tanta',7),('EG','الزقازيق','Zagazig',8),('EG','الإسماعيلية','Ismailia',9),
  ('EG','دمياط','Damietta',10),('EG','الفيوم','Fayoum',11),('EG','بني سويف','Beni Suef',12),
  ('EG','المنيا','Minya',13),('EG','أسيوط','Asyut',14),('EG','سوهاج','Sohag',15),
  ('EG','الأقصر','Luxor',16),('EG','أسوان','Aswan',17),('EG','الغردقة','Hurghada',18),
  ('EG','شرم الشيخ','Sharm El Sheikh',19),
  ('SY','دمشق','Damascus',1),('SY','حلب','Aleppo',2),('SY','حمص','Homs',3),('SY','حماة','Hama',4),
  ('SY','اللاذقية','Latakia',5),('SY','طرطوس','Tartus',6),('SY','درعا','Daraa',7),
  ('SY','دير الزور','Deir ez-Zor',8),('SY','الرقة','Raqqa',9),('SY','الحسكة','Hasakah',10),
  ('SY','إدلب','Idlib',11),('SY','السويداء','Suwayda',12),('SY','القنيطرة','Quneitra',13),
  ('IQ','بغداد','Baghdad',1),('IQ','البصرة','Basra',2),('IQ','الموصل','Mosul',3),('IQ','أربيل','Erbil',4),
  ('IQ','السليمانية','Sulaymaniyah',5),('IQ','كركوك','Kirkuk',6),('IQ','النجف','Najaf',7),
  ('IQ','كربلاء','Karbala',8),('IQ','الرمادي','Ramadi',9),('IQ','الفلوجة','Fallujah',10),
  ('IQ','الناصرية','Nasiriyah',11),('IQ','الحلة','Hillah',12),('IQ','الديوانية','Diwaniyah',13),
  ('IQ','سامراء','Samarra',14),('IQ','تكريت','Tikrit',15),('IQ','العمارة','Amarah',16),
  ('IQ','الكوت','Kut',17),('IQ','دهوك','Duhok',18)
)
INSERT INTO public.mkt_cities (country_id, name_ar, name_en, sort_order)
SELECT c.id, s.name_ar, s.name_en, s.ord
FROM seed s JOIN public.mkt_countries c ON c.iso2 = s.iso2
ON CONFLICT (country_id, name_ar) DO NOTHING;
