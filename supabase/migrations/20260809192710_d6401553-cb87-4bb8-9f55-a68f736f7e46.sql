-- ═══════════════════════════════════════════════════════════════════════
-- «جيب لي» — Errand / fetch-me service (Kaheel captains)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) service catalog ────────────────────────────────────────────────
CREATE TABLE public.mkt_errand_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'fetch' CHECK (kind IN ('fetch','send','buy','gas','moving','custom')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  tagline_ar text NOT NULL DEFAULT '',
  tagline_en text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'package',
  needs_pickup boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_errand_services TO anon, authenticated;
GRANT ALL ON public.mkt_errand_services TO service_role;
ALTER TABLE public.mkt_errand_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "errand services are public"
  ON public.mkt_errand_services FOR SELECT USING (true);
CREATE POLICY "admins manage errand services"
  ON public.mkt_errand_services FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

INSERT INTO public.mkt_errand_services
  (slug, kind, name_ar, name_en, tagline_ar, tagline_en, icon, needs_pickup, is_active, sort_order)
VALUES
  ('fetch-me','fetch','جيب لي','Fetch me',
   'اطلب أي شي من أي مكان ومنجيبولك','Order anything from anywhere — we bring it to you',
   'shopping-bag', false, true, 1),
  ('send-anything','send','أرسل أي شي','Send anything',
   'استلام من مكان وتوصيله لمكان تاني','Pick up from one place, deliver to another',
   'send', true, true, 2),
  ('buy-anything','buy','اطلب أي شي','Buy anything',
   'الكابتن يشتري ويوصّل لعندك','The captain buys it and delivers it to you',
   'shopping-cart', false, true, 3),
  ('gas-delivery','gas','توصيل غاز','Gas delivery',
   'جرة غاز لعند باب البيت','A gas cylinder to your door',
   'flame', false, false, 4),
  ('furniture-moving','moving','نقل عفش','Furniture moving',
   'نقل أثاث بسيارة مناسبة','Move furniture with the right vehicle',
   'truck', true, false, 5);

-- ── 2) captains ───────────────────────────────────────────────────────
CREATE TABLE public.mkt_errand_captains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  vehicle text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  is_online boolean NOT NULL DEFAULT false,
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  jobs_done integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mkt_errand_captains TO authenticated;
GRANT ALL ON public.mkt_errand_captains TO service_role;
ALTER TABLE public.mkt_errand_captains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "captains read own row"
  ON public.mkt_errand_captains FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin());
CREATE POLICY "captains apply for themselves"
  ON public.mkt_errand_captains FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "captains update own row"
  ON public.mkt_errand_captains FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR public.mkt_is_platform_admin());

-- status is not self-serve: only admins may move it.
CREATE OR REPLACE FUNCTION public.mkt_errand_captain_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.mkt_is_platform_admin() THEN
    NEW.status := OLD.status;
  END IF;
  IF (NEW.rating_avg, NEW.rating_count, NEW.jobs_done)
     IS DISTINCT FROM (OLD.rating_avg, OLD.rating_count, OLD.jobs_done)
     AND NOT public.mkt_is_platform_admin() THEN
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.jobs_done := OLD.jobs_done;
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_errand_captain_guard
  BEFORE UPDATE ON public.mkt_errand_captains
  FOR EACH ROW EXECUTE FUNCTION public.mkt_errand_captain_guard();

-- security-definer probe: avoids recursive policy reads on the captains table
CREATE OR REPLACE FUNCTION public.mkt_is_errand_captain()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_errand_captains
    WHERE user_id = auth.uid() AND status = 'approved'
  );
$$;

-- ── 3) requests ───────────────────────────────────────────────────────
CREATE TABLE public.mkt_errand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  service_slug text NOT NULL REFERENCES public.mkt_errand_services(slug),
  details text NOT NULL,
  photo_path text,
  budget_estimate numeric(12,2),
  currency text NOT NULL DEFAULT 'SAR',
  city_id uuid REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  pickup_label text,
  pickup_details text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_label text NOT NULL,
  dropoff_details text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','offered','accepted','purchasing','delivering','delivered','cancelled','expired')),
  captain_id uuid REFERENCES public.mkt_errand_captains(id) ON DELETE SET NULL,
  accepted_offer_id uuid,
  delivery_fee numeric(12,2),
  offers_count integer NOT NULL DEFAULT 0,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  rating_comment text,
  cancel_reason text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_errand_requests_open_idx
  ON public.mkt_errand_requests (status, created_at DESC);
CREATE INDEX mkt_errand_requests_owner_idx
  ON public.mkt_errand_requests (user_id, created_at DESC);
CREATE INDEX mkt_errand_requests_captain_idx
  ON public.mkt_errand_requests (captain_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mkt_errand_requests TO authenticated;
GRANT ALL ON public.mkt_errand_requests TO service_role;
ALTER TABLE public.mkt_errand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own errands"
  ON public.mkt_errand_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin());

CREATE POLICY "captains read open and assigned errands"
  ON public.mkt_errand_requests FOR SELECT TO authenticated
  USING (
    public.mkt_is_errand_captain()
    AND (
      status IN ('open','offered')
      OR captain_id IN (
        SELECT id FROM public.mkt_errand_captains WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "owners create own errands"
  ON public.mkt_errand_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open' AND captain_id IS NULL);

CREATE POLICY "owners edit own open errands"
  ON public.mkt_errand_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR public.mkt_is_platform_admin());

-- The lifecycle columns move only through the secured functions below.
CREATE OR REPLACE FUNCTION public.mkt_errand_request_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.captain_id := OLD.captain_id;
    NEW.accepted_offer_id := OLD.accepted_offer_id;
    NEW.delivery_fee := OLD.delivery_fee;
    NEW.offers_count := OLD.offers_count;
    NEW.rating := OLD.rating;
    NEW.rating_comment := OLD.rating_comment;
    NEW.accepted_at := OLD.accepted_at;
    NEW.delivered_at := OLD.delivered_at;
    IF OLD.status <> 'open' THEN
      NEW.details := OLD.details;
      NEW.photo_path := OLD.photo_path;
      NEW.pickup_label := OLD.pickup_label;
      NEW.dropoff_label := OLD.dropoff_label;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_errand_request_guard
  BEFORE UPDATE ON public.mkt_errand_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_errand_request_guard();

-- ── 4) offers ─────────────────────────────────────────────────────────
CREATE TABLE public.mkt_errand_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mkt_errand_requests(id) ON DELETE CASCADE,
  captain_id uuid NOT NULL REFERENCES public.mkt_errand_captains(id) ON DELETE CASCADE,
  fee numeric(12,2) NOT NULL CHECK (fee >= 0),
  eta_minutes integer CHECK (eta_minutes BETWEEN 1 AND 600),
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, captain_id)
);

CREATE INDEX mkt_errand_offers_request_idx ON public.mkt_errand_offers (request_id, created_at DESC);

GRANT SELECT ON public.mkt_errand_offers TO authenticated;
GRANT ALL ON public.mkt_errand_offers TO service_role;
ALTER TABLE public.mkt_errand_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer parties read offers"
  ON public.mkt_errand_offers FOR SELECT TO authenticated
  USING (
    public.mkt_is_platform_admin()
    OR captain_id IN (SELECT id FROM public.mkt_errand_captains WHERE user_id = auth.uid())
    OR request_id IN (SELECT id FROM public.mkt_errand_requests WHERE user_id = auth.uid())
  );

ALTER TABLE public.mkt_errand_requests
  ADD CONSTRAINT mkt_errand_requests_accepted_offer_fkey
  FOREIGN KEY (accepted_offer_id) REFERENCES public.mkt_errand_offers(id) ON DELETE SET NULL;

-- ── 5) status events ──────────────────────────────────────────────────
CREATE TABLE public.mkt_errand_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mkt_errand_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  from_status text,
  to_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_errand_events_request_idx ON public.mkt_errand_events (request_id, created_at);

GRANT SELECT ON public.mkt_errand_events TO authenticated;
GRANT ALL ON public.mkt_errand_events TO service_role;
ALTER TABLE public.mkt_errand_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "errand parties read events"
  ON public.mkt_errand_events FOR SELECT TO authenticated
  USING (
    public.mkt_is_platform_admin()
    OR request_id IN (SELECT id FROM public.mkt_errand_requests WHERE user_id = auth.uid())
    OR request_id IN (
      SELECT r.id FROM public.mkt_errand_requests r
      JOIN public.mkt_errand_captains c ON c.id = r.captain_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ── 6) secured lifecycle operations ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_errand_place_offer(
  _request_id uuid,
  _fee numeric,
  _eta_minutes integer DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _captain uuid;
  _status text;
  _offer uuid;
BEGIN
  SELECT id INTO _captain FROM public.mkt_errand_captains
   WHERE user_id = auth.uid() AND status = 'approved';
  IF _captain IS NULL THEN RAISE EXCEPTION 'NOT_A_CAPTAIN'; END IF;
  IF _fee IS NULL OR _fee < 0 THEN RAISE EXCEPTION 'BAD_FEE'; END IF;

  SELECT status INTO _status FROM public.mkt_errand_requests WHERE id = _request_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _status NOT IN ('open','offered') THEN RAISE EXCEPTION 'NOT_OPEN'; END IF;

  INSERT INTO public.mkt_errand_offers (request_id, captain_id, fee, eta_minutes, note)
  VALUES (_request_id, _captain, _fee, _eta_minutes, left(coalesce(_note,''), 300))
  ON CONFLICT (request_id, captain_id) DO UPDATE
    SET fee = excluded.fee, eta_minutes = excluded.eta_minutes,
        note = excluded.note, status = 'pending', updated_at = now()
  RETURNING id INTO _offer;

  UPDATE public.mkt_errand_requests
     SET status = 'offered',
         offers_count = (SELECT count(*) FROM public.mkt_errand_offers
                          WHERE request_id = _request_id AND status = 'pending'),
         updated_at = now()
   WHERE id = _request_id;

  INSERT INTO public.mkt_errand_events (request_id, actor_id, from_status, to_status, note)
  VALUES (_request_id, auth.uid(), _status, 'offered', 'offer');

  RETURN _offer;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_place_offer(uuid, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_errand_place_offer(uuid, numeric, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_errand_decide_offer(_offer_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request uuid;
  _captain uuid;
  _fee numeric;
  _owner uuid;
  _status text;
BEGIN
  SELECT o.request_id, o.captain_id, o.fee, r.user_id, r.status
    INTO _request, _captain, _fee, _owner, _status
    FROM public.mkt_errand_offers o
    JOIN public.mkt_errand_requests r ON r.id = o.request_id
   WHERE o.id = _offer_id FOR UPDATE OF o;
  IF _request IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _owner <> auth.uid() AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _status NOT IN ('open','offered') THEN RAISE EXCEPTION 'NOT_OPEN'; END IF;

  IF NOT _accept THEN
    UPDATE public.mkt_errand_offers SET status = 'rejected', updated_at = now() WHERE id = _offer_id;
    UPDATE public.mkt_errand_requests
       SET offers_count = (SELECT count(*) FROM public.mkt_errand_offers
                            WHERE request_id = _request AND status = 'pending'),
           status = CASE WHEN EXISTS (SELECT 1 FROM public.mkt_errand_offers
                                       WHERE request_id = _request AND status = 'pending')
                         THEN 'offered' ELSE 'open' END,
           updated_at = now()
     WHERE id = _request;
    INSERT INTO public.mkt_errand_events (request_id, actor_id, from_status, to_status, note)
    VALUES (_request, auth.uid(), _status, _status, 'offer_rejected');
    RETURN;
  END IF;

  UPDATE public.mkt_errand_offers SET status = 'accepted', updated_at = now() WHERE id = _offer_id;
  UPDATE public.mkt_errand_offers SET status = 'rejected', updated_at = now()
   WHERE request_id = _request AND id <> _offer_id AND status = 'pending';
  UPDATE public.mkt_errand_requests
     SET status = 'accepted', captain_id = _captain, accepted_offer_id = _offer_id,
         delivery_fee = _fee, accepted_at = now(), offers_count = 0, updated_at = now()
   WHERE id = _request;
  INSERT INTO public.mkt_errand_events (request_id, actor_id, from_status, to_status, note)
  VALUES (_request, auth.uid(), _status, 'accepted', 'offer_accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_decide_offer(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_errand_decide_offer(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_errand_advance(_request_id uuid, _to_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _captain_user uuid;
  _captain uuid;
BEGIN
  SELECT r.status, c.user_id, c.id INTO _status, _captain_user, _captain
    FROM public.mkt_errand_requests r
    LEFT JOIN public.mkt_errand_captains c ON c.id = r.captain_id
   WHERE r.id = _request_id FOR UPDATE OF r;
  IF _status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _captain_user IS DISTINCT FROM auth.uid() AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT (
       (_status = 'accepted'   AND _to_status = 'purchasing')
    OR (_status IN ('accepted','purchasing') AND _to_status = 'delivering')
    OR (_status = 'delivering' AND _to_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'BAD_TRANSITION';
  END IF;

  UPDATE public.mkt_errand_requests
     SET status = _to_status,
         delivered_at = CASE WHEN _to_status = 'delivered' THEN now() ELSE delivered_at END,
         updated_at = now()
   WHERE id = _request_id;

  IF _to_status = 'delivered' AND _captain IS NOT NULL THEN
    UPDATE public.mkt_errand_captains SET jobs_done = jobs_done + 1, updated_at = now()
     WHERE id = _captain;
  END IF;

  INSERT INTO public.mkt_errand_events (request_id, actor_id, from_status, to_status)
  VALUES (_request_id, auth.uid(), _status, _to_status);
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_advance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_errand_advance(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_errand_cancel(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _owner uuid;
BEGIN
  SELECT status, user_id INTO _status, _owner
    FROM public.mkt_errand_requests WHERE id = _request_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _owner <> auth.uid() AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'BAD_TRANSITION'; END IF;

  UPDATE public.mkt_errand_offers SET status = 'withdrawn', updated_at = now()
   WHERE request_id = _request_id AND status = 'pending';
  UPDATE public.mkt_errand_requests
     SET status = 'cancelled', cancel_reason = left(coalesce(_reason,''), 300),
         offers_count = 0, updated_at = now()
   WHERE id = _request_id;
  INSERT INTO public.mkt_errand_events (request_id, actor_id, from_status, to_status, note)
  VALUES (_request_id, auth.uid(), _status, 'cancelled', left(coalesce(_reason,''), 300));
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_cancel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_errand_cancel(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_errand_rate(
  _request_id uuid, _rating integer, _comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _owner uuid;
  _captain uuid;
  _existing integer;
BEGIN
  SELECT status, user_id, captain_id, rating INTO _status, _owner, _captain, _existing
    FROM public.mkt_errand_requests WHERE id = _request_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _owner <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status <> 'delivered' THEN RAISE EXCEPTION 'NOT_DELIVERED'; END IF;
  IF _existing IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_RATED'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'BAD_RATING'; END IF;

  UPDATE public.mkt_errand_requests
     SET rating = _rating, rating_comment = left(coalesce(_comment,''), 300), updated_at = now()
   WHERE id = _request_id;

  IF _captain IS NOT NULL THEN
    UPDATE public.mkt_errand_captains
       SET rating_count = rating_count + 1,
           rating_avg = round(((rating_avg * rating_count) + _rating)::numeric / (rating_count + 1), 2),
           updated_at = now()
     WHERE id = _captain;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_errand_rate(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_errand_rate(uuid, integer, text) TO authenticated;

-- keep updated_at fresh on the catalog too
CREATE OR REPLACE FUNCTION public.mkt_errand_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER mkt_errand_services_touch
  BEFORE UPDATE ON public.mkt_errand_services
  FOR EACH ROW EXECUTE FUNCTION public.mkt_errand_touch();
CREATE TRIGGER mkt_errand_offers_touch
  BEFORE UPDATE ON public.mkt_errand_offers
  FOR EACH ROW EXECUTE FUNCTION public.mkt_errand_touch();
