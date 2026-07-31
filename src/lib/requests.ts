/**
 * Single source of truth for the supervisor-request lifecycle.
 * Mirrors the database (request_can_transition / request_progress) for the UI.
 */

export const REQUEST_STAGES = [
  "awaiting_reply",
  "under_review",
  "assigned",
  "processing",
  "needs_info",
  "supervisor_replied",
  "review_after_info",
  "awaiting_approval",
  "approved",
  "awaiting_execution",
  "executing",
  "executed",
  "completed",
] as const;

export type RequestStage = (typeof REQUEST_STAGES)[number];

/** Extra financial / terminal states outside the linear stage list. */
export const EXTRA_STATUSES = ["awaiting_payment", "paid", "rejected", "cancelled"] as const;

export const ALL_REQUEST_STATUSES = [...REQUEST_STAGES, ...EXTRA_STATUSES] as const;

/** Legacy value kept in old rows; treated as the first stage. */
export function normalizeStatus(status: string): string {
  return status === "new" ? "awaiting_reply" : status;
}

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  awaiting_reply: ["under_review", "assigned", "cancelled", "rejected"],
  under_review: [
    "assigned",
    "processing",
    "needs_info",
    "awaiting_approval",
    "cancelled",
    "rejected",
  ],
  assigned: ["processing", "needs_info", "awaiting_approval", "cancelled", "rejected"],
  processing: ["needs_info", "awaiting_approval", "awaiting_payment", "cancelled", "rejected"],
  needs_info: ["supervisor_replied", "cancelled", "rejected"],
  supervisor_replied: ["review_after_info", "cancelled"],
  review_after_info: ["processing", "needs_info", "awaiting_approval", "cancelled", "rejected"],
  awaiting_approval: ["approved", "rejected", "needs_info", "cancelled"],
  approved: ["awaiting_execution", "cancelled"],
  awaiting_execution: ["executing", "awaiting_payment", "cancelled"],
  executing: ["executed", "awaiting_payment", "cancelled"],
  executed: ["completed", "awaiting_payment"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["executed", "completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function nextStatuses(from: string): string[] {
  return ALLOWED_TRANSITIONS[normalizeStatus(from)] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  return normalizeStatus(from) === to || nextStatuses(from).includes(to);
}

export const CLOSED_STATUSES = ["completed", "rejected", "cancelled"];

export function isClosed(status: string): boolean {
  return CLOSED_STATUSES.includes(status);
}

/** 0–100. Mirrors public.request_progress(). */
export function requestProgress(status: string): number {
  if (status === "rejected" || status === "cancelled") return 100;
  if (status === "paid") return 92;
  if (status === "awaiting_payment") return 85;
  if (status === "new") return 8;
  const index = REQUEST_STAGES.indexOf(status as RequestStage);
  if (index < 0) return 0;
  return Math.floor(((index + 1) * 100) / REQUEST_STAGES.length);
}

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Supervisor-facing request kinds, grouped by the four families in the spec. */
export const PORTAL_KINDS = [
  "general",
  "project_service",
  "custody_topup",
  "payment",
  "project_create",
  "document_upload",
  "utility_meter",
] as const;

export type PortalKind = (typeof PORTAL_KINDS)[number];

export function kindNeedsProject(kind: string): boolean {
  return kind !== "general" && kind !== "project_create";
}

export function kindNeedsAmount(kind: string): boolean {
  return kind === "custody_topup" || kind === "payment";
}

/** Named inbox views shared by the requests list. */
export const INBOX_VIEWS = [
  "all",
  "mine",
  "assigned_to_me",
  "awaiting_my_review",
  "awaiting_my_approval",
  "needs_info",
  "awaiting_execution",
  "overdue",
  "completed",
  "rejected",
] as const;

export type InboxView = (typeof INBOX_VIEWS)[number];

export interface InboxRow {
  status: string;
  assigned_to: string | null;
  requester_id: string | null;
  created_by: string | null;
  due_date: string | null;
  need_date: string | null;
}

export function matchesInboxView(
  row: InboxRow,
  view: InboxView,
  userId: string | undefined,
  today: string,
): boolean {
  const status = normalizeStatus(row.status);
  switch (view) {
    case "all":
      return true;
    case "mine":
      return row.requester_id === userId || row.created_by === userId;
    case "assigned_to_me":
      return !!userId && row.assigned_to === userId;
    case "awaiting_my_review":
      return ["awaiting_reply", "under_review", "assigned", "processing", "review_after_info"].includes(
        status,
      );
    case "awaiting_my_approval":
      return status === "awaiting_approval";
    case "needs_info":
      return status === "needs_info";
    case "awaiting_execution":
      return ["approved", "awaiting_execution", "executing"].includes(status);
    case "overdue": {
      const deadline = row.due_date ?? row.need_date;
      return !!deadline && deadline < today && !isClosed(status);
    }
    case "completed":
      return status === "completed" || status === "executed";
    case "rejected":
      return status === "rejected" || status === "cancelled";
    default:
      return true;
  }
}
