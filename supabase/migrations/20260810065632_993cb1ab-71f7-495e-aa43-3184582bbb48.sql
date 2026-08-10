-- ═══════════════════════════════════════════════════════════════════════════
-- كَحيل عقار — طلبات التمديد + تقييمات ما بعد الإقامة
-- كل الكتابة عبر دوال SECURITY DEFINER، والحذف منطقي فقط (deleted_at).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── حقول التمديد على الحجز ────────────────────────────────────────────────
ALTER TABLE public.mkt_realestate_bookings
  ADD COLUMN IF NOT EXISTS extended_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_check_out date,
  ADD COLUMN IF NOT EXISTS extension_id uuid;

-- ── جدول طلبات التمديد ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_realestate_booking_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.mkt_realestate_bookings(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.mkt_realestate_listings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.mkt_realestate_providers(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  previous_check_out date,
  new_check_out date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_ext_status_chk
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS re_ext_booking_idx
  ON public.mkt_realestate_booking_extensions (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS re_ext_provider_idx
  ON public.mkt_realestate_booking_extensions (provider_id, status, created_at DESC);
-- طلب تمديد واحد معلّق فقط لكل حجز
CREATE UNIQUE INDEX IF NOT EXISTS re_ext_one_pending_idx
  ON public.mkt_realestate_booking_extensions (booking_id)
  WHERE status = 'pending' AND deleted_at IS NULL;

GRANT SELECT ON public.mkt_realestate_booking_extensions TO authenticated;
GRANT ALL ON public.mkt_realestate_booking_extensions TO service_role;

ALTER TABLE public.mkt_realestate_booking_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY re_ext_read ON public.mkt_realestate_booking_extensions
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.mkt_re_is_member(provider_id)
    OR public.mkt_is_platform_admin()
  );

CREATE POLICY re_ext_admin_all ON public.mkt_realestate_booking_extensions
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE TRIGGER re_ext_touch
  BEFORE UPDATE ON public.mkt_realestate_booking_extensions
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ── جدول التقييمات ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_realestate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.mkt_realestate_bookings(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.mkt_realestate_listings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.mkt_realestate_providers(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  rating smallint NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  comment text,
  status text NOT NULL DEFAULT 'published',
  hidden_reason text,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_reviews_rating_chk CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT re_reviews_status_chk CHECK (status IN ('published', 'hidden')),
  CONSTRAINT re_reviews_tags_chk CHECK (
    tags <@ ARRAY[
      'great_advertiser', 'excellent_cleanliness', 'accurate_info',
      'great_location', 'good_value'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS re_reviews_provider_idx
  ON public.mkt_realestate_reviews (provider_id) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS re_reviews_listing_idx
  ON public.mkt_realestate_reviews (listing_id) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS re_reviews_reviewer_idx
  ON public.mkt_realestate_reviews (reviewer_user_id, created_at DESC);

GRANT SELECT ON public.mkt_realestate_reviews TO anon, authenticated;
GRANT ALL ON public.mkt_realestate_reviews TO service_role;

ALTER TABLE public.mkt_realestate_reviews ENABLE ROW LEVEL SECURITY;

-- قراءة عامة للمنشور غير المحذوف فقط
CREATE POLICY re_reviews_public_read ON public.mkt_realestate_reviews
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

-- صاحب التقييم يقرأ تقييمه دائمًا (حتى لو أُخفي)
CREATE POLICY re_reviews_owner_read ON public.mkt_realestate_reviews
  FOR SELECT TO authenticated
  USING (reviewer_user_id = auth.uid());

-- الإدراج المباشر مسموح فقط لصاحب حجز مقبول انتهت مدته (والدالة المعتمدة تستخدم المسار نفسه)
CREATE POLICY re_reviews_reviewer_insert ON public.mkt_realestate_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND status = 'published'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.mkt_realestate_bookings b
      WHERE b.id = mkt_realestate_reviews.booking_id
        AND b.customer_user_id = auth.uid()
        AND b.status = 'accepted'
        AND b.deleted_at IS NULL
        AND b.check_out IS NOT NULL
        AND b.check_out < current_date
        AND b.listing_id = mkt_realestate_reviews.listing_id
        AND b.provider_id = mkt_realestate_reviews.provider_id
    )
  );

CREATE POLICY re_reviews_admin_all ON public.mkt_realestate_reviews
  FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE TRIGGER re_reviews_touch
  BEFORE UPDATE ON public.mkt_realestate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ── ملخّصات التقييم (بدون حساب على العميل) ────────────────────────────────
CREATE OR REPLACE VIEW public.mkt_realestate_provider_review_stats
WITH (security_invoker = on) AS
SELECT
  r.provider_id,
  count(*)::integer AS reviews_count,
  round(avg(r.rating)::numeric, 2) AS rating_avg,
  (
    SELECT array_agg(t.tag ORDER BY t.uses DESC, t.tag)
    FROM (
      SELECT unnest(r2.tags) AS tag, count(*)::integer AS uses
      FROM public.mkt_realestate_reviews r2
      WHERE r2.provider_id = r.provider_id
        AND r2.status = 'published' AND r2.deleted_at IS NULL
      GROUP BY 1
      ORDER BY 2 DESC, 1
      LIMIT 3
    ) t
  ) AS top_tags
FROM public.mkt_realestate_reviews r
WHERE r.status = 'published' AND r.deleted_at IS NULL
GROUP BY r.provider_id;

CREATE OR REPLACE VIEW public.mkt_realestate_listing_review_stats
WITH (security_invoker = on) AS
SELECT
  r.listing_id,
  count(*)::integer AS reviews_count,
  round(avg(r.rating)::numeric, 2) AS rating_avg
FROM public.mkt_realestate_reviews r
WHERE r.status = 'published' AND r.deleted_at IS NULL
GROUP BY r.listing_id;

GRANT SELECT ON public.mkt_realestate_provider_review_stats TO anon, authenticated;
GRANT SELECT ON public.mkt_realestate_listing_review_stats TO anon, authenticated;

-- ── دوال التمديد ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_re_request_extension(
  _booking_id uuid,
  _new_check_out date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.mkt_realestate_bookings;
  _deadline integer;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول.';
  END IF;

  SELECT * INTO _b FROM public.mkt_realestate_bookings
  WHERE id = _booking_id AND deleted_at IS NULL;

  IF _b.id IS NULL OR _b.customer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'الحجز غير موجود أو ليس لك.';
  END IF;
  IF _b.status <> 'accepted' THEN
    RAISE EXCEPTION 'التمديد متاح للحجز المقبول فقط.';
  END IF;
  IF _b.check_out IS NULL OR _new_check_out <= _b.check_out THEN
    RAISE EXCEPTION 'تاريخ الخروج الجديد يجب أن يكون بعد الحالي.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mkt_realestate_booking_extensions
    WHERE booking_id = _booking_id AND status = 'pending' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'يوجد طلب تمديد قيد الانتظار.';
  END IF;

  SELECT COALESCE(response_deadline_minutes, 1440) INTO _deadline
  FROM public.mkt_realestate_providers WHERE id = _b.provider_id;

  INSERT INTO public.mkt_realestate_booking_extensions (
    booking_id, listing_id, provider_id, requested_by,
    previous_check_out, new_check_out, status, expires_at
  ) VALUES (
    _b.id, _b.listing_id, _b.provider_id, auth.uid(),
    _b.check_out, _new_check_out, 'pending',
    now() + make_interval(mins => COALESCE(_deadline, 1440))
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_request_extension(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_re_request_extension(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_re_decide_extension(
  _extension_id uuid,
  _accept boolean,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e public.mkt_realestate_booking_extensions;
BEGIN
  SELECT * INTO _e FROM public.mkt_realestate_booking_extensions
  WHERE id = _extension_id AND deleted_at IS NULL;

  IF _e.id IS NULL THEN
    RAISE EXCEPTION 'طلب التمديد غير موجود.';
  END IF;
  IF NOT (public.mkt_re_is_member(_e.provider_id) OR public.mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'لا تملك صلاحية البتّ في هذا الطلب.';
  END IF;
  IF _e.status <> 'pending' THEN
    RAISE EXCEPTION 'تمّ البتّ في هذا الطلب مسبقًا.';
  END IF;
  IF _e.expires_at < now() THEN
    UPDATE public.mkt_realestate_booking_extensions
      SET status = 'expired' WHERE id = _e.id;
    RAISE EXCEPTION 'انتهت مهلة الرد على هذا الطلب.';
  END IF;

  UPDATE public.mkt_realestate_booking_extensions
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
        decided_at = now(),
        decided_by = auth.uid(),
        decision_reason = NULLIF(btrim(COALESCE(_reason, '')), '')
    WHERE id = _e.id;

  IF _accept THEN
    UPDATE public.mkt_realestate_bookings
      SET previous_check_out = check_out,
          check_out = _e.new_check_out,
          extended_at = now(),
          extension_count = extension_count + 1,
          extension_id = _e.id
      WHERE id = _e.booking_id;
  END IF;

  INSERT INTO public.mkt_notifications (user_id, kind, title, body, link)
  VALUES (
    _e.requested_by,
    'aqar_extension',
    CASE WHEN _accept THEN 'تم تمديد حجزك' ELSE 'رُفض طلب التمديد' END,
    CASE WHEN _accept
      THEN 'وافق المعلن على التمديد حتى ' || to_char(_e.new_check_out, 'DD/MM/YYYY') || '.'
      ELSE 'لم يوافق المعلن على تمديد الحجز.'
    END,
    '/aqar/requests'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_decide_extension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_re_decide_extension(uuid, boolean, text) TO authenticated;

-- انتهاء تلقائي للطلبات التي فاتت مهلتها (نفس دورة الحجوزات)
CREATE OR REPLACE FUNCTION public.mkt_re_expire_extensions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  UPDATE public.mkt_realestate_booking_extensions
    SET status = 'expired'
    WHERE status = 'pending' AND deleted_at IS NULL AND expires_at < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_expire_extensions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_re_expire_extensions() TO authenticated;

-- ── دالة إرسال التقييم ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_re_submit_review(
  _booking_id uuid,
  _rating smallint,
  _tags text[] DEFAULT '{}',
  _comment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.mkt_realestate_bookings;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يلزم تسجيل الدخول.';
  END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'التقييم من 1 إلى 5.';
  END IF;

  SELECT * INTO _b FROM public.mkt_realestate_bookings
  WHERE id = _booking_id AND deleted_at IS NULL;

  IF _b.id IS NULL OR _b.customer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'الحجز غير موجود أو ليس لك.';
  END IF;
  IF _b.status <> 'accepted' OR _b.check_out IS NULL OR _b.check_out >= current_date THEN
    RAISE EXCEPTION 'التقييم متاح بعد انتهاء إقامة مقبولة.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_realestate_reviews WHERE booking_id = _booking_id) THEN
    RAISE EXCEPTION 'سبق أن قيّمت هذا الحجز.';
  END IF;

  INSERT INTO public.mkt_realestate_reviews (
    booking_id, listing_id, provider_id, reviewer_user_id, rating, tags, comment
  ) VALUES (
    _b.id, _b.listing_id, _b.provider_id, auth.uid(), _rating,
    COALESCE(_tags, '{}')::text[], NULLIF(btrim(COALESCE(_comment, '')), '')
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_submit_review(uuid, smallint, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_re_submit_review(uuid, smallint, text[], text) TO authenticated;