import { supabase } from "@/integrations/supabase/client";
import type { MktNotification } from "@/lib/mkt-reports";

/**
 * Marketplace report notifications. Rows are readable only by their owner
 * (RLS: user_id = auth.uid()), so no reporter/advertiser identity ever leaks.
 */
export async function loadAllMktNotifications(limit = 100): Promise<MktNotification[]> {
  const { data, error } = await supabase
    .from("mkt_notifications")
    .select("id, report_id, event, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MktNotification[];
}

export async function markAllMktNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("mkt_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

/** Events that belong to the staff/admin side of the case. */
const STAFF_EVENTS = new Set(["report_assigned", "party_replied", "appeal_submitted"]);
/** Events addressed to the advertiser (listing owner / restricted account). */
const ADVERTISER_EVENTS = new Set([
  "advertiser_message",
  "listing_action",
  "final_decision",
  "account_restricted",
  "restriction_lifted",
  "appeal_decision",
  "report_reopened_advertiser",
]);

export type MktNotificationTarget =
  | { kind: "admin"; reportId: string }
  | { kind: "reporter"; reportId: string }
  | { kind: "violations" }
  | { kind: "none" };

/** Where a notification should navigate, derived from the event only. */
export function notificationTarget(n: MktNotification): MktNotificationTarget {
  if (STAFF_EVENTS.has(n.event)) {
    return n.report_id ? { kind: "admin", reportId: n.report_id } : { kind: "none" };
  }
  if (ADVERTISER_EVENTS.has(n.event)) return { kind: "violations" };
  return n.report_id ? { kind: "reporter", reportId: n.report_id } : { kind: "none" };
}
