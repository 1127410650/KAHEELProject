import { supabase } from "@/integrations/supabase/client";

/**
 * Shared administrative work queue.
 *
 * A pending item is never duplicated per administrator: one row per
 * (kind, subject) is created the moment somebody claims it, and the unique
 * index in the database is what actually prevents two administrators from
 * holding — and deciding — the same item.
 */
export type QueueKind =
  | "listing_review"
  | "report"
  | "verification"
  | "activity_suggestion"
  | "account_review"
  | "business_review";

export interface QueueAssignment {
  subject_id: string;
  assignee: string | null;
  assignee_label: string | null;
  claimed_at: string | null;
  is_mine: boolean;
}

export async function claimSubject(kind: QueueKind, subjectId: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_claim", { _kind: kind, _subject_id: subjectId });
  if (error) throw error;
}

export async function transferSubject(
  kind: QueueKind,
  subjectId: string,
  to: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_transfer", {
    _kind: kind,
    _subject_id: subjectId,
    _to: to,
    _reason: reason,
  });
  if (error) throw error;
}

export async function releaseSubject(
  kind: QueueKind,
  subjectId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_release", {
    _kind: kind,
    _subject_id: subjectId,
    _reason: reason,
  });
  if (error) throw error;
}

export async function loadAssignments(
  kind: QueueKind,
  subjectIds: string[],
): Promise<Record<string, QueueAssignment>> {
  if (subjectIds.length === 0) return {};
  const { data, error } = await supabase.rpc("mkt_admin_assignments_for", {
    _kind: kind,
    _subject_ids: subjectIds,
  });
  if (error) throw error;
  const rows = (data ?? []) as QueueAssignment[];
  return Object.fromEntries(rows.map((row) => [row.subject_id, row]));
}

/** Human text for the errors the queue functions raise. */
export function queueErrorKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("already_claimed")) return "admin.queue.alreadyClaimed";
  if (message.includes("not_holder")) return "admin.queue.notHolder";
  if (message.includes("invalid_assignee")) return "admin.queue.invalidAssignee";
  if (message.includes("reason_required")) return "admin.reasonRequired";
  if (message.includes("forbidden")) return "market.admin.denied";
  return "admin.actionFailed";
}
