-- 1) علم البيانات التجريبية على الجداول الناقصة (الافتراضي false: لا سجل قائم يتأثر)
ALTER TABLE public.mkt_listing_images ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.mkt_realestate_listings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.mkt_realestate_photos ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.mkt_realestate_providers ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS mkt_listings_is_demo_idx ON public.mkt_listings (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS mkt_realestate_listings_is_demo_idx ON public.mkt_realestate_listings (is_demo) WHERE is_demo;

-- 2) سجل الحسابات التجريبية: لا كلمة مرور ولا ربط بـ auth.users ⇒ الدخول مستحيل
CREATE TABLE IF NOT EXISTS public.mkt_demo_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_kind text NOT NULL,
  display_name_ar text NOT NULL,
  display_name_en text,
  headline_ar text,
  city text,
  district text,
  city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  fake_email text NOT NULL,
  fake_phone_label text NOT NULL DEFAULT 'هاتف تجريبي',
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mkt_demo_accounts_kind_chk CHECK (account_kind IN ('realestate_office','hotel','individual','restaurant','store','service_provider')),
  CONSTRAINT mkt_demo_accounts_is_demo_chk CHECK (is_demo),
  CONSTRAINT mkt_demo_accounts_email_chk CHECK (fake_email LIKE '%@demo.kaheel.invalid')
);

GRANT SELECT ON public.mkt_demo_accounts TO anon;
GRANT SELECT ON public.mkt_demo_accounts TO authenticated;
GRANT ALL ON public.mkt_demo_accounts TO service_role;

ALTER TABLE public.mkt_demo_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo accounts are public read-only"
  ON public.mkt_demo_accounts FOR SELECT
  USING (true);

CREATE TRIGGER mkt_demo_accounts_touch
  BEFORE UPDATE ON public.mkt_demo_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) حماية التفاعل: أي تفاعل حقيقي مع سجل تجريبي يُرفض برسالة واضحة
CREATE OR REPLACE FUNCTION public.mkt_demo_interaction_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocked boolean := false;
BEGIN
  IF TG_TABLE_NAME IN ('mkt_conversations','mkt_quote_requests','mkt_call_requests') THEN
    SELECT COALESCE(l.is_demo, false) INTO blocked
      FROM public.mkt_listings l WHERE l.id = NEW.listing_id;
  ELSIF TG_TABLE_NAME IN ('mkt_orders','mkt_service_bookings') THEN
    SELECT COALESCE(s.is_demo, false) INTO blocked
      FROM public.mkt_storefronts s WHERE s.id = NEW.storefront_id;
  ELSIF TG_TABLE_NAME = 'mkt_realestate_bookings' THEN
    SELECT COALESCE(r.is_demo, false) INTO blocked
      FROM public.mkt_realestate_listings r WHERE r.id = NEW.listing_id;
  END IF;

  IF COALESCE(blocked, false) THEN
    RAISE EXCEPTION 'DEMO_ONLY: هذا إعلان تجريبي للعرض فقط';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_demo_interaction_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_demo_interaction_guard() FROM anon;

CREATE TRIGGER mkt_demo_guard_conversations BEFORE INSERT ON public.mkt_conversations
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();
CREATE TRIGGER mkt_demo_guard_quotes BEFORE INSERT ON public.mkt_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();
CREATE TRIGGER mkt_demo_guard_calls BEFORE INSERT ON public.mkt_call_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();
CREATE TRIGGER mkt_demo_guard_orders BEFORE INSERT ON public.mkt_orders
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();
CREATE TRIGGER mkt_demo_guard_service_bookings BEFORE INSERT ON public.mkt_service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();
CREATE TRIGGER mkt_demo_guard_re_bookings BEFORE INSERT ON public.mkt_realestate_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_interaction_guard();

-- 4) لا إشعار ولا رسالة تصل حسابًا تجريبيًا مطلقًا
CREATE OR REPLACE FUNCTION public.mkt_demo_notification_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mkt_demo_accounts d WHERE d.id = NEW.user_id) THEN
    RETURN NULL; -- يُهمل الإشعار بصمت: الحساب تجريبي ولا قناة إرسال له
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_demo_notification_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_demo_notification_guard() FROM anon;

CREATE TRIGGER mkt_demo_guard_notifications BEFORE INSERT ON public.mkt_notifications
  FOR EACH ROW EXECUTE FUNCTION public.mkt_demo_notification_guard();

-- 5) أمر مسح واحد: يمسح ما هو تجريبي فقط، ولمدير النظام فقط
CREATE OR REPLACE FUNCTION public.mkt_purge_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_images int := 0; n_listings int := 0; n_re_photos int := 0; n_re_listings int := 0;
  n_re_providers int := 0; n_items int := 0; n_stores int := 0; n_offers int := 0;
  n_stories int := 0; n_accounts int := 0;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: هذا الأمر لمدير النظام فقط';
  END IF;

  DELETE FROM public.mkt_listing_images WHERE is_demo; n_images := ROW_COUNT_OF();
  RETURN NULL; -- placeholder replaced below
END;
$$;

-- إعادة تعريف نظيفة (بدل الحيلة أعلاه) باستخدام GET DIAGNOSTICS
CREATE OR REPLACE FUNCTION public.mkt_purge_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_images int := 0; n_listings int := 0; n_re_photos int := 0; n_re_listings int := 0;
  n_re_providers int := 0; n_items int := 0; n_stores int := 0; n_offers int := 0;
  n_stories int := 0; n_accounts int := 0;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: هذا الأمر لمدير النظام فقط';
  END IF;

  DELETE FROM public.mkt_listing_images WHERE is_demo;
  GET DIAGNOSTICS n_images = ROW_COUNT;
  DELETE FROM public.mkt_listings WHERE is_demo;
  GET DIAGNOSTICS n_listings = ROW_COUNT;
  DELETE FROM public.mkt_realestate_photos WHERE is_demo;
  GET DIAGNOSTICS n_re_photos = ROW_COUNT;
  DELETE FROM public.mkt_realestate_listings WHERE is_demo;
  GET DIAGNOSTICS n_re_listings = ROW_COUNT;
  DELETE FROM public.mkt_realestate_providers WHERE is_demo;
  GET DIAGNOSTICS n_re_providers = ROW_COUNT;
  DELETE FROM public.mkt_store_items WHERE is_demo;
  GET DIAGNOSTICS n_items = ROW_COUNT;
  DELETE FROM public.mkt_storefronts WHERE is_demo;
  GET DIAGNOSTICS n_stores = ROW_COUNT;
  DELETE FROM public.mkt_exclusive_offers WHERE is_demo;
  GET DIAGNOSTICS n_offers = ROW_COUNT;
  DELETE FROM public.mkt_stories WHERE is_demo;
  GET DIAGNOSTICS n_stories = ROW_COUNT;
  DELETE FROM public.mkt_demo_accounts;
  GET DIAGNOSTICS n_accounts = ROW_COUNT;

  RETURN jsonb_build_object(
    'mkt_listing_images', n_images,
    'mkt_listings', n_listings,
    'mkt_realestate_photos', n_re_photos,
    'mkt_realestate_listings', n_re_listings,
    'mkt_realestate_providers', n_re_providers,
    'mkt_store_items', n_items,
    'mkt_storefronts', n_stores,
    'mkt_exclusive_offers', n_offers,
    'mkt_stories', n_stories,
    'mkt_demo_accounts', n_accounts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_purge_demo_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_purge_demo_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_purge_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_purge_demo_data() TO service_role;