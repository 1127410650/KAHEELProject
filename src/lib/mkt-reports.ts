import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";

/* ────────────────────────────  types  ──────────────────────────── */

export const REPORT_STATUSES = [
  "new",
  "unassigned",
  "under_review",
  "awaiting_reporter",
  "awaiting_advertiser",
  "action_taken",
  "closed",
  "reopened",
  "duplicate",
  "invalid",
  "out_of_scope",
  "escalated",
  "referred",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

export const REPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export const LISTING_ENFORCEMENTS = [
  "none",
  "warn",
  "request_edit",
  "hide",
  "suspend",
  "reject",
  "archive",
  "soft_delete",
  "republish",
] as const;
export type ListingEnforcement = (typeof LISTING_ENFORCEMENTS)[number];

export const ACCOUNT_RESTRICTIONS = [
  "warning",
  "no_new_listings",
  "no_submit_review",
  "no_messaging",
  "no_new_requests",
  "suspend_listings",
  "suspend_account",
  "suspend_business_publishing",
  "revoke_verification",
  "permanent_ban",
] as const;
export type AccountRestriction = (typeof ACCOUNT_RESTRICTIONS)[number];

export const APPEAL_STATUSES = [
  "new",
  "under_review",
  "accepted",
  "partially_accepted",
  "rejected",
] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

/** Staff permissions understood by the marketplace back office. */
export const STAFF_PERMS = [
  "reports.inbox_view",
  "reports.review",
  "reports.assign",
  "reports.message_reporter",
  "reports.message_advertiser",
  "reports.add_internal_note",
  "reports.close",
  "reports.reopen",
  "reports.escalate",
  "reports.merge",
  "reports.audit_view",
  "reports.view_reporter_identity",
  "ads.moderation_hide",
  "ads.moderation_suspend",
  "ads.moderation_unsuspend",
  "ads.moderation_request_edit",
  "ads.moderation_archive",
  "ads.moderation_extend",
  "ads.events_view",
  "ads.view_ip_device",
  "accounts.restrict",
  "accounts.suspend",
  "businesses.suspend",
  "businesses.revoke_verification",
  "appeals.review",
] as const;
export type StaffPerm = (typeof STAFF_PERMS)[number];

export interface MktReportReason {
  code: string;
  name_ar: string;
  name_en: string;
  default_severity: ReportSeverity;
  requires_note: boolean;
  sort_order: number;
}

export interface ListingSnapshot {
  title?: string;
  summary?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  city?: string | null;
  status?: string | null;
  slug?: string | null;
  cover_image_url?: string | null;
  images?: string[];
  captured_at?: string;
}

/** Columns the reporter is allowed to see — internal fields are never selected. */
export const REPORT_REPORTER_COLUMNS =
  "id, ref_no, listing_id, reason_code, note, status, created_at, updated_at, closed_at, public_outcome";

/** Full row for the back office. */
export const REPORT_ADMIN_COLUMNS =
  "id, ref_no, listing_id, reporter_user_id, owner_user_id, tenant_id, reason_code, note, status, severity, priority, assigned_to, assigned_at, sla_due_at, first_response_at, closed_at, reopened_at, decision, decision_reason, public_outcome, merged_into, listing_snapshot, created_at, updated_at";

export interface MktReportPublic {
  id: string;
  ref_no: string | null;
  listing_id: string;
  reason_code: string | null;
  note: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  public_outcome: string | null;
}

export interface MktReportAdmin extends MktReportPublic {
  reporter_user_id: string;
  owner_user_id: string | null;
  tenant_id: string | null;
  severity: ReportSeverity;
  priority: ReportPriority;
  assigned_to: string | null;
  assigned_at: string | null;
  sla_due_at: string | null;
  first_response_at: string | null;
  reopened_at: string | null;
  decision: string | null;
  decision_reason: string | null;
  merged_into: string | null;
  listing_snapshot: ListingSnapshot | null;
}

export interface MktReportMessage {
  id: string;
  report_id: string;
  channel: "reporter" | "advertiser";
  sender_side: "staff" | "reporter" | "advertiser";
  sender_user_id: string | null;
  kind: string | null;
  body: string;
  attachment_path: string | null;
  due_at: string | null;
  created_at: string;
}

export interface MktReportFile {
  id: string;
  report_id: string;
  appeal_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  side: "reporter" | "advertiser" | "staff";
  created_at: string;
}

export interface MktReportNote {
  id: string;
  report_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
}

export interface MktStatusEvent {
  id: string;
  report_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export interface MktEnforcementAction {
  id: string;
  report_id: string | null;
  target_type: "listing" | "user" | "business";
  target_id: string;
  action: string;
  reason: string | null;
  duration_days: number | null;
  expires_at: string | null;
  created_at: string;
}

export interface MktRestriction {
  id: string;
  report_id: string | null;
  subject_type: "user" | "business";
  subject_id: string;
  restriction: AccountRestriction;
  reason: string;
  starts_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_reason: string | null;
  created_at: string;
}

export interface MktAppeal {
  id: string;
  report_id: string;
  listing_id: string | null;
  submitted_by: string;
  reason: string;
  status: AppealStatus;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MktModerationCase {
  report_id: string;
  ref_no: string | null;
  listing_id: string | null;
  listing_title: string | null;
  status: ReportStatus;
  severity: ReportSeverity;
  reason_code: string | null;
  decision: string | null;
  decision_reason: string | null;
  created_at: string;
  closed_at: string | null;
  can_appeal: boolean;
}

export interface MktNotification {
  id: string;
  report_id: string | null;
  event: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

/* ──────────────────  user-facing status simplification  ────────────────── */

export type SimpleStage =
  | "received"
  | "reviewing"
  | "needsInfo"
  | "actionTaken"
  | "notViolating"
  | "closed"
  | "appealReview";

export function simpleStage(status: ReportStatus, appealOpen = false): SimpleStage {
  if (appealOpen) return "appealReview";
  switch (status) {
    case "new":
    case "unassigned":
      return "received";
    case "awaiting_reporter":
      return "needsInfo";
    case "action_taken":
      return "actionTaken";
    case "invalid":
    case "out_of_scope":
      return "notViolating";
    case "closed":
    case "duplicate":
      return "closed";
    default:
      return "reviewing";
  }
}

/* ────────────────────────────  error mapping  ──────────────────────────── */

const ERROR_MAP: [RegExp, string][] = [
  [/cannot report your own listing/i, "ownListing"],
  [/already have an open report/i, "duplicateOpen"],
  [/Too many reports/i, "rateLimitHour"],
  [/Daily report limit/i, "rateLimitDay"],
  [/description is required/i, "noteRequired"],
  [/Confirmation required/i, "confirmRequired"],
  [/Account restricted/i, "accountRestricted"],
  [/Sign in required/i, "signInRequired"],
  [/Listing not found/i, "listingNotFound"],
  [/Unknown reason/i, "unknownReason"],
  [/Conflict of interest/i, "conflict"],
  [/A reason is required/i, "reasonRequired"],
  [/An appeal is already under review/i, "appealOpen"],
  [/appeal window has ended/i, "appealWindow"],
  [/No decision to appeal yet/i, "appealTooEarly"],
  [/Severe decisions must be reviewed/i, "appealSuperAdmin"],
  [/same reviewer cannot decide/i, "appealSameReviewer"],
  [/Assignee is not a review staff member/i, "assigneeNotStaff"],
  [/Cannot merge into itself/i, "mergeSelf"],
  [/Empty (message|note)/i, "emptyBody"],
  [/account suspension is restricted/i, "notAuthorized"],
  [/Not authorized/i, "notAuthorized"],
  [/permission denied/i, "notAuthorized"],
];

/** Turn a raw RPC/Postgres error into an i18n key under market.reports.err.* */
export function reportErrorKey(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "");
  for (const [pattern, key] of ERROR_MAP) if (pattern.test(message)) return key;
  return "generic";
}

/* ────────────────────────────  attachments  ──────────────────────────── */

export const REPORT_FILE_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const REPORT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const REPORT_FILE_MAX_COUNT = 5;

export function validateReportFile(file: File): "type" | "size" | null {
  if (!REPORT_FILE_MIMES.includes(file.type)) return "type";
  if (file.size > REPORT_FILE_MAX_BYTES) return "size";
  return null;
}

function safeExtension(name: string): string {
  const ext = name.split(".").pop() ?? "";
  return /^[a-z0-9]{1,5}$/i.test(ext) ? `.${ext.toLowerCase()}` : "";
}

/** Upload supporting files for a report/appeal into the private bucket and register them. */
export async function uploadReportFiles(params: {
  reportId: string;
  side: "reporter" | "advertiser" | "staff";
  files: File[];
  appealId?: string | undefined;
}): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in required");

  let saved = 0;
  for (const file of params.files.slice(0, REPORT_FILE_MAX_COUNT)) {
    if (validateReportFile(file)) continue;
    const path = `reports/${params.reportId}/${params.side}/${crypto.randomUUID()}${safeExtension(file.name)}`;
    const { error: upErr } = await supabase.storage.from(MKT_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw upErr;
    const { error } = await supabase.from("mkt_report_files").insert({
      report_id: params.reportId,
      ...(params.appealId ? { appeal_id: params.appealId } : {}),
      storage_path: path,
      file_name: file.name.slice(0, 120),
      mime_type: file.type,
      size_bytes: file.size,
      side: params.side,
      uploaded_by: uid,
    });
    if (error) throw error;
    saved += 1;
  }
  return saved;
}

/** Short-lived signed URL; access is still decided by storage policies. */
export async function reportFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/* ────────────────────────────  reporter side  ──────────────────────────── */

export async function loadReportReasons(): Promise<MktReportReason[]> {
  const { data } = await supabase
    .from("mkt_report_reasons")
    .select("code, name_ar, name_en, default_severity, requires_note, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as MktReportReason[];
}

export async function submitReport(params: {
  listingId: string;
  reasonCode: string;
  note: string;
  confirmed: boolean;
}): Promise<{ report_id: string; ref_no: string }> {
  const { data, error } = await supabase.rpc("mkt_submit_report", {
    _listing_id: params.listingId,
    _reason_code: params.reasonCode,
    _note: (params.note || null) as never,
    _confirmed: params.confirmed,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { report_id: string; ref_no: string };
}

export async function loadMyReports(): Promise<MktReportPublic[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("mkt_reports")
    .select(REPORT_REPORTER_COLUMNS)
    .eq("reporter_user_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as MktReportPublic[];
}

export async function loadReportForReporter(id: string): Promise<MktReportPublic | null> {
  const { data } = await supabase
    .from("mkt_reports")
    .select(REPORT_REPORTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as MktReportPublic | null) ?? null;
}

export async function loadReportMessages(
  reportId: string,
  channel?: "reporter" | "advertiser",
): Promise<MktReportMessage[]> {
  let query = supabase
    .from("mkt_report_messages")
    .select(
      "id, report_id, channel, sender_side, sender_user_id, kind, body, attachment_path, due_at, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at");
  if (channel) query = query.eq("channel", channel);
  const { data } = await query;
  return (data ?? []) as MktReportMessage[];
}

export async function loadReportFiles(
  reportId: string,
  side?: "reporter" | "advertiser" | "staff",
): Promise<MktReportFile[]> {
  let query = supabase
    .from("mkt_report_files")
    .select(
      "id, report_id, appeal_id, storage_path, file_name, mime_type, size_bytes, side, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at");
  if (side) query = query.eq("side", side);
  const { data } = await query;
  return (data ?? []) as MktReportFile[];
}

/** Reply in the caller's own channel (reporter or advertiser — decided server-side). */
export async function replyToReport(
  reportId: string,
  body: string,
  attachmentPath?: string | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_reply", {
    _report_id: reportId,
    _body: body,
    ...(attachmentPath ? { _attachment_path: attachmentPath } : {}),
  });
  if (error) throw error;
}

/* ────────────────────────────  advertiser side  ──────────────────────────── */

export async function loadMyModerationCases(): Promise<MktModerationCase[]> {
  const { data, error } = await supabase.rpc("mkt_my_moderation_cases");
  if (error) throw error;
  return (data ?? []) as MktModerationCase[];
}

export async function loadAppeals(reportIds?: string[]): Promise<MktAppeal[]> {
  let query = supabase
    .from("mkt_appeals")
    .select(
      "id, report_id, listing_id, submitted_by, reason, status, decision_reason, decided_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (reportIds && reportIds.length > 0) query = query.in("report_id", reportIds);
  const { data } = await query;
  return (data ?? []) as MktAppeal[];
}

export async function submitAppeal(reportId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_submit_appeal", {
    _report_id: reportId,
    _reason: reason,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function loadMyEnforcement(reportIds: string[]): Promise<MktEnforcementAction[]> {
  if (reportIds.length === 0) return [];
  const { data } = await supabase
    .from("mkt_enforcement_actions")
    .select(
      "id, report_id, target_type, target_id, action, reason, duration_days, expires_at, created_at",
    )
    .in("report_id", reportIds)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktEnforcementAction[];
}

export async function loadMyRestrictions(): Promise<MktRestriction[]> {
  const { data } = await supabase
    .from("mkt_account_restrictions")
    .select(
      "id, report_id, subject_type, subject_id, restriction, reason, starts_at, expires_at, lifted_at, lifted_reason, created_at",
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as MktRestriction[];
}

/* ────────────────────────────  staff permissions  ──────────────────────────── */

export interface StaffAccess {
  isAdmin: boolean;
  perms: string[];
  can: (perm: StaffPerm) => boolean;
}

export async function loadStaffAccess(): Promise<{ isAdmin: boolean; perms: string[] }> {
  const [{ data: isAdmin }, { data: rows }] = await Promise.all([
    supabase.rpc("mkt_is_platform_admin"),
    supabase.from("mkt_staff_permissions").select("perm"),
  ]);
  return {
    isAdmin: isAdmin === true,
    perms: ((rows ?? []) as { perm: string }[]).map((r) => r.perm),
  };
}

export function makeStaffAccess(data: { isAdmin: boolean; perms: string[] } | undefined): StaffAccess {
  const isAdmin = data?.isAdmin === true;
  const perms = data?.perms ?? [];
  return {
    isAdmin,
    perms,
    // Platform admins are super admins server-side, so mirror that in the UI.
    can: (perm) => isAdmin || perms.includes(perm),
  };
}

/* ────────────────────────────  back office  ──────────────────────────── */

export type Worklist =
  | "new"
  | "unassigned"
  | "mine"
  | "needs_info"
  | "escalated"
  | "pending_decision"
  | "appeals"
  | "closed"
  | "all";

export interface AdminReportFilters {
  worklist: Worklist;
  ref?: string;
  status?: string;
  priority?: string;
  severity?: string;
  reason?: string;
  assignee?: string;
  from?: string;
  to?: string;
  sla?: "" | "overdue" | "ontime";
}

export async function loadAdminReports(
  filters: AdminReportFilters,
  currentUserId: string | null,
): Promise<MktReportAdmin[]> {
  let query = supabase
    .from("mkt_reports")
    .select(REPORT_ADMIN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  const closedSet = ["closed", "duplicate", "invalid", "out_of_scope"];
  switch (filters.worklist) {
    case "new":
      query = query.in("status", ["new", "unassigned"]);
      break;
    case "unassigned":
      query = query.is("assigned_to", null).not("status", "in", `(${closedSet.join(",")})`);
      break;
    case "mine":
      query = query.eq("assigned_to", currentUserId ?? "00000000-0000-0000-0000-000000000000");
      break;
    case "needs_info":
      query = query.in("status", ["awaiting_reporter", "awaiting_advertiser"]);
      break;
    case "escalated":
      query = query.in("status", ["escalated", "referred"]);
      break;
    case "pending_decision":
      query = query.in("status", ["under_review", "reopened", "action_taken"]);
      break;
    case "closed":
      query = query.in("status", closedSet);
      break;
    default:
      break;
  }

  if (filters.ref) query = query.ilike("ref_no", `%${filters.ref}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.reason) query = query.eq("reason_code", filters.reason);
  if (filters.assignee) query = query.eq("assigned_to", filters.assignee);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59Z`);
  if (filters.sla === "overdue") query = query.lt("sla_due_at", new Date().toISOString());
  if (filters.sla === "ontime") query = query.gte("sla_due_at", new Date().toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MktReportAdmin[];
}

export interface ReportStats {
  new: number;
  open: number;
  unassigned: number;
  critical: number;
  overdue: number;
  avg_first_response_hours: number;
  avg_close_hours: number;
}

export async function loadReportStats(): Promise<ReportStats | null> {
  const { data, error } = await supabase.rpc("mkt_report_stats");
  if (error) return null;
  return (data ?? null) as ReportStats | null;
}

export async function loadReportNotes(reportId: string): Promise<MktReportNote[]> {
  const { data } = await supabase
    .from("mkt_report_notes")
    .select("id, report_id, body, author_id, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktReportNote[];
}

export async function loadStatusHistory(reportId: string): Promise<MktStatusEvent[]> {
  const { data } = await supabase
    .from("mkt_report_status_history")
    .select("id, report_id, from_status, to_status, reason, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktStatusEvent[];
}

export async function loadEnforcementActions(reportId: string): Promise<MktEnforcementAction[]> {
  const { data } = await supabase
    .from("mkt_enforcement_actions")
    .select(
      "id, report_id, target_type, target_id, action, reason, duration_days, expires_at, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktEnforcementAction[];
}

export async function loadReportRestrictions(reportId: string): Promise<MktRestriction[]> {
  const { data } = await supabase
    .from("mkt_account_restrictions")
    .select(
      "id, report_id, subject_type, subject_id, restriction, reason, starts_at, expires_at, lifted_at, lifted_reason, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktRestriction[];
}

export async function assignReport(reportId: string, assignee: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_assign", {
    _report_id: reportId,
    _assignee: assignee,
  });
  if (error) throw error;
}

export async function setReportStatus(
  reportId: string,
  status: ReportStatus,
  reason?: string | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_set_status", {
    _report_id: reportId,
    _status: status,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

export async function setReportPriority(
  reportId: string,
  priority: ReportPriority,
  severity?: ReportSeverity | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_set_priority", {
    _report_id: reportId,
    _priority: priority,
    ...(severity ? { _severity: severity } : {}),
  });
  if (error) throw error;
}

export async function staffMessage(params: {
  reportId: string;
  channel: "reporter" | "advertiser";
  body: string;
  kind?: string | undefined;
  dueDays?: number | undefined;
  attachmentPath?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_message", {
    _report_id: params.reportId,
    _channel: params.channel,
    _body: params.body,
    ...(params.kind ? { _kind: params.kind } : {}),
    ...(params.dueDays ? { _due_days: params.dueDays } : {}),
    ...(params.attachmentPath ? { _attachment_path: params.attachmentPath } : {}),
  });
  if (error) throw error;
}

export async function addInternalNote(reportId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_note", { _report_id: reportId, _body: body });
  if (error) throw error;
}

export async function mergeReport(reportId: string, into: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_merge", { _report_id: reportId, _into: into });
  if (error) throw error;
}

export async function closeReport(params: {
  reportId: string;
  decision: string;
  reason: string;
  publicOutcome?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_close", {
    _report_id: params.reportId,
    _decision: params.decision,
    _reason: params.reason,
    _public_outcome: (params.publicOutcome || null) as never,
  });
  if (error) throw error;
}

export async function reopenReport(reportId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_report_reopen", {
    _report_id: reportId,
    _reason: reason,
  });
  if (error) throw error;
}

export async function enforceListing(params: {
  reportId: string;
  action: ListingEnforcement;
  reason?: string | undefined;
  days?: number | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_enforce_listing", {
    _report_id: params.reportId,
    _action: params.action,
    ...(params.reason ? { _reason: params.reason } : {}),
    ...(params.days ? { _days: params.days } : {}),
  });
  if (error) throw error;
}

export async function restrictSubject(params: {
  reportId?: string | undefined;
  subjectType: "user" | "business";
  subjectId: string;
  restriction: AccountRestriction;
  reason: string;
  days?: number | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_restrict_subject", {
    _report_id: (params.reportId || null) as never,
    _subject_type: params.subjectType,
    _subject_id: params.subjectId,
    _restriction: params.restriction,
    _reason: params.reason,
    ...(params.days ? { _days: params.days } : {}),
  });
  if (error) throw error;
}

export async function liftRestriction(restrictionId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_lift_restriction", {
    _restriction_id: restrictionId,
    _reason: reason,
  });
  if (error) throw error;
}

export async function reviewAppeal(
  appealId: string,
  status: AppealStatus,
  reason?: string | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_review_appeal", {
    _appeal_id: appealId,
    _status: status,
    _reason: (reason || null) as never,
  });
  if (error) throw error;
}

/* ────────────────────────────  notifications  ──────────────────────────── */

export async function loadMktNotifications(): Promise<MktNotification[]> {
  const { data } = await supabase
    .from("mkt_notifications")
    .select("id, report_id, event, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as MktNotification[];
}

export async function markMktNotificationRead(id: string): Promise<void> {
  await supabase
    .from("mkt_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}

/** SLA helpers used by the inbox and the report card. */
export function slaRemainingHours(dueAt: string | null): number | null {
  if (!dueAt) return null;
  return (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
}

export function isOverdue(report: Pick<MktReportAdmin, "sla_due_at" | "status">): boolean {
  const remaining = slaRemainingHours(report.sla_due_at);
  if (remaining === null) return false;
  return remaining < 0 && !["closed", "duplicate", "invalid", "out_of_scope"].includes(report.status);
}
