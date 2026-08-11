-- ============================================================
-- Batch 2 — operations & reliability foundation (additive only)
-- Reuses: mkt_admin_can(), mkt_is_platform_admin(), mkt_ops_log
-- All new public tables carry the mkt_ prefix (structure guard).
-- ============================================================

-- shared updated_at trigger (create only if absent)
CREATE OR REPLACE FUNCTION public.mkt_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- 1. feature flags ----------
CREATE TABLE public.mkt_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  description_ar text,
  description_en text,
  owner_user_id uuid,
  unit text NOT NULL DEFAULT 'platform',
  status text NOT NULL DEFAULT 'off',
  scope text NOT NULL DEFAULT 'global',
  rollout_percent integer NOT NULL DEFAULT 0,
  fallback_note text,
  depends_on text[] NOT NULL DEFAULT '{}',
  review_at timestamptz,
  expires_at timestamptz,
  is_kill_switch boolean NOT NULL DEFAULT false,
  last_changed_by uuid,
  last_change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_feature_flags_status_chk CHECK (status IN ('off','on','partial','deprecated')),
  CONSTRAINT mkt_feature_flags_scope_chk CHECK (scope IN ('global','country','account_type','tenant','percent','environment')),
  CONSTRAINT mkt_feature_flags_rollout_chk CHECK (rollout_percent BETWEEN 0 AND 100)
);

CREATE TABLE public.mkt_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.mkt_feature_flags(id) ON DELETE CASCADE,
  match_kind text NOT NULL,
  match_value text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_feature_overrides_kind_chk CHECK (match_kind IN ('country','account_type','tenant','environment')),
  CONSTRAINT mkt_feature_overrides_unique UNIQUE (flag_id, match_kind, match_value)
);
CREATE INDEX mkt_feature_overrides_flag_idx ON public.mkt_feature_overrides(flag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_feature_flags TO authenticated;
GRANT ALL ON public.mkt_feature_flags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_feature_overrides TO authenticated;
GRANT ALL ON public.mkt_feature_overrides TO service_role;
ALTER TABLE public.mkt_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags readable by admin staff" ON public.mkt_feature_flags
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('platform.health.view') OR public.mkt_admin_can('flags.manage'));
CREATE POLICY "flags managed by flag owners" ON public.mkt_feature_flags
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('flags.manage'))
  WITH CHECK (public.mkt_admin_can('flags.manage'));

CREATE POLICY "flag overrides readable by admin staff" ON public.mkt_feature_overrides
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('platform.health.view') OR public.mkt_admin_can('flags.manage'));
CREATE POLICY "flag overrides managed by flag owners" ON public.mkt_feature_overrides
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('flags.manage'))
  WITH CHECK (public.mkt_admin_can('flags.manage'));

CREATE TRIGGER mkt_feature_flags_touch BEFORE UPDATE ON public.mkt_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();
CREATE TRIGGER mkt_feature_overrides_touch BEFORE UPDATE ON public.mkt_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 2. job registry & queue ----------
CREATE TABLE public.mkt_platform_job_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  unit text NOT NULL DEFAULT 'platform',
  version integer NOT NULL DEFAULT 1,
  schedule_cron text,
  timeout_seconds integer NOT NULL DEFAULT 120,
  max_attempts integer NOT NULL DEFAULT 5,
  backoff_seconds integer NOT NULL DEFAULT 30,
  is_enabled boolean NOT NULL DEFAULT true,
  owner_user_id uuid,
  runbook_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_job_defs_timeout_chk CHECK (timeout_seconds BETWEEN 5 AND 3600),
  CONSTRAINT mkt_job_defs_attempts_chk CHECK (max_attempts BETWEEN 1 AND 20)
);

CREATE TABLE public.mkt_platform_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL REFERENCES public.mkt_platform_job_definitions(job_key) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  error_summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_job_queue_status_chk CHECK (status IN ('queued','running','succeeded','failed','dead_letter','cancelled')),
  CONSTRAINT mkt_job_queue_idem_unique UNIQUE (job_key, idempotency_key)
);
CREATE INDEX mkt_job_queue_pick_idx ON public.mkt_platform_job_queue(status, scheduled_for);
CREATE INDEX mkt_job_queue_job_idx ON public.mkt_platform_job_queue(job_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_job_definitions TO authenticated;
GRANT ALL ON public.mkt_platform_job_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_job_queue TO authenticated;
GRANT ALL ON public.mkt_platform_job_queue TO service_role;
ALTER TABLE public.mkt_platform_job_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_platform_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job defs readable by ops staff" ON public.mkt_platform_job_definitions
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('platform.health.view') OR public.mkt_admin_can('jobs.manage'));
CREATE POLICY "job defs managed by ops staff" ON public.mkt_platform_job_definitions
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('jobs.manage'))
  WITH CHECK (public.mkt_admin_can('jobs.manage'));
CREATE POLICY "job queue readable by ops staff" ON public.mkt_platform_job_queue
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('platform.health.view') OR public.mkt_admin_can('jobs.manage'));
CREATE POLICY "job queue managed by ops staff" ON public.mkt_platform_job_queue
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('jobs.manage'))
  WITH CHECK (public.mkt_admin_can('jobs.manage'));

CREATE TRIGGER mkt_job_defs_touch BEFORE UPDATE ON public.mkt_platform_job_definitions
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();
CREATE TRIGGER mkt_job_queue_touch BEFORE UPDATE ON public.mkt_platform_job_queue
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 3. SLOs & health checks ----------
CREATE TABLE public.mkt_platform_slos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  unit text NOT NULL DEFAULT 'platform',
  indicator text NOT NULL,
  target_value numeric(10,3) NOT NULL,
  target_unit text NOT NULL DEFAULT 'ms',
  window_days integer NOT NULL DEFAULT 30,
  baseline_value numeric(10,3),
  baseline_measured_at timestamptz,
  owner_user_id uuid,
  runbook_slug text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_slos_indicator_chk CHECK (indicator IN ('latency_p50','latency_p95','latency_p99','error_rate','success_rate','saturation','freshness')),
  CONSTRAINT mkt_slos_window_chk CHECK (window_days BETWEEN 1 AND 365)
);

CREATE TABLE public.mkt_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL UNIQUE,
  service_key text REFERENCES public.mkt_platform_slos(service_key) ON DELETE SET NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  kind text NOT NULL DEFAULT 'query',
  is_active boolean NOT NULL DEFAULT true,
  interval_minutes integer NOT NULL DEFAULT 15,
  warn_threshold numeric(10,3),
  fail_threshold numeric(10,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_health_kind_chk CHECK (kind IN ('query','rpc','http','derived')),
  CONSTRAINT mkt_health_interval_chk CHECK (interval_minutes BETWEEN 1 AND 1440)
);
CREATE INDEX mkt_health_checks_service_idx ON public.mkt_health_checks(service_key);

CREATE TABLE public.mkt_health_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL REFERENCES public.mkt_health_checks(check_key) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL,
  value numeric(12,3),
  duration_ms integer,
  correlation_id uuid,
  detail text,
  CONSTRAINT mkt_health_runs_state_chk CHECK (state IN ('ok','warn','fail','unknown'))
);
CREATE INDEX mkt_health_runs_check_time_idx ON public.mkt_health_runs(check_key, observed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_slos TO authenticated;
GRANT ALL ON public.mkt_platform_slos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_health_checks TO authenticated;
GRANT ALL ON public.mkt_health_checks TO service_role;
GRANT SELECT, INSERT ON public.mkt_health_runs TO authenticated;
GRANT ALL ON public.mkt_health_runs TO service_role;
ALTER TABLE public.mkt_platform_slos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_health_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slos readable by ops staff" ON public.mkt_platform_slos
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "slos managed by slo owners" ON public.mkt_platform_slos
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('platform.slo.manage'))
  WITH CHECK (public.mkt_admin_can('platform.slo.manage'));
CREATE POLICY "health checks readable by ops staff" ON public.mkt_health_checks
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "health checks managed by slo owners" ON public.mkt_health_checks
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('platform.slo.manage'))
  WITH CHECK (public.mkt_admin_can('platform.slo.manage'));
CREATE POLICY "health runs readable by ops staff" ON public.mkt_health_runs
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "health runs written by ops staff" ON public.mkt_health_runs
  FOR INSERT TO authenticated WITH CHECK (public.mkt_admin_can('platform.health.view'));

CREATE TRIGGER mkt_slos_touch BEFORE UPDATE ON public.mkt_platform_slos
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();
CREATE TRIGGER mkt_health_checks_touch BEFORE UPDATE ON public.mkt_health_checks
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 4. alert rules, incidents, runbooks ----------
CREATE TABLE public.mkt_platform_runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  unit text NOT NULL DEFAULT 'platform',
  owner_user_id uuid,
  body_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mkt_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  service_key text REFERENCES public.mkt_platform_slos(service_key) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'P2',
  condition_note text NOT NULL,
  owner_user_id uuid,
  runbook_slug text REFERENCES public.mkt_platform_runbooks(slug) ON DELETE SET NULL,
  dedupe_window_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_alert_rules_sev_chk CHECK (severity IN ('P0','P1','P2','P3')),
  CONSTRAINT mkt_alert_rules_dedupe_chk CHECK (dedupe_window_minutes BETWEEN 1 AND 1440)
);
CREATE INDEX mkt_alert_rules_service_idx ON public.mkt_alert_rules(service_key);
CREATE INDEX mkt_alert_rules_runbook_idx ON public.mkt_alert_rules(runbook_slug);

CREATE TABLE public.mkt_platform_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'P2',
  status text NOT NULL DEFAULT 'open',
  service_key text REFERENCES public.mkt_platform_slos(service_key) ON DELETE SET NULL,
  rule_key text REFERENCES public.mkt_alert_rules(rule_key) ON DELETE SET NULL,
  lead_user_id uuid,
  correlation_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  mitigated_at timestamptz,
  resolved_at timestamptz,
  root_cause text,
  postmortem text,
  occurrence_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_incidents_sev_chk CHECK (severity IN ('P0','P1','P2','P3')),
  CONSTRAINT mkt_incidents_status_chk CHECK (status IN ('open','mitigating','monitoring','resolved','cancelled'))
);
CREATE INDEX mkt_incidents_status_idx ON public.mkt_platform_incidents(status, started_at DESC);
CREATE INDEX mkt_incidents_service_idx ON public.mkt_platform_incidents(service_key);
CREATE INDEX mkt_incidents_rule_idx ON public.mkt_platform_incidents(rule_key);

CREATE TABLE public.mkt_incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.mkt_platform_incidents(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  CONSTRAINT mkt_incident_timeline_kind_chk CHECK (kind IN ('note','detect','mitigate','escalate','resolve','postmortem'))
);
CREATE INDEX mkt_incident_timeline_incident_idx ON public.mkt_incident_timeline(incident_id, at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_runbooks TO authenticated;
GRANT ALL ON public.mkt_platform_runbooks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_alert_rules TO authenticated;
GRANT ALL ON public.mkt_alert_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_incidents TO authenticated;
GRANT ALL ON public.mkt_platform_incidents TO service_role;
GRANT SELECT, INSERT ON public.mkt_incident_timeline TO authenticated;
GRANT ALL ON public.mkt_incident_timeline TO service_role;
ALTER TABLE public.mkt_platform_runbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_platform_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_incident_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runbooks readable by ops staff" ON public.mkt_platform_runbooks
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "runbooks managed by incident managers" ON public.mkt_platform_runbooks
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('platform.incidents.manage'))
  WITH CHECK (public.mkt_admin_can('platform.incidents.manage'));
CREATE POLICY "alert rules readable by ops staff" ON public.mkt_alert_rules
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "alert rules managed by slo owners" ON public.mkt_alert_rules
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('platform.slo.manage'))
  WITH CHECK (public.mkt_admin_can('platform.slo.manage'));
CREATE POLICY "incidents readable by ops staff" ON public.mkt_platform_incidents
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "incidents managed by incident managers" ON public.mkt_platform_incidents
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('platform.incidents.manage'))
  WITH CHECK (public.mkt_admin_can('platform.incidents.manage'));
CREATE POLICY "incident timeline readable by ops staff" ON public.mkt_incident_timeline
  FOR SELECT TO authenticated USING (public.mkt_admin_can('platform.health.view'));
CREATE POLICY "incident timeline appended by incident managers" ON public.mkt_incident_timeline
  FOR INSERT TO authenticated WITH CHECK (public.mkt_admin_can('platform.incidents.manage'));

CREATE TRIGGER mkt_runbooks_touch BEFORE UPDATE ON public.mkt_platform_runbooks
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();
CREATE TRIGGER mkt_alert_rules_touch BEFORE UPDATE ON public.mkt_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();
CREATE TRIGGER mkt_incidents_touch BEFORE UPDATE ON public.mkt_platform_incidents
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 5. dependency & impact map ----------
CREATE TABLE public.mkt_platform_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL,
  source_id text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  relation text NOT NULL DEFAULT 'uses',
  is_published_path boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_dependencies_unique UNIQUE (source_kind, source_id, target_kind, target_id, relation),
  CONSTRAINT mkt_dependencies_relation_chk CHECK (relation IN ('uses','renders','links_to','targets','tracks','indexes','gated_by'))
);
CREATE INDEX mkt_dependencies_target_idx ON public.mkt_platform_dependencies(target_kind, target_id);
CREATE INDEX mkt_dependencies_source_idx ON public.mkt_platform_dependencies(source_kind, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_platform_dependencies TO authenticated;
GRANT ALL ON public.mkt_platform_dependencies TO service_role;
ALTER TABLE public.mkt_platform_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependencies readable by content and ops staff" ON public.mkt_platform_dependencies
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('platform.dependencies.view') OR public.mkt_admin_can('platform.health.view'));
CREATE POLICY "dependencies managed by ops staff" ON public.mkt_platform_dependencies
  FOR ALL TO authenticated
  USING (public.mkt_admin_can('jobs.manage'))
  WITH CHECK (public.mkt_admin_can('jobs.manage'));

CREATE TRIGGER mkt_dependencies_touch BEFORE UPDATE ON public.mkt_platform_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ---------- 6. permission keys (§26) recognised by mkt_admin_can ----------
CREATE OR REPLACE FUNCTION public.mkt_admin_can(_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.mkt_is_platform_admin()
      OR public.mkt_staff_has(_perm)
      OR CASE _perm
           WHEN 'users.view'          THEN public.mkt_staff_has('accounts.restrict') OR public.mkt_staff_has('accounts.suspend')
           WHEN 'users.manage'        THEN public.mkt_staff_has('accounts.restrict')
           WHEN 'businesses.view'     THEN public.mkt_staff_has('businesses.suspend') OR public.mkt_staff_has('verifications.review')
           WHEN 'businesses.manage'   THEN public.mkt_staff_has('businesses.suspend')
           WHEN 'listings.view'       THEN public.mkt_staff_has('ads.events_view') OR public.mkt_staff_has('ads.moderation_hide')
           WHEN 'listings.review'     THEN public.mkt_staff_has('ads.moderation_hide') OR public.mkt_staff_has('ads.moderation_suspend')
           WHEN 'reports.view'        THEN public.mkt_staff_has('reports.inbox_view')
           WHEN 'reports.manage'      THEN public.mkt_staff_has('reports.review')
           WHEN 'verifications.view'  THEN public.mkt_staff_has('verifications.review')
           WHEN 'verifications.manage' THEN public.mkt_staff_has('verifications.review')
           WHEN 'docs.view_sensitive' THEN public.mkt_staff_has('verifications.review')
           WHEN 'notes.read'          THEN public.mkt_staff_has('reports.add_internal_note')
           WHEN 'notes.write'         THEN public.mkt_staff_has('reports.add_internal_note')
           WHEN 'restrictions.manage' THEN public.mkt_staff_has('accounts.restrict')
           -- Batch 2 additions (§26): reliability & operations. Managing implies viewing;
           -- no reverse implication, and no single fallback grants an approval right.
           WHEN 'platform.health.view' THEN public.mkt_staff_has('platform.slo.manage')
                                         OR public.mkt_staff_has('platform.incidents.manage')
                                         OR public.mkt_staff_has('jobs.manage')
                                         OR public.mkt_staff_has('flags.manage')
           WHEN 'platform.dependencies.view' THEN public.mkt_staff_has('jobs.manage')
                                              OR public.mkt_staff_has('content.publish')
           ELSE false
         END
$function$;

-- ---------- 7. seed the reliability baseline (definitions only, no test data) ----------
INSERT INTO public.mkt_platform_runbooks (slug, title_ar, title_en, unit, body_ar, body_en) VALUES
  ('auth-degraded', 'تدهور تسجيل الدخول', 'Sign-in degraded', 'account',
   E'1. راجع سجل مصادقة Supabase.\n2. تحقق من إعدادات الروابط (Site URL / Redirect URLs).\n3. لا تعطّل المصادقة في الوضع الآمن أبدًا.\n4. صعّد إلى P1 عند فشل يمس عددًا كبيرًا.',
   E'1. Check Supabase auth logs.\n2. Verify Site URL / Redirect URLs.\n3. Never disable auth in safe mode.\n4. Escalate to P1 when many users are affected.'),
  ('ingest-backlog', 'تراكم استقبال الأحداث', 'Analytics ingest backlog', 'platform',
   E'1. راجع معدل الأحداث في الساعة.\n2. عطّل الأحداث منخفضة القيمة بمفتاح الإيقاف.\n3. أبقِ أحداث الأمان والطلبات تعمل.',
   E'1. Review hourly event rate.\n2. Disable low-value events via kill switch.\n3. Keep security and order events flowing.'),
  ('search-fallback', 'رجوع البحث إلى الأساسي', 'Search fallback', 'market',
   E'1. تأكد من فشل البحث المتقدم.\n2. فعّل مفتاح الرجوع للبحث الأساسي.\n3. سجّل حادثة P2 وراقب النتائج الصفرية.',
   E'1. Confirm advanced search failure.\n2. Enable the basic-search fallback flag.\n3. Open a P2 incident and watch zero-result rate.');

INSERT INTO public.mkt_platform_slos (service_key, name_ar, name_en, unit, indicator, target_value, target_unit, runbook_slug) VALUES
  ('auth',        'الدخول والجلسات', 'Auth & sessions',      'account',  'success_rate', 99.000, '%',  'auth-degraded'),
  ('market_home', 'السوق والرئيسية', 'Marketplace home',     'market',   'latency_p95',  2500.000, 'ms', NULL),
  ('search',      'البحث',            'Search',               'market',   'latency_p95',  1200.000, 'ms', 'search-fallback'),
  ('uploads',     'رفع الملفات',      'File uploads',         'platform', 'success_rate', 98.000, '%',  NULL),
  ('content_publish', 'النشر والمحتوى', 'Content publishing', 'platform', 'success_rate', 99.000, '%',  NULL),
  ('analytics_ingest', 'استقبال الأحداث', 'Analytics ingest', 'platform', 'success_rate', 99.000, '%',  'ingest-backlog'),
  ('messaging',   'الرسائل والتواصل', 'Messaging',            'market',   'latency_p95',  1500.000, 'ms', NULL),
  ('orders',      'الطلبات والمشاريع', 'Orders & projects',   'platform', 'success_rate', 99.000, '%',  NULL),
  ('jobs',        'المهام والتقارير', 'Jobs & reports',        'platform', 'freshness',    60.000, 'min', NULL);

INSERT INTO public.mkt_alert_rules (rule_key, name_ar, name_en, service_key, severity, condition_note, runbook_slug) VALUES
  ('auth_success_drop', 'انخفاض نجاح الدخول', 'Auth success drop', 'auth', 'P1', 'success_rate < 99% خلال 15 دقيقة', 'auth-degraded'),
  ('ingest_failures', 'فشل استقبال الأحداث', 'Ingest failures', 'analytics_ingest', 'P2', 'فشل الاستقبال > 2% خلال ساعة', 'ingest-backlog'),
  ('search_slow', 'بطء البحث', 'Search latency', 'search', 'P2', 'p95 > 1200ms خلال 30 دقيقة', 'search-fallback'),
  ('jobs_stale', 'تأخر المهام', 'Jobs stale', 'jobs', 'P2', 'آخر نجاح أقدم من 60 دقيقة', NULL);

INSERT INTO public.mkt_platform_job_definitions (job_key, name_ar, name_en, unit, schedule_cron, timeout_seconds, max_attempts, runbook_slug) VALUES
  ('analytics_rollup', 'تجميع التحليلات', 'Analytics rollup', 'platform', '5 * * * *', 300, 5, 'ingest-backlog'),
  ('analytics_retention', 'تطهير الأحداث الخام', 'Analytics retention', 'platform', '30 3 * * *', 600, 3, 'ingest-backlog'),
  ('content_link_health', 'فحص صحة الروابط والأصول', 'Content link health', 'platform', '0 4 * * *', 600, 3, NULL),
  ('campaign_lifecycle', 'بدء وإنهاء الحملات', 'Campaign start/end', 'market', '*/15 * * * *', 120, 5, NULL),
  ('scheduled_publishing', 'النشر المجدول', 'Scheduled publishing', 'platform', '*/10 * * * *', 120, 5, NULL),
  ('health_probe', 'فحوص الصحة الدورية', 'Health probes', 'platform', '*/15 * * * *', 60, 2, NULL);

INSERT INTO public.mkt_feature_flags (flag_key, description_ar, description_en, unit, status, scope, fallback_note, is_kill_switch) VALUES
  ('platform.safe_mode', 'الوضع الآمن العام للمنصة — لا يعطّل المصادقة ولا الدخول الإداري', 'Global safe mode — never disables auth or admin access', 'platform', 'off', 'global', 'آخر نسخة منشورة + صفحة صيانة', true),
  ('analytics.low_value_events', 'استقبال الأحداث منخفضة القيمة', 'Low-value analytics events', 'platform', 'on', 'global', 'إيقافها لا يمس أحداث الأمان والطلبات', true),
  ('search.advanced', 'البحث المتقدم (تطبيع/مرادفات/تقارب)', 'Advanced search (normalisation/synonyms/fuzzy)', 'market', 'off', 'global', 'الرجوع إلى البحث الأساسي الحالي', true),
  ('analytics.realtime', 'التحليلات اللحظية', 'Realtime analytics', 'platform', 'off', 'global', 'آخر تجميع مع وقت التحديث', true),
  ('ads.commercial_inventory', 'بيع المساحات الإعلانية والفواتير', 'Ad inventory & platform invoices', 'market', 'off', 'global', 'إخفاء الوحدة بالكامل عن أصحاب الحسابات', false),
  ('experiments.enabled', 'إطار تجارب A/B', 'A/B experimentation framework', 'platform', 'off', 'global', 'عرض نسخة Control فقط', true),
  ('owner.recommendations', 'توصيات أصحاب الإعلانات والمتاجر', 'Owner recommendations', 'market', 'off', 'global', 'إخفاء القسم دون خانات فارغة', false),
  ('reports.scheduled', 'التقارير الدورية', 'Scheduled reports', 'platform', 'off', 'global', 'التقارير الفورية داخل التطبيق فقط', false);