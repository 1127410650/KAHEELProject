-- 1) Instrumentation table -------------------------------------------------
CREATE TABLE public.mkt_analytics_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  session_id   text NOT NULL,
  user_id      uuid,
  event_type   text NOT NULL,
  path         text,
  listing_id   uuid,
  category_id  uuid,
  city_id      uuid,
  query_text   text,
  result_count integer,
  duration_ms  integer,
  severity     text,
  message      text,
  device       text,
  browser      text,
  country_code text,
  city_name    text,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT mkt_analytics_events_type_chk CHECK (event_type IN (
    'page_view','search','search_zero','search_click','listing_view','contact_click',
    'error_js','error_api','error_image','error_storage','error_db','unauthorized'
  )),
  CONSTRAINT mkt_analytics_events_session_chk CHECK (char_length(session_id) BETWEEN 8 AND 64)
);

GRANT SELECT ON public.mkt_analytics_events TO authenticated;
GRANT ALL ON public.mkt_analytics_events TO service_role;

ALTER TABLE public.mkt_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_analytics_events_admin_read"
  ON public.mkt_analytics_events FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE INDEX mkt_analytics_events_time_idx ON public.mkt_analytics_events (occurred_at DESC);
CREATE INDEX mkt_analytics_events_type_time_idx ON public.mkt_analytics_events (event_type, occurred_at DESC);
CREATE INDEX mkt_analytics_events_session_idx ON public.mkt_analytics_events (session_id, occurred_at DESC);
CREATE INDEX mkt_analytics_events_query_idx ON public.mkt_analytics_events (query_text)
  WHERE query_text IS NOT NULL;

-- 2) Guards ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_guard()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_guard() TO authenticated;

-- 3) Ingest ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_track(_events jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e jsonb;
  n integer := 0;
BEGIN
  IF jsonb_typeof(_events) <> 'array' THEN RETURN 0; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(_events) LIMIT 25 LOOP
    IF coalesce(e->>'event_type','') NOT IN (
      'page_view','search','search_zero','search_click','listing_view','contact_click',
      'error_js','error_api','error_image','error_storage','error_db','unauthorized'
    ) THEN CONTINUE; END IF;
    IF char_length(coalesce(e->>'session_id','')) NOT BETWEEN 8 AND 64 THEN CONTINUE; END IF;

    INSERT INTO public.mkt_analytics_events (
      session_id, user_id, event_type, path, listing_id, category_id, city_id,
      query_text, result_count, duration_ms, severity, message, device, browser,
      country_code, city_name
    ) VALUES (
      left(e->>'session_id', 64),
      auth.uid(),
      e->>'event_type',
      left(nullif(e->>'path',''), 160),
      nullif(e->>'listing_id','')::uuid,
      nullif(e->>'category_id','')::uuid,
      nullif(e->>'city_id','')::uuid,
      left(nullif(btrim(e->>'query_text'),''), 80),
      least(greatest(coalesce((e->>'result_count')::int, 0), 0), 1000000),
      least(greatest(coalesce((e->>'duration_ms')::int, 0), 0), 600000),
      CASE WHEN e->>'severity' IN ('info','warn','error') THEN e->>'severity' END,
      left(nullif(e->>'message',''), 240),
      CASE WHEN e->>'device' IN ('mobile','tablet','desktop') THEN e->>'device' END,
      CASE WHEN e->>'browser' IN ('chrome','safari','firefox','edge','samsung','other') THEN e->>'browser' END,
      left(nullif(e->>'country_code',''), 2),
      left(nullif(e->>'city_name',''), 60)
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_track(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_track(jsonb) TO anon, authenticated;

-- 4) Overview counters -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d0 timestamptz := date_trunc('day', now());
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN jsonb_build_object(
    'active_users_today', (
      SELECT count(DISTINCT user_id) FROM public.mkt_analytics_events
      WHERE occurred_at >= d0 AND user_id IS NOT NULL),
    'active_sessions_today', (
      SELECT count(DISTINCT session_id) FROM public.mkt_analytics_events WHERE occurred_at >= d0),
    'new_users_today', (SELECT count(*) FROM auth.users WHERE created_at >= d0),
    'total_users', (SELECT count(*) FROM auth.users),
    'total_businesses', (SELECT count(*) FROM public.mkt_business_profiles),
    'listings_published', (SELECT count(*) FROM public.mkt_listings WHERE status = 'published'),
    'listings_pending', (SELECT count(*) FROM public.mkt_listings WHERE status = 'pending'),
    'listings_featured', (SELECT count(*) FROM public.mkt_listings
      WHERE is_featured AND (featured_until IS NULL OR featured_until > now())),
    'listings_expired', (SELECT count(*) FROM public.mkt_listings WHERE status = 'expired'),
    'conversations_today', (SELECT count(*) FROM public.mkt_conversations WHERE created_at >= d0),
    'messages_today', (SELECT count(*) FROM public.mkt_messages WHERE created_at >= d0),
    'calls_today', (SELECT count(*) FROM public.mkt_calls WHERE created_at >= d0),
    'reports_open', (SELECT count(*) FROM public.mkt_reports WHERE closed_at IS NULL),
    'verifications_pending', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'pending'),
    'quote_requests_open', (SELECT count(*) FROM public.mkt_quote_requests
      WHERE status IN ('new','open','pending','negotiating')),
    'quote_requests_closed', (SELECT count(*) FROM public.mkt_quote_requests
      WHERE status NOT IN ('new','open','pending','negotiating')),
    'revenue_points_spent', (SELECT coalesce(sum(points_spent), 0) FROM public.mkt_listing_promotions),
    'revenue_money_enabled', false,
    'generated_at', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_overview() TO authenticated;

-- 5) Funnel ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_funnel(_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(least(_days, 90), 1));
  visit int; searched int; viewed int; contacted int; signed int;
  messaged int; called int; faved int; posted int;
BEGIN
  PERFORM public.mkt_analytics_guard();
  SELECT count(DISTINCT session_id) INTO visit FROM public.mkt_analytics_events WHERE occurred_at >= since;
  SELECT count(DISTINCT session_id) INTO searched FROM public.mkt_analytics_events
    WHERE occurred_at >= since AND event_type IN ('search','search_zero');
  SELECT count(DISTINCT session_id) INTO viewed FROM public.mkt_analytics_events
    WHERE occurred_at >= since AND event_type = 'listing_view';
  SELECT count(DISTINCT session_id) INTO contacted FROM public.mkt_analytics_events
    WHERE occurred_at >= since AND event_type = 'contact_click';
  SELECT count(*) INTO signed FROM auth.users WHERE created_at >= since;
  SELECT count(DISTINCT sender_user_id) INTO messaged FROM public.mkt_messages WHERE created_at >= since;
  SELECT count(DISTINCT caller_user_id) INTO called FROM public.mkt_calls WHERE created_at >= since;
  SELECT count(DISTINCT user_id) INTO faved FROM public.mkt_favorites WHERE created_at >= since;
  SELECT count(DISTINCT owner_user_id) INTO posted FROM public.mkt_listings WHERE created_at >= since;

  RETURN jsonb_build_object(
    'days', greatest(least(_days, 90), 1),
    'steps', jsonb_build_array(
      jsonb_build_object('key','visit','value',visit,'source','events'),
      jsonb_build_object('key','search','value',searched,'source','events'),
      jsonb_build_object('key','listing_view','value',viewed,'source','events'),
      jsonb_build_object('key','contact','value',contacted,'source','events'),
      jsonb_build_object('key','signup','value',signed,'source','auth'),
      jsonb_build_object('key','message','value',messaged,'source','messages'),
      jsonb_build_object('key','call','value',called,'source','calls'),
      jsonb_build_object('key','favorite','value',faved,'source','favorites'),
      jsonb_build_object('key','publish','value',posted,'source','listings')
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_funnel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_funnel(integer) TO authenticated;

-- 6) Listings --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_listings(_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE lim int := greatest(least(_limit, 50), 1);
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN jsonb_build_object(
    'most_viewed', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, views_count AS metric FROM public.mkt_listings
      WHERE deleted_at IS NULL ORDER BY views_count DESC NULLS LAST LIMIT lim) x),
    'most_called', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT l.id, l.title, count(c.id) AS metric FROM public.mkt_listings l
      JOIN public.mkt_calls c ON c.listing_id = l.id
      GROUP BY l.id, l.title ORDER BY count(c.id) DESC LIMIT lim) x),
    'most_messaged', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT l.id, l.title, count(m.id) AS metric FROM public.mkt_listings l
      JOIN public.mkt_conversations cv ON cv.listing_id = l.id
      JOIN public.mkt_messages m ON m.conversation_id = cv.id
      GROUP BY l.id, l.title ORDER BY count(m.id) DESC LIMIT lim) x),
    'most_favorited', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, favorites_count AS metric FROM public.mkt_listings
      WHERE deleted_at IS NULL AND coalesce(favorites_count,0) > 0
      ORDER BY favorites_count DESC LIMIT lim) x),
    'most_shared', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, (coalesce(shares_count,0) + coalesce(link_copies_count,0)
        + coalesce(share_link_count,0)) AS metric FROM public.mkt_listings
      WHERE deleted_at IS NULL
      ORDER BY (coalesce(shares_count,0) + coalesce(link_copies_count,0)
        + coalesce(share_link_count,0)) DESC LIMIT lim) x),
    'zero_views', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, 0 AS metric FROM public.mkt_listings
      WHERE deleted_at IS NULL AND status = 'published' AND coalesce(views_count,0) = 0
      ORDER BY published_at DESC NULLS LAST LIMIT lim) x),
    'expired', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, 0 AS metric FROM public.mkt_listings
      WHERE status = 'expired' ORDER BY expires_at DESC NULLS LAST LIMIT lim) x),
    'reported', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT l.id, l.title, count(r.id) AS metric FROM public.mkt_listings l
      JOIN public.mkt_reports r ON r.listing_id = l.id
      GROUP BY l.id, l.title ORDER BY count(r.id) DESC LIMIT lim) x),
    'featured', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT id, title, coalesce(views_count,0) AS metric FROM public.mkt_listings
      WHERE is_featured AND (featured_until IS NULL OR featured_until > now())
      ORDER BY featured_until DESC NULLS LAST LIMIT lim) x)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_listings(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_listings(integer) TO authenticated;

-- 7) Fields (root categories) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_fields(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => greatest(least(_days, 365), 1));
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN (
    SELECT coalesce(jsonb_agg(r ORDER BY (r->>'listings')::int DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object(
        'category_id', c.id,
        'slug', c.slug,
        'name_ar', c.name_ar,
        'name_en', c.name_en,
        'listings', count(DISTINCT l.id),
        'new_listings', count(DISTINCT l.id) FILTER (WHERE l.created_at >= since),
        'expired', count(DISTINCT l.id) FILTER (WHERE l.status = 'expired'),
        'views', coalesce(sum(DISTINCT_views.v), 0),
        'favorites', coalesce(sum(DISTINCT_views.f), 0),
        'shares', coalesce(sum(DISTINCT_views.s), 0),
        'reports', coalesce(sum(DISTINCT_views.r), 0),
        'calls', (SELECT count(*) FROM public.mkt_calls k
                  JOIN public.mkt_listings kl ON kl.id = k.listing_id
                  WHERE coalesce(kl.category_id, kl.subcategory_id) IS NOT NULL
                    AND public.mkt_root_category(kl.category_id) = c.id),
        'conversations', (SELECT count(*) FROM public.mkt_conversations cv
                  JOIN public.mkt_listings cl ON cl.id = cv.listing_id
                  WHERE public.mkt_root_category(cl.category_id) = c.id)
      ) AS r
      FROM public.mkt_categories c
      LEFT JOIN public.mkt_listings l
        ON public.mkt_root_category(l.category_id) = c.id AND l.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT coalesce(l.views_count,0) AS v, coalesce(l.favorites_count,0) AS f,
               (coalesce(l.shares_count,0) + coalesce(l.link_copies_count,0)) AS s,
               coalesce(l.reports_count,0) AS r
      ) DISTINCT_views ON true
      WHERE c.parent_id IS NULL AND c.is_active
      GROUP BY c.id, c.slug, c.name_ar, c.name_en, c.sort_order
    ) q
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_fields(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_fields(integer) TO authenticated;

-- helper: root category of a category id
CREATE OR REPLACE FUNCTION public.mkt_root_category(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _id IS NULL THEN NULL
    ELSE coalesce((SELECT parent.id FROM public.mkt_categories child
                   JOIN public.mkt_categories parent ON parent.id = child.parent_id
                   WHERE child.id = _id), _id)
  END
$$;
GRANT EXECUTE ON FUNCTION public.mkt_root_category(uuid) TO authenticated, anon;

-- 8) Search ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_search(_days integer DEFAULT 30, _limit integer DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(least(_days, 365), 1));
  lim int := greatest(least(_limit, 50), 1);
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN jsonb_build_object(
    'searches', (SELECT count(*) FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type IN ('search','search_zero')),
    'zero_result_searches', (SELECT count(*) FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type = 'search_zero'),
    'result_clicks', (SELECT count(*) FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type = 'search_click'),
    'avg_duration_ms', (SELECT round(avg(duration_ms)) FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type IN ('search','search_zero') AND duration_ms > 0),
    'top_terms', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT query_text AS term, count(*) AS metric FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type IN ('search','search_zero') AND query_text IS NOT NULL
      GROUP BY query_text ORDER BY count(*) DESC LIMIT lim) x),
    'zero_terms', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT query_text AS term, count(*) AS metric FROM public.mkt_analytics_events
      WHERE occurred_at >= since AND event_type = 'search_zero' AND query_text IS NOT NULL
      GROUP BY query_text ORDER BY count(*) DESC LIMIT lim) x),
    'top_cities', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT ci.id, ci.name_ar, ci.name_en, count(*) AS metric
      FROM public.mkt_analytics_events e JOIN public.mkt_cities ci ON ci.id = e.city_id
      WHERE e.occurred_at >= since AND e.event_type IN ('search','search_zero')
      GROUP BY ci.id, ci.name_ar, ci.name_en ORDER BY count(*) DESC LIMIT lim) x),
    'top_categories', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT c.id, c.name_ar, c.name_en, count(*) AS metric
      FROM public.mkt_analytics_events e JOIN public.mkt_categories c ON c.id = e.category_id
      WHERE e.occurred_at >= since AND e.event_type IN ('search','search_zero')
      GROUP BY c.id, c.name_ar, c.name_en ORDER BY count(*) DESC LIMIT lim) x)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_search(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_search(integer, integer) TO authenticated;

-- 9) People (users + businesses) ------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_people(_days integer DEFAULT 30, _limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(least(_days, 365), 1));
  lim int := greatest(least(_limit, 50), 1);
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM auth.users),
      'new', (SELECT count(*) FROM auth.users WHERE created_at >= since),
      'active', (SELECT count(DISTINCT user_id) FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND user_id IS NOT NULL),
      'inactive', (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (
        SELECT 1 FROM public.mkt_analytics_events e
        WHERE e.user_id = u.id AND e.occurred_at >= since)),
      'banned', (SELECT count(DISTINCT subject_id) FROM public.mkt_account_restrictions
        WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
      'deleted', (SELECT count(*) FROM auth.users WHERE deleted_at IS NOT NULL),
      'top_publishers', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT l.owner_user_id AS user_id, coalesce(p.display_name, p.username, '—') AS name,
               count(*) AS metric
        FROM public.mkt_listings l
        LEFT JOIN public.mkt_user_profiles p ON p.user_id = l.owner_user_id
        WHERE l.owner_user_id IS NOT NULL
        GROUP BY l.owner_user_id, p.display_name, p.username
        ORDER BY count(*) DESC LIMIT lim) x),
      'top_message_receivers', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT cv.seller_user_id AS user_id, coalesce(p.display_name, p.username, '—') AS name,
               count(m.id) AS metric
        FROM public.mkt_conversations cv
        JOIN public.mkt_messages m ON m.conversation_id = cv.id AND m.sender_user_id <> cv.seller_user_id
        LEFT JOIN public.mkt_user_profiles p ON p.user_id = cv.seller_user_id
        GROUP BY cv.seller_user_id, p.display_name, p.username
        ORDER BY count(m.id) DESC LIMIT lim) x),
      'top_call_receivers', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT k.callee_user_id AS user_id, coalesce(p.display_name, p.username, '—') AS name,
               count(*) AS metric
        FROM public.mkt_calls k
        LEFT JOIN public.mkt_user_profiles p ON p.user_id = k.callee_user_id
        WHERE k.callee_user_id IS NOT NULL
        GROUP BY k.callee_user_id, p.display_name, p.username
        ORDER BY count(*) DESC LIMIT lim) x)
    ),
    'businesses', jsonb_build_object(
      'total', (SELECT count(*) FROM public.mkt_business_profiles),
      'new', (SELECT count(*) FROM public.mkt_business_profiles WHERE created_at >= since),
      'verified', (SELECT count(*) FROM public.mkt_business_profiles WHERE verification_status = 'verified'),
      'top_active', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT b.tenant_id, b.display_name_ar AS name, count(l.id) AS metric
        FROM public.mkt_business_profiles b
        JOIN public.mkt_listings l ON l.tenant_id = b.tenant_id AND l.deleted_at IS NULL
        GROUP BY b.tenant_id, b.display_name_ar ORDER BY count(l.id) DESC LIMIT lim) x),
      'top_viewed', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT b.tenant_id, b.display_name_ar AS name, coalesce(sum(l.views_count), 0) AS metric
        FROM public.mkt_business_profiles b
        JOIN public.mkt_listings l ON l.tenant_id = b.tenant_id AND l.deleted_at IS NULL
        GROUP BY b.tenant_id, b.display_name_ar ORDER BY coalesce(sum(l.views_count),0) DESC LIMIT lim) x),
      'top_conversations', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT b.tenant_id, b.display_name_ar AS name, count(cv.id) AS metric
        FROM public.mkt_business_profiles b
        JOIN public.mkt_conversations cv ON cv.seller_tenant_id = b.tenant_id
        GROUP BY b.tenant_id, b.display_name_ar ORDER BY count(cv.id) DESC LIMIT lim) x)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_people(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_people(integer, integer) TO authenticated;

-- 10) Health (performance + security) -------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_health(_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => greatest(least(_days, 90), 1));
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN jsonb_build_object(
    'performance', jsonb_build_object(
      'avg_page_ms', (SELECT round(avg(duration_ms)) FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND event_type = 'page_view' AND duration_ms > 0),
      'page_views', (SELECT count(*) FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND event_type = 'page_view'),
      'slowest_pages', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT path, round(avg(duration_ms)) AS metric, count(*) AS samples
        FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND event_type = 'page_view' AND duration_ms > 0 AND path IS NOT NULL
        GROUP BY path HAVING count(*) >= 2 ORDER BY avg(duration_ms) DESC LIMIT 10) x),
      'realtime_tables', (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime')
    ),
    'errors', jsonb_build_object(
      'js', (SELECT count(*) FROM public.mkt_analytics_events WHERE occurred_at >= since AND event_type = 'error_js'),
      'api', (SELECT count(*) FROM public.mkt_analytics_events WHERE occurred_at >= since AND event_type = 'error_api'),
      'image', (SELECT count(*) FROM public.mkt_analytics_events WHERE occurred_at >= since AND event_type = 'error_image'),
      'storage', (SELECT count(*) FROM public.mkt_analytics_events WHERE occurred_at >= since AND event_type = 'error_storage'),
      'db', (SELECT count(*) FROM public.mkt_analytics_events WHERE occurred_at >= since AND event_type = 'error_db'),
      'top', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT event_type, message, count(*) AS metric FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND event_type LIKE 'error_%' AND message IS NOT NULL
        GROUP BY event_type, message ORDER BY count(*) DESC LIMIT 10) x)
    ),
    'security', jsonb_build_object(
      'failed_logins', (SELECT coalesce(sum(fail_count), 0) FROM public.login_attempts),
      'locked_accounts', (SELECT count(*) FROM public.login_attempts WHERE locked_until > now()),
      'banned_accounts', (SELECT count(*) FROM public.mkt_account_restrictions
        WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
      'unauthorized_attempts', (SELECT count(*) FROM public.mkt_analytics_events
        WHERE occurred_at >= since AND event_type = 'unauthorized'),
      'security_reviews', (SELECT count(*) FROM public.mkt_admin_assignments
        WHERE kind = 'security_review' AND created_at >= since),
      'suspicious_scans', (SELECT count(*) FROM public.mkt_moderation_scans
        WHERE scanned_at >= since AND decision <> 'allow')
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_health(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_health(integer) TO authenticated;

-- 11) Ops (conversations + verification + admin work) ---------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_ops(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(least(_days, 365), 1));
  d0 timestamptz := date_trunc('day', now());
  is_admin boolean := public.mkt_is_platform_admin();
BEGIN
  IF NOT is_admin AND NOT public.mkt_admin_can('work.view') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN jsonb_build_object(
    'conversations', CASE WHEN NOT is_admin THEN NULL ELSE jsonb_build_object(
      'new', (SELECT count(*) FROM public.mkt_conversations WHERE created_at >= since),
      'messages', (SELECT count(*) FROM public.mkt_messages WHERE created_at >= since),
      'attachments', (SELECT count(*) FROM public.mkt_messages
        WHERE created_at >= since AND (attachment_path IS NOT NULL OR kind IN ('image','file'))),
      'audio', (SELECT count(*) FROM public.mkt_messages WHERE created_at >= since AND kind = 'audio'),
      'locations', (SELECT count(*) FROM public.mkt_messages WHERE created_at >= since AND kind = 'location'),
      'bank_shares', (SELECT count(*) FROM public.mkt_messages
        WHERE created_at >= since AND kind IN ('bank_request','bank_account')),
      'flagged', (SELECT count(*) FROM public.mkt_messages
        WHERE created_at >= since AND moderation_state IS NOT NULL AND moderation_state <> 'clean')
    ) END,
    'verification', CASE WHEN NOT is_admin THEN NULL ELSE jsonb_build_object(
      'pending', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'pending'),
      'in_review', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'in_review'),
      'approved', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'approved'),
      'rejected', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'rejected'),
      'avg_review_hours', (SELECT round(avg(extract(epoch FROM (decided_at - created_at)) / 3600.0)::numeric, 1)
        FROM public.mkt_verification_requests WHERE decided_at IS NOT NULL)
    ) END,
    'admin', jsonb_build_object(
      'open_work', (SELECT count(*) FROM public.mkt_admin_assignments WHERE closed_at IS NULL),
      'closed_work', (SELECT count(*) FROM public.mkt_admin_assignments WHERE closed_at IS NOT NULL),
      'staff_requests', (SELECT count(*) FROM public.mkt_admin_assignments WHERE kind = 'admin_request'),
      'operations_today', (SELECT count(*) FROM public.audit_log WHERE created_at >= d0),
      'top_staff', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT assignee AS user_id, count(*) AS metric FROM public.mkt_admin_assignments
        WHERE closed_at IS NOT NULL AND assignee IS NOT NULL
        GROUP BY assignee ORDER BY count(*) DESC LIMIT 5) x),
      'lightest_staff', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT assignee AS user_id, count(*) AS metric FROM public.mkt_admin_assignments
        WHERE closed_at IS NULL AND assignee IS NOT NULL
        GROUP BY assignee ORDER BY count(*) ASC LIMIT 5) x)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_ops(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_ops(integer) TO authenticated;

-- 12) Geo -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_geo(_limit integer DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE lim int := greatest(least(_limit, 50), 1);
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT ci.id, ci.name_ar, ci.name_en,
      (SELECT count(*) FROM public.mkt_listings l WHERE l.city_id = ci.id AND l.deleted_at IS NULL) AS listings,
      (SELECT count(*) FROM public.mkt_user_profiles p WHERE p.city_id = ci.id) AS users,
      (SELECT count(*) FROM public.mkt_business_profiles b WHERE b.city_id = ci.id) AS businesses,
      (SELECT count(*) FROM public.mkt_analytics_events e WHERE e.city_id = ci.id) AS events
    FROM public.mkt_cities ci
    WHERE ci.is_active
    ORDER BY (SELECT count(*) FROM public.mkt_listings l WHERE l.city_id = ci.id AND l.deleted_at IS NULL) DESC
    LIMIT lim) x);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_geo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_geo(integer) TO authenticated;

-- 13) Daily time series ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_analytics_timeseries(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE dd int := greatest(least(_days, 180), 2);
BEGIN
  PERFORM public.mkt_analytics_guard();
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'day', to_char(d.day, 'YYYY-MM-DD'),
      'users', (SELECT count(*) FROM auth.users u WHERE u.created_at >= d.day AND u.created_at < d.day + interval '1 day'),
      'listings', (SELECT count(*) FROM public.mkt_listings l WHERE l.created_at >= d.day AND l.created_at < d.day + interval '1 day'),
      'conversations', (SELECT count(*) FROM public.mkt_conversations c WHERE c.created_at >= d.day AND c.created_at < d.day + interval '1 day'),
      'messages', (SELECT count(*) FROM public.mkt_messages m WHERE m.created_at >= d.day AND m.created_at < d.day + interval '1 day'),
      'views', (SELECT count(*) FROM public.mkt_analytics_events e WHERE e.event_type = 'listing_view' AND e.occurred_at >= d.day AND e.occurred_at < d.day + interval '1 day'),
      'searches', (SELECT count(*) FROM public.mkt_analytics_events e WHERE e.event_type IN ('search','search_zero') AND e.occurred_at >= d.day AND e.occurred_at < d.day + interval '1 day'),
      'revenue_points', (SELECT coalesce(sum(points_spent),0) FROM public.mkt_listing_promotions p WHERE p.created_at >= d.day AND p.created_at < d.day + interval '1 day')
    ) ORDER BY d.day), '[]'::jsonb)
    FROM generate_series(date_trunc('day', now()) - make_interval(days => dd - 1), date_trunc('day', now()), interval '1 day') AS d(day)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_analytics_timeseries(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_analytics_timeseries(integer) TO authenticated;