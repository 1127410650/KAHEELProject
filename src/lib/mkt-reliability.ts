import { supabase } from "@/integrations/supabase/client";

/* ────────────────────────────────────────────────────────────────
   Batch 2 — reliability, feature flags, jobs, incidents
   Client-safe read/write helpers over the additive foundation
   tables (mkt_feature_flags, mkt_platform_job_*, mkt_platform_slos,
   mkt_health_*, mkt_alert_rules, mkt_platform_incidents,
   mkt_incident_timeline, mkt_platform_dependencies).
   All privileged mutations go through SECURITY DEFINER RPCs that
   re-check permissions server-side.
   ──────────────────────────────────────────────────────────────── */

/* ── health summary ── */

export interface HealthIngest {
  events_last_hour: number;
  events_last_day: number;
  last_event_at: string | null;
}

export interface HealthJobs {
  queued: number;
  running: number;
  failed: number;
  dead_letter: number;
  succeeded_last_day: number;
  p95_duration_ms: number;
}

export interface JobFreshness {
  job_key: string;
  enabled: boolean;
  last_success_at: string | null;
  minutes_since: number | null;
}

export interface HealthCheckState {
  check_key: string;
  service_key: string;
  state: string;
  value: number | null;
  observed_at: string | null;
}

export interface SloRow {
  service_key: string;
  name_ar: string;
  name_en: string;
  indicator: string;
  target_value: number | null;
  target_unit: string | null;
  baseline_value: number | null;
  runbook_slug: string | null;
}

export interface HealthSummary {
  generated_at: string;
  ingest: HealthIngest;
  jobs: HealthJobs;
  job_freshness: JobFreshness[];
  checks: HealthCheckState[];
  slos: SloRow[];
  incidents: { open: number; p0_p1_open: number; last_started_at: string | null };
  ops: { actions_last_day: number };
}

export async function loadHealthSummary(): Promise<HealthSummary> {
  const { data, error } = await supabase.rpc("mkt_platform_health_summary");
  if (error) throw error;
  return data as unknown as HealthSummary;
}

/* ── feature flags ── */

export interface FeatureFlagRow {
  id: string;
  flag_key: string;
  description_ar: string | null;
  description_en: string | null;
  unit: string;
  scope: string;
  status: string;
  rollout_percent: number;
  is_kill_switch: boolean;
  fallback_note: string | null;
  last_change_reason: string | null;
  review_at: string | null;
  expires_at: string | null;
  updated_at: string;
}

export interface FeatureOverrideRow {
  id: string;
  flag_id: string;
  match_kind: string;
  match_value: string;
  enabled: boolean;
  reason: string | null;
  expires_at: string | null;
}

export async function loadFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase
    .from("mkt_feature_flags")
    .select(
      "id, flag_key, description_ar, description_en, unit, scope, status, rollout_percent, is_kill_switch, fallback_note, last_change_reason, review_at, expires_at, updated_at",
    )
    .order("is_kill_switch", { ascending: false })
    .order("flag_key");
  if (error) throw error;
  return (data ?? []) as FeatureFlagRow[];
}

export async function loadFeatureOverrides(): Promise<FeatureOverrideRow[]> {
  const { data, error } = await supabase
    .from("mkt_feature_overrides")
    .select("id, flag_id, match_kind, match_value, enabled, reason, expires_at")
    .order("match_kind");
  if (error) throw error;
  return (data ?? []) as FeatureOverrideRow[];
}

export async function setFlagStatus(id: string, status: "on" | "off" | "internal"): Promise<void> {
  const { error } = await supabase.from("mkt_feature_flags").update({ status }).eq("id", id);
  if (error) throw error;
}

export interface FeatureState {
  flag_key: string;
  known: boolean;
  enabled: boolean;
  status?: string;
  scope?: string;
  rollout_percent?: number;
  is_kill_switch?: boolean;
  fallback_note?: string | null;
  override_applied?: boolean;
}

export async function resolveFeatureState(
  flagKey: string,
  country?: string | null,
  accountType?: string | null,
): Promise<FeatureState> {
  const { data, error } = await supabase.rpc("mkt_feature_state", {
    _flag_key: flagKey,
    ...(country ? { _country: country } : {}),
    ...(accountType ? { _account_type: accountType } : {}),
  });
  if (error) throw error;
  return data as unknown as FeatureState;
}

/* ── jobs ── */

export interface JobDefinitionRow {
  id: string;
  job_key: string;
  name_ar: string;
  name_en: string;
  unit: string;
  schedule_cron: string | null;
  is_enabled: boolean;
  max_attempts: number;
  backoff_seconds: number;
  timeout_seconds: number;
  runbook_slug: string | null;
}

export interface JobQueueRow {
  id: string;
  job_key: string;
  idempotency_key: string;
  status: string;
  attempts: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_summary: string | null;
  locked_by: string | null;
}

export async function loadJobDefinitions(): Promise<JobDefinitionRow[]> {
  const { data, error } = await supabase
    .from("mkt_platform_job_definitions")
    .select(
      "id, job_key, name_ar, name_en, unit, schedule_cron, is_enabled, max_attempts, backoff_seconds, timeout_seconds, runbook_slug",
    )
    .order("job_key");
  if (error) throw error;
  return (data ?? []) as JobDefinitionRow[];
}

export async function loadJobQueue(limit = 60): Promise<JobQueueRow[]> {
  const { data, error } = await supabase
    .from("mkt_platform_job_queue")
    .select(
      "id, job_key, idempotency_key, status, attempts, scheduled_for, started_at, finished_at, duration_ms, error_summary, locked_by",
    )
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JobQueueRow[];
}

export async function setJobEnabled(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_platform_job_definitions")
    .update({ is_enabled: isEnabled })
    .eq("id", id);
  if (error) throw error;
}

export async function enqueueJob(
  jobKey: string,
  idempotencyKey: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_jobs_enqueue", {
    _job_key: jobKey,
    _idempotency_key: idempotencyKey,
    _payload: payload as never,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function requeueJob(id: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_platform_job_queue")
    .update({ status: "queued", scheduled_for: new Date().toISOString(), error_summary: null })
    .eq("id", id);
  if (error) throw error;
}

/* ── incidents ── */

export interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  service_key: string | null;
  rule_key: string | null;
  incident_number: number;
  started_at: string;
  mitigated_at: string | null;
  resolved_at: string | null;
  occurrence_count: number;
  root_cause: string | null;
}

export interface IncidentTimelineRow {
  id: string;
  incident_id: string;
  at: string;
  kind: string;
  body: string | null;
}

export async function loadIncidents(limit = 50): Promise<IncidentRow[]> {
  const { data, error } = await supabase
    .from("mkt_platform_incidents")
    .select(
      "id, incident_number, title, severity, status, service_key, rule_key, started_at, mitigated_at, resolved_at, occurrence_count, root_cause",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function loadIncidentTimeline(incidentId: string): Promise<IncidentTimelineRow[]> {
  const { data, error } = await supabase
    .from("mkt_incident_timeline")
    .select("id, incident_id, at, kind, body")
    .eq("incident_id", incidentId)
    .order("at");
  if (error) throw error;
  return (data ?? []) as IncidentTimelineRow[];
}

export async function openIncident(
  ruleKey: string,
  title: string,
  severity?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_incident_open", {
    _rule_key: ruleKey,
    _title: title,
    ...(severity ? { _severity: severity } : {}),
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function setIncidentStatus(
  id: string,
  status: "open" | "mitigating" | "monitoring" | "resolved",
  note?: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch = {
    status,
    ...(status === "resolved" ? { resolved_at: nowIso } : {}),
    ...(status === "mitigating" ? { mitigated_at: nowIso } : {}),
  };
  const { error } = await supabase.from("mkt_platform_incidents").update(patch).eq("id", id);
  if (error) throw error;
  const { error: timelineError } = await supabase.from("mkt_incident_timeline").insert({
    incident_id: id,
    kind: status === "resolved" ? "resolve" : "update",
    body: note ?? null,
  });
  if (timelineError) throw timelineError;
}

/* ── dependencies & alert rules (read-only surfaces) ── */

export interface DependencyRow {
  id: string;
  source_kind: string;
  source_id: string;
  target_kind: string;
  target_id: string;
  relation: string;
  is_published_path: boolean;
  detected_at: string;
}

export async function loadDependencies(): Promise<DependencyRow[]> {
  const { data, error } = await supabase
    .from("mkt_platform_dependencies")
    .select("id, source_kind, source_id, target_kind, target_id, relation, is_published_path, detected_at")
    .order("is_published_path", { ascending: false })
    .order("source_kind");
  if (error) throw error;
  return (data ?? []) as DependencyRow[];
}

export interface AlertRuleRow {
  id: string;
  rule_key: string;
  service_key: string | null;
  severity: string;
  condition_note: string | null;
  dedupe_window_minutes: number;
  is_active: boolean;
  runbook_slug: string | null;
}

export async function loadAlertRules(): Promise<AlertRuleRow[]> {
  const { data, error } = await supabase
    .from("mkt_alert_rules")
    .select(
      "id, rule_key, service_key, severity, condition_note, dedupe_window_minutes, is_active, runbook_slug",
    )
    .order("severity")
    .order("rule_key");
  if (error) throw error;
  return (data ?? []) as AlertRuleRow[];
}

/* ── shared display helpers ── */

export const SEVERITY_LABEL_AR: Record<string, string> = {
  P0: "حرِج",
  P1: "عالٍ",
  P2: "متوسط",
  P3: "منخفض",
};

export const JOB_STATUS_LABEL_AR: Record<string, string> = {
  queued: "في الطابور",
  running: "قيد التنفيذ",
  succeeded: "نجحت",
  failed: "فشلت",
  dead_letter: "رسائل ميتة",
  canceled: "ملغاة",
};

export const INCIDENT_STATUS_LABEL_AR: Record<string, string> = {
  open: "مفتوحة",
  mitigating: "تحت المعالجة",
  monitoring: "مراقبة",
  resolved: "مغلقة",
};

export const FLAG_STATUS_LABEL_AR: Record<string, string> = {
  on: "مفعّل",
  off: "معطّل",
  internal: "داخلي فقط",
};
