/**
 * SINGLE SOURCE OF TRUTH for the marketplace search destination.
 *
 * Every search shortcut in the app chrome (desktop header, mobile bottom bar,
 * footer) must build its href through here so the path is never hardcoded in
 * more than one component. The search page itself restores the visitor's saved
 * city/preferences, so a bare path is all any shortcut needs.
 */

/** The real, and only, public search route in this project. */
export const SEARCH_PATH = "/search" as const;

/** Href for any "search" control in the chrome. */
export function getSearchHref(): string {
  return SEARCH_PATH;
}
