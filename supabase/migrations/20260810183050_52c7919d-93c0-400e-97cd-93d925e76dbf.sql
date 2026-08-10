CREATE TABLE public.mkt_mascot_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character text NOT NULL,
  text_ar text NOT NULL,
  link_path text,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT mkt_mascot_phrases_character_chk CHECK (character IN ('kaheel', 'kaheelan')),
  CONSTRAINT mkt_mascot_phrases_text_len CHECK (char_length(btrim(text_ar)) BETWEEN 2 AND 140 AND text_ar !~ '[<>]'),
  CONSTRAINT mkt_mascot_phrases_link_shape CHECK (link_path IS NULL OR link_path ~ '^/[A-Za-z0-9/_.$-]*$')
);

GRANT SELECT ON public.mkt_mascot_phrases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_mascot_phrases TO authenticated;
GRANT ALL ON public.mkt_mascot_phrases TO service_role;

ALTER TABLE public.mkt_mascot_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mascot_phrases_public_read" ON public.mkt_mascot_phrases
  FOR SELECT TO anon, authenticated USING (is_active);

CREATE POLICY "mascot_phrases_admin_read" ON public.mkt_mascot_phrases
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

CREATE POLICY "mascot_phrases_admin_write" ON public.mkt_mascot_phrases
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.mkt_mascot_phrases_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_mascot_phrases_touch
BEFORE INSERT OR UPDATE ON public.mkt_mascot_phrases
FOR EACH ROW EXECUTE FUNCTION public.mkt_mascot_phrases_touch();

CREATE INDEX mkt_mascot_phrases_active_idx
  ON public.mkt_mascot_phrases (character, sort) WHERE is_active;

INSERT INTO public.mkt_mascot_phrases (character, text_ar, link_path, sort) VALUES
  ('kaheel', 'أهلًا فيك في كَحيل — كل شي تحتاجه بمكان واحد.', NULL, 1),
  ('kaheel', 'تدوّر على بيت أو محل؟ قسم العقار جاهز.', '/aqar', 2),
  ('kaheel', 'جعان؟ شوف المطاعم القريبة منك.', '/c/restaurants', 3),
  ('kaheel', 'مقاضي البيت توصلك لبابك — جرّبها.', '/c/groceries', 4),
  ('kaheel', 'دليل سوريا فيه أرقام وعناوين موثوقة.', '/guide', 5),
  ('kaheel', 'طالب؟ دليل الطالب يساعدك بالجامعات والمعاهد.', '/student', 6),
  ('kaheel', 'حابب تعرض خدمتك؟ إنشاء إعلان ما بياخد دقيقة.', '/listings/new', 7),
  ('kaheel', 'حدّد موقعك يطلعلك الأقرب إلك أول شي.', NULL, 8),
  ('kaheel', 'خزّن اللي عجبك بالمفضلة وترجعله وقت ما بدّك.', '/my/favorites', 9),
  ('kaheel', 'طلباتك كلها بصفحة وحدة — تابعها من هون.', '/my/orders', 10),
  ('kaheel', 'بتحتاج سيارة؟ قسم السيارات فيه خيارات كتير.', '/c/cars', 11),
  ('kaheel', 'أي سؤال؟ راسل المعلن مباشرة بالمحادثات.', '/my/chats', 12),
  ('kaheelan', 'وين رايح؟ في عروض حصرية ما شفتها!', '/offers', 1),
  ('kaheelan', 'أنا الزعيم كَحيلان — وأنا بشمّ ريحة تخفيضات.', '/offers', 2),
  ('kaheelan', 'إعلانك لسا مو منشور؟ اللحق حالك!', '/listings/new', 3),
  ('kaheelan', 'ياااه… هالسعر لازم تشوفه بعينك.', '/offers', 4),
  ('kaheelan', 'بلا مزح: أحلى المطاعم قربك.', '/c/restaurants', 5),
  ('kaheelan', 'يلا شدّ حالك، بدّك بيت وأنا معي عناوين.', '/aqar', 6),
  ('kaheelan', 'العصاية جاهزة… والعروض كمان جاهزة.', '/offers', 7),
  ('kaheelan', 'لا تنسى تتابع متاجرك المفضلة.', '/my/favorites', 8),
  ('kaheelan', 'أنا كنت هون قبلك وحجزت الأرخص.', '/aqar', 9),
  ('kaheelan', 'إذا بتدوّر على سيارة… خليني دلّك.', '/c/cars', 10),
  ('kaheelan', 'قصص كَحيل اليوم فيها مفاجآت.', NULL, 11),
  ('kaheelan', 'ما تخلّي حدا يسبقك عالعرض!', '/offers', 12);