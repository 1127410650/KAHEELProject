CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.mkt_seed_activity(_group text, _parent text, _ar text, _en text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE g uuid; p uuid; v uuid;
BEGIN
  SELECT id INTO g FROM public.mkt_activity_groups WHERE slug = _group;
  IF _parent IS NOT NULL THEN
    SELECT id INTO p FROM public.mkt_activities WHERE group_id = g AND parent_id IS NULL AND norm_ar = public.mkt_norm_activity_text(_parent);
  END IF;
  INSERT INTO public.mkt_activities (group_id, parent_id, name_ar, name_en)
  VALUES (g, p, _ar, _en)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v FROM public.mkt_activities
   WHERE group_id = g AND coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p,'00000000-0000-0000-0000-000000000000'::uuid)
     AND norm_ar = public.mkt_norm_activity_text(_ar);
  RETURN v;
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_seed_alias(_group text, _ar text, _alias text, _kind text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a uuid;
BEGIN
  SELECT act.id INTO a FROM public.mkt_activities act
  JOIN public.mkt_activity_groups g ON g.id = act.group_id
  WHERE g.slug = _group AND act.norm_ar = public.mkt_norm_activity_text(_ar)
  LIMIT 1;
  IF a IS NOT NULL THEN
    INSERT INTO public.mkt_activity_aliases (activity_id, alias, kind) VALUES (a, _alias, _kind)
    ON CONFLICT DO NOTHING;
  END IF;
END; $$;

SELECT public.mkt_seed_activity('contracting', NULL, 'مقاولات عامة للمباني', 'General building contracting');
SELECT public.mkt_seed_activity('contracting', NULL, 'أعمال الحفر والردم', 'Excavation and backfilling');
SELECT public.mkt_seed_activity('contracting', NULL, 'الأعمال الكهربائية', 'Electrical works');
SELECT public.mkt_seed_activity('contracting', NULL, 'أعمال السباكة والصرف', 'Plumbing and drainage works');
SELECT public.mkt_seed_activity('contracting', NULL, 'التشطيبات والديكور', 'Finishing and decoration');
SELECT public.mkt_seed_activity('contracting', NULL, 'الطرق والبنية التحتية', 'Roads and infrastructure');
SELECT public.mkt_seed_activity('contracting', NULL, 'الهدم وإزالة المخلفات', 'Demolition and debris removal');
SELECT public.mkt_seed_activity('contracting', 'أعمال الحفر والردم', 'مقاولات الحفر', 'Excavation contracting');
SELECT public.mkt_seed_activity('contracting', 'أعمال الحفر والردم', 'تأجير معدات الحفر', 'Excavation equipment rental');
SELECT public.mkt_seed_activity('contracting', 'أعمال الحفر والردم', 'تسوية المواقع', 'Site levelling');
SELECT public.mkt_seed_activity('contracting', 'أعمال الحفر والردم', 'حفر الآبار', 'Well drilling');
SELECT public.mkt_seed_activity('contracting', 'مقاولات عامة للمباني', 'الهياكل الخرسانية', 'Concrete structures');
SELECT public.mkt_seed_activity('contracting', 'مقاولات عامة للمباني', 'أعمال البناء والطوب', 'Masonry works');
SELECT public.mkt_seed_activity('contracting', 'مقاولات عامة للمباني', 'الأعمال المعدنية والحدادة', 'Steel and metal works');
SELECT public.mkt_seed_activity('contracting', 'الأعمال الكهربائية', 'تمديدات كهربائية', 'Electrical installations');
SELECT public.mkt_seed_activity('contracting', 'الأعمال الكهربائية', 'محطات ولوحات كهربائية', 'Substations and panels');
SELECT public.mkt_seed_activity('contracting', 'التشطيبات والديكور', 'أعمال الدهانات', 'Painting works');
SELECT public.mkt_seed_activity('contracting', 'التشطيبات والديكور', 'أعمال الجبس والأسقف', 'Gypsum and ceilings');
SELECT public.mkt_seed_activity('contracting', 'التشطيبات والديكور', 'تركيب البلاط والرخام', 'Tiling and marble');

SELECT public.mkt_seed_activity('transport-logistics', NULL, 'نقل البضائع بالشاحنات', 'Freight trucking');
SELECT public.mkt_seed_activity('transport-logistics', NULL, 'النقل الثقيل والمعدات', 'Heavy haulage');
SELECT public.mkt_seed_activity('transport-logistics', NULL, 'التخزين والمستودعات', 'Warehousing');
SELECT public.mkt_seed_activity('transport-logistics', NULL, 'التخليص والشحن', 'Customs clearance and shipping');
SELECT public.mkt_seed_activity('transport-logistics', NULL, 'نقل الركاب', 'Passenger transport');
SELECT public.mkt_seed_activity('transport-logistics', 'نقل البضائع بالشاحنات', 'نقل مواد البناء', 'Construction material transport');
SELECT public.mkt_seed_activity('transport-logistics', 'نقل البضائع بالشاحنات', 'النقل المبرد', 'Refrigerated transport');
SELECT public.mkt_seed_activity('transport-logistics', 'النقل الثقيل والمعدات', 'نقل المعدات الثقيلة', 'Heavy equipment transport');
SELECT public.mkt_seed_activity('transport-logistics', 'النقل الثقيل والمعدات', 'خدمات الونش والرافعات', 'Crane services');

SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'التصميم المعماري', 'Architectural design');
SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'التصميم الإنشائي', 'Structural design');
SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'الإشراف الهندسي', 'Engineering supervision');
SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'إدارة المشاريع', 'Project management');
SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'المساحة وأعمال الرفع المساحي', 'Surveying');
SELECT public.mkt_seed_activity('engineering-consulting', NULL, 'فحص التربة والمواد', 'Soil and material testing');
SELECT public.mkt_seed_activity('engineering-consulting', 'التصميم المعماري', 'التصميم الداخلي', 'Interior design');
SELECT public.mkt_seed_activity('engineering-consulting', 'إدارة المشاريع', 'إدارة العقود والمطالبات', 'Contract and claims management');

SELECT public.mkt_seed_activity('real-estate', NULL, 'الوساطة العقارية', 'Real estate brokerage');
SELECT public.mkt_seed_activity('real-estate', NULL, 'إدارة الأملاك', 'Property management');
SELECT public.mkt_seed_activity('real-estate', NULL, 'التطوير العقاري', 'Real estate development');
SELECT public.mkt_seed_activity('real-estate', NULL, 'التقييم العقاري', 'Property valuation');
SELECT public.mkt_seed_activity('real-estate', 'الوساطة العقارية', 'بيع وشراء العقارات', 'Sales brokerage');
SELECT public.mkt_seed_activity('real-estate', 'الوساطة العقارية', 'تأجير العقارات', 'Leasing brokerage');
SELECT public.mkt_seed_activity('real-estate', 'إدارة الأملاك', 'إدارة اتحاد الملاك', 'Owners association management');

SELECT public.mkt_seed_activity('trade-supply', NULL, 'توريد مواد البناء', 'Building materials supply');
SELECT public.mkt_seed_activity('trade-supply', NULL, 'توريد المعدات والآلات', 'Equipment and machinery supply');
SELECT public.mkt_seed_activity('trade-supply', NULL, 'توريد الأثاث والمفروشات', 'Furniture supply');
SELECT public.mkt_seed_activity('trade-supply', NULL, 'توريد المواد الكهربائية', 'Electrical materials supply');
SELECT public.mkt_seed_activity('trade-supply', NULL, 'التجارة العامة', 'General trading');
SELECT public.mkt_seed_activity('trade-supply', 'توريد مواد البناء', 'توريد الخرسانة الجاهزة', 'Ready-mix concrete supply');
SELECT public.mkt_seed_activity('trade-supply', 'توريد مواد البناء', 'توريد الحديد والأسمنت', 'Steel and cement supply');
SELECT public.mkt_seed_activity('trade-supply', 'توريد مواد البناء', 'توريد الرمل والبحص', 'Sand and gravel supply');

SELECT public.mkt_seed_activity('industry', NULL, 'الصناعات المعدنية', 'Metal industries');
SELECT public.mkt_seed_activity('industry', NULL, 'صناعة مواد البناء', 'Building materials manufacturing');
SELECT public.mkt_seed_activity('industry', NULL, 'الصناعات الغذائية', 'Food industries');
SELECT public.mkt_seed_activity('industry', NULL, 'الصناعات البلاستيكية', 'Plastic industries');
SELECT public.mkt_seed_activity('industry', NULL, 'صناعة الأثاث', 'Furniture manufacturing');
SELECT public.mkt_seed_activity('industry', 'صناعة مواد البناء', 'مصنع بلوك وخرسانة', 'Block and concrete plant');
SELECT public.mkt_seed_activity('industry', 'الصناعات المعدنية', 'ورش حدادة وتشكيل معادن', 'Metal fabrication workshops');

SELECT public.mkt_seed_activity('maintenance-operations', NULL, 'صيانة المباني', 'Building maintenance');
SELECT public.mkt_seed_activity('maintenance-operations', NULL, 'صيانة التكييف والتبريد', 'HVAC maintenance');
SELECT public.mkt_seed_activity('maintenance-operations', NULL, 'النظافة والتشغيل', 'Cleaning and facility operations');
SELECT public.mkt_seed_activity('maintenance-operations', NULL, 'مكافحة الحشرات', 'Pest control');
SELECT public.mkt_seed_activity('maintenance-operations', NULL, 'صيانة المصاعد', 'Elevator maintenance');
SELECT public.mkt_seed_activity('maintenance-operations', 'صيانة المباني', 'صيانة كهربائية', 'Electrical maintenance');
SELECT public.mkt_seed_activity('maintenance-operations', 'صيانة المباني', 'صيانة سباكة', 'Plumbing maintenance');

SELECT public.mkt_seed_activity('professional-services', NULL, 'المحاسبة والمراجعة', 'Accounting and audit');
SELECT public.mkt_seed_activity('professional-services', NULL, 'الاستشارات القانونية', 'Legal consulting');
SELECT public.mkt_seed_activity('professional-services', NULL, 'الاستشارات الإدارية', 'Management consulting');
SELECT public.mkt_seed_activity('professional-services', NULL, 'التسويق والإعلان', 'Marketing and advertising');
SELECT public.mkt_seed_activity('professional-services', NULL, 'التوظيف والموارد البشرية', 'Recruitment and HR');
SELECT public.mkt_seed_activity('professional-services', 'المحاسبة والمراجعة', 'إعداد الإقرارات الضريبية', 'Tax filing');
SELECT public.mkt_seed_activity('professional-services', 'التسويق والإعلان', 'التصميم الجرافيكي', 'Graphic design');

SELECT public.mkt_seed_activity('information-technology', NULL, 'تطوير البرمجيات', 'Software development');
SELECT public.mkt_seed_activity('information-technology', NULL, 'تطوير المواقع والتطبيقات', 'Web and mobile development');
SELECT public.mkt_seed_activity('information-technology', NULL, 'الشبكات والبنية التقنية', 'Networks and IT infrastructure');
SELECT public.mkt_seed_activity('information-technology', NULL, 'أنظمة المراقبة والأمن', 'Surveillance and security systems');
SELECT public.mkt_seed_activity('information-technology', NULL, 'الدعم الفني', 'Technical support');
SELECT public.mkt_seed_activity('information-technology', 'الشبكات والبنية التقنية', 'تمديد شبكات وكابلات', 'Network cabling');

SELECT public.mkt_seed_activity('hospitality-catering', NULL, 'الإعاشة وتقديم الوجبات', 'Catering services');
SELECT public.mkt_seed_activity('hospitality-catering', NULL, 'المطاعم والمقاهي', 'Restaurants and cafes');
SELECT public.mkt_seed_activity('hospitality-catering', NULL, 'إدارة السكن والمخيمات', 'Accommodation and camp management');
SELECT public.mkt_seed_activity('hospitality-catering', NULL, 'تنظيم الفعاليات', 'Event management');
SELECT public.mkt_seed_activity('hospitality-catering', 'الإعاشة وتقديم الوجبات', 'إعاشة مواقع العمل', 'Site catering');

SELECT public.mkt_seed_activity('agriculture', NULL, 'الزراعة والمحاصيل', 'Crop farming');
SELECT public.mkt_seed_activity('agriculture', NULL, 'تنسيق الحدائق والمسطحات', 'Landscaping');
SELECT public.mkt_seed_activity('agriculture', NULL, 'أنظمة الري', 'Irrigation systems');
SELECT public.mkt_seed_activity('agriculture', NULL, 'الثروة الحيوانية', 'Livestock');
SELECT public.mkt_seed_activity('agriculture', 'تنسيق الحدائق والمسطحات', 'صيانة الحدائق', 'Garden maintenance');

SELECT public.mkt_seed_activity('other', NULL, 'نشاط قيد المراجعة', 'Activity under review');
SELECT public.mkt_seed_activity('other', NULL, 'نشاط آخر غير مدرج', 'Other unlisted activity');

SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'حفر', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'حفري', 'misspelling');
SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'حفريات', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'أعمال حفريات', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'حفارة', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'أعمال الحفر والردم', 'excavation', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'مقاولات عامة للمباني', 'مقاولات', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'مقاولات عامة للمباني', 'مقاول', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'التشطيبات والديكور', 'ديكور', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'التشطيبات والديكور', 'تشطيب', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'الأعمال الكهربائية', 'كهرباء', 'synonym');
SELECT public.mkt_seed_alias('contracting', 'أعمال السباكة والصرف', 'سباكة', 'synonym');
SELECT public.mkt_seed_alias('transport-logistics', 'نقل البضائع بالشاحنات', 'نقل', 'synonym');
SELECT public.mkt_seed_alias('transport-logistics', 'نقل البضائع بالشاحنات', 'شحن', 'synonym');
SELECT public.mkt_seed_alias('transport-logistics', 'التخزين والمستودعات', 'مستودع', 'synonym');
SELECT public.mkt_seed_alias('transport-logistics', 'النقل الثقيل والمعدات', 'نقل ثقيل', 'synonym');
SELECT public.mkt_seed_alias('engineering-consulting', 'التصميم المعماري', 'مكتب هندسي', 'synonym');
SELECT public.mkt_seed_alias('engineering-consulting', 'التصميم المعماري', 'مكتب هندسة', 'synonym');
SELECT public.mkt_seed_alias('engineering-consulting', 'التصميم المعماري', 'معماري', 'synonym');
SELECT public.mkt_seed_alias('engineering-consulting', 'الإشراف الهندسي', 'اشراف', 'misspelling');
SELECT public.mkt_seed_alias('real-estate', 'الوساطة العقارية', 'عقار', 'synonym');
SELECT public.mkt_seed_alias('real-estate', 'الوساطة العقارية', 'عقارات', 'synonym');
SELECT public.mkt_seed_alias('real-estate', 'الوساطة العقارية', 'وسيط عقاري', 'synonym');
SELECT public.mkt_seed_alias('real-estate', 'الوساطة العقارية', 'مكتب عقاري', 'synonym');
SELECT public.mkt_seed_alias('trade-supply', 'التجارة العامة', 'تجارة', 'synonym');
SELECT public.mkt_seed_alias('trade-supply', 'التجارة العامة', 'تجارة وتوريد', 'synonym');
SELECT public.mkt_seed_alias('trade-supply', 'توريد مواد البناء', 'توريد', 'synonym');
SELECT public.mkt_seed_alias('trade-supply', 'توريد مواد البناء', 'مواد بناء', 'synonym');
SELECT public.mkt_seed_alias('industry', 'صناعة مواد البناء', 'مصنع', 'synonym');
SELECT public.mkt_seed_alias('industry', 'الصناعات المعدنية', 'حدادة', 'synonym');
SELECT public.mkt_seed_alias('maintenance-operations', 'صيانة المباني', 'صيانة', 'synonym');
SELECT public.mkt_seed_alias('maintenance-operations', 'صيانة التكييف والتبريد', 'تكييف', 'synonym');
SELECT public.mkt_seed_alias('maintenance-operations', 'النظافة والتشغيل', 'نظافة', 'synonym');
SELECT public.mkt_seed_alias('information-technology', 'تطوير البرمجيات', 'برمجة', 'synonym');
SELECT public.mkt_seed_alias('information-technology', 'تطوير المواقع والتطبيقات', 'تطبيقات', 'synonym');
SELECT public.mkt_seed_alias('professional-services', 'المحاسبة والمراجعة', 'محاسبة', 'synonym');
SELECT public.mkt_seed_alias('professional-services', 'الاستشارات القانونية', 'محاماة', 'synonym');
SELECT public.mkt_seed_alias('hospitality-catering', 'الإعاشة وتقديم الوجبات', 'اعاشة', 'misspelling');
SELECT public.mkt_seed_alias('agriculture', 'تنسيق الحدائق والمسطحات', 'تنسيق حدائق', 'synonym');

DROP FUNCTION public.mkt_seed_activity(text, text, text, text);
DROP FUNCTION public.mkt_seed_alias(text, text, text, text);

CREATE OR REPLACE FUNCTION public.mkt_search_activities(
  _q text,
  _group_id uuid DEFAULT NULL,
  _parent_id uuid DEFAULT NULL,
  _only_main boolean DEFAULT NULL,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid, group_id uuid, group_name_ar text, group_name_en text, parent_id uuid,
  parent_name_ar text, name_ar text, name_en text, matched_alias text, match_kind text, score real
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH q AS (SELECT public.mkt_norm_activity_text(_q) AS n),
  base AS (
    SELECT a.id, a.group_id, g.name_ar AS group_name_ar, g.name_en AS group_name_en,
           a.parent_id, p.name_ar AS parent_name_ar, a.name_ar, a.name_en, a.norm_ar, a.sort_order
    FROM public.mkt_activities a
    JOIN public.mkt_activity_groups g ON g.id = a.group_id AND g.is_active
    LEFT JOIN public.mkt_activities p ON p.id = a.parent_id
    WHERE a.is_active AND a.merged_into_id IS NULL
      AND (_group_id IS NULL OR a.group_id = _group_id)
      AND (_parent_id IS NULL OR a.parent_id = _parent_id)
      AND (_only_main IS NULL OR (_only_main AND a.parent_id IS NULL) OR (NOT _only_main AND a.parent_id IS NOT NULL))
  ),
  scored AS (
    SELECT b.*, NULL::text AS matched_alias,
           CASE
             WHEN (SELECT n FROM q) IS NULL THEN 'browse'
             WHEN b.norm_ar = (SELECT n FROM q) THEN 'exact'
             WHEN b.norm_ar LIKE (SELECT n FROM q) || '%' THEN 'prefix'
             WHEN b.norm_ar LIKE '%' || (SELECT n FROM q) || '%' THEN 'contains'
             ELSE 'fuzzy'
           END AS match_kind,
           CASE
             WHEN (SELECT n FROM q) IS NULL THEN 0.5
             WHEN b.norm_ar = (SELECT n FROM q) THEN 1.0
             WHEN b.norm_ar LIKE (SELECT n FROM q) || '%' THEN 0.8
             WHEN b.norm_ar LIKE '%' || (SELECT n FROM q) || '%' THEN 0.7
             ELSE extensions.similarity(b.norm_ar, (SELECT n FROM q))
           END::real AS score
    FROM base b
    UNION ALL
    SELECT b.*, al.alias,
           CASE WHEN al.norm_alias = (SELECT n FROM q) THEN 'alias' ELSE 'alias_partial' END,
           CASE WHEN al.norm_alias = (SELECT n FROM q) THEN 0.95
                WHEN al.norm_alias LIKE (SELECT n FROM q) || '%' THEN 0.75
                ELSE 0.6 END::real
    FROM base b
    JOIN public.mkt_activity_aliases al ON al.activity_id = b.id
    WHERE (SELECT n FROM q) IS NOT NULL
      AND (al.norm_alias LIKE '%' || (SELECT n FROM q) || '%' OR (SELECT n FROM q) LIKE al.norm_alias || '%')
  ),
  best AS (
    SELECT DISTINCT ON (s.id) s.*
    FROM scored s
    WHERE (SELECT n FROM q) IS NULL OR s.score >= 0.28
    ORDER BY s.id, s.score DESC
  )
  SELECT best.id, best.group_id, best.group_name_ar, best.group_name_en, best.parent_id,
         best.parent_name_ar, best.name_ar, best.name_en, best.matched_alias, best.match_kind, best.score
  FROM best
  ORDER BY best.score DESC, best.sort_order, best.name_ar
  LIMIT greatest(1, least(coalesce(_limit, 20), 50));
$$;

REVOKE ALL ON FUNCTION public.mkt_search_activities(text, uuid, uuid, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_search_activities(text, uuid, uuid, boolean, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_entity_activities_list(_tenant_id uuid)
RETURNS TABLE (
  activity_id uuid, is_primary boolean, group_id uuid, group_name_ar text, group_name_en text,
  parent_id uuid, name_ar text, name_en text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ea.activity_id, ea.is_primary, a.group_id, g.name_ar, g.name_en, a.parent_id, a.name_ar, a.name_en
  FROM public.mkt_entity_activities ea
  JOIN public.mkt_activities a ON a.id = ea.activity_id
  JOIN public.mkt_activity_groups g ON g.id = a.group_id
  WHERE ea.tenant_id = _tenant_id
  ORDER BY ea.is_primary DESC, a.name_ar;
$$;

REVOKE ALL ON FUNCTION public.mkt_entity_activities_list(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_entity_activities_list(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_set_entity_activities(
  _tenant_id uuid, _main_activity_id uuid, _sub_activity_ids uuid[] DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  main_group uuid; sub uuid; sub_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT (public.is_active_member(_tenant_id) OR public.mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'not authorised for this entity';
  END IF;
  SELECT group_id INTO main_group FROM public.mkt_activities
   WHERE id = _main_activity_id AND parent_id IS NULL AND is_active AND merged_into_id IS NULL;
  IF main_group IS NULL THEN
    RAISE EXCEPTION 'invalid main activity';
  END IF;
  FOREACH sub IN ARRAY coalesce(_sub_activity_ids, '{}'::uuid[]) LOOP
    SELECT id, group_id, parent_id INTO sub_row FROM public.mkt_activities
     WHERE id = sub AND is_active AND merged_into_id IS NULL;
    IF sub_row IS NULL THEN
      RAISE EXCEPTION 'invalid sub-activity';
    END IF;
    IF sub_row.group_id <> main_group THEN
      RAISE EXCEPTION 'sub-activity belongs to a different sector';
    END IF;
    IF sub_row.parent_id IS NOT NULL AND sub_row.parent_id <> _main_activity_id THEN
      RAISE EXCEPTION 'sub-activity does not belong to the selected main activity';
    END IF;
  END LOOP;
  DELETE FROM public.mkt_entity_activities WHERE tenant_id = _tenant_id;
  INSERT INTO public.mkt_entity_activities (tenant_id, activity_id, is_primary, created_by)
  VALUES (_tenant_id, _main_activity_id, true, auth.uid());
  INSERT INTO public.mkt_entity_activities (tenant_id, activity_id, is_primary, created_by)
  SELECT _tenant_id, s, false, auth.uid()
  FROM unnest(coalesce(_sub_activity_ids, '{}'::uuid[])) AS s
  WHERE s <> _main_activity_id
  ON CONFLICT (tenant_id, activity_id) DO NOTHING;
END; $$;

REVOKE ALL ON FUNCTION public.mkt_set_entity_activities(uuid, uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_set_entity_activities(uuid, uuid, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_suggest_activity(
  _raw_text text, _group_id uuid DEFAULT NULL, _parent_id uuid DEFAULT NULL, _tenant_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; recent integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF length(coalesce(trim(_raw_text), '')) < 2 THEN
    RAISE EXCEPTION 'suggestion text is too short';
  END IF;
  IF _tenant_id IS NOT NULL AND NOT public.is_active_member(_tenant_id) THEN
    RAISE EXCEPTION 'not authorised for this entity';
  END IF;
  SELECT count(*) INTO recent FROM public.mkt_activity_suggestions
   WHERE suggested_by = auth.uid() AND created_at > now() - interval '1 hour';
  IF recent >= 10 THEN
    RAISE EXCEPTION 'too many suggestions, please try again later';
  END IF;
  SELECT id INTO v_id FROM public.mkt_activity_suggestions
   WHERE suggested_by = auth.uid() AND status = 'pending'
     AND norm_text = public.mkt_norm_activity_text(_raw_text)
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  INSERT INTO public.mkt_activity_suggestions (raw_text, group_id, parent_id, tenant_id, suggested_by)
  VALUES (trim(_raw_text), _group_id, _parent_id, _tenant_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.mkt_suggest_activity(text, uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_suggest_activity(text, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_merge_activities(_source_id uuid, _target_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  src RECORD; tgt RECORD;
  n_links integer := 0; n_alias integer := 0; n_children integer := 0;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _source_id = _target_id THEN
    RAISE EXCEPTION 'cannot merge an activity into itself';
  END IF;
  SELECT * INTO src FROM public.mkt_activities WHERE id = _source_id;
  SELECT * INTO tgt FROM public.mkt_activities WHERE id = _target_id;
  IF src IS NULL OR tgt IS NULL THEN
    RAISE EXCEPTION 'activity not found';
  END IF;
  IF (src.parent_id IS NULL) <> (tgt.parent_id IS NULL) THEN
    RAISE EXCEPTION 'main and sub activities cannot be merged together';
  END IF;
  WITH moved AS (
    UPDATE public.mkt_entity_activities ea
       SET activity_id = _target_id, updated_at = now()
     WHERE ea.activity_id = _source_id
       AND NOT EXISTS (SELECT 1 FROM public.mkt_entity_activities x
                        WHERE x.tenant_id = ea.tenant_id AND x.activity_id = _target_id)
    RETURNING 1)
  SELECT count(*) INTO n_links FROM moved;
  DELETE FROM public.mkt_entity_activities WHERE activity_id = _source_id;
  WITH moved AS (
    UPDATE public.mkt_activity_aliases al
       SET activity_id = _target_id
     WHERE al.activity_id = _source_id
       AND NOT EXISTS (SELECT 1 FROM public.mkt_activity_aliases x
                        WHERE x.activity_id = _target_id AND x.norm_alias = al.norm_alias)
    RETURNING 1)
  SELECT count(*) INTO n_alias FROM moved;
  DELETE FROM public.mkt_activity_aliases WHERE activity_id = _source_id;
  INSERT INTO public.mkt_activity_aliases (activity_id, alias, kind, created_by)
  VALUES (_target_id, src.name_ar, 'legacy', auth.uid())
  ON CONFLICT DO NOTHING;
  WITH moved AS (
    UPDATE public.mkt_activities c
       SET parent_id = _target_id, group_id = tgt.group_id, updated_at = now()
     WHERE c.parent_id = _source_id
    RETURNING 1)
  SELECT count(*) INTO n_children FROM moved;
  UPDATE public.mkt_activities
     SET is_active = false, merged_into_id = _target_id, updated_at = now()
   WHERE id = _source_id;
  INSERT INTO public.mkt_activity_merges (source_id, target_id, moved_links, moved_aliases, moved_children, note, actor_id)
  VALUES (_source_id, _target_id, n_links, n_alias, n_children, _note, auth.uid());
END; $$;

REVOKE ALL ON FUNCTION public.mkt_merge_activities(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_merge_activities(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_activities(
  _q text DEFAULT NULL, _group_id uuid DEFAULT NULL, _include_inactive boolean DEFAULT true, _limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid, group_id uuid, group_name_ar text, parent_id uuid, parent_name_ar text,
  name_ar text, name_en text, is_active boolean, merged_into_id uuid,
  alias_count integer, entity_count integer, child_count integer, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.group_id, g.name_ar, a.parent_id, p.name_ar, a.name_ar, a.name_en,
         a.is_active, a.merged_into_id,
         (SELECT count(*) FROM public.mkt_activity_aliases x WHERE x.activity_id = a.id)::int,
         (SELECT count(*) FROM public.mkt_entity_activities x WHERE x.activity_id = a.id)::int,
         (SELECT count(*) FROM public.mkt_activities x WHERE x.parent_id = a.id)::int,
         a.created_at
  FROM public.mkt_activities a
  JOIN public.mkt_activity_groups g ON g.id = a.group_id
  LEFT JOIN public.mkt_activities p ON p.id = a.parent_id
  WHERE public.mkt_is_platform_admin()
    AND (_group_id IS NULL OR a.group_id = _group_id)
    AND (_include_inactive OR a.is_active)
    AND (_q IS NULL OR public.mkt_norm_activity_text(_q) IS NULL
         OR a.norm_ar LIKE '%' || public.mkt_norm_activity_text(_q) || '%'
         OR EXISTS (SELECT 1 FROM public.mkt_activity_aliases al
                     WHERE al.activity_id = a.id
                       AND al.norm_alias LIKE '%' || public.mkt_norm_activity_text(_q) || '%'))
  ORDER BY g.sort_order, coalesce(p.name_ar, a.name_ar), a.parent_id NULLS FIRST, a.name_ar
  LIMIT greatest(1, least(coalesce(_limit, 200), 500));
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_activities(text, uuid, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_activities(text, uuid, boolean, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_review_activity_suggestion(
  _suggestion_id uuid, _decision text, _activity_id uuid DEFAULT NULL, _note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _decision NOT IN ('approved', 'rejected', 'merged') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;
  IF _decision <> 'rejected' AND _activity_id IS NULL THEN
    RAISE EXCEPTION 'an activity must be selected for this decision';
  END IF;
  UPDATE public.mkt_activity_suggestions
     SET status = _decision, linked_activity_id = _activity_id, review_note = _note,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE id = _suggestion_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suggestion not found or already reviewed';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.mkt_review_activity_suggestion(uuid, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_review_activity_suggestion(uuid, text, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_activity_migration_report()
RETURNS TABLE (
  tenant_id uuid, legacy_text text, bucket text, matched_activity_id uuid, matched_name_ar text, score real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH legacy AS (
    SELECT b.tenant_id, nullif(trim(b.main_activity), '') AS legacy_text
    FROM public.mkt_business_profiles b
    WHERE public.mkt_is_platform_admin()
  ),
  matched AS (
    SELECT l.tenant_id, l.legacy_text, s.id AS activity_id, s.name_ar, s.score
    FROM legacy l
    LEFT JOIN LATERAL (
      SELECT * FROM public.mkt_search_activities(l.legacy_text, NULL, NULL, NULL, 1)
    ) s ON true
  )
  SELECT m.tenant_id, m.legacy_text,
         CASE
           WHEN m.legacy_text IS NULL THEN 'unclassified'
           WHEN EXISTS (SELECT 1 FROM public.mkt_entity_activities ea WHERE ea.tenant_id = m.tenant_id AND ea.is_primary) THEN 'already_linked'
           WHEN m.score >= 0.95 THEN 'auto_matched'
           WHEN m.score >= 0.5 THEN 'needs_review'
           ELSE 'unclassified'
         END,
         m.activity_id, m.name_ar, m.score
  FROM matched m;
$$;

REVOKE ALL ON FUNCTION public.mkt_activity_migration_report() FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_activity_migration_report() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_activities_guard() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_activities_block_delete() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_entity_activities_guard() FROM public, anon, authenticated;
