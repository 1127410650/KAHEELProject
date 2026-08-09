ALTER TABLE public.mkt_countries
  ADD COLUMN IF NOT EXISTS is_market_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_only_otp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default_market boolean NOT NULL DEFAULT false;

UPDATE public.mkt_countries
   SET is_market_enabled = true, phone_only_otp = true, is_default_market = true, is_active = true
 WHERE iso2 = 'SY';

UPDATE public.mkt_countries
   SET is_market_enabled = false, phone_only_otp = true, is_default_market = false
 WHERE iso2 = 'LB';

CREATE UNIQUE INDEX IF NOT EXISTS mkt_countries_one_default_market
  ON public.mkt_countries ((is_default_market)) WHERE is_default_market;

INSERT INTO public.mkt_cities (country_id, name_ar, name_en, is_active, sort_order)
SELECT c.id, v.name_ar, v.name_en, true, v.sort_order
  FROM public.mkt_countries c
  CROSS JOIN (VALUES
    ('بيروت', 'Beirut', 1),
    ('جبل لبنان', 'Mount Lebanon', 2),
    ('الشمال', 'North Lebanon', 3),
    ('عكار', 'Akkar', 4),
    ('البقاع', 'Beqaa', 5),
    ('بعلبك الهرمل', 'Baalbek-Hermel', 6),
    ('الجنوب', 'South Lebanon', 7),
    ('النبطية', 'Nabatieh', 8)
  ) AS v(name_ar, name_en, sort_order)
 WHERE c.iso2 = 'LB'
   AND NOT EXISTS (
     SELECT 1 FROM public.mkt_cities x
      WHERE x.country_id = c.id AND x.name_ar = v.name_ar
   );