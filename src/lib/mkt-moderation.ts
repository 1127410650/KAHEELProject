/**
 * Platform-admin ads moderation: automated scan history + rule management.
 *
 * Every read goes through the tables the moderation job itself writes to
 * (`mkt_moderation_scans`, `mkt_moderation_rules`, `mkt_job_runs`), all of
 * which are admin-readable. Every write goes through a `SECURITY DEFINER`
 * RPC that re-checks the caller: dismissing a flag needs any platform admin,
 * saving or deleting a rule needs the system owner.
 */
import { supabase } from "@/integrations/supabase/client";

export type ScanDecision = "clean" | "review" | "block";
export type TriggerSource = "submit" | "reactivate" | "admin_rescan" | "price_change";

export interface ModerationSignal {
  type: "rule" | "contact_or_link" | "abnormal_price" | "duplicate_title" | "allow_list";
  rule_id?: string;
  category?: string;
  severity?: string;
  action?: string;
  weight?: number;
  field?: string;
  pattern?: string;
  excerpt?: string;
  [key: string]: unknown;
}

export interface ModerationScan {
  id: string;
  listing_id: string;
  decision: ScanDecision;
  score: number;
  policy_version: number | null;
  rules_evaluated: number | null;
  signals: ModerationSignal[];
  content_hash: string | null;
  trigger_source: TriggerSource;
  dismissed_at: string | null;
  dismissed_by: string | null;
  dismiss_reason: string | null;
  created_at: string;
}

export async function loadListingScans(listingId: string): Promise<ModerationScan[]> {
  const { data, error } = await supabase
    .from("mkt_moderation_scans")
    .select(
      "id, listing_id, decision, score, policy_version, rules_evaluated, signals, content_hash, trigger_source, dismissed_at, dismissed_by, dismiss_reason, created_at",
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    signals: Array.isArray(row.signals) ? (row.signals as ModerationSignal[]) : [],
  })) as ModerationScan[];
}

export async function dismissScan(scanId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_scan_dismiss", { _scan_id: scanId, _reason: reason });
  if (error) throw error;
}

// ── Rules ────────────────────────────────────────────────────────────────────

export type RuleKind = "word" | "phrase" | "regex";
export type RuleLang = "ar" | "en" | "any";
export type RuleCategory =
  | "profanity"
  | "sexual"
  | "threat"
  | "hate"
  | "racism"
  | "defamation"
  | "incitement"
  | "morals"
  | "fraud"
  | "prohibited"
  | "competitor"
  | "bypass"
  | "contact"
  | "spam"
  | "other";
export type RuleSeverity = "low" | "medium" | "high";
export type RuleAction = "flag" | "review" | "block" | "allow";

export interface ModerationRule {
  id: string;
  kind: RuleKind;
  pattern: string;
  normalized: string | null;
  lang: RuleLang;
  category: RuleCategory;
  severity: RuleSeverity;
  action: RuleAction;
  weight: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function loadModerationRules(): Promise<ModerationRule[]> {
  const { data, error } = await supabase
    .from("mkt_moderation_rules")
    .select("id, kind, pattern, normalized, lang, category, severity, action, weight, is_active, notes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ModerationRule[];
}

export interface ModerationRuleInput {
  id?: string | null;
  kind: RuleKind;
  pattern: string;
  lang: RuleLang;
  category: RuleCategory;
  severity: RuleSeverity;
  action: RuleAction;
  weight: number;
  is_active: boolean;
  notes: string | null;
}

export async function saveModerationRule(input: ModerationRuleInput): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_moderation_rule_save", {
    // the function accepts NULL for a new rule; generated types narrow it to string
    _id: (input.id ?? null) as unknown as string,
    _kind: input.kind,
    _pattern: input.pattern,
    _lang: input.lang,
    _category: input.category,
    _severity: input.severity,
    _action: input.action,
    _weight: input.weight,
    _is_active: input.is_active,
    _notes: (input.notes ?? null) as unknown as string,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteModerationRule(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_moderation_rule_delete", { _id: id, _reason: reason });
  if (error) throw error;
}

// ── Job runs ─────────────────────────────────────────────────────────────────

export interface JobRun {
  job: string;
  source: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  ok: boolean | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export async function loadRecentJobRuns(limit = 10): Promise<JobRun[]> {
  const { data, error } = await supabase
    .from("mkt_job_runs")
    .select("job, source, started_at, finished_at, duration_ms, ok, result, error")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JobRun[];
}

export interface RunTickResult {
  run_id: string;
  ok: boolean;
  result: Record<string, unknown>;
}

export async function runModerationTickNow(): Promise<RunTickResult> {
  const { data, error } = await supabase.rpc("mkt_admin_run_tick");
  if (error) throw error;
  return data as unknown as RunTickResult;
}

// ── Client-side "would this rule match" preview ─────────────────────────────

/**
 * Best-effort mirror of the server's text normalisation, used ONLY to preview
 * which active rules a pasted sample would touch. It is never the final
 * decision — the server re-normalises and re-scores independently.
 */
export function normalizeModerationText(input: string): string {
  let s = input.toLowerCase();
  // Strip Arabic diacritics and tatweel.
  s = s.replace(/[\u0617-\u061A\u064B-\u0652\u0670\u0640]/g, "");
  // Normalise alef variants, ya, ta-marbuta.
  s = s.replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627"); // آ أ إ ٱ -> ا
  s = s.replace(/\u0649/g, "\u064A"); // ى -> ي
  s = s.replace(/\u0629/g, "\u0647"); // ة -> ه
  // Leet-ish digit substitutions.
  const leet: Record<string, string> = {
    "@": "a",
    "$": "s",
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
  };
  s = s.replace(/[@$013457]/g, (ch) => leet[ch] ?? ch);
  // Strip everything that isn't a letter (keeps Arabic + Latin letters).
  s = s.replace(/[^\p{L}]+/gu, "");
  // Collapse 3+ repeated characters down to one.
  s = s.replace(/(.)\1{2,}/gu, "$1");
  return s;
}

export interface RuleMatchPreview {
  rule: ModerationRule;
  matched: boolean;
  excerpt: string | null;
}

/** Local, approximate preview only — the real decision is made server-side. */
export function previewRuleMatches(sample: string, rules: ModerationRule[]): RuleMatchPreview[] {
  const normalizedSample = normalizeModerationText(sample);
  return rules
    .filter((rule) => rule.is_active)
    .map((rule) => {
      try {
        if (rule.kind === "regex") {
          const re = new RegExp(rule.pattern, "iu");
          const match = sample.match(re);
          return { rule, matched: !!match, excerpt: match ? match[0].slice(0, 60) : null };
        }
        const needle = normalizeModerationText(rule.pattern);
        if (!needle) return { rule, matched: false, excerpt: null };
        const idx = normalizedSample.indexOf(needle);
        return { rule, matched: idx !== -1, excerpt: idx !== -1 ? needle : null };
      } catch {
        return { rule, matched: false, excerpt: null };
      }
    });
}

// ── Listing moderation summary (state/score shown on the admin listing file) ──

export interface ListingModerationSummary {
  moderation_state: string | null;
  moderation_score: number | null;
  last_scan_at: string | null;
}

export async function loadListingModerationSummary(
  listingId: string,
): Promise<ListingModerationSummary> {
  const { data, error } = await supabase
    .from("mkt_listings")
    .select("moderation_state, moderation_score, last_scan_at")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? { moderation_state: null, moderation_score: null, last_scan_at: null }) as ListingModerationSummary;
}

export interface ModerationThresholds {
  review: number;
  block: number;
}

export async function loadModerationThresholds(): Promise<{
  thresholds: ModerationThresholds | null;
  policyVersion: number | null;
}> {
  const { data, error } = await supabase
    .from("mkt_platform_settings")
    .select("key, value")
    .in("key", ["moderation.thresholds", "moderation.policy_version"]);
  if (error) throw error;
  const rows = (data ?? []) as { key: string; value: Record<string, unknown> }[];
  const thresholdsRow = rows.find((r) => r.key === "moderation.thresholds");
  const policyRow = rows.find((r) => r.key === "moderation.policy_version");
  const review = thresholdsRow?.value?.["review"];
  const block = thresholdsRow?.value?.["block"];
  const version = policyRow?.value?.["value"];
  return {
    thresholds:
      typeof review === "number" && typeof block === "number" ? { review, block } : null,
    policyVersion: typeof version === "number" ? version : null,
  };
}
