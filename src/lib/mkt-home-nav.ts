/**
 * Navigation data for the PUBLIC marketplace home only ("كحلي").
 *
 * Every entry resolves to a real, working `/search` query built from the
 * taxonomy that actually exists in `mkt_categories` / `mkt_listing_types`.
 * Where the marketing label has no matching category (cars, restaurants,
 * fashion …) the entry falls back to a keyword search instead of inventing a
 * category, so no chip can ever lead to a dead or empty-by-construction page.
 *
 * This module is not imported by the admin console or the internal system.
 */

export interface HomeCategoryEntry {
  /** i18n key under `market.home.cats`. */
  key: string;
  /** Home chip: no search params, links to `/`. */
  home?: boolean;
  /** Static search params (category slug / listing type / domain). */
  params?: Record<string, string>;
  /** Locale-dependent keyword search when no real category matches. */
  keyword?: { ar: string; en: string };
}

/** 18 chips (home + 17 fields); the rail adds a 19th "more" opener. */
export const HOME_CATEGORIES: HomeCategoryEntry[] = [
  { key: "home", home: true },
  { key: "realestate", params: { category: "real-estate" } },
  { key: "cars", keyword: { ar: "سيارة", en: "car" } },
  { key: "devices", keyword: { ar: "جهاز", en: "device" } },
  { key: "realdeal", params: { category: "real-estate", domain: "realestate" } },
  { key: "restaurants", keyword: { ar: "مطعم", en: "restaurant" } },
  { key: "furniture", keyword: { ar: "أثاث", en: "furniture" } },
  { key: "services", params: { type: "service" } },
  { key: "fashion", keyword: { ar: "أزياء", en: "fashion" } },
  { key: "jobs", keyword: { ar: "وظيفة", en: "job" } },
  { key: "training", keyword: { ar: "تدريب", en: "training" } },
  { key: "events", keyword: { ar: "مناسبات", en: "events" } },
  { key: "software", keyword: { ar: "برمجة", en: "software" } },
  { key: "gardens", keyword: { ar: "حدائق", en: "garden" } },
  { key: "arts", keyword: { ar: "فنون", en: "art" } },
  { key: "lost", keyword: { ar: "مفقودات", en: "lost" } },
  { key: "projects", keyword: { ar: "مشاريع", en: "project" } },
  { key: "travel", keyword: { ar: "رحلات", en: "travel" } },
];

/** Search params for one chip, resolved for the active locale. */
export function homeCategorySearch(
  entry: HomeCategoryEntry,
  locale: "ar" | "en",
): Record<string, string> {
  if (entry.params) return entry.params;
  if (entry.keyword) return { q: entry.keyword[locale] };
  return {};
}

export interface HomeTile {
  /** i18n key under `market.home.tiles`. */
  key: string;
  params: Record<string, string>;
  /** Imported asset URL, injected by the component. */
  image: string;
}
