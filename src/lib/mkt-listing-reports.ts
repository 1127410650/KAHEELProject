import { supabase } from "@/integrations/supabase/client";

/**
 * Listing-reports back office. Every read and write goes through a
 * permission-gated database function: the reporter's identity is replaced by a
 * server-side alias unless the caller holds `reports.view_reporter_identity`,
 * and every lifecycle transition is validated server-side.
 */

/** Simplified, enforced report lifecycle (server mirrors this graph exactly). */
export const LR_STATUSES = [
  "new",
  "under_review",
  "awaiting_reporter",
  "action_taken",
  "invalid",
  "closed",
] as const;
export type LrStatus = (typeof LR_STATUSES)[number];

/** Allowed transitions — same table as `mkt_report_transition_ok`. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["under_review"],
  unassigned: ["under_review"],
  reopened: ["under_review"],
  under_review: ["awaiting_reporter", "action_taken", "invalid"],
  awaiting_reporter: ["under_review", "invalid"],
  action_taken: ["closed"],
  invalid: ["closed"],
  closed: ["reopened"],
};

export function nextStatuses(current: string): string[] {
  return TRANSITIONS[current] ?? [];
}

export function transitionPerm(to: string): string {
  if (to === "closed") return "reports.close";
  if (to === "reopened") return "ads.reports_reopen";
  return "ads.reports_manage";
}

export const LR_REASON_REQUIRED = ["closed", "invalid", "reopened"];

export interface AdminListingReport {
  id: string;
  ref_no: string | null;
  status: string;
  severity: string;
  priority: string;
  reason_code: string | null;
  reason_name_ar: string | null;
  reason_name_en: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  sla_due_at: string | null;
  listing_id: string;
  listing_ref: string | null;
  listing_title: string | null;
  listing_status: string | null;
  listing_slug: string | null;
  listing_city: string | null;
  owner_label: string | null;
  owner_business: string | null;
  listing_report_count: number;
  assigned_to: string | null;
  assignee_label: string | null;
  last_action: string | null;
  last_action_at: string | null;
  reporter_alias: string;
  reporter_identity: string | null;
  reporter_invalid_count: number;
  can_view_reporter: boolean;
  total_count: number;
}

export interface LrFilters {
  search?: string | undefined;
  status?: string | undefined;
  reason?: string | undefined;
  priority?: string | undefined;
  assignee?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  suspendedOnly?: boolean | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function loadListingReports(filters: LrFilters): Promise<AdminListingReport[]> {
  const size = filters.pageSize ?? 25;
  const { data, error } = await supabase.rpc("mkt_admin_listing_reports", {
    _search: filters.search?.trim() || null,
    _status: filters.status || null,
    _reason: filters.reason || null,
    _priority: filters.priority || null,
    _assignee: filters.assignee || null,
    _from: filters.from ? `${filters.from}T00:00:00Z` : null,
    _to: filters.to ? `${filters.to}T23:59:59Z` : null,
    _suspended_only: filters.suspendedOnly ?? false,
    _limit: size,
    _offset: (filters.page ?? 0) * size,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminListingReport[];
}

export interface LrStaffOption {
  user_id: string;
  label: string;
}

export async function loadReportStaffOptions(): Promise<LrStaffOption[]> {
  const { data, error } = await supabase.rpc("mkt_report_staff_options");
  if (error) throw error;
  return (data ?? []) as unknown as LrStaffOption[];
}

export async function transitionReport(
  reportId: string,
  to: string,
  reason?: string | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_transition", {
    _report_id: reportId,
    _to: to,
    _reason: reason?.trim() || null,
  } as never);
  if (error) throw error;
}

export const LR_LISTING_ACTIONS = [
  "suspend",
  "unsuspend",
  "request_edit",
  "reject",
  "archive",
  "extend",
] as const;
export type LrListingAction = (typeof LR_LISTING_ACTIONS)[number];

export const LR_EXTEND_DAYS = [1, 3, 7, 14, 30] as const;

export async function reportListingAction(params: {
  reportId: string;
  action: LrListingAction;
  reason: string;
  days?: number | undefined;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_report_listing_action", {
    _report_id: params.reportId,
    _action: params.action,
    _reason: params.reason,
    _days: params.days ?? null,
  } as never);
  if (error) throw error;
  return (data ?? "") as unknown as string;
}

/** Map an RPC failure onto an i18n key under `market.lr.err.*`. */
export function lrErrorKey(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? "";
  if (/invalid_transition/i.test(message)) return "invalidTransition";
  if (/reason_required|A reason is required/i.test(message)) return "reasonRequired";
  if (/invalid_duration/i.test(message)) return "invalidDuration";
  if (/forbidden|Not authorized|permission denied/i.test(message)) return "forbidden";
  if (/Conflict of interest/i.test(message)) return "conflict";
  if (/not_found|Report not found/i.test(message)) return "notFound";
  if (/Assignee is not a review staff member/i.test(message)) return "assigneeNotStaff";
  if (/Failed to fetch|NetworkError/i.test(message)) return "network";
  return "failed";
}
