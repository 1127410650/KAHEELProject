import { supabase } from "@/integrations/supabase/client";
import type { QueueKind } from "@/lib/mkt-admin-queue";

/**
 * Workforce distribution: who is working right now, how much each of them is
 * holding, and where a new administrative item goes.
 *
 * Every decision here is re-taken on the server — this module only shapes the
 * calls and translates the errors the database raises.
 */

export type WorkState = "available" | "busy" | "away" | "leave" | "off";
export type WorkPriority = "low" | "normal" | "high" | "urgent";
export type WorkProgress = "unstarted" | "in_progress" | "waiting_info" | "done";
export type LeaveKind = "annual" | "sick" | "emergency" | "training" | "other";
export type QueueScope = "mine" | "unassigned" | "all";

export const WORK_STATES: WorkState[] = ["available", "busy", "away", "leave", "off"];
export const SELF_WORK_STATES: WorkState[] = ["available", "busy", "away"];
export const WORK_PRIORITIES: WorkPriority[] = ["urgent", "high", "normal", "low"];
export const WORK_PROGRESS: WorkProgress[] = ["unstarted", "in_progress", "waiting_info", "done"];
export const LEAVE_KINDS: LeaveKind[] = ["annual", "sick", "emergency", "training", "other"];

export interface StaffRow {
  user_id: string;
  label: string;
  email: string | null;
  platform_role: string | null;
  perms: string[];
  work_state: WorkState;
  effective_state: WorkState;
  capacity_limit: number;
  accepts_auto: boolean;
  department: string | null;
  note: string | null;
  open_count: number;
  done_today: number;
  on_leave: boolean;
  leave_ends_on: string | null;
  last_assigned_at: string | null;
}

export interface WorkItem {
  id: string;
  kind: QueueKind;
  subject_id: string;
  assignee: string | null;
  assignee_label: string | null;
  priority: WorkPriority;
  progress: WorkProgress;
  auto_assigned: boolean;
  due_at: string | null;
  claimed_at: string | null;
  created_at: string;
  is_mine: boolean;
}

export interface WorkforceOverview {
  unassigned?: number;
  open?: number;
  urgent?: number;
  overdue?: number;
  available_staff?: number;
  on_leave?: number;
}

export interface DepartmentRow {
  code: string;
  name_ar: string;
  name_en: string;
  queue_kinds: string[];
  sort_order: number;
  is_active: boolean;
}

export interface LeaveRow {
  id: string;
  user_id: string;
  kind: LeaveKind;
  starts_on: string;
  ends_on: string;
  note: string | null;
  substitute_user_id: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export async function loadWorkforceStaff(): Promise<StaffRow[]> {
  const { data, error } = await supabase.rpc("mkt_workforce_staff");
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

export async function loadWorkforceOverview(): Promise<WorkforceOverview> {
  const { data, error } = await supabase.rpc("mkt_workforce_overview");
  if (error) throw error;
  return (data ?? {}) as WorkforceOverview;
}

export async function loadWorkQueue(
  scope: QueueScope,
  kind?: QueueKind | null,
): Promise<WorkItem[]> {
  const { data, error } = await supabase.rpc("mkt_workforce_queue", {
    _scope: scope,
    ...(kind ? { _kind: kind } : {}),
    _limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as WorkItem[];
}

export async function loadDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await supabase
    .from("mkt_workforce_departments")
    .select("code,name_ar,name_en,queue_kinds,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DepartmentRow[];
}

export async function loadLeaves(userId?: string): Promise<LeaveRow[]> {
  let query = supabase
    .from("mkt_staff_leaves")
    .select("id,user_id,kind,starts_on,ends_on,note,substitute_user_id,cancelled_at,created_at")
    .is("cancelled_at", null)
    .order("starts_on", { ascending: false })
    .limit(100);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

export interface StaffUpdate {
  work_state?: WorkState | null;
  capacity_limit?: number | null;
  accepts_auto?: boolean | null;
  department?: string | null;
  note?: string | null;
}

export async function saveStaff(
  userId: string,
  update: StaffUpdate,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_set_staff", {
    _user_id: userId,
    _work_state: update.work_state ?? undefined,
    _capacity_limit: update.capacity_limit ?? undefined,
    _accepts_auto: update.accepts_auto ?? undefined,
    _department: update.department ?? undefined,
    _note: update.note ?? undefined,
    _reason: reason,
  });
  if (error) throw error;
}

export async function addLeave(input: {
  userId: string;
  kind: LeaveKind;
  startsOn: string;
  endsOn: string;
  note?: string | null;
  substitute?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_add_leave", {
    _user_id: input.userId,
    _kind: input.kind,
    _starts_on: input.startsOn,
    _ends_on: input.endsOn,
    _note: input.note ?? undefined,
    _substitute: input.substitute ?? undefined,
  });
  if (error) throw error;
}

export async function cancelLeave(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_cancel_leave", { _id: id, _reason: reason });
  if (error) throw error;
}

export async function setWorkProgress(
  kind: QueueKind,
  subjectId: string,
  progress: WorkProgress,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_set_progress", {
    _kind: kind,
    _subject_id: subjectId,
    _progress: progress,
  });
  if (error) throw error;
}

export async function setWorkPriority(
  kind: QueueKind,
  subjectId: string,
  priority: WorkPriority,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_set_priority", {
    _kind: kind,
    _subject_id: subjectId,
    _priority: priority,
    _reason: reason,
  });
  if (error) throw error;
}

/** Distribute every unassigned item that now has an eligible, available taker. */
export async function distributeWork(kind?: QueueKind | null): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_workforce_distribute", {
    _kind: kind ?? undefined,
    _limit: 50,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** Put a subject on the shared list; the server auto-assigns when it can. */
export async function enqueueWork(
  kind: QueueKind,
  subjectId: string,
  priority: WorkPriority = "normal",
  dueAt?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_workforce_enqueue", {
    _kind: kind,
    _subject_id: subjectId,
    _priority: priority,
    _due_at: dueAt ?? undefined,
  });
  if (error) throw error;
}

/** The route to open for a work item, so a queue row is always actionable. */
export function workItemHref(item: WorkItem): string {
  switch (item.kind) {
    case "listing_review":
      return `/admin/listings/${item.subject_id}`;
    case "report":
      return `/admin/reports/${item.subject_id}`;
    case "verification":
      return `/admin/verifications/${item.subject_id}`;
    case "business_review":
      return `/admin/businesses/${item.subject_id}`;
    case "account_review":
      return `/admin/users/${item.subject_id}`;
    default:
      return "/admin";
  }
}

export function workforceErrorKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("capacity_reached")) return "admin.workforce.err.capacity";
  if (message.includes("already_claimed")) return "admin.queue.alreadyClaimed";
  if (message.includes("not_holder")) return "admin.queue.notHolder";
  if (message.includes("invalid_assignee")) return "admin.queue.invalidAssignee";
  if (message.includes("invalid_leave_range")) return "admin.workforce.err.leaveRange";
  if (message.includes("dates_required")) return "admin.workforce.err.dates";
  if (message.includes("reason_required")) return "admin.reasonRequired";
  if (message.includes("forbidden")) return "market.admin.denied";
  return "admin.actionFailed";
}
