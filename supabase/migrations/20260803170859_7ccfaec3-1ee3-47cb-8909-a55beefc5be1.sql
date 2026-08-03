-- 1) columns
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS duration_days smallint NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_notice_stage smallint NOT NULL DEFAULT 0;

ALTER TABLE public.mkt_listings DROP CONSTRAINT IF EXISTS mkt_listings_duration_days_check;
ALTER TABLE public.mkt_listings
  ADD CONSTRAINT mkt_listings_duration_days_check CHECK (duration_days = ANY (ARRAY[1,3,7,14,30]));

ALTER TABLE public.mkt_listings DROP CONSTRAINT IF EXISTS mkt_listings_status_check;
ALTER TABLE public.mkt_listings
  ADD CONSTRAINT mkt_listings_status_check CHECK (status = ANY (ARRAY[
    'draft','pending','published','rejected','suspended','paused','hidden','expired','archived','deleted']));

-- 2) operations log
CREATE TABLE IF NOT EXISTS public.mkt_listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_listing_events_listing_idx
  ON public.mkt_listing_events (listing_id, created_at DESC);

GRANT SELECT ON public.mkt_listing_events TO authenticated;
GRANT ALL ON public.mkt_listing_events TO service_role;
ALTER TABLE public.mkt_listing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_listing_events_read ON public.mkt_listing_events;
CREATE POLICY mkt_listing_events_read ON public.mkt_listing_events
  FOR SELECT TO authenticated
  USING (public.mkt_can_manage_listing(listing_id));

-- 3) column-level write protection on mkt_listings
REVOKE UPDATE ON public.mkt_listings FROM authenticated;
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mkt_listings'
      AND column_name NOT IN (
        'id','owner_user_id','tenant_id','advertiser_type','slug','status',
        'expires_at','published_at','views_count','shares_count',
        'contact_requests_count','deleted_at','paused_at','last_renewed_at',
        'expiry_notice_stage','created_at','latitude_public','longitude_public')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.mkt_listings TO authenticated', c.column_name);
  END LOOP;
END $$;

-- 4) helpers
CREATE OR REPLACE FUNCTION public.mkt_log_listing_event(
  _listing_id uuid, _event_type text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.mkt_listing_events (listing_id, actor_id, event_type, meta)
  VALUES (_listing_id, auth.uid(), _event_type, coalesce(_meta, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.mkt_log_listing_event(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mkt_set_listing_status(
  _listing_id uuid, _to text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from text;
BEGIN
  SELECT status INTO _from FROM public.mkt_listings WHERE id = _listing_id;
  UPDATE public.mkt_listings SET status = _to, updated_at = now() WHERE id = _listing_id;
  INSERT INTO public.mkt_listing_status_history (listing_id, actor_id, from_status, to_status, reason)
  VALUES (_listing_id, auth.uid(), _from, _to, _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_set_listing_status(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- 5) owner operations
CREATE OR REPLACE FUNCTION public.mkt_listing_submit(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text; _dur smallint;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status, duration_days INTO _st, _dur FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st NOT IN ('draft','rejected','expired','archived') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM public.mkt_set_listing_status(_id, 'pending', NULL);
  UPDATE public.mkt_listings
     SET rejection_reason = NULL, expiry_notice_stage = 0
   WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'submitted', jsonb_build_object('duration_days', _dur));
  RETURN 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_pause(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO _st FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st <> 'published' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM public.mkt_set_listing_status(_id, 'paused', NULL);
  UPDATE public.mkt_listings SET paused_at = now() WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'paused', '{}'::jsonb);
  RETURN 'paused';
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_resume(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text; _paused timestamptz; _exp timestamptz; _next text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status, paused_at, expires_at INTO _st, _paused, _exp
    FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st <> 'paused' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  -- the time spent paused is given back so pausing never costs the advertiser
  IF _exp IS NOT NULL AND _paused IS NOT NULL THEN
    _exp := _exp + (now() - _paused);
  END IF;
  _next := CASE WHEN _exp IS NOT NULL AND _exp <= now() THEN 'expired' ELSE 'published' END;
  PERFORM public.mkt_set_listing_status(_id, _next, NULL);
  UPDATE public.mkt_listings SET paused_at = NULL, expires_at = _exp WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'resumed', jsonb_build_object('expires_at', _exp));
  RETURN _next;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_renew(_id uuid, _days integer DEFAULT 30)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text; _published timestamptz; _next text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _days IS NULL OR _days NOT IN (1,3,7,14,30) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  SELECT status, published_at INTO _st, _published
    FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st NOT IN ('published','paused','expired') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  -- an ad that was never approved cannot become live through a renewal
  _next := CASE WHEN _published IS NULL THEN 'pending' ELSE 'published' END;
  PERFORM public.mkt_set_listing_status(_id, _next, NULL);
  UPDATE public.mkt_listings
     SET duration_days = _days::smallint,
         expires_at = CASE WHEN _next = 'published' THEN now() + make_interval(days => _days) ELSE expires_at END,
         last_renewed_at = now(),
         paused_at = NULL,
         expiry_notice_stage = 0
   WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'renewed', jsonb_build_object('duration_days', _days));
  RETURN _next;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_archive(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO _st FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st IN ('suspended','archived') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM public.mkt_set_listing_status(_id, 'archived', NULL);
  UPDATE public.mkt_listings SET paused_at = NULL WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'archived', '{}'::jsonb);
  RETURN 'archived';
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_restore(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO _st FROM public.mkt_listings WHERE id = _id;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st <> 'archived' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM public.mkt_set_listing_status(_id, 'draft', NULL);
  UPDATE public.mkt_listings SET deleted_at = NULL WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'restored', '{}'::jsonb);
  RETURN 'draft';
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_delete(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO _st FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st = 'suspended' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM public.mkt_set_listing_status(_id, 'deleted', NULL);
  UPDATE public.mkt_listings SET deleted_at = now(), paused_at = NULL WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'deleted', '{}'::jsonb);
  RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_duplicate(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.mkt_listings (
    owner_user_id, tenant_id, advertiser_type, type_code, category_id, subcategory_id,
    title, summary, description, specs, price, price_on_request, price_unit, currency,
    quantity, unit, item_condition, deal_kind, city, region, country_id, city_id,
    district, address_text, latitude, longitude, location_accuracy, location_source,
    location_visibility, cover_image_url, duration_days, status)
  SELECT owner_user_id, tenant_id, advertiser_type, type_code, category_id, subcategory_id,
    left(title || ' (نسخة)', 120), summary, description, specs, price, price_on_request, price_unit, currency,
    quantity, unit, item_condition, deal_kind, city, region, country_id, city_id,
    district, address_text, latitude, longitude, location_accuracy, location_source,
    location_visibility, cover_image_url, duration_days, 'draft'
  FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL
  RETURNING id INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO public.mkt_listing_images (listing_id, storage_path, sort_order)
  SELECT _new, storage_path, sort_order FROM public.mkt_listing_images WHERE listing_id = _id;

  PERFORM public.mkt_log_listing_event(_new, 'duplicated_from', jsonb_build_object('source_id', _id));
  PERFORM public.mkt_log_listing_event(_id, 'duplicated_to', jsonb_build_object('new_id', _new));
  RETURN _new;
END $$;

-- shares counter: published ads only, callable by visitors
CREATE OR REPLACE FUNCTION public.mkt_listing_track_share(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.mkt_listings SET shares_count = shares_count + 1
   WHERE id = _id AND public.mkt_listing_is_public(_id);
$$;

-- 6) expiry sweep + pre-expiry notices
CREATE OR REPLACE FUNCTION public.mkt_sweep_expired_listings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _expired integer := 0; _notified integer := 0; r record; _stage smallint;
BEGIN
  WITH done AS (
    UPDATE public.mkt_listings
       SET status = 'expired', updated_at = now()
     WHERE status = 'published' AND deleted_at IS NULL
       AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING id, owner_user_id, title
  )
  SELECT count(*) INTO _expired FROM done;

  INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason)
  SELECT id, 'published', 'expired', 'auto_expiry' FROM public.mkt_listings
   WHERE status = 'expired' AND expires_at IS NOT NULL AND expires_at <= now()
     AND NOT EXISTS (
       SELECT 1 FROM public.mkt_listing_status_history h
        WHERE h.listing_id = mkt_listings.id AND h.to_status = 'expired'
          AND h.created_at > now() - interval '1 day');

  FOR r IN
    SELECT id, owner_user_id, title, duration_days, expires_at, expiry_notice_stage
      FROM public.mkt_listings
     WHERE status = 'published' AND deleted_at IS NULL AND expires_at IS NOT NULL
       AND expires_at > now()
  LOOP
    _stage := CASE
      WHEN r.duration_days = 1 AND r.expires_at - now() <= interval '6 hours' THEN 1
      WHEN r.duration_days = 3 AND r.expires_at - now() <= interval '24 hours' THEN 1
      WHEN r.duration_days = 7 AND r.expires_at - now() <= interval '2 days' THEN 1
      WHEN r.duration_days = 14 AND r.expires_at - now() <= interval '3 days' THEN 1
      WHEN r.duration_days = 30 AND r.expires_at - now() <= interval '24 hours' THEN 3
      WHEN r.duration_days = 30 AND r.expires_at - now() <= interval '3 days' THEN 2
      WHEN r.duration_days = 30 AND r.expires_at - now() <= interval '7 days' THEN 1
      ELSE 0 END;
    IF _stage > r.expiry_notice_stage THEN
      PERFORM public.mkt_notify(
        r.owner_user_id, 'listing_expiring', r.title, r.id::text,
        jsonb_build_object('expires_at', r.expires_at, 'stage', _stage));
      UPDATE public.mkt_listings SET expiry_notice_stage = _stage WHERE id = r.id;
      _notified := _notified + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', _expired, 'notified', _notified);
END $$;
REVOKE ALL ON FUNCTION public.mkt_sweep_expired_listings() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.mkt_listing_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_pause(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_resume(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_renew(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_archive(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_restore(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_delete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_duplicate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_pause(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_renew(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_restore(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_duplicate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_track_share(uuid) TO anon, authenticated;