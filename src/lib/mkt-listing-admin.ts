import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-side listing moderation. Every read and write goes through a
 * permission-gated database function: the client never reads
 * `mkt_listing_events` directly, and IP / device values arrive already masked
 * for staff without the `ads.view_ip_device` permission.
 */

export const ADMIN_LISTING_ACTIONS = [
  "suspend",
  "unsuspend",
  "request_edit",
  "reject",
  "archive",
  "extend",
] as const;
export type AdminListingAction = (typeof ADMIN_LISTING_ACTIONS)[number];

/** Permission required per action — mirrors the server-side check exactly. */
export const ADMIN_ACTION_PERM: Record<AdminListingAction, string> = {
  suspend: "ads.moderation_suspend",
  reject: "ads.moderation_suspend",
  unsuspend: "ads.moderation_unsuspend",
  request_edit: "ads.moderation_request_edit",
  archive: "ads.moderation_archive",
  extend: "ads.moderation_extend",
};

export const ADMIN_EXTEND_DAYS = [1, 3, 7, 14, 30] as const;

export interface AdminListingEvent {
  id: string;
  created_at: string;
  event_type: string;
  meta: Record<string, unknown> | null;
  actor_id: string | null;
  actor_label: string | null;
  listing_id: string;
  listing_ref: string | null;
  listing_title: string | null;
  listing_status: string | null;
  listing_city: string | null;
  ip_address: string | null;
  user_agent: string | null;
  can_view_ip: boolean;
}

export interface AdminListingBrief {
  id: string;
  ref_no: string | null;
  title: string | null;
  status: string | null;
  city: string | null;
  slug: string | null;
  expires_at: string | null;
  published_at: string | null;
  rejection_reason: string | null;
}

export interface AdminEventFilters {
  search?: string | undefined;
  eventType?: string | undefined;
  actor?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function loadAdminListingEvents(
  filters: AdminEventFilters,
): Promise<AdminListingEvent[]> {
  const size = filters.pageSize ?? 50;
  const { data, error } = await supabase.rpc("mkt_admin_listing_events", {
    _search: filters.search?.trim() || null,
    _event_type: filters.eventType || null,
    _actor: filters.actor || null,
    _from: filters.from ? `${filters.from}T00:00:00Z` : null,
    _to: filters.to ? `${filters.to}T23:59:59Z` : null,
    _limit: size,
    _offset: (filters.page ?? 0) * size,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminListingEvent[];
}

export async function loadAdminListingBrief(listingId: string): Promise<AdminListingBrief | null> {
  const { data, error } = await supabase.rpc("mkt_admin_listing_brief", {
    _listing_id: listingId,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as unknown as AdminListingBrief[];
  return rows[0] ?? null;
}

export async function runAdminListingAction(params: {
  listingId: string;
  action: AdminListingAction;
  reason: string;
  days?: number | undefined;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_listing_action", {
    _listing_id: params.listingId,
    _action: params.action,
    _reason: params.reason,
    _days: params.days ?? null,
  } as never);
  if (error) throw error;
  return (data ?? "") as unknown as string;
}

/** Event types worth offering as a filter; unknown types still render fine. */
export const ADMIN_EVENT_TYPES = [
  "created",
  "updated",
  "submitted",
  "approve",
  "reject",
  "needs_changes",
  "return",
  "paused",
  "resumed",
  "renewed",
  "extended",
  "archived",
  "restored",
  "deleted",
  "duplicated",
  "expired",
  "favorite",
  "quote_request",
  "report",
  "copy_link",
  "qr",
  "review",
  "admin_suspend",
  "admin_unsuspend",
  "admin_request_edit",
  "admin_reject",
  "admin_archive",
  "admin_extended",
] as const;

/** Human error text for the errors the RPCs raise. */
export function adminActionError(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? "";
  if (message.includes("forbidden")) return "forbidden";
  if (message.includes("reason_required")) return "reason_required";
  if (message.includes("invalid_duration")) return "invalid_duration";
  if (message.includes("not_found")) return "not_found";
  return "failed";
}
