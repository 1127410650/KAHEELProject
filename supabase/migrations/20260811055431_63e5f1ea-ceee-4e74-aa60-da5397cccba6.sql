-- ══════════════════════════════════════════════════════════════════
-- Batch 3 — performance, emergency switches, content health
-- Additive only: new tables, new columns, new functions.
-- ══════════════════════════════════════════════════════════════════

-- ---------- 1. performance budgets ----------
CREATE TABLE public.mkt_perf_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  lcp_ms integer NOT NULL DEFAULT 2500,
  inp_ms integer NOT NULL DEFAULT 200,
  cls_milli integer NOT NULL DEFAULT 100,
  max_asset_kb integer NOT NULL DEFAULT 400,
  max_page_kb integer NOT NULL DEFAULT 1800,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_perf_budgets_lcp_chk CHECK (lcp_ms BETWEEN 500 AND 20000),
  CONSTRAINT mkt_perf_budgets_inp_chk CHECK (inp_ms BETWEEN 50 AND 5000),
  CONSTRAINT mkt_perf_budgets_cls_chk CHECK (cls_milli BETWEEN 1 AND 1000),
  CONSTRAINT mkt_perf_budgets_asset_chk CHECK (max_asset_kb BETWEEN 20 AND 20000),
  CONSTRAINT mkt_perf_budgets_page_chk CHECK (max_page_kb BETWEEN 100 AND 60000)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_perf_budgets TO authenticated;
GRANT ALL ON public.mkt_perf_budgets TO service_role;
ALTER TABLE public.mkt_perf_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf budgets readable by ops staff" ON public.mkt_perf_budgets
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "perf budgets managed by settings owners" ON public.mkt_perf_budgets
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('settings.manage'))
  WITH CHECK (public.mkt_admin_can('settings.manage'));

CREATE TRIGGER mkt_perf_budgets_touch BEFORE UPDATE ON public.mkt_perf_budgets
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

INSERT INTO public.mkt_perf_budgets (page_type, name_ar, name_en, lcp_ms, inp_ms, cls_milli, max_asset_kb, max_page_kb, note) VALUES
  ('home', 'الرئيسية', 'Home', 2500, 200, 100, 400, 2000, 'الصفحة الأكثر زيارة — الصور الكبيرة تُقاس بصرامة.'),
  ('listing', 'صفحة إعلان', 'Listing detail', 2500, 200, 100, 500, 2200, 'معرض صور الإعلان أثقل عنصر.'),
  ('search', 'البحث والتصفح', 'Search & browse', 2200, 200, 80, 300, 1600, 'قوائم كثيفة — الإزاحة أخطر من الحجم.'),
  ('store', 'واجهة متجر', 'Storefront', 2600, 200, 100, 500, 2400, 'ثيمات المتاجر تسمح بصور أكبر.'),
  ('cms', 'صفحة محتوى', 'CMS page', 2400, 200, 80, 400, 1800, 'صفحات المؤلّف — تُفحص قبل النشر.'),
  ('admin', 'شاشة إدارة', 'Admin screen', 3000, 250, 150, 300, 2000, 'داخلية — الهدف الاستجابة لا الجمال.')
ON CONFLICT (page_type) DO NOTHING;

-- ---------- 2. safe mode / kill switch levels ----------
ALTER TABLE public.mkt_feature_flags
  ADD COLUMN IF NOT EXISTS switch_level text NOT NULL DEFAULT 'module',
  ADD COLUMN IF NOT EXISTS expected_minutes integer,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

ALTER TABLE public.mkt_feature_flags
  DROP CONSTRAINT IF EXISTS mkt_feature_flags_switch_level_chk;
ALTER TABLE public.mkt_feature_flags
  ADD CONSTRAINT mkt_feature_flags_switch_level_chk
  CHECK (switch_level IN ('global','unit','module','surface','placement'));

-- الدخول والإدارة لا تُعطَّل أبدًا: يُعلَّم المفتاح محميًا.
UPDATE public.mkt_feature_flags
SET is_protected = true
WHERE flag_key LIKE 'auth.%' OR flag_key LIKE 'admin.%' OR unit IN ('auth','admin');

CREATE TABLE public.mkt_flag_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.mkt_feature_flags(id) ON DELETE CASCADE,
  target_status text NOT NULL,
  switch_level text NOT NULL DEFAULT 'module',
  reason text NOT NULL,
  expected_minutes integer NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  applied_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_flag_req_status_chk CHECK (target_status IN ('on','off','internal')),
  CONSTRAINT mkt_flag_req_state_chk CHECK (state IN ('pending','applied','rejected','expired')),
  CONSTRAINT mkt_flag_req_level_chk CHECK (switch_level IN ('global','unit','module','surface','placement')),
  CONSTRAINT mkt_flag_req_reason_chk CHECK (char_length(btrim(reason)) >= 10),
  CONSTRAINT mkt_flag_req_minutes_chk CHECK (expected_minutes BETWEEN 5 AND 10080)
);
CREATE INDEX mkt_flag_req_state_idx ON public.mkt_flag_change_requests(state, requested_at DESC);
CREATE INDEX mkt_flag_req_flag_idx ON public.mkt_flag_change_requests(flag_id, requested_at DESC);

GRANT SELECT ON public.mkt_flag_change_requests TO authenticated;
GRANT ALL ON public.mkt_flag_change_requests TO service_role;
ALTER TABLE public.mkt_flag_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flag requests readable by flag managers" ON public.mkt_flag_change_requests
  FOR SELECT TO authenticated USING (public.mkt_admin_can('flags.manage'));

CREATE TRIGGER mkt_flag_requests_touch BEFORE UPDATE ON public.mkt_flag_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 3. content & link health findings ----------
CREATE TABLE public.mkt_content_health_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL,
  severity text NOT NULL DEFAULT 'P3',
  entity text NOT NULL,
  entity_id uuid,
  entity_label text,
  dedupe_key text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  detail_ar text,
  href text,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_content_health_sev_chk CHECK (severity IN ('P0','P1','P2','P3')),
  CONSTRAINT mkt_content_health_check_chk CHECK (check_key IN ('broken_link','missing_media','expired_campaign','placement_empty','redirect_loop','perf_budget'))
);
CREATE INDEX mkt_content_health_open_idx ON public.mkt_content_health_findings(resolved_at, severity, last_seen_at DESC);

GRANT SELECT ON public.mkt_content_health_findings TO authenticated;
GRANT ALL ON public.mkt_content_health_findings TO service_role;
ALTER TABLE public.mkt_content_health_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content health readable by ops staff" ON public.mkt_content_health_findings
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));

CREATE TRIGGER mkt_content_health_touch BEFORE UPDATE ON public.mkt_content_health_findings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 4. preflight warning overrides ----------
CREATE TABLE public.mkt_cms_preflight_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.mkt_cms_pages(id) ON DELETE CASCADE,
  codes text[] NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_preflight_override_reason_chk CHECK (char_length(btrim(reason)) >= 10)
);
CREATE INDEX mkt_preflight_override_page_idx ON public.mkt_cms_preflight_overrides(page_id, created_at DESC);

GRANT SELECT ON public.mkt_cms_preflight_overrides TO authenticated;
GRANT ALL ON public.mkt_cms_preflight_overrides TO service_role;
ALTER TABLE public.mkt_cms_preflight_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preflight overrides readable by settings owners" ON public.mkt_cms_preflight_overrides
  FOR SELECT TO authenticated USING (public.mkt_admin_can('settings.manage'));

-- ---------- 5. performance reporting from real RUM events ----------
CREATE OR REPLACE FUNCTION public.mkt_perf_summary(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, analytics
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(_days, 7), 90)));
  _metrics jsonb;
  _pages jsonb;
  _assets jsonb;
  _samples bigint;
BEGIN
  IF NOT public.mkt_admin_can('platform.health.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT count(*) INTO _samples
  FROM analytics.events_raw e
  WHERE e.name = 'perf.web_vital' AND e.occurred_at >= _since
    AND e.is_test = false AND e.is_internal = false AND e.is_demo = false;

  SELECT coalesce(jsonb_agg(row_to_json(m)), '[]'::jsonb) INTO _metrics
  FROM (
    SELECT
      e.props->>'metric' AS metric,
      coalesce(e.device, 'unknown') AS device,
      count(*) AS samples,
      round(percentile_cont(0.75) WITHIN GROUP (ORDER BY (e.props->>'value')::numeric)::numeric, 2) AS p75,
      round(percentile_cont(0.95) WITHIN GROUP (ORDER BY (e.props->>'value')::numeric)::numeric, 2) AS p95
    FROM analytics.events_raw e
    WHERE e.name = 'perf.web_vital' AND e.occurred_at >= _since
      AND e.is_test = false AND e.is_internal = false AND e.is_demo = false
      AND e.props ? 'metric' AND jsonb_typeof(e.props->'value') = 'number'
    GROUP BY 1, 2
    ORDER BY 1, 2
  ) m;

  SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO _pages
  FROM (
    SELECT
      coalesce(e.route_path, '/') AS route_path,
      count(*) AS samples,
      round(percentile_cont(0.75) WITHIN GROUP (
        ORDER BY CASE WHEN e.props->>'metric' = 'LCP' THEN (e.props->>'value')::numeric END
      )::numeric, 0) AS lcp_p75,
      round(percentile_cont(0.75) WITHIN GROUP (
        ORDER BY CASE WHEN e.props->>'metric' = 'INP' THEN (e.props->>'value')::numeric END
      )::numeric, 0) AS inp_p75,
      round(percentile_cont(0.75) WITHIN GROUP (
        ORDER BY CASE WHEN e.props->>'metric' = 'CLS' THEN (e.props->>'value')::numeric END
      )::numeric, 3) AS cls_p75
    FROM analytics.events_raw e
    WHERE e.name = 'perf.web_vital' AND e.occurred_at >= _since
      AND e.is_test = false AND e.is_internal = false AND e.is_demo = false
      AND e.props ? 'metric' AND jsonb_typeof(e.props->'value') = 'number'
    GROUP BY 1
    HAVING count(*) >= 3
    ORDER BY 3 DESC NULLS LAST
    LIMIT 25
  ) p;

  SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) INTO _assets
  FROM (
    SELECT
      e.props->>'path' AS asset_path,
      coalesce(e.route_path, '/') AS route_path,
      count(*) AS hits,
      round(max((e.props->>'kb')::numeric)::numeric, 0) AS max_kb
    FROM analytics.events_raw e
    WHERE e.name = 'perf.asset' AND e.occurred_at >= _since
      AND e.is_test = false AND e.is_internal = false AND e.is_demo = false
      AND e.props ? 'path' AND jsonb_typeof(e.props->'kb') = 'number'
    GROUP BY 1, 2
    ORDER BY 4 DESC
    LIMIT 25
  ) a;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'window_days', greatest(1, least(coalesce(_days, 7), 90)),
    'samples', _samples,
    'metrics', _metrics,
    'slow_pages', _pages,
    'heavy_assets', _assets,
    'budgets', (
      SELECT coalesce(jsonb_agg(row_to_json(b) ORDER BY b.page_type), '[]'::jsonb)
      FROM (
        SELECT page_type, name_ar, name_en, lcp_ms, inp_ms, cls_milli, max_asset_kb, max_page_kb, note
        FROM public.mkt_perf_budgets WHERE is_active
      ) b
    )
  );
END;
$$;

-- ---------- 6. kill switch: request, approve, apply ----------
CREATE OR REPLACE FUNCTION public.mkt_flag_change_request(
  _flag_key text,
  _target_status text,
  _reason text,
  _expected_minutes integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flag public.mkt_feature_flags;
  _reason_clean text := btrim(coalesce(_reason, ''));
  _req_id uuid;
  _old_status text;
BEGIN
  IF NOT public.mkt_admin_can('flags.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _target_status NOT IN ('on','off','internal') THEN
    RAISE EXCEPTION 'BAD_STATUS';
  END IF;
  IF char_length(_reason_clean) < 10 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;
  IF _expected_minutes IS NULL OR _expected_minutes < 5 OR _expected_minutes > 10080 THEN
    RAISE EXCEPTION 'DURATION_REQUIRED';
  END IF;

  SELECT * INTO _flag FROM public.mkt_feature_flags WHERE flag_key = _flag_key;
  IF _flag.id IS NULL THEN
    RAISE EXCEPTION 'FLAG_NOT_FOUND';
  END IF;
  IF _flag.is_protected AND _target_status <> 'on' THEN
    RAISE EXCEPTION 'PROTECTED_FLAG';
  END IF;
  IF _target_status = 'off'
     AND coalesce(btrim(_flag.fallback_note), '') = '' THEN
    RAISE EXCEPTION 'FALLBACK_NOTE_REQUIRED';
  END IF;

  _old_status := _flag.status;

  INSERT INTO public.mkt_flag_change_requests
    (flag_id, target_status, switch_level, reason, expected_minutes, requested_by)
  VALUES (_flag.id, _target_status, _flag.switch_level, _reason_clean, _expected_minutes, auth.uid())
  RETURNING id INTO _req_id;

  -- الإجراء العام (global) يحتاج موافقة شخص ثانٍ؛ ما دونه يُطبَّق فورًا.
  IF _flag.switch_level = 'global' THEN
    PERFORM public.mkt_ops_log_write(
      'flags.change_requested', 'platform', 'mkt_feature_flags', _flag.id,
      format('طلب تغيير مفتاح %s إلى %s — بانتظار موافقة ثانية', _flag.flag_key, _target_status),
      jsonb_build_object('request_id', _req_id, 'from', _old_status, 'to', _target_status,
                         'level', _flag.switch_level, 'expected_minutes', _expected_minutes)
    );
    RETURN jsonb_build_object('request_id', _req_id, 'applied', false, 'needs_second_approval', true);
  END IF;

  UPDATE public.mkt_feature_flags
  SET status = _target_status,
      last_change_reason = _reason_clean,
      last_changed_by = auth.uid(),
      expected_minutes = _expected_minutes,
      activated_at = CASE WHEN _target_status = 'on' THEN NULL ELSE now() END,
      activated_by = CASE WHEN _target_status = 'on' THEN NULL ELSE auth.uid() END
  WHERE id = _flag.id;

  UPDATE public.mkt_flag_change_requests
  SET state = 'applied', applied_at = now()
  WHERE id = _req_id;

  PERFORM public.mkt_ops_log_write(
    'flags.changed', 'platform', 'mkt_feature_flags', _flag.id,
    format('تغيير مفتاح %s من %s إلى %s', _flag.flag_key, _old_status, _target_status),
    jsonb_build_object('request_id', _req_id, 'from', _old_status, 'to', _target_status,
                       'level', _flag.switch_level, 'expected_minutes', _expected_minutes,
                       'reason', _reason_clean)
  );

  RETURN jsonb_build_object('request_id', _req_id, 'applied', true, 'needs_second_approval', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_flag_change_decide(
  _request_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.mkt_flag_change_requests;
  _flag public.mkt_feature_flags;
  _old_status text;
BEGIN
  IF NOT public.mkt_admin_can('flags.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO _req FROM public.mkt_flag_change_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;
  IF _req.state <> 'pending' THEN
    RAISE EXCEPTION 'REQUEST_CLOSED';
  END IF;
  IF _req.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'SECOND_APPROVER_REQUIRED';
  END IF;

  SELECT * INTO _flag FROM public.mkt_feature_flags WHERE id = _req.flag_id;
  _old_status := _flag.status;

  IF NOT _approve THEN
    UPDATE public.mkt_flag_change_requests
    SET state = 'rejected', approved_by = auth.uid(), approved_at = now(), decision_note = btrim(coalesce(_note, ''))
    WHERE id = _request_id;
    PERFORM public.mkt_ops_log_write(
      'flags.change_rejected', 'platform', 'mkt_feature_flags', _flag.id,
      format('رفض طلب تغيير مفتاح %s', _flag.flag_key),
      jsonb_build_object('request_id', _request_id, 'note', btrim(coalesce(_note, '')))
    );
    RETURN jsonb_build_object('request_id', _request_id, 'applied', false);
  END IF;

  IF _flag.is_protected AND _req.target_status <> 'on' THEN
    RAISE EXCEPTION 'PROTECTED_FLAG';
  END IF;

  UPDATE public.mkt_feature_flags
  SET status = _req.target_status,
      last_change_reason = _req.reason,
      last_changed_by = auth.uid(),
      expected_minutes = _req.expected_minutes,
      activated_at = CASE WHEN _req.target_status = 'on' THEN NULL ELSE now() END,
      activated_by = CASE WHEN _req.target_status = 'on' THEN NULL ELSE auth.uid() END
  WHERE id = _flag.id;

  UPDATE public.mkt_flag_change_requests
  SET state = 'applied', approved_by = auth.uid(), approved_at = now(), applied_at = now(),
      decision_note = btrim(coalesce(_note, ''))
  WHERE id = _request_id;

  PERFORM public.mkt_ops_log_write(
    'flags.changed', 'platform', 'mkt_feature_flags', _flag.id,
    format('تطبيق تغيير عام لمفتاح %s من %s إلى %s بموافقة ثانية', _flag.flag_key, _old_status, _req.target_status),
    jsonb_build_object('request_id', _request_id, 'from', _old_status, 'to', _req.target_status,
                       'level', _req.switch_level, 'reason', _req.reason,
                       'expected_minutes', _req.expected_minutes)
  );

  RETURN jsonb_build_object('request_id', _request_id, 'applied', true);
END;
$$;

-- حماية خادمية: تُستدعى داخل أي عملية حسّاسة قبل التنفيذ.
CREATE OR REPLACE FUNCTION public.mkt_feature_guard(_flag_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state jsonb;
BEGIN
  _state := public.mkt_feature_state(_flag_key);
  IF coalesce((_state->>'known')::boolean, false)
     AND NOT coalesce((_state->>'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'FEATURE_DISABLED:%', _flag_key;
  END IF;
  RETURN true;
END;
$$;

-- ---------- 7. content & link health scan ----------
CREATE OR REPLACE FUNCTION public.mkt_content_health_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seen text[] := '{}';
  _found integer := 0;
  _resolved integer := 0;
  r record;
BEGIN
  IF NOT public.mkt_admin_can('platform.health.view') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 1) روابط التحويل المكسورة أو الحلقية
  FOR r IN
    SELECT id, from_path, to_path FROM public.mkt_cms_page_redirects
  LOOP
    IF r.to_path IS NULL OR btrim(r.to_path) = '' OR r.to_path = r.from_path THEN
      INSERT INTO public.mkt_content_health_findings
        (check_key, severity, entity, entity_id, entity_label, dedupe_key, title_ar, detail_ar, href)
      VALUES ('redirect_loop', 'P2', 'mkt_cms_page_redirects', r.id, r.from_path,
              'redirect_loop:' || r.id::text, 'تحويل مسار غير صالح',
              format('التحويل من %s إلى %s غير صالح أو يشير لنفسه', r.from_path, coalesce(r.to_path, '—')),
              '/admin/content/pages')
      ON CONFLICT (dedupe_key) DO UPDATE
        SET occurrence_count = public.mkt_content_health_findings.occurrence_count + 1,
            last_seen_at = now(), resolved_at = NULL;
      _seen := _seen || ('redirect_loop:' || r.id::text);
      _found := _found + 1;
    END IF;
  END LOOP;

  -- 2) فتحات وسائط منشورة بلا مصدر
  FOR r IN
    SELECT slot_key, section FROM public.mkt_media_slots
    WHERE coalesce(hidden, false) = false
      AND coalesce(path, '') = '' AND coalesce(external_url, '') = ''
      AND coalesce(kind, '') IN ('image','video','lottie')
  LOOP
    INSERT INTO public.mkt_content_health_findings
      (check_key, severity, entity, entity_label, dedupe_key, title_ar, detail_ar, href)
    VALUES ('missing_media', 'P3', 'mkt_media_slots', r.slot_key,
            'missing_media:' || r.slot_key, 'فتحة وسائط ظاهرة بلا صورة',
            format('الفتحة %s في قسم %s ظاهرة بلا مصدر', r.slot_key, coalesce(r.section, '—')),
            '/admin/media')
    ON CONFLICT (dedupe_key) DO UPDATE
      SET occurrence_count = public.mkt_content_health_findings.occurrence_count + 1,
          last_seen_at = now(), resolved_at = NULL;
    _seen := _seen || ('missing_media:' || r.slot_key);
    _found := _found + 1;
  END LOOP;

  -- 3) حملات منتهية ما زالت مفعّلة
  FOR r IN
    SELECT id, slug, ends_at FROM public.mkt_ad_campaigns
    WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at < now()
  LOOP
    INSERT INTO public.mkt_content_health_findings
      (check_key, severity, entity, entity_id, entity_label, dedupe_key, title_ar, detail_ar, href)
    VALUES ('expired_campaign', 'P2', 'mkt_ad_campaigns', r.id, r.slug,
            'expired_campaign:' || r.id::text, 'حملة منتهية ما زالت مفعّلة',
            format('الحملة %s انتهت في %s وحالتها مفعّلة', r.slug, to_char(r.ends_at, 'DD/MM/YYYY')),
            '/admin/campaigns')
    ON CONFLICT (dedupe_key) DO UPDATE
      SET occurrence_count = public.mkt_content_health_findings.occurrence_count + 1,
          last_seen_at = now(), resolved_at = NULL;
    _seen := _seen || ('expired_campaign:' || r.id::text);
    _found := _found + 1;
  END LOOP;

  -- 4) مواضع إعلانية مفعّلة بلا حملة صالحة
  FOR r IN
    SELECT p.placement_key, p.name_ar FROM public.mkt_cms_ad_placements p
    WHERE p.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.mkt_cms_campaign_placements cp
        JOIN public.mkt_ad_campaigns c ON c.id = cp.campaign_id
        WHERE cp.placement_key = p.placement_key
          AND c.status = 'active'
          AND (cp.starts_at IS NULL OR cp.starts_at <= now())
          AND (cp.ends_at IS NULL OR cp.ends_at > now())
      )
  LOOP
    INSERT INTO public.mkt_content_health_findings
      (check_key, severity, entity, entity_label, dedupe_key, title_ar, detail_ar, href)
    VALUES ('placement_empty', 'P3', 'mkt_cms_ad_placements', r.placement_key,
            'placement_empty:' || r.placement_key, 'موضع إعلاني مفعّل بلا حملة',
            format('الموضع %s مفعّل ولا حملة صالحة تعرضه', coalesce(r.name_ar, r.placement_key)),
            '/admin/campaigns')
    ON CONFLICT (dedupe_key) DO UPDATE
      SET occurrence_count = public.mkt_content_health_findings.occurrence_count + 1,
          last_seen_at = now(), resolved_at = NULL;
    _seen := _seen || ('placement_empty:' || r.placement_key);
    _found := _found + 1;
  END LOOP;

  -- 5) صفحات منشورة بلا نسخة منشورة فعلية = رابط مكسور للعامة
  FOR r IN
    SELECT id, route_path, title_ar FROM public.mkt_cms_pages
    WHERE status = 'published' AND published_version_id IS NULL
  LOOP
    INSERT INTO public.mkt_content_health_findings
      (check_key, severity, entity, entity_id, entity_label, dedupe_key, title_ar, detail_ar, href)
    VALUES ('broken_link', 'P1', 'mkt_cms_pages', r.id, r.route_path,
            'broken_link:' || r.id::text, 'صفحة منشورة بلا نسخة منشورة',
            format('الصفحة %s (%s) معلَنة منشورة ولا نسخة منشورة لها', coalesce(r.title_ar, '—'), r.route_path),
            '/admin/content/pages')
    ON CONFLICT (dedupe_key) DO UPDATE
      SET occurrence_count = public.mkt_content_health_findings.occurrence_count + 1,
          last_seen_at = now(), resolved_at = NULL;
    _seen := _seen || ('broken_link:' || r.id::text);
    _found := _found + 1;
  END LOOP;

  -- ما لم يظهر في هذه الجولة يُغلق تلقائيًا
  UPDATE public.mkt_content_health_findings
  SET resolved_at = now()
  WHERE resolved_at IS NULL AND NOT (dedupe_key = ANY(_seen));
  _resolved := (SELECT count(*) FROM public.mkt_content_health_findings
                WHERE resolved_at IS NOT NULL AND resolved_at > now() - interval '1 minute');

  PERFORM public.mkt_ops_log_write(
    'content_health.scan', 'platform', 'mkt_content_health_findings', NULL,
    format('فحص سلامة المحتوى: %s ملاحظة قائمة', _found),
    jsonb_build_object('open_found', _found, 'auto_resolved', _resolved)
  );

  RETURN jsonb_build_object('scanned_at', now(), 'open_found', _found, 'auto_resolved', _resolved);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_content_health_open(_limit integer DEFAULT 50)
RETURNS SETOF public.mkt_content_health_findings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mkt_content_health_findings
  WHERE resolved_at IS NULL
    AND public.mkt_admin_can('platform.health.view')
  ORDER BY CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
           last_seen_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
$$;

-- ---------- 8. preflight override recording ----------
CREATE OR REPLACE FUNCTION public.mkt_cms_preflight_override(
  _page_id uuid,
  _codes text[],
  _reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _reason_clean text := btrim(coalesce(_reason, ''));
BEGIN
  IF NOT public.mkt_admin_can('settings.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF char_length(_reason_clean) < 10 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  INSERT INTO public.mkt_cms_preflight_overrides (page_id, codes, reason, created_by)
  VALUES (_page_id, coalesce(_codes, '{}'), _reason_clean, auth.uid())
  RETURNING id INTO _id;

  PERFORM public.mkt_ops_log_write(
    'cms.preflight_override', 'platform', 'mkt_cms_pages', _page_id,
    'تجاوز تحذيرات ما قبل النشر بسبب مسجَّل',
    jsonb_build_object('codes', to_jsonb(coalesce(_codes, '{}')), 'reason', _reason_clean)
  );

  RETURN _id;
END;
$$;

-- ---------- 9. new scheduled job definitions ----------
INSERT INTO public.mkt_platform_job_definitions
  (job_key, name_ar, name_en, unit, schedule_cron, is_enabled, max_attempts, backoff_seconds, timeout_seconds)
VALUES
  ('content_health_scan', 'فحص سلامة المحتوى', 'Content health scan', 'platform', '0 */6 * * *', true, 3, 120, 120),
  ('link_health_scan', 'فحص الروابط والتحويلات', 'Link health scan', 'platform', '30 3 * * *', true, 3, 120, 180),
  ('perf_budget_audit', 'مراجعة ميزانيات الأداء', 'Performance budget audit', 'platform', '0 4 * * *', true, 2, 300, 180)
ON CONFLICT (job_key) DO NOTHING;

-- ---------- 10. grants ----------
GRANT EXECUTE ON FUNCTION public.mkt_perf_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_flag_change_request(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_flag_change_decide(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_feature_guard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_content_health_scan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_content_health_open(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_cms_preflight_override(uuid, text[], text) TO authenticated;