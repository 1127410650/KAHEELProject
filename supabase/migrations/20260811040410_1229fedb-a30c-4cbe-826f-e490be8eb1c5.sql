-- ── 1. Design tokens: draft → preview → apply on the EXISTING theme engine ──

CREATE OR REPLACE FUNCTION public.mkt_theme_tokens_admin(_palette_id uuid DEFAULT NULL)
RETURNS TABLE (palette_id uuid, token_key text, category text, value text, draft_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_id := COALESCE(
    _palette_id,
    (SELECT p.id FROM public.mkt_theme_palettes p WHERE p.is_active AND p.deleted_at IS NULL LIMIT 1)
  );
  RETURN QUERY
    SELECT s.palette_id, s.token_key, s.category, s.value, s.draft_value
    FROM public.mkt_theme_settings s
    WHERE s.palette_id = v_id
    ORDER BY s.category, s.token_key;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_theme_tokens_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_theme_tokens_admin(uuid) TO authenticated;

-- Writes a DRAFT value only: the live token is untouched until apply.
CREATE OR REPLACE FUNCTION public.mkt_theme_token_draft_set(
  _palette_id uuid,
  _token_key text,
  _category text,
  _draft text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text := NULLIF(btrim(COALESCE(_token_key, '')), '');
  v_cat text := COALESCE(NULLIF(btrim(COALESCE(_category, '')), ''), 'color');
  v_val text := NULLIF(btrim(COALESCE(_draft, '')), '');
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[a-z][a-z0-9-]{1,48}$' THEN
    RAISE EXCEPTION 'invalid token key';
  END IF;
  IF v_cat NOT IN ('color','font','type','radius','shadow','space') THEN
    RAISE EXCEPTION 'invalid category';
  END IF;
  IF v_val IS NOT NULL AND (length(v_val) > 40 OR v_val ~ '[<>;{}]') THEN
    RAISE EXCEPTION 'invalid token value';
  END IF;

  v_id := COALESCE(
    _palette_id,
    (SELECT p.id FROM public.mkt_theme_palettes p WHERE p.is_active AND p.deleted_at IS NULL LIMIT 1)
  );
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'palette not found';
  END IF;

  INSERT INTO public.mkt_theme_settings (palette_id, token_key, category, value, draft_value)
  VALUES (v_id, v_key, v_cat, COALESCE(v_val, ''), v_val)
  ON CONFLICT (palette_id, token_key)
  DO UPDATE SET draft_value = v_val, category = v_cat, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_theme_token_draft_set(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_theme_token_draft_set(uuid, text, text, text) TO authenticated;

-- Apply: drafts become live values, drafts cleared, one audit row per change.
CREATE OR REPLACE FUNCTION public.mkt_theme_tokens_apply(_palette_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_n integer := 0;
  r record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT p.id, p.name_ar INTO v_id, v_name
  FROM public.mkt_theme_palettes p
  WHERE p.deleted_at IS NULL
    AND (p.id = _palette_id OR (_palette_id IS NULL AND p.is_active))
  LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'palette not found';
  END IF;

  FOR r IN
    SELECT token_key, value, draft_value
    FROM public.mkt_theme_settings
    WHERE palette_id = v_id AND draft_value IS NOT NULL AND draft_value <> value
  LOOP
    INSERT INTO public.mkt_theme_audit (palette_id, palette_name, action, token_key, old_value, new_value, actor)
    VALUES (v_id, v_name, 'token_apply', r.token_key, r.value, r.draft_value, auth.uid());
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.mkt_theme_settings
    SET value = draft_value, draft_value = NULL, updated_at = now()
  WHERE palette_id = v_id AND draft_value IS NOT NULL;

  UPDATE public.mkt_theme_palettes SET updated_at = now() WHERE id = v_id;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_theme_tokens_apply(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_theme_tokens_apply(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_theme_tokens_discard(_palette_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_n integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_id := COALESCE(
    _palette_id,
    (SELECT p.id FROM public.mkt_theme_palettes p WHERE p.is_active AND p.deleted_at IS NULL LIMIT 1)
  );
  UPDATE public.mkt_theme_settings SET draft_value = NULL, updated_at = now()
  WHERE palette_id = v_id AND draft_value IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- A row created only as a draft placeholder leaves no live value behind.
  DELETE FROM public.mkt_theme_settings WHERE palette_id = v_id AND btrim(value) = '';
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_theme_tokens_discard(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_theme_tokens_discard(uuid) TO authenticated;

-- ── 2. Owner-identity analytics: aggregates only, ownership resolved server-side ──

CREATE OR REPLACE FUNCTION public.mkt_owner_analytics(
  _days integer DEFAULT 30,
  _tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, analytics
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := (now() AT TIME ZONE 'Asia/Riyadh')::date
                 - GREATEST(1, LEAST(COALESCE(_days, 30), 180));
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- A supplied tenant id is honoured ONLY for a tenant the caller belongs to.
  IF _tenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = v_uid AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  WITH owned AS (
    SELECT l.id
    FROM public.mkt_listings l
    WHERE l.deleted_at IS NULL
      AND l.is_demo = false
      AND (
        CASE WHEN _tenant_id IS NULL
          THEN l.owner_user_id = v_uid
          ELSE l.tenant_id = _tenant_id
        END
      )
  ),
  ev AS (
    SELECT e.name, e.session_key, e.entity_id, e.country,
           (e.occurred_at AT TIME ZONE 'Asia/Riyadh')::date AS day
    FROM analytics.events_raw e
    JOIN owned o ON o.id = e.entity_id
    WHERE e.occurred_at >= v_from
      AND e.entity_kind = 'listing'
      AND e.is_test = false
      AND e.is_demo = false
      AND e.is_internal = false
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'listings', (SELECT count(*) FROM owned),
    'totals', jsonb_build_object(
      'impressions', (SELECT count(*) FROM ev WHERE name = 'listing.impression'),
      'detail_visits', (SELECT count(*) FROM ev WHERE name = 'listing.view'),
      'contact_clicks', (SELECT count(*) FROM ev WHERE name = 'listing.contact_click'),
      'favorites', (SELECT count(*) FROM ev WHERE name = 'listing.favorite'),
      'shares', (SELECT count(*) FROM ev WHERE name = 'listing.share'),
      'sessions', (SELECT count(DISTINCT session_key) FROM ev)
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
      FROM (
        SELECT day,
               count(*) FILTER (WHERE name = 'listing.view')::bigint AS detail_visits,
               count(*) FILTER (WHERE name = 'listing.contact_click')::bigint AS contact_clicks,
               count(DISTINCT session_key)::bigint AS sessions
        FROM ev GROUP BY day
      ) d
    ), '[]'::jsonb),
    -- Small slices are merged into «أخرى»: fewer than 5 sessions is not reported.
    'countries', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.sessions DESC)
      FROM (
        SELECT CASE WHEN count(DISTINCT session_key) < 5 THEN 'أخرى'
                    ELSE COALESCE(country, 'أخرى') END AS label,
               count(DISTINCT session_key)::bigint AS sessions
        FROM ev
        GROUP BY COALESCE(country, 'أخرى')
      ) c
    ), '[]'::jsonb),
    'top_listings', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.detail_visits DESC)
      FROM (
        SELECT entity_id AS listing_id,
               count(*) FILTER (WHERE name = 'listing.view')::bigint AS detail_visits,
               count(*) FILTER (WHERE name = 'listing.contact_click')::bigint AS contact_clicks
        FROM ev
        WHERE entity_id IS NOT NULL
        GROUP BY entity_id
        HAVING count(DISTINCT session_key) >= 5
        ORDER BY 2 DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_out;

  RETURN COALESCE(v_out, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_owner_analytics(integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mkt_owner_analytics(integer, uuid) TO authenticated;