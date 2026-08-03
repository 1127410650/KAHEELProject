-- 1) Sports sector, activities, sub-activities and search aliases (idempotent).
DO $$
DECLARE
  g uuid;
  rec jsonb;
  sub jsonb;
  al jsonb;
  m uuid;
  s uuid;
  ord int := 0;
  data jsonb := $json$[
    {"ar":"الأندية الرياضية","en":"Sports clubs","aliases":["نادي رياضي","كلوب","نادي"],
     "subs":[{"ar":"أندية كرة القدم","en":"Football clubs"},{"ar":"أندية متعددة الرياضات","en":"Multi-sport clubs"},{"ar":"أندية الرياضات القتالية","en":"Combat sports clubs"},{"ar":"أندية صحية","en":"Health clubs"}]},
    {"ar":"مراكز اللياقة البدنية","en":"Fitness centers","aliases":["جيم","صالة رياضية","فتنس","نادي صحي","جم"],
     "subs":[{"ar":"صالات الأثقال","en":"Weight training gyms"},{"ar":"كروس فت","en":"CrossFit"},{"ar":"يوغا وبيلاتس","en":"Yoga & Pilates"},{"ar":"سبينينج ودراجات ثابتة","en":"Spinning studios"}]},
    {"ar":"الأكاديميات الرياضية","en":"Sports academies","aliases":["اكاديمية رياضية","مدرسة رياضية"],
     "subs":[{"ar":"أكاديمية كرة قدم","en":"Football academy"},{"ar":"أكاديمية سباحة","en":"Swimming academy"},{"ar":"أكاديمية تنس وبادل","en":"Tennis & padel academy"},{"ar":"أكاديمية فنون قتالية","en":"Martial arts academy"}]},
    {"ar":"الأندية النسائية","en":"Women's clubs","aliases":["نادي نسائي","صالة نسائية","جيم نسائي"],
     "subs":[{"ar":"مراكز لياقة نسائية","en":"Women's fitness centers"},{"ar":"أكاديميات رياضية نسائية","en":"Women's sports academies"}]},
    {"ar":"الملاعب والمرافق الرياضية","en":"Sports venues & facilities","aliases":["ملعب","ملاعب","استاد","صالة مغلقة"],
     "subs":[{"ar":"ملاعب كرة قدم","en":"Football pitches"},{"ar":"ملاعب بادل","en":"Padel courts"},{"ar":"صالات رياضية مغلقة","en":"Indoor halls"},{"ar":"مسابح","en":"Swimming pools"},{"ar":"مضامير جري","en":"Running tracks"}]},
    {"ar":"التدريب الرياضي","en":"Sports training","aliases":["تدريب رياضي","كوتشينج"],
     "subs":[{"ar":"تدريب جماعي","en":"Group training"},{"ar":"إعداد بدني","en":"Strength & conditioning"},{"ar":"تأهيل رياضي","en":"Sports rehabilitation"},{"ar":"تدريب الناشئين","en":"Youth training"}]},
    {"ar":"المدربون الشخصيون","en":"Personal trainers","aliases":["مدرب شخصي","كابتن","بيرسونال ترينر"],
     "subs":[{"ar":"مدرب لياقة شخصي","en":"Personal fitness trainer"},{"ar":"مدرب سباحة","en":"Swimming coach"},{"ar":"مدرب تغذية رياضية","en":"Sports nutrition coach"}]},
    {"ar":"تأجير المعدات الرياضية","en":"Sports equipment rental","aliases":["تأجير معدات رياضية","ايجار اجهزة رياضية"],
     "subs":[{"ar":"تأجير أجهزة لياقة","en":"Fitness equipment rental"},{"ar":"تأجير مستلزمات الملاعب","en":"Pitch equipment rental"},{"ar":"تأجير معدات الرياضات المائية","en":"Water sports equipment rental"}]},
    {"ar":"تنظيم الفعاليات الرياضية","en":"Sports events organizing","aliases":["بطولات","دوري","ماراثون"],
     "subs":[{"ar":"تنظيم البطولات والدوريات","en":"Tournaments & leagues"},{"ar":"تنظيم الماراثونات","en":"Marathons"},{"ar":"التحكيم الرياضي","en":"Refereeing services"}]},
    {"ar":"أنشطة رياضية أخرى مشروعة","en":"Other lawful sports activities","aliases":["رياضة اخرى","نشاط رياضي"],
     "subs":[{"ar":"رياضات مائية","en":"Water sports"},{"ar":"رياضات الرمال والمغامرات","en":"Desert & adventure sports"},{"ar":"رياضات إلكترونية","en":"Esports"},{"ar":"نشاط رياضي آخر","en":"Other sport"}]}
  ]$json$::jsonb;
BEGIN
  INSERT INTO public.mkt_activity_groups (slug, name_ar, name_en, sort_order, is_active)
  VALUES ('sports', 'الرياضة والأنشطة الرياضية', 'Sports & Athletics', 115, true)
  ON CONFLICT (slug) DO UPDATE
    SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, updated_at = now()
  RETURNING id INTO g;

  FOR rec IN SELECT * FROM jsonb_array_elements(data) LOOP
    ord := ord + 10;
    SELECT id INTO m FROM public.mkt_activities
     WHERE group_id = g AND parent_id IS NULL
       AND norm_ar = public.mkt_norm_activity_text(rec->>'ar');
    IF m IS NULL THEN
      INSERT INTO public.mkt_activities (group_id, parent_id, name_ar, name_en, sort_order)
      VALUES (g, NULL, rec->>'ar', rec->>'en', ord)
      RETURNING id INTO m;
    END IF;

    FOR al IN SELECT * FROM jsonb_array_elements(coalesce(rec->'aliases', '[]'::jsonb)) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.mkt_activity_aliases
         WHERE activity_id = m AND norm_alias = public.mkt_norm_activity_text(al #>> '{}')
      ) THEN
        INSERT INTO public.mkt_activity_aliases (activity_id, alias, kind)
        VALUES (m, al #>> '{}', 'synonym');
      END IF;
    END LOOP;

    FOR sub IN SELECT * FROM jsonb_array_elements(coalesce(rec->'subs', '[]'::jsonb)) LOOP
      SELECT id INTO s FROM public.mkt_activities
       WHERE group_id = g AND parent_id = m
         AND norm_ar = public.mkt_norm_activity_text(sub->>'ar');
      IF s IS NULL THEN
        INSERT INTO public.mkt_activities (group_id, parent_id, name_ar, name_en, sort_order)
        VALUES (g, m, sub->>'ar', sub->>'en', 100);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 2) Open sectors: platform admins can create/adjust sectors and activities for
--    any lawful activity in the future. No automatic changes to entity data.
CREATE OR REPLACE FUNCTION public.mkt_admin_create_group(
  _name_ar text,
  _name_en text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _sort_order integer DEFAULT 500
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF coalesce(trim(_name_ar), '') = '' THEN
    RAISE EXCEPTION 'sector name is required';
  END IF;
  v_slug := nullif(trim(lower(coalesce(_slug, ''))), '');
  IF v_slug IS NULL THEN
    v_slug := 'sector-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  END IF;
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]+', '-', 'g');

  INSERT INTO public.mkt_activity_groups (slug, name_ar, name_en, sort_order, is_active)
  VALUES (v_slug, trim(_name_ar), coalesce(nullif(trim(coalesce(_name_en, '')), ''), trim(_name_ar)),
          coalesce(_sort_order, 500), true)
  ON CONFLICT (slug) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_admin_update_group(
  _id uuid,
  _name_ar text DEFAULT NULL,
  _name_en text DEFAULT NULL,
  _is_active boolean DEFAULT NULL,
  _sort_order integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.mkt_activity_groups
     SET name_ar = coalesce(nullif(trim(coalesce(_name_ar, '')), ''), name_ar),
         name_en = coalesce(nullif(trim(coalesce(_name_en, '')), ''), name_en),
         is_active = coalesce(_is_active, is_active),
         sort_order = coalesce(_sort_order, sort_order),
         updated_at = now()
   WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sector not found';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_admin_create_activity(
  _group_id uuid,
  _name_ar text,
  _name_en text DEFAULT NULL,
  _parent_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF coalesce(trim(_name_ar), '') = '' THEN
    RAISE EXCEPTION 'activity name is required';
  END IF;

  SELECT id INTO v_id FROM public.mkt_activities
   WHERE group_id = _group_id
     AND coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(_parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND norm_ar = public.mkt_norm_activity_text(_name_ar);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.mkt_activities (group_id, parent_id, name_ar, name_en, created_by)
  VALUES (_group_id, _parent_id, trim(_name_ar),
          nullif(trim(coalesce(_name_en, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_admin_update_activity(
  _id uuid,
  _name_ar text DEFAULT NULL,
  _name_en text DEFAULT NULL,
  _is_active boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.mkt_activities
     SET name_ar = coalesce(nullif(trim(coalesce(_name_ar, '')), ''), name_ar),
         name_en = coalesce(nullif(trim(coalesce(_name_en, '')), ''), name_en),
         is_active = coalesce(_is_active, is_active),
         updated_at = now()
   WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found';
  END IF;
END; $$;

-- Admin-only surface: never reachable by anonymous visitors.
REVOKE ALL ON FUNCTION public.mkt_admin_create_group(text, text, text, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.mkt_admin_update_group(uuid, text, text, boolean, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.mkt_admin_create_activity(uuid, text, text, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.mkt_admin_update_activity(uuid, text, text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_create_group(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_update_group(uuid, text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_create_activity(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_update_activity(uuid, text, text, boolean) TO authenticated;