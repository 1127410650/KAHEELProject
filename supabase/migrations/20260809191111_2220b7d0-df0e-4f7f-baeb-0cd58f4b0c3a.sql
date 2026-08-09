-- ============================================================
-- Syria guide: customer photos, reviews, ownership claims, promotions
-- Nothing here touches existing tables.
-- ============================================================

CREATE TABLE public.mkt_guide_place_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  evidence text,
  contact text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_place_claims_status_chk CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT mkt_guide_place_claims_unique UNIQUE (place_id, user_id)
);

CREATE TABLE public.mkt_guide_place_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'customer',
  caption text,
  width integer,
  height integer,
  bytes integer,
  mime text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_place_photos_kind_chk CHECK (kind IN ('official','customer')),
  CONSTRAINT mkt_guide_place_photos_status_chk CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT mkt_guide_place_photos_path_unique UNIQUE (storage_path)
);

CREATE TABLE public.mkt_guide_place_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_place_reviews_rating_chk CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT mkt_guide_place_reviews_status_chk CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT mkt_guide_place_reviews_unique UNIQUE (place_id, user_id)
);

CREATE TABLE public.mkt_guide_place_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  days integer NOT NULL DEFAULT 7,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_place_promotions_status_chk CHECK (status IN ('active','expired','cancelled'))
);

CREATE TABLE public.mkt_guide_place_promo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.mkt_guide_place_promotions(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  kind text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_place_promo_events_kind_chk CHECK (kind IN ('view','click'))
);

CREATE INDEX mkt_guide_place_photos_place_idx
  ON public.mkt_guide_place_photos (place_id, status, sort_order);
CREATE INDEX mkt_guide_place_photos_queue_idx
  ON public.mkt_guide_place_photos (status, created_at DESC);
CREATE INDEX mkt_guide_place_reviews_place_idx
  ON public.mkt_guide_place_reviews (place_id, status, created_at DESC);
CREATE INDEX mkt_guide_place_reviews_queue_idx
  ON public.mkt_guide_place_reviews (status, created_at DESC);
CREATE INDEX mkt_guide_place_promotions_active_idx
  ON public.mkt_guide_place_promotions (status, ends_at DESC);
CREATE INDEX mkt_guide_place_promo_events_idx
  ON public.mkt_guide_place_promo_events (promotion_id, kind, created_at DESC);

-- ── grants ──────────────────────────────────────────────────
GRANT SELECT ON public.mkt_guide_place_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_guide_place_photos TO authenticated;
GRANT ALL ON public.mkt_guide_place_photos TO service_role;

GRANT SELECT ON public.mkt_guide_place_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_guide_place_reviews TO authenticated;
GRANT ALL ON public.mkt_guide_place_reviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_guide_place_claims TO authenticated;
GRANT ALL ON public.mkt_guide_place_claims TO service_role;

GRANT SELECT ON public.mkt_guide_place_promotions TO anon;
GRANT SELECT ON public.mkt_guide_place_promotions TO authenticated;
GRANT ALL ON public.mkt_guide_place_promotions TO service_role;

GRANT SELECT ON public.mkt_guide_place_promo_events TO service_role;
GRANT ALL ON public.mkt_guide_place_promo_events TO service_role;

-- ── helpers ─────────────────────────────────────────────────
-- Ownership of a guide record is granted by an approved claim only.
CREATE OR REPLACE FUNCTION public.mkt_guide_place_is_owner(_place_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_guide_place_claims c
    WHERE c.place_id = _place_id
      AND c.user_id = auth.uid()
      AND c.status = 'approved'
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_place_is_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_place_is_owner(uuid) TO authenticated, service_role;

-- Public rating summary: approved reviews only.
CREATE OR REPLACE FUNCTION public.mkt_guide_place_rating(_place_id uuid)
RETURNS TABLE (average numeric, total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(AVG(r.rating)::numeric, 2), COUNT(*)::int
  FROM public.mkt_guide_place_reviews r
  WHERE r.place_id = _place_id AND r.status = 'approved'
$$;

GRANT EXECUTE ON FUNCTION public.mkt_guide_place_rating(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_guide_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_guide_place_photos_touch BEFORE UPDATE ON public.mkt_guide_place_photos
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_touch_updated_at();
CREATE TRIGGER mkt_guide_place_reviews_touch BEFORE UPDATE ON public.mkt_guide_place_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_touch_updated_at();
CREATE TRIGGER mkt_guide_place_claims_touch BEFORE UPDATE ON public.mkt_guide_place_claims
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_touch_updated_at();
CREATE TRIGGER mkt_guide_place_promotions_touch BEFORE UPDATE ON public.mkt_guide_place_promotions
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_touch_updated_at();

-- A contribution always enters the queue as pending, whoever sends it.
CREATE OR REPLACE FUNCTION public.mkt_guide_force_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.mkt_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.reject_reason := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_guide_place_photos_pending BEFORE INSERT ON public.mkt_guide_place_photos
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_force_pending();
CREATE TRIGGER mkt_guide_place_reviews_pending BEFORE INSERT ON public.mkt_guide_place_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guide_force_pending();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.mkt_guide_place_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_guide_place_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_guide_place_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_guide_place_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_guide_place_promo_events ENABLE ROW LEVEL SECURITY;

-- photos
CREATE POLICY mkt_guide_photos_public_read ON public.mkt_guide_place_photos
  FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY mkt_guide_photos_own_read ON public.mkt_guide_place_photos
  FOR SELECT TO authenticated USING (uploaded_by = auth.uid());
CREATE POLICY mkt_guide_photos_staff_read ON public.mkt_guide_place_photos
  FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_guide_place_is_owner(place_id));
CREATE POLICY mkt_guide_photos_insert ON public.mkt_guide_place_photos
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY mkt_guide_photos_staff_write ON public.mkt_guide_place_photos
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_guide_place_is_owner(place_id))
  WITH CHECK (public.mkt_is_platform_admin() OR public.mkt_guide_place_is_owner(place_id));
CREATE POLICY mkt_guide_photos_delete ON public.mkt_guide_place_photos
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.mkt_is_platform_admin()
    OR public.mkt_guide_place_is_owner(place_id)
  );

-- reviews
CREATE POLICY mkt_guide_reviews_public_read ON public.mkt_guide_place_reviews
  FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY mkt_guide_reviews_own_read ON public.mkt_guide_place_reviews
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY mkt_guide_reviews_staff_read ON public.mkt_guide_place_reviews
  FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_guide_place_is_owner(place_id));
CREATE POLICY mkt_guide_reviews_insert ON public.mkt_guide_place_reviews
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY mkt_guide_reviews_own_update ON public.mkt_guide_place_reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY mkt_guide_reviews_staff_write ON public.mkt_guide_place_reviews
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY mkt_guide_reviews_delete ON public.mkt_guide_place_reviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin());

-- claims
CREATE POLICY mkt_guide_claims_own_read ON public.mkt_guide_place_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin());
CREATE POLICY mkt_guide_claims_insert ON public.mkt_guide_place_claims
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY mkt_guide_claims_staff_write ON public.mkt_guide_place_claims
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY mkt_guide_claims_delete ON public.mkt_guide_place_claims
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending') OR public.mkt_is_platform_admin()
  );

-- promotions: readable by everyone (the featured slot is public), written only
-- through the definer promote function below.
CREATE POLICY mkt_guide_promotions_public_read ON public.mkt_guide_place_promotions
  FOR SELECT TO anon, authenticated USING (true);

-- promo events: no direct client access at all; counted through a definer fn.
CREATE POLICY mkt_guide_promo_events_staff_read ON public.mkt_guide_place_promo_events
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- ── review decisions (admin) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_guide_review_photo(
  _photo_id uuid,
  _approve boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mkt_guide_place_photos;
  v_name text;
BEGIN
  SELECT * INTO v_row FROM public.mkt_guide_place_photos WHERE id = _photo_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'PHOTO_NOT_FOUND';
  END IF;
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_guide_place_is_owner(v_row.place_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.mkt_guide_place_photos
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         reject_reason = CASE WHEN _approve THEN NULL ELSE _reason END
   WHERE id = _photo_id;

  SELECT name_ar INTO v_name FROM public.mkt_guide_places WHERE id = v_row.place_id;
  PERFORM public.mkt_notify(
    v_row.uploaded_by,
    NULL,
    CASE WHEN _approve THEN 'guide_photo_approved' ELSE 'guide_photo_rejected' END,
    CASE WHEN _approve THEN 'تم اعتماد صورتك' ELSE 'لم تُعتمد صورتك' END,
    COALESCE(v_name, 'جهة في الدليل')
      || CASE WHEN _approve THEN ' — صورتك ظاهرة الآن.'
              ELSE ' — السبب: ' || COALESCE(_reason, 'لا يتوافق مع الشروط') END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_review_photo(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_review_photo(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_guide_review_review(
  _review_id uuid,
  _approve boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mkt_guide_place_reviews;
  v_name text;
BEGIN
  SELECT * INTO v_row FROM public.mkt_guide_place_reviews WHERE id = _review_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.mkt_guide_place_reviews
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         reject_reason = CASE WHEN _approve THEN NULL ELSE _reason END
   WHERE id = _review_id;

  SELECT name_ar INTO v_name FROM public.mkt_guide_places WHERE id = v_row.place_id;
  PERFORM public.mkt_notify(
    v_row.user_id,
    NULL,
    CASE WHEN _approve THEN 'guide_review_approved' ELSE 'guide_review_rejected' END,
    CASE WHEN _approve THEN 'تم اعتماد تقييمك' ELSE 'لم يُعتمد تقييمك' END,
    COALESCE(v_name, 'جهة في الدليل')
      || CASE WHEN _approve THEN ' — تقييمك ظاهر الآن.'
              ELSE ' — السبب: ' || COALESCE(_reason, 'لا يتوافق مع الشروط') END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_review_review(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_review_review(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_guide_review_claim(
  _claim_id uuid,
  _approve boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mkt_guide_place_claims;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_row FROM public.mkt_guide_place_claims WHERE id = _claim_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CLAIM_NOT_FOUND';
  END IF;

  UPDATE public.mkt_guide_place_claims
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         reject_reason = CASE WHEN _approve THEN NULL ELSE _reason END
   WHERE id = _claim_id;

  PERFORM public.mkt_notify(
    v_row.user_id,
    NULL,
    CASE WHEN _approve THEN 'guide_claim_approved' ELSE 'guide_claim_rejected' END,
    CASE WHEN _approve THEN 'تم اعتماد مطالبتك بالجهة' ELSE 'لم تُعتمد مطالبتك بالجهة' END,
    CASE WHEN _approve THEN 'يمكنك الآن إدارة صور الجهة وبياناتها المسموحة.'
         ELSE 'السبب: ' || COALESCE(_reason, 'لم تكفِ الإثباتات') END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_review_claim(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_review_claim(uuid, boolean, text) TO authenticated, service_role;

-- ── promotion: spends ad credit, never written from the browser ──
CREATE OR REPLACE FUNCTION public.mkt_guide_promote_place(
  _place_id uuid,
  _days integer DEFAULT 7,
  _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF _days IS NULL OR _days < 1 OR _days > 30 THEN
    RAISE EXCEPTION 'INVALID_DAYS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_guide_places WHERE id = _place_id AND is_published = true
  ) THEN
    RAISE EXCEPTION 'PLACE_NOT_FOUND';
  END IF;

  -- 10 credits per day; the wallet function enforces the balance.
  v_credits := _days * 10;
  PERFORM public.mkt_ad_credit_consume(v_credits, 'guide_place', _place_id, _tenant_id);

  INSERT INTO public.mkt_guide_place_promotions
    (place_id, owner_user_id, credits_spent, days, starts_at, ends_at)
  VALUES (_place_id, auth.uid(), v_credits, _days, now(), now() + (_days || ' days')::interval)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_promote_place(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_promote_place(uuid, integer, uuid) TO authenticated, service_role;

-- Featured slot reads: active promotions joined with their place, public.
CREATE OR REPLACE FUNCTION public.mkt_guide_featured_places(_limit integer DEFAULT 6)
RETURNS TABLE (
  promotion_id uuid,
  place_id uuid,
  slug text,
  name_ar text,
  name_en text,
  sector text,
  category text,
  city text,
  governorate text,
  rating numeric,
  rating_total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, g.id, g.slug, g.name_ar, g.name_en, g.sector, g.category, g.city, g.governorate,
         (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.mkt_guide_place_reviews r
           WHERE r.place_id = g.id AND r.status = 'approved'),
         (SELECT COUNT(*)::int FROM public.mkt_guide_place_reviews r
           WHERE r.place_id = g.id AND r.status = 'approved')
  FROM public.mkt_guide_place_promotions p
  JOIN public.mkt_guide_places g ON g.id = p.place_id AND g.is_published = true
  WHERE p.status = 'active' AND p.ends_at > now()
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 6), 1), 12)
$$;

GRANT EXECUTE ON FUNCTION public.mkt_guide_featured_places(integer) TO anon, authenticated, service_role;

-- Impression / click tracking without exposing the events table.
CREATE OR REPLACE FUNCTION public.mkt_guide_promo_track(
  _promotion_id uuid,
  _kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place uuid;
BEGIN
  IF _kind NOT IN ('view','click') THEN
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;
  SELECT place_id INTO v_place FROM public.mkt_guide_place_promotions
   WHERE id = _promotion_id AND status = 'active' AND ends_at > now();
  IF v_place IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.mkt_guide_place_promo_events (promotion_id, place_id, kind, user_id)
  VALUES (_promotion_id, v_place, _kind, auth.uid());

  UPDATE public.mkt_guide_place_promotions
     SET impressions = impressions + CASE WHEN _kind = 'view' THEN 1 ELSE 0 END,
         clicks = clicks + CASE WHEN _kind = 'click' THEN 1 ELSE 0 END
   WHERE id = _promotion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_promo_track(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_guide_promo_track(uuid, text) TO anon, authenticated, service_role;