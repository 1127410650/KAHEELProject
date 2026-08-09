CREATE POLICY "public read guide outreach text"
  ON public.mkt_platform_settings FOR SELECT TO anon, authenticated
  USING (section = 'guide_outreach');

CREATE POLICY "admins write platform settings"
  ON public.mkt_platform_settings FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

INSERT INTO public.mkt_platform_settings (key, section, value, description_ar)
VALUES (
  'guide_invite_message',
  'guide_outreach',
  jsonb_build_object(
    'template',
    'مرحبًا {name} 👋' || chr(10) ||
    'منصة كَحيل — سوق سوريا الإلكتروني — عارضة صفحتكم مجانًا ضمن دليل سوريا.' || chr(10) ||
    'سجّلوا حسابكم لتديروا صفحتكم، وتستقبلوا طلبات الحجز والتواصل مباشرة، وتضيفوا صوركم وعروضكم.' || chr(10) ||
    'التسجيل مجاني: {signup_url}'
  ),
  'نص دعوة جهات الدليل — يُستخدم في زر «مشاركة الدعوة» ورسائل الدعوة العامة. المتغيرات: {name} اسم الجهة، {city} المدينة، {signup_url} رابط التسجيل، {platform_url} رابط المنصة.'
)
ON CONFLICT (key) DO NOTHING;