-- ---------- job queue: idempotent enqueue ----------
CREATE OR REPLACE FUNCTION public.mkt_jobs_enqueue(
  _job_key text,
  _idempotency_key text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.mkt_admin_can('jobs.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.mkt_platform_job_queue (job_key, idempotency_key, payload, scheduled_for)
  VALUES (_job_key, _idempotency_key, coalesce(_payload, '{}'::jsonb), coalesce(_scheduled_for, now()))
  ON CONFLICT (job_key, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.mkt_platform_job_queue
     WHERE job_key = _job_key AND idempotency_key = _idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;

-- ---------- job queue: non-blocking claim (SKIP LOCKED) ----------
CREATE OR REPLACE FUNCTION public.mkt_jobs_claim(_worker text, _limit integer DEFAULT 1)
RETURNS SETOF public.mkt_platform_job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.mkt_admin_can('jobs.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
      FROM public.mkt_platform_job_queue q
      JOIN public.mkt_platform_job_definitions d ON d.job_key = q.job_key
     WHERE q.status = 'queued'
       AND q.scheduled_for <= now()
       AND d.is_enabled
     ORDER BY q.scheduled_for
     LIMIT greatest(1, least(coalesce(_limit, 1), 20))
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.mkt_platform_job_queue q
     SET status = 'running',
         attempts = q.attempts + 1,
         locked_at = now(),
         locked_by = left(coalesce(_worker, 'worker'), 60),
         started_at = now()
   WHERE q.id IN (SELECT id FROM picked)
  RETURNING q.*;
END;
$$;

-- ---------- job queue: finish with backoff / dead-letter ----------
CREATE OR REPLACE FUNCTION public.mkt_jobs_finish(_id uuid, _ok boolean, _error text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.mkt_platform_job_queue;
  v_def public.mkt_platform_job_definitions;
  v_status text;
BEGIN
  IF NOT public.mkt_admin_can('jobs.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT * INTO v_row FROM public.mkt_platform_job_queue WHERE id = _id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'job_not_found'; END IF;
  SELECT * INTO v_def FROM public.mkt_platform_job_definitions WHERE job_key = v_row.job_key;

  IF _ok THEN
    v_status := 'succeeded';
    UPDATE public.mkt_platform_job_queue
       SET status = v_status, finished_at = now(), locked_at = NULL, locked_by = NULL,
           duration_ms = greatest(0, (extract(epoch FROM (now() - coalesce(started_at, now()))) * 1000)::int),
           error_summary = NULL
     WHERE id = _id;
  ELSIF v_row.attempts >= coalesce(v_def.max_attempts, 5) THEN
    v_status := 'dead_letter';
    UPDATE public.mkt_platform_job_queue
       SET status = v_status, finished_at = now(), locked_at = NULL, locked_by = NULL,
           error_summary = left(coalesce(_error, 'unknown'), 500)
     WHERE id = _id;
  ELSE
    v_status := 'queued';
    UPDATE public.mkt_platform_job_queue
       SET status = v_status, locked_at = NULL, locked_by = NULL, finished_at = NULL,
           scheduled_for = now() + make_interval(secs => coalesce(v_def.backoff_seconds, 30) * power(2, greatest(0, v_row.attempts - 1))::int),
           error_summary = left(coalesce(_error, 'unknown'), 500)
     WHERE id = _id;
  END IF;
  RETURN v_status;
END;
$$;

-- ---------- incidents: dedupe-aware open ----------
CREATE OR REPLACE FUNCTION public.mkt_incident_open(
  _rule_key text,
  _title text,
  _severity text DEFAULT NULL,
  _correlation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule public.mkt_alert_rules;
  v_id uuid;
BEGIN
  IF NOT public.mkt_admin_can('platform.incidents.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT * INTO v_rule FROM public.mkt_alert_rules WHERE rule_key = _rule_key;

  SELECT i.id INTO v_id
    FROM public.mkt_platform_incidents i
   WHERE i.rule_key = _rule_key
     AND i.status IN ('open','mitigating','monitoring')
     AND i.started_at > now() - make_interval(mins => coalesce(v_rule.dedupe_window_minutes, 60))
   ORDER BY i.started_at DESC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.mkt_platform_incidents
       SET occurrence_count = occurrence_count + 1
     WHERE id = v_id;
    INSERT INTO public.mkt_incident_timeline (incident_id, actor_user_id, kind, body)
    VALUES (v_id, auth.uid(), 'detect', 'تكرار داخل نافذة التجميع — لم تُفتح حادثة ثانية');
    RETURN v_id;
  END IF;

  INSERT INTO public.mkt_platform_incidents (title, severity, service_key, rule_key, lead_user_id, correlation_id)
  VALUES (_title, coalesce(_severity, v_rule.severity, 'P2'), v_rule.service_key, _rule_key, auth.uid(), _correlation_id)
  RETURNING id INTO v_id;

  INSERT INTO public.mkt_incident_timeline (incident_id, actor_user_id, kind, body)
  VALUES (v_id, auth.uid(), 'detect', coalesce(v_rule.condition_note, 'فتح يدوي'));
  RETURN v_id;
END;
$$;

-- ---------- health summary from real sources ----------
CREATE OR REPLACE FUNCTION public.mkt_platform_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.mkt_admin_can('platform.health.view') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'ingest', (
      SELECT jsonb_build_object(
        'events_last_hour', count(*) FILTER (WHERE occurred_at > now() - interval '1 hour'),
        'events_last_day', count(*) FILTER (WHERE occurred_at > now() - interval '1 day'),
        'last_event_at', max(occurred_at)
      ) FROM analytics.events_raw
    ),
    'jobs', (
      SELECT jsonb_build_object(
        'queued', count(*) FILTER (WHERE status = 'queued'),
        'running', count(*) FILTER (WHERE status = 'running'),
        'failed', count(*) FILTER (WHERE status = 'failed'),
        'dead_letter', count(*) FILTER (WHERE status = 'dead_letter'),
        'succeeded_last_day', count(*) FILTER (WHERE status = 'succeeded' AND finished_at > now() - interval '1 day'),
        'p95_duration_ms', coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)
      ) FROM public.mkt_platform_job_queue
    ),
    'job_freshness', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'job_key', d.job_key,
        'enabled', d.is_enabled,
        'last_success_at', s.last_success_at,
        'minutes_since', CASE WHEN s.last_success_at IS NULL THEN NULL
                              ELSE floor(extract(epoch FROM (now() - s.last_success_at)) / 60)::int END
      ) ORDER BY d.job_key), '[]'::jsonb)
      FROM public.mkt_platform_job_definitions d
      LEFT JOIN (
        SELECT job_key, max(finished_at) AS last_success_at
          FROM public.mkt_platform_job_queue WHERE status = 'succeeded' GROUP BY job_key
      ) s ON s.job_key = d.job_key
    ),
    'checks', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'check_key', c.check_key,
        'service_key', c.service_key,
        'state', coalesce(r.state, 'unknown'),
        'value', r.value,
        'observed_at', r.observed_at
      ) ORDER BY c.check_key), '[]'::jsonb)
      FROM public.mkt_health_checks c
      LEFT JOIN LATERAL (
        SELECT state, value, observed_at FROM public.mkt_health_runs hr
         WHERE hr.check_key = c.check_key ORDER BY observed_at DESC LIMIT 1
      ) r ON true
      WHERE c.is_active
    ),
    'slos', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'service_key', service_key, 'name_ar', name_ar, 'name_en', name_en,
        'indicator', indicator, 'target_value', target_value, 'target_unit', target_unit,
        'baseline_value', baseline_value, 'runbook_slug', runbook_slug
      ) ORDER BY service_key), '[]'::jsonb)
      FROM public.mkt_platform_slos WHERE is_active
    ),
    'incidents', (
      SELECT jsonb_build_object(
        'open', count(*) FILTER (WHERE status IN ('open','mitigating','monitoring')),
        'p0_p1_open', count(*) FILTER (WHERE status IN ('open','mitigating','monitoring') AND severity IN ('P0','P1')),
        'last_started_at', max(started_at)
      ) FROM public.mkt_platform_incidents
    ),
    'ops', (
      SELECT jsonb_build_object('actions_last_day', count(*)) FROM public.mkt_ops_log WHERE at > now() - interval '1 day'
    )
  ) INTO v_out;

  RETURN v_out;
END;
$$;

-- ---------- feature flag resolution ----------
CREATE OR REPLACE FUNCTION public.mkt_feature_state(
  _flag_key text,
  _country text DEFAULT NULL,
  _account_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_flag public.mkt_feature_flags;
  v_override boolean;
  v_enabled boolean;
BEGIN
  SELECT * INTO v_flag FROM public.mkt_feature_flags WHERE flag_key = _flag_key;
  IF v_flag.id IS NULL THEN
    RETURN jsonb_build_object('flag_key', _flag_key, 'known', false, 'enabled', false, 'reason', 'unknown_flag');
  END IF;

  v_enabled := v_flag.status = 'on'
    AND (v_flag.expires_at IS NULL OR v_flag.expires_at > now());

  SELECT o.enabled INTO v_override
    FROM public.mkt_feature_overrides o
   WHERE o.flag_id = v_flag.id
     AND (o.expires_at IS NULL OR o.expires_at > now())
     AND ((o.match_kind = 'country' AND o.match_value = _country)
       OR (o.match_kind = 'account_type' AND o.match_value = _account_type))
   ORDER BY CASE o.match_kind WHEN 'country' THEN 1 ELSE 2 END
   LIMIT 1;

  IF v_override IS NOT NULL THEN v_enabled := v_override; END IF;

  RETURN jsonb_build_object(
    'flag_key', v_flag.flag_key,
    'known', true,
    'enabled', coalesce(v_enabled, false),
    'status', v_flag.status,
    'scope', v_flag.scope,
    'rollout_percent', v_flag.rollout_percent,
    'is_kill_switch', v_flag.is_kill_switch,
    'fallback_note', v_flag.fallback_note,
    'override_applied', v_override IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mkt_jobs_enqueue(text, text, jsonb, timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_jobs_claim(text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_jobs_finish(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_incident_open(text, text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_platform_health_summary() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_feature_state(text, text, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.mkt_jobs_enqueue(text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_jobs_claim(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_jobs_finish(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_incident_open(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_platform_health_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_feature_state(text, text, text) TO authenticated;