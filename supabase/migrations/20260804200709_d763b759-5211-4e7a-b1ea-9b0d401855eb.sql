-- 1) canonical real-estate label
UPDATE public.mkt_categories SET name_ar = 'عقارات', name_en = 'Real estate', sort_order = 1
 WHERE slug = 'real-estate';

-- 2) approved primary domains (order 1..17 following the approved list)
INSERT INTO public.mkt_categories (slug, name_ar, name_en, sort_order)
VALUES
  ('cars', 'سيارات', 'Cars', 2),
  ('devices', 'أجهزة', 'Devices', 3),
  ('restaurants', 'مطاعم', 'Restaurants', 5),
  ('furniture', 'أثاث', 'Furniture', 6),
  ('services', 'خدمات', 'Services', 7),
  ('fashion', 'أزياء', 'Fashion', 8),
  ('jobs', 'وظائف', 'Jobs', 9),
  ('training', 'تدريب', 'Training', 10),
  ('events', 'مناسبات', 'Events', 11),
  ('programming', 'برمجة', 'Programming', 12),
  ('gardens', 'الحدائق', 'Gardens', 13),
  ('arts', 'الفنون', 'Arts', 14),
  ('lost-found', 'مفقودات', 'Lost & found', 15),
  ('projects-investments', 'مشاريع واستثمارات', 'Projects & investments', 16),
  ('travel-tourism', 'الرحلات والسياحة', 'Travel & tourism', 17)
ON CONFLICT (slug) DO NOTHING;

-- 3) existing top-level records become subcategories (no data deleted)
UPDATE public.mkt_categories c
   SET parent_id = (SELECT id FROM public.mkt_categories WHERE slug = 'services'),
       sort_order = x.ord
  FROM (VALUES
    ('general-contracting', 1), ('finishing', 2), ('electrical', 3), ('plumbing', 4),
    ('hvac', 5), ('maintenance', 6), ('professional', 7), ('safety', 8), ('logistics', 9)
  ) AS x(slug, ord)
 WHERE c.slug = x.slug AND c.parent_id IS NULL;

UPDATE public.mkt_categories c
   SET parent_id = (SELECT id FROM public.mkt_categories WHERE slug = 'projects-investments'),
       sort_order = x.ord
  FROM (VALUES ('building-materials', 1), ('equipment', 2), ('factories', 3)) AS x(slug, ord)
 WHERE c.slug = x.slug AND c.parent_id IS NULL;

-- 4) new subcategories under the approved domains
INSERT INTO public.mkt_categories (slug, name_ar, name_en, parent_id, sort_order)
SELECT x.slug, x.ar, x.en, p.id, x.ord
  FROM (VALUES
    ('dev-electronics', 'إلكترونيات', 'Electronics', 'devices', 1),
    ('dev-mobiles', 'جوالات', 'Mobiles', 'devices', 2),
    ('dev-computers', 'حواسيب', 'Computers', 'devices', 3),
    ('dev-home-appliances', 'أجهزة منزلية', 'Home appliances', 'devices', 4),
    ('dev-office-equipment', 'معدات مكتبية', 'Office equipment', 'devices', 5),
    ('car-sale', 'سيارات للبيع', 'Cars for sale', 'cars', 1),
    ('car-rent', 'سيارات للإيجار', 'Cars for rent', 'cars', 2),
    ('car-parts', 'قطع غيار', 'Spare parts', 'cars', 3),
    ('car-motorcycles', 'دراجات نارية', 'Motorcycles', 'cars', 4),
    ('car-trucks', 'شاحنات ومعدات نقل', 'Trucks & transport equipment', 'cars', 5),
    ('re-sale', 'بيع', 'For sale', 'real-estate', 20),
    ('re-rent', 'إيجار', 'For rent', 'real-estate', 21),
    ('re-aqar-deal', 'عقار ديل', 'Aqar Deal', 'real-estate', 22)
  ) AS x(slug, ar, en, parent_slug, ord)
  JOIN public.mkt_categories p ON p.slug = x.parent_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO NOTHING;