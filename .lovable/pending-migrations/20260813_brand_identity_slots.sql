-- هوية الواجهة: فتحتا صورة فقط (بنر الرئيسية + شعار الهيدر).
-- لا جدول جديد، لا سياسة جديدة، لا صلاحية جديدة — سجلّان إعداديان فقط في
-- `mkt_media_slots`، تُدارَان بنفس دوال المالك القائمة (mkt_admin_save_media_slot
-- / mkt_admin_clear_media_slot) وبنفس حاوية الهوية `mkt-media`.
--
-- الحالة: تنتظر موافقة المالك الصريحة قبل التطبيق (قاعدة «لا كتابة إنتاج»).

INSERT INTO public.mkt_media_slots (slot_key, section, kind, edit_kind, sort_order, alt_text)
VALUES
  ('home.hero.banner', 'home', 'image', 'media', 0, 'بنر كَحيل الرئيسي'),
  ('brand.logo.header.light', 'home', 'image', 'media', 1, 'شعار كَحيل')
ON CONFLICT (slot_key) DO NOTHING;
