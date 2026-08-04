/**
 * SINGLE SOURCE OF TRUTH for the "add a listing" destination.
 *
 * Every «أضف» / «أضف إعلانًا» / «نشر إعلان» button — header, mobile bottom
 * bar, home, search empty state, «إعلاناتي», landing page and the form's own
 * sign-in prompt — must build its href through here. Never hardcode the path
 * in a component: the real route is `/dashboard/ads/new` and legacy guesses
 * (`/listings/new`, `/new-listing`, `/dashboard/listings/new`) render the 404
 * page.
 *
 * A visitor is sent to `/auth` with an internal-only `next`, so signing in
 * lands straight on the form — no account picker in between; the header's
 * active account is used as-is.
 */

import { safeInternalPath } from "@/lib/mkt";

/** The real, and only, listing-creation route in this project. */
export const ADD_LISTING_PATH = "/dashboard/ads/new" as const;

export interface AddListingOptions {
  /** Truthy when a session exists; visitors get the sign-in detour. */
  authenticated?: boolean | null | undefined;
  /**
   * Canonical root category slug to preselect (e.g. `schools-universities`).
   * Only the slug travels in the URL — the form resolves the real id, so a
   * label can never be stored instead of an identifier. The advertiser can
   * still change the field inside the form.
   */
  fieldSlug?: string | null | undefined;
}

/** Path of the form itself, with the optional preselected field. */
export function addListingPath(fieldSlug?: string | null): string {
  const slug = normalizeFieldSlug(fieldSlug);
  return slug ? `${ADD_LISTING_PATH}?field=${encodeURIComponent(slug)}` : ADD_LISTING_PATH;
}

/** Href for any "add a listing" control — sign-in aware, always internal. */
export function addListingHref(options: AddListingOptions = {}): string {
  const target = addListingPath(options.fieldSlug);
  if (options.authenticated) return target;
  const next = safeInternalPath(target) ?? ADD_LISTING_PATH;
  return `/auth?next=${encodeURIComponent(next)}`;
}

/** Slugs are lowercase kebab-case; anything else is ignored, never trusted. */
function normalizeFieldSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  return /^[a-z0-9-]{2,64}$/.test(slug) ? slug : null;
}
