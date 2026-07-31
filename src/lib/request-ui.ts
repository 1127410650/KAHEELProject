/**
 * Presentation layer for requests.
 *
 * The database keeps the full 15-stage lifecycle; this module only groups those
 * stages into five user-facing phases and resolves the single "what do I do now"
 * action per role. No lifecycle rule, permission or transition is defined here —
 * every action below maps to an existing RPC.
 */

import { isClosed, normalizeStatus } from "@/lib/requests";

export const SIMPLE_STAGES = [
  "received",
  "reviewing",
  "action_needed",
  "approval_execution",
  "done",
] as const;

export type SimpleStage = (typeof SIMPLE_STAGES)[number] | "rejected" | "cancelled";

const STAGE_OF_STATUS: Record<string, SimpleStage> = {
  new: "received",
  awaiting_reply: "received",
  assigned: "received",
  under_review: "reviewing",
  processing: "reviewing",
  supervisor_replied: "reviewing",
  review_after_info: "reviewing",
  needs_info: "action_needed",
  awaiting_approval: "approval_execution",
  approved: "approval_execution",
  awaiting_execution: "approval_execution",
  executing: "approval_execution",
  awaiting_payment: "approval_execution",
  paid: "approval_execution",
  executed: "done",
  completed: "done",
  rejected: "rejected",
  cancelled: "cancelled",
};

export function simpleStage(status: string): SimpleStage {
  return STAGE_OF_STATUS[normalizeStatus(status)] ?? "received";
}

/** Index inside SIMPLE_STAGES, or -1 for terminal (rejected/cancelled). */
export function stageIndex(status: string): number {
  const stage = simpleStage(status);
  return (SIMPLE_STAGES as readonly string[]).indexOf(stage);
}

export function stageTone(stage: SimpleStage): string {
  switch (stage) {
    case "received":
      return "bg-info/10 text-info border-info/30";
    case "reviewing":
      return "bg-primary/10 text-primary border-primary/25";
    case "action_needed":
      return "bg-warning/20 text-warning-foreground border-warning/50";
    case "approval_execution":
      return "bg-primary/12 text-primary border-primary/30";
    case "done":
      return "bg-success/12 text-success border-success/30";
    default:
      return "bg-destructive/10 text-destructive border-destructive/30";
  }
}

/* ------------------------------------------------------------------ titles */

const PLACEHOLDER_TITLES = new Set(["0", "00", "000", "-", "--", "."]);

/** Internal/acceptance-test titles must never reach the end user. */
const TEST_TITLE_PATTERNS = [
  /^at\s|^at[_-]/i,
  /\bat\s+final\b/i,
  /\btest\b/i,
  /\bqa\b/i,
  /^smoke/i,
];

export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const value = (title ?? "").trim();
  if (!value) return true;
  if (PLACEHOLDER_TITLES.has(value)) return true;
  if (/^0+$/.test(value)) return true;
  return TEST_TITLE_PATTERNS.some((re) => re.test(value));
}

export interface TitleSource {
  title?: string | null;
  kind?: string | null;
  request_type?: string | null;
  service_type?: string | null;
  notes_ar?: string | null;
  reason?: string | null;
  beneficiary?: string | null;
  amount?: number | null;
  projectName?: string | null;
}

const KIND_TITLES_AR: Record<string, string> = {
  custody_topup: "طلب إضافة رصيد للعهدة",
  payment: "طلب صرف دفعة",
  project_create: "طلب إضافة مشروع",
  project_service: "طلب خدمة للمشروع",
  utility_meter: "طلب تركيب عداد",
  document_upload: "طلب إضافة مستندات",
  general: "طلب عام",
};

const KIND_TITLES_EN: Record<string, string> = {
  custody_topup: "Custody top-up request",
  payment: "Payment request",
  project_create: "New project request",
  project_service: "Project service request",
  utility_meter: "Utility meter request",
  document_upload: "Documents request",
  general: "General request",
};

/**
 * Auto-title: never shows "0"/"00"/empty or internal test titles.
 * `fallback` is the localized "طلب بدون عنوان" string.
 */
export function buildRequestTitle(
  row: TitleSource,
  fallback: string,
  locale: "ar" | "en" = "ar",
): string {
  if (!isPlaceholderTitle(row.title)) return row.title!.trim();

  const kind = row.kind ?? "general";
  const project = row.projectName?.trim();
  const amount = row.amount != null ? String(row.amount) : "";
  const kindLabel = (locale === "en" ? KIND_TITLES_EN : KIND_TITLES_AR)[kind];

  if (kind === "project_service" || kind === "utility_meter") {
    const service = row.service_type?.trim() || row.request_type?.trim();
    const parts = [service || kindLabel, project].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  if (kind === "custody_topup") {
    const parts = [kindLabel || row.request_type?.trim(), amount].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  if (kind === "payment") {
    const parts = [kindLabel || row.request_type?.trim(), project || row.beneficiary?.trim()].filter(
      Boolean,
    );
    if (parts.length) return parts.join(" — ");
  }

  const text = (row.notes_ar || row.reason || "").trim();
  if (text && !isPlaceholderTitle(text)) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  if (kindLabel) return project ? `${kindLabel} — ${project}` : kindLabel;
  if (!isPlaceholderTitle(row.request_type)) return row.request_type!.trim();
  return fallback;
}


/* ------------------------------------------------------------- work groups */

export const STAFF_GROUPS = [
  "mine_now",
  "awaiting_supervisor",
  "awaiting_approval",
  "awaiting_execution",
  "completed",
  "closed_other",
] as const;
export type StaffGroup = (typeof STAFF_GROUPS)[number];

const STAFF_GROUP_STATUSES: Record<StaffGroup, string[]> = {
  mine_now: [
    "awaiting_reply",
    "assigned",
    "under_review",
    "processing",
    "supervisor_replied",
    "review_after_info",
  ],
  awaiting_supervisor: ["needs_info"],
  awaiting_approval: ["awaiting_approval"],
  awaiting_execution: [
    "approved",
    "awaiting_execution",
    "executing",
    "awaiting_payment",
    "paid",
    "executed",
  ],
  completed: ["completed"],
  closed_other: ["rejected", "cancelled"],
};

export function staffGroupOf(status: string): StaffGroup {
  const s = normalizeStatus(status);
  for (const group of STAFF_GROUPS) {
    if (STAFF_GROUP_STATUSES[group].includes(s)) return group;
  }
  return "mine_now";
}

export const PORTAL_GROUPS = ["action_mine", "in_progress", "completed", "closed_other"] as const;
export type PortalGroup = (typeof PORTAL_GROUPS)[number];

export function portalGroupOf(status: string): PortalGroup {
  const s = normalizeStatus(status);
  if (s === "needs_info") return "action_mine";
  if (s === "rejected" || s === "cancelled") return "closed_other";
  if (s === "completed" || s === "executed") return "completed";
  return isClosed(s) ? "completed" : "in_progress";
}

/* ----------------------------------------------------------- action resolver */

export type ActionKind =
  | "none"
  | "reply_info"
  | "set_status"
  | "approve"
  | "reject"
  | "close"
  | "payment_dialog";

export interface NextAction {
  /** i18n key describing the situation, shown as the card body. */
  messageKey: string;
  /** i18n key of the single primary button, when an action is available. */
  buttonKey?: string;
  kind: ActionKind;
  /** Target status for `set_status` / `payment_dialog`. */
  target?: string;
  tone: "info" | "warning" | "success" | "danger";
}

export interface ActionContext {
  role: string | null | undefined;
  isSupervisorView: boolean;
  isRequester: boolean;
  can: (perm: string) => boolean;
}

const IDLE: NextAction = { messageKey: "action.none", kind: "none", tone: "info" };

/** Resolves the one action the current viewer should take on this request. */
export function resolveNextAction(
  request: { status: string; info_state?: string | null },
  ctx: ActionContext,
): NextAction {
  const status = normalizeStatus(request.status);

  if (status === "rejected")
    return { messageKey: "action.rejected", kind: "none", tone: "danger" };
  if (status === "cancelled")
    return { messageKey: "action.cancelled", kind: "none", tone: "danger" };
  if (status === "completed")
    return { messageKey: "action.completed", kind: "none", tone: "success" };

  /* --- supervisor / requester view ------------------------------------- */
  if (ctx.isSupervisorView || (ctx.isRequester && !ctx.can("requests.process"))) {
    if (status === "needs_info")
      return {
        messageKey: "action.sup.needsInfo",
        buttonKey: "action.btn.addReply",
        kind: "reply_info",
        tone: "warning",
      };
    if (["approved", "awaiting_execution", "executing", "awaiting_payment", "paid"].includes(status))
      return { messageKey: "action.sup.approvedWaiting", kind: "none", tone: "info" };
    if (status === "executed")
      return { messageKey: "action.sup.executed", kind: "none", tone: "success" };
    return { messageKey: "action.sup.withStaff", kind: "none", tone: "info" };
  }

  /* --- staff (employee / accountant) ----------------------------------- */
  const canProcess = ctx.can("requests.process") || ctx.can("requests.assign");
  const canApprove = ctx.can("requests.approve");

  if (status === "needs_info")
    return { messageKey: "action.staff.awaitingSupervisor", kind: "none", tone: "info" };

  if (["awaiting_reply", "assigned"].includes(status) && canProcess)
    return {
      messageKey: "action.staff.startReview",
      buttonKey: "action.btn.startReview",
      kind: "set_status",
      target: "under_review",
      tone: "warning",
    };

  if (status === "under_review" && canProcess)
    return {
      messageKey: "action.staff.process",
      buttonKey: "action.btn.startProcessing",
      kind: "set_status",
      target: "processing",
      tone: "warning",
    };

  if (status === "supervisor_replied" && canProcess)
    return {
      messageKey: "action.staff.reviewReply",
      buttonKey: "action.btn.reviewReply",
      kind: "set_status",
      target: "review_after_info",
      tone: "warning",
    };

  if (["processing", "review_after_info"].includes(status) && canProcess)
    return {
      messageKey: "action.staff.sendForApproval",
      buttonKey: "action.btn.sendForApproval",
      kind: "set_status",
      target: "awaiting_approval",
      tone: "warning",
    };

  if (status === "awaiting_approval")
    return canApprove
      ? {
          messageKey: "action.mgr.awaitingApproval",
          buttonKey: "action.btn.approve",
          kind: "approve",
          tone: "warning",
        }
      : { messageKey: "action.staff.withManager", kind: "none", tone: "info" };

  if (["approved", "awaiting_execution"].includes(status))
    return canProcess
      ? {
          messageKey: "action.mgr.approvedAwaitingExecution",
          buttonKey: "action.btn.startExecution",
          kind: "set_status",
          target: "executing",
          tone: "warning",
        }
      : { messageKey: "action.staff.withManager", kind: "none", tone: "info" };

  if (status === "executing" && canProcess)
    return {
      messageKey: "action.staff.confirmExecution",
      buttonKey: "action.btn.confirmExecution",
      kind: "set_status",
      target: "executed",
      tone: "warning",
    };

  if (status === "awaiting_payment" && canProcess)
    return {
      messageKey: "action.staff.registerPayment",
      buttonKey: "action.btn.registerPayment",
      kind: "payment_dialog",
      target: "paid",
      tone: "warning",
    };

  if (status === "paid" && canProcess)
    return {
      messageKey: "action.staff.confirmExecution",
      buttonKey: "action.btn.confirmExecution",
      kind: "set_status",
      target: "executed",
      tone: "warning",
    };

  if (status === "executed" && canProcess)
    return {
      messageKey: "action.mgr.closeRequest",
      buttonKey: "action.btn.close",
      kind: "close",
      tone: "warning",
    };

  return IDLE;
}

/** Simplified notification copy per section 10, derived from the event + status. */
export function notificationTextKey(event: string, status?: string | null): string {
  const s = status ? normalizeStatus(status) : "";
  if (event === "request_created") return "notify.created";
  if (event === "message_added") return "notify.message";
  if (event === "reminder_added") return "notify.reminder";
  if (event === "request_executed") return "notify.executed";
  // status_changed → describe where the request is now
  switch (simpleStage(s)) {
    case "received":
      return "notify.created";
    case "reviewing":
      return "notify.reviewStarted";
    case "action_needed":
      return "notify.needsInfo";
    case "approval_execution":
      return s === "executing" || s === "awaiting_payment" || s === "paid"
        ? "notify.executionStarted"
        : "notify.approved";
    case "done":
      return s === "completed" ? "notify.completed" : "notify.executed";
    case "rejected":
      return "notify.rejected";
    default:
      return "notify.cancelled";
  }
}
