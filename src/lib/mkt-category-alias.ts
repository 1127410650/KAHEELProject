/**
 * Legacy category aliases for the PUBLIC marketplace.
 *
 * `mkt_categories` has exactly ONE canonical real-estate record
 * (`real-estate` / «عقارات» / `Real estate`). The old «عقار ديل» label was a
 * duplicate surface pointing at the same category, so no listing or
 * subcategory moves — old links just resolve onto the canonical slug.
 *
 * The same alias set lives in `public.mkt_category_aliases` so the database
 * refuses any new top-level category that duplicates it.
 *
 * Not imported by the admin console or the internal system.
 */

/** Same normalization as `public.mkt_norm_label`: case, spaces, punctuation, hamza. */
export function normalizeCategoryLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[^a-z0-9\u0621-\u064a]+/g, "");
}

/** normalized legacy alias -> canonical category slug. */
const CATEGORY_ALIASES: Record<string, string> = {
  realestatedeal: "real-estate",
  realdeal: "real-estate",
  propertydeals: "real-estate",
  aqardeal: "real-estate",
  عقارديل: "real-estate",
  عقاردليل: "real-estate",
};

/**
 * Canonical slug for a possibly-legacy category slug.
 * Returns the input unchanged when it is not an alias.
 */
export function canonicalCategorySlug(slug: string): string {
  return CATEGORY_ALIASES[normalizeCategoryLabel(slug)] ?? slug;
}

/** True when the slug is a legacy alias that must redirect. */
export function isLegacyCategorySlug(slug: string): boolean {
  return canonicalCategorySlug(slug) !== slug;
}
