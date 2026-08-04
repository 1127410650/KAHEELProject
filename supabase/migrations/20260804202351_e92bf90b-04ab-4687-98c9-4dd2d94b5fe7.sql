-- 1) duplicate guards on normalized labels (root categories) + slug
CREATE UNIQUE INDEX IF NOT EXISTS mkt_categories_root_slug_norm_key
  ON public.mkt_categories (public.mkt_norm_label(slug))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mkt_categories_root_name_ar_norm_key
  ON public.mkt_categories (public.mkt_norm_label(name_ar))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mkt_categories_root_name_en_norm_key
  ON public.mkt_categories (public.mkt_norm_label(name_en))
  WHERE parent_id IS NULL AND coalesce(name_en, '') <> '';

-- 2) make room right after «تدريب» (sort_order = 10) without deleting anything
UPDATE public.mkt_categories
   SET sort_order = sort_order + 1, updated_at = now()
 WHERE parent_id IS NULL
   AND sort_order >= 11
   AND NOT EXISTS (
     SELECT 1 FROM public.mkt_categories c2
      WHERE c2.parent_id IS NULL AND c2.slug = 'schools-universities'
   );

-- 3) the real root record (idempotent, fixed id)
INSERT INTO public.mkt_categories (id, parent_id, slug, name_ar, name_en, sort_order, is_active)
VALUES ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', NULL, 'schools-universities',
        'مدارس وجامعات', 'Schools & Universities', 11, true)
ON CONFLICT (slug) DO UPDATE
  SET parent_id = NULL,
      name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now();

-- 4) real subcategories
INSERT INTO public.mkt_categories (parent_id, slug, name_ar, name_en, sort_order, is_active)
VALUES
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-schools', 'مدارس', 'Schools', 1, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-universities-colleges', 'جامعات وكليات', 'Universities & Colleges', 2, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-institutes-academies', 'معاهد وأكاديميات', 'Institutes & Academies', 3, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-nurseries-kindergartens', 'حضانات ورياض أطفال', 'Nurseries & Kindergartens', 4, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-private-tutoring', 'دروس خصوصية', 'Private Tutoring', 5, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-educational-services', 'خدمات تعليمية', 'Educational Services', 6, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-admission-registration', 'قبول وتسجيل', 'Admission & Registration', 7, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-scholarships', 'منح دراسية', 'Scholarships', 8, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-student-housing', 'سكن طلابي', 'Student Housing', 9, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-educational-supplies', 'مستلزمات تعليمية', 'Educational Supplies', 10, true),
  ('b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', 'edu-other', 'أخرى', 'Other', 99, true)
ON CONFLICT (slug) DO UPDATE
  SET parent_id = EXCLUDED.parent_id,
      name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now();

-- 5) search-only aliases (no separate category records)
INSERT INTO public.mkt_category_aliases (category_id, alias, note)
SELECT 'b7c1f2a4-9e3d-4c58-8a71-2d6f5b0c1e94', a, 'search alias for schools-universities'
  FROM unnest(ARRAY[
    'التعليم','تعليم','مدارس','مدرسة','جامعات','جامعة','كليات','كلية',
    'معاهد','معهد','أكاديميات','أكاديمية',
    'Education','Schools','Universities','Colleges','Institutes'
  ]) AS a
ON CONFLICT (alias_norm) DO NOTHING;