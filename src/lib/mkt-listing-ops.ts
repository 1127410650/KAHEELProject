/**
 * Listing lifecycle operations.
 *
 * Every state change goes through a database function: the advertiser has no
 * direct write privilege on `status`, `expires_at`, the counters or the owner
 * columns, so a hand-crafted API call cannot self-publish an ad or extend it.
 */

import { supabase } from "@/integrations/supabase/client";

export const LISTING_DURATIONS = [1, 3, 7, 14, 30] as const;
export type ListingDuration = (typeof LISTING_DURATIONS)[number];
export const DEFAULT_LISTING_DURATION: ListingDuration = 30;

export function isListingDuration(value: unknown): value is ListingDuration {
  return LISTING_DURATIONS.includes(Number(value) as ListingDuration);
}

/** Columns the owner dashboard needs on top of the public listing columns. */
export const MY_LISTING_COLUMNS =
  "id, slug, owner_user_id, tenant_id, advertiser_type, type_code, category_id, subcategory_id, title, summary, price, price_on_request, price_unit, currency, city, city_id, cover_image_url, status, rejection_reason, published_at, created_at, views_count, shares_count, contact_requests_count, duration_days, expires_at, paused_at, last_renewed_at";

export type ListingOpError =
  | "forbidden"
  | "invalid_state"
  | "invalid_duration"
  | "not_found"
  | "license_required"
  | "failed";

function opError(message: string): ListingOpError {
  if (message.includes("forbidden")) return "forbidden";
  if (message.includes("invalid_state")) return "invalid_state";
  if (message.includes("invalid_duration")) return "invalid_duration";
  if (message.includes("not_found")) return "not_found";
  if (message.includes("RE_LICENSE_REQUIRED")) return "license_required";
  return "failed";
}

async function call<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(opError(error.message));
  return data;
}

export const submitListing = (id: string) =>
  call(supabase.rpc("mkt_listing_submit", { _id: id }));

export const pauseListing = (id: string) => call(supabase.rpc("mkt_listing_pause", { _id: id }));

export const resumeListing = (id: string) => call(supabase.rpc("mkt_listing_resume", { _id: id }));

export const renewListing = (id: string, days: ListingDuration) =>
  call(supabase.rpc("mkt_listing_renew", { _id: id, _days: days }));

export const archiveListing = (id: string) =>
  call(supabase.rpc("mkt_listing_archive", { _id: id }));

export const restoreListing = (id: string) =>
  call(supabase.rpc("mkt_listing_restore", { _id: id }));

export const deleteListing = (id: string) => call(supabase.rpc("mkt_listing_delete", { _id: id }));

export const duplicateListing = (id: string) =>
  call(supabase.rpc("mkt_listing_duplicate", { _id: id }));

/** Fire-and-forget share counter; failures never block the share sheet. */
export function trackListingShare(id: string): void {
  void supabase.rpc("mkt_listing_track_share", { _id: id }).then(
    () => undefined,
    () => undefined,
  );
}

/** Which operations a status allows — mirrors the database guards. */
export function allowedOps(status: string) {
  return {
    submit: ["draft", "rejected", "expired", "archived"].includes(status),
    pause: status === "published",
    resume: status === "paused",
    renew: ["published", "paused", "expired"].includes(status),
    archive: !["suspended", "archived", "deleted"].includes(status),
    restore: status === "archived",
    remove: status !== "suspended",
    edit: !["suspended", "deleted"].includes(status),
    duplicate: status !== "deleted",
  };
}

/** Remaining time in whole days/hours, or null when the ad has no expiry. */
export function remainingLabel(
  expiresAt: string | null | undefined,
  fmt: { days: (n: number) => string; hours: (n: number) => string; ended: string },
): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return fmt.ended;
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? fmt.days(Math.floor(hours / 24)) : fmt.hours(Math.max(hours, 1));
}
