-- maintenance context: bypasses per-user publishing guards during backfills
SELECT set_config('mkt.system_action', 'license_expiry', false);

-- 0) internal maintenance writes must not re-run advertiser-facing validators
CREATE OR REPLACE FUNCTION public.mkt_listing_require_business_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NOT NULL
     AND NEW.status IN ('pending','published')
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_is_system_action()
     AND NOT public.mkt_business_details_complete(NEW.tenant_id) THEN
    RAISE EXCEPTION 'BUSINESS_DETAILS_INCOMPLETE';
  END IF;
  RETURN NEW;
END;
$function$;

-- 1) counters + keywords + featured scaffolding ------------------------------
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS favorites_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_requests_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reports_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_copies_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_opens_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_link_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ratings_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ratings_avg numeric(3,2),
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_from timestamptz,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS featured_package text,
  ADD COLUMN IF NOT EXISTS guaranteed_impressions integer,
  ADD COLUMN IF NOT EXISTS display_priority smallint NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS public.mkt_listing_ref_seq START WITH 100000;
ALTER TABLE public.mkt_listings ADD COLUMN IF NOT EXISTS ref_no bigint;

ALTER TABLE public.mkt_listings DISABLE TRIGGER USER;
UPDATE public.mkt_listings SET ref_no = nextval('public.mkt_listing_ref_seq') WHERE ref_no IS NULL;
ALTER TABLE public.mkt_listings ENABLE TRIGGER USER;

ALTER TABLE public.mkt_listings
  ALTER COLUMN ref_no SET DEFAULT nextval('public.mkt_listing_ref_seq'),
  ALTER COLUMN ref_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_listings_ref_no_key ON public.mkt_listings (ref_no);

-- 2) new explicit status: needs_changes -------------------------------------
ALTER TABLE public.mkt_listings DROP CONSTRAINT IF EXISTS mkt_listings_status_check;
ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_status_check
  CHECK (status = ANY (ARRAY['draft','pending','needs_changes','published','rejected',
                             'suspended','paused','hidden','expired','archived','deleted']));

CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.mkt_slugify(NEW.title);
    IF base IS NULL OR base = '' THEN base := 'ad'; END IF;
    candidate := base || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    WHILE EXISTS (SELECT 1 FROM public.mkt_listings l WHERE l.slug = candidate AND l.id <> NEW.id) LOOP
      n := n + 1; candidate := base || '-' || n::text || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    END LOOP;
    NEW.slug := candidate;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('published','rejected','suspended','needs_changes')
       AND NOT public.mkt_is_platform_admin()
       AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action())
       AND NOT (NEW.status = 'published' AND public.mkt_is_listing_op() AND OLD.published_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Only platform reviewers can set status %', NEW.status;
    END IF;
    IF NEW.status = 'rejected' AND coalesce(btrim(NEW.rejection_reason),'') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
      NEW.published_at := coalesce(OLD.published_at, now());
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 3) only reviewers/lifecycle RPCs may touch counters and paid scaffolding ---
CREATE OR REPLACE FUNCTION public.mkt_guard_listing_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.mkt_is_platform_admin() OR public.mkt_is_listing_op() OR public.mkt_is_system_action() THEN
    RETURN NEW;
  END IF;
  NEW.is_featured := OLD.is_featured;
  NEW.featured_from := OLD.featured_from;
  NEW.featured_until := OLD.featured_until;
  NEW.featured_package := OLD.featured_package;
  NEW.guaranteed_impressions := OLD.guaranteed_impressions;
  NEW.display_priority := OLD.display_priority;
  NEW.ref_no := OLD.ref_no;
  NEW.favorites_count := OLD.favorites_count;
  NEW.quote_requests_count := OLD.quote_requests_count;
  NEW.reports_count := OLD.reports_count;
  NEW.link_copies_count := OLD.link_copies_count;
  NEW.qr_opens_count := OLD.qr_opens_count;
  NEW.share_link_count := OLD.share_link_count;
  NEW.ratings_count := OLD.ratings_count;
  NEW.ratings_avg := OLD.ratings_avg;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS zz_mkt_listings_guard_promotion ON public.mkt_listings;
CREATE TRIGGER zz_mkt_listings_guard_promotion
  BEFORE UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_listing_promotion();

-- 4) derived counters --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_sync_favorites_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid := coalesce(NEW.listing_id, OLD.listing_id);
BEGIN
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  UPDATE public.mkt_listings l
     SET favorites_count = (SELECT count(*) FROM public.mkt_favorites f WHERE f.listing_id = _id)
   WHERE l.id = _id;
  PERFORM set_config('mkt.system_action', '', true);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS mkt_favorites_count ON public.mkt_favorites;
CREATE TRIGGER mkt_favorites_count
  AFTER INSERT OR DELETE ON public.mkt_favorites
  FOR EACH ROW EXECUTE FUNCTION public.mkt_sync_favorites_count();

CREATE OR REPLACE FUNCTION public.mkt_sync_quote_requests_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid := coalesce(NEW.listing_id, OLD.listing_id);
BEGIN
  IF _id IS NULL THEN RETURN NULL; END IF;
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  UPDATE public.mkt_listings l
     SET quote_requests_count = (SELECT count(*) FROM public.mkt_quote_requests q WHERE q.listing_id = _id)
   WHERE l.id = _id;
  PERFORM set_config('mkt.system_action', '', true);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS mkt_quote_requests_count ON public.mkt_quote_requests;
CREATE TRIGGER mkt_quote_requests_count
  AFTER INSERT OR DELETE ON public.mkt_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_sync_quote_requests_count();

CREATE OR REPLACE FUNCTION public.mkt_sync_reports_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid := coalesce(NEW.listing_id, OLD.listing_id);
BEGIN
  IF _id IS NULL THEN RETURN NULL; END IF;
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  UPDATE public.mkt_listings l
     SET reports_count = (SELECT count(*) FROM public.mkt_reports r WHERE r.listing_id = _id)
   WHERE l.id = _id;
  PERFORM set_config('mkt.system_action', '', true);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS mkt_reports_count ON public.mkt_reports;
CREATE TRIGGER mkt_reports_count
  AFTER INSERT OR DELETE ON public.mkt_reports
  FOR EACH ROW EXECUTE FUNCTION public.mkt_sync_reports_count();

ALTER TABLE public.mkt_listings DISABLE TRIGGER USER;
UPDATE public.mkt_listings l SET
  favorites_count = (SELECT count(*) FROM public.mkt_favorites f WHERE f.listing_id = l.id),
  quote_requests_count = (SELECT count(*) FROM public.mkt_quote_requests q WHERE q.listing_id = l.id),
  reports_count = (SELECT count(*) FROM public.mkt_reports r WHERE r.listing_id = l.id);
ALTER TABLE public.mkt_listings ENABLE TRIGGER USER;

-- 5) granular share tracking ------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_listing_track(_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _kind NOT IN ('share','link_copy','qr_open') THEN RETURN; END IF;
  IF NOT public.mkt_listing_is_public(_id) THEN RETURN; END IF;
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  UPDATE public.mkt_listings SET
    shares_count      = shares_count + 1,
    share_link_count  = share_link_count  + CASE WHEN _kind = 'share' THEN 1 ELSE 0 END,
    link_copies_count = link_copies_count + CASE WHEN _kind = 'link_copy' THEN 1 ELSE 0 END,
    qr_opens_count    = qr_opens_count    + CASE WHEN _kind = 'qr_open' THEN 1 ELSE 0 END
   WHERE id = _id;
  PERFORM set_config('mkt.system_action', '', true);
END $function$;

REVOKE ALL ON FUNCTION public.mkt_listing_track(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_listing_track(uuid, text) TO anon, authenticated;

-- 6) event log: capture client fingerprint, expose it to reviewers only ------
ALTER TABLE public.mkt_listing_events
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE OR REPLACE FUNCTION public.mkt_log_listing_event(_listing_id uuid, _event_type text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _h jsonb; _ip text; _ua text;
BEGIN
  BEGIN
    _h := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  EXCEPTION WHEN others THEN _h := '{}'::jsonb;
  END;
  _ip := coalesce(_h->>'cf-connecting-ip', split_part(coalesce(_h->>'x-forwarded-for',''), ',', 1));
  _ua := _h->>'user-agent';
  INSERT INTO public.mkt_listing_events (listing_id, actor_id, event_type, meta, ip_address, user_agent)
  VALUES (_listing_id, auth.uid(), _event_type, coalesce(_meta, '{}'::jsonb),
          nullif(btrim(coalesce(_ip,'')), ''), nullif(btrim(coalesce(_ua,'')), ''));
END $function$;

REVOKE SELECT ON public.mkt_listing_events FROM authenticated;
GRANT SELECT (id, listing_id, actor_id, event_type, meta, created_at)
  ON public.mkt_listing_events TO authenticated;
GRANT ALL ON public.mkt_listing_events TO service_role;

CREATE OR REPLACE FUNCTION public.mkt_listing_event_log(_listing_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  event_type text,
  actor_id uuid,
  meta jsonb,
  ip_address text,
  user_agent text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _admin boolean := public.mkt_is_platform_admin();
BEGIN
  IF NOT _admin AND NOT public.mkt_can_manage_listing(_listing_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT e.id, e.created_at, e.event_type, e.actor_id, e.meta,
           CASE WHEN _admin THEN e.ip_address END,
           CASE WHEN _admin THEN e.user_agent END
      FROM public.mkt_listing_events e
     WHERE e.listing_id = _listing_id
     ORDER BY e.created_at DESC
     LIMIT least(greatest(coalesce(_limit, 100), 1), 500);
END $function$;

REVOKE ALL ON FUNCTION public.mkt_listing_event_log(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_listing_event_log(uuid, integer) TO authenticated;

-- 7) reviewer operations: request changes, republish, extend -----------------
CREATE OR REPLACE FUNCTION public.mkt_review_listing(_listing_id uuid, _action text, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_status text;
  new_status text;
  _days smallint;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT status, COALESCE(duration_days, 30) INTO old_status, _days
    FROM public.mkt_listings WHERE id = _listing_id;
  IF old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  new_status := CASE _action
    WHEN 'approve' THEN 'published'
    WHEN 'republish' THEN 'published'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    WHEN 'needs_changes' THEN 'needs_changes'
    WHEN 'return' THEN 'draft'
    ELSE NULL END;

  IF new_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action NOT IN ('approve','republish') AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.mkt_listings
     SET status = new_status,
         rejection_reason = CASE WHEN _action IN ('approve','republish') THEN NULL ELSE _reason END,
         published_at = CASE WHEN new_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
         expires_at = CASE WHEN new_status = 'published'
                           THEN now() + make_interval(days => _days::int)
                           ELSE expires_at END,
         expiry_notice_stage = CASE WHEN new_status = 'published' THEN 0 ELSE expiry_notice_stage END,
         paused_at = CASE WHEN new_status = 'published' THEN NULL ELSE paused_at END,
         updated_at = now()
   WHERE id = _listing_id;

  INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
  VALUES (_listing_id, old_status, new_status, _reason, auth.uid());

  PERFORM public.mkt_log_listing_event(_listing_id, _action,
    jsonb_build_object('from', old_status, 'to', new_status));

  PERFORM public.log_audit('mkt_listing', _action, _listing_id,
    jsonb_build_object('status', old_status), jsonb_build_object('status', new_status), _reason);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_admin_listing_extend(_listing_id uuid, _days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _days IS NULL OR _days NOT IN (1,3,7,14,30) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  UPDATE public.mkt_listings
     SET expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => _days),
         expiry_notice_stage = 0,
         updated_at = now()
   WHERE id = _listing_id;
  PERFORM public.mkt_log_listing_event(_listing_id, 'extended', jsonb_build_object('days', _days));
END $function$;

REVOKE ALL ON FUNCTION public.mkt_admin_listing_extend(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_extend(uuid, integer) TO authenticated;

CREATE INDEX IF NOT EXISTS mkt_listings_keywords_idx ON public.mkt_listings USING gin (keywords);

SELECT set_config('mkt.system_action', '', false);
