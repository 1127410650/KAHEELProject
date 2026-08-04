/**
 * Listing lifecycle operations.
 *
 * Every state change goes through a database function: the advertiser has no
 * direct write privilege on `status`, `expires_at`, the counters or the owner
 * columns, so a hand-crafted API call cannot self-publish an ad or extend it.
 */

import { supabase } from "@/integrations/supabase/client";
import { removeObjects } from "@/lib/mkt-listing-media";

export const LISTING_DURATIONS = [1, 3, 7, 14, 30] as const;
export type ListingDuration = (typeof LISTING_DURATIONS)[number];
/** Organic (unpaid) ads always run for a fixed 7 days; 1/3/7/14/30 belong to paid promotion only. */
export const ORGANIC_LISTING_DAYS = 7 as const;
export const DEFAULT_LISTING_DURATION: ListingDuration = ORGANIC_LISTING_DAYS;

export function isListingDuration(value: unknown): value is ListingDuration {
  return LISTING_DURATIONS.includes(Number(value) as ListingDuration);
}

/** Columns the owner dashboard needs on top of the public listing columns. */
export const MY_LISTING_COLUMNS =
  "id, slug, ref_no, owner_user_id, tenant_id, advertiser_type, type_code, category_id, subcategory_id, title, summary, keywords, price, price_unit, currency, city, city_id, cover_image_url, status, rejection_reason, published_at, created_at, views_count, shares_count, contact_requests_count, favorites_count, quote_requests_count, reports_count, link_copies_count, qr_opens_count, ratings_count, ratings_avg, is_featured, featured_until, featured_package, display_priority, duration_days, expires_at, paused_at, last_renewed_at";

export type ListingOpError =
  | "forbidden"
  | "invalid_state"
  | "invalid_duration"
  | "not_found"
  | "license_required"
  | "image_required"
  | "images_incomplete"
  | "images_too_many"
  | "business_incomplete"
  | "geo_required"
  | "price_required"
  | "price_invalid"
  | "admin_suspended"
  | "account_restricted"
  | "category_inactive"
  | "already_promoted"
  | "insufficient_points"
  | "failed";


function opError(message: string): ListingOpError {
  if (message.includes("forbidden")) return "forbidden";
  if (message.includes("invalid_state")) return "invalid_state";
  if (message.includes("invalid_duration")) return "invalid_duration";
  if (message.includes("not_found")) return "not_found";
  if (message.includes("admin_suspended")) return "admin_suspended";
  if (message.includes("account_restricted")) return "account_restricted";
  if (message.includes("category_inactive")) return "category_inactive";
  if (message.includes("already_promoted")) return "already_promoted";
  if (message.includes("insufficient_points")) return "insufficient_points";
  if (message.includes("RE_LICENSE_REQUIRED")) return "license_required";
  if (message.includes("IMAGE_REQUIRED")) return "image_required";
  if (message.includes("IMAGES_INCOMPLETE")) return "images_incomplete";
  if (message.includes("IMAGES_TOO_MANY")) return "images_too_many";
  // Publish-time gates raised by triggers, not by the submit function itself.
  if (message.includes("BUSINESS_DETAILS_INCOMPLETE")) return "business_incomplete";
  if (message.includes("GEO_LOCATION_REQUIRED")) return "geo_required";
  if (message.includes("PRICE_REQUIRED")) return "price_required";
  if (
    message.includes("PRICE_INVALID") ||
    message.includes("PRICE_TOO_LARGE") ||
    message.includes("PRICE_UNIT_INVALID")
  )
    return "price_invalid";
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

/**
 * Reactivate an expired/paused ad for another organic window. The database
 * re-scans the content first, so the result tells the caller whether the ad
 * went live again or landed in review.
 */
export const reactivateListing = async (id: string): Promise<"published" | "pending"> => {
  const result = await call(supabase.rpc("mkt_listing_reactivate", { _id: id }));
  return (result as unknown as "published" | "pending") ?? "pending";
};

export const archiveListing = (id: string) =>
  call(supabase.rpc("mkt_listing_archive", { _id: id }));

export const restoreListing = (id: string) =>
  call(supabase.rpc("mkt_listing_restore", { _id: id }));

/**
 * Delete an ad. For a draft the photo objects have no reason to survive, so the
 * owner's own storage objects are swept right after the row is gone; a failure
 * there never turns a successful delete into an error.
 */
export const deleteListing = async (id: string) => {
  const { data: images } = await supabase
    .from("mkt_listing_images")
    .select("url")
    .eq("listing_id", id);
  const { data: row } = await supabase
    .from("mkt_listings")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const result = await call(supabase.rpc("mkt_listing_delete", { _id: id }));
  if (row?.status === "draft") {
    const paths = (images ?? []).map((i) => i.url).filter((u) => !/^https?:/i.test(u));
    await removeObjects(paths);
  }
  return result;
};

export const duplicateListing = (id: string) =>
  call(supabase.rpc("mkt_listing_duplicate", { _id: id }));

/** Fire-and-forget share counter; failures never block the share sheet. */
export function trackListingShare(id: string): void {
  void supabase.rpc("mkt_listing_track_share", { _id: id }).then(
    () => undefined,
    () => undefined,
  );
}

/** Aggregate engagement events (link copies, QR opens, shares). */
export type ListingTrackKind = "share" | "link_copy" | "qr_open";

export function trackListingEvent(id: string, kind: ListingTrackKind): void {
  void supabase.rpc("mkt_listing_track", { _id: id, _kind: kind }).then(
    () => undefined,
    () => undefined,
  );
}

/** All lifecycle statuses an ad can be in, in dashboard display order. */
export const MY_LISTING_STATUSES = [
  "draft",
  "pending",
  "needs_changes",
  "published",
  "featured",
  "paused",
  "expired",
  "rejected",
  "suspended",
  "archived",
] as const;

/** Which operations a status allows — mirrors the database guards. */
export function allowedOps(status: string) {
  return {
    submit: ["draft", "needs_changes", "rejected", "expired", "archived"].includes(status),
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


/**
 * Expiry label: "ends in X" while the ad is live, "ended X ago" afterwards, so
 * the dashboard always states the duration explicitly.
 */
export function remainingLabel(
  expiresAt: string | null | undefined,
  fmt: {
    days: (n: number) => string;
    hours: (n: number) => string;
    ended: string;
    endedDays?: ((n: number) => string) | undefined;
    endedHours?: ((n: number) => string) | undefined;
  },
): string | null {
  if (!expiresAt) return null;
  const past = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isNaN(past) && past <= 0 && (fmt.endedDays || fmt.endedHours)) {
    const hours = Math.floor(-past / 3_600_000);
    if (hours >= 24 && fmt.endedDays) return fmt.endedDays(Math.floor(hours / 24));
    if (fmt.endedHours) return fmt.endedHours(Math.max(hours, 1));
  }
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return fmt.ended;
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? fmt.days(Math.floor(hours / 24)) : fmt.hours(Math.max(hours, 1));
}
