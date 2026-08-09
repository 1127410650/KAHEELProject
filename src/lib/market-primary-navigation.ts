/**
 * SINGLE SOURCE OF TRUTH for the public marketplace "primary fields" bar
 * («المجالات الرئيسية»).
 *
 * Every public surface reads this list — home rail, search rail, `/more`,
 * the "choose a field" picker in the listing form, listing edit and the
 * category filters — so the labels, the ids and the order can never diverge.
 * Never redeclare this list inside a component.
 *
 * Order is the approved one, and must not change:
 * الرئيسية · عقارات · سيارات · أجهزة · مطاعم · أثاث · خدمات ·
 * أزياء · وظائف · تدريب · مدارس وجامعات · مناسبات · برمجة · الحدائق ·
 * الفنون · مفقودات · مشاريع واستثمارات · الرحلات والسياحة · المزيد
 *
 * «مدارس وجامعات» is a real root record in `mkt_categories`
 * (slug `schools-universities`) with its own subcategories; «تدريب» stays a
 * separate, untouched field.
 *
 * Real estate has exactly ONE entry: «عقارات». The old duplicate label that
 * pointed at the same canonical category through its `re-aqar-deal`
 * subcategory is gone from the interface; its search terms live on as aliases
 * of «عقارات», and its old links keep resolving through
 * `mkt-category-alias.ts`, so no shared or indexed URL breaks.
 *
 * This module is not imported by the admin console or the internal system.
 */

import { normalizeCategoryLabel } from "@/lib/mkt-category-alias";

export type PrimaryFieldKind = "home" | "field" | "more";

export interface PrimaryField {
  /** Stable unique id — also the i18n key under `market.fields`. */
  id: string;
  kind: PrimaryFieldKind;
  /** Canonical root category slug in `mkt_categories` (fields only). */
  categorySlug?: string;
  /** Real subcategory slug, when a field opens one branch of its category. */
  subcategorySlug?: string;
  /** Extra search terms (ar/en/aliases) matched by the picker search. */
  aliases?: string[];
}

/** The approved list, in the approved order. */
export const PRIMARY_FIELDS: PrimaryField[] = [
  { id: "home", kind: "home" },
  {
    id: "realestate",
    kind: "field",
    categorySlug: "real-estate",
    aliases: ["عقار", "property", "aqar", "real estate deal"],
  },
  { id: "cars", kind: "field", categorySlug: "cars", aliases: ["سيارة", "مركبات", "vehicles"] },
  {
    id: "devices",
    kind: "field",
    categorySlug: "devices",
    aliases: ["إلكترونيات", "جهاز", "electronics"],
  },

  { id: "restaurants", kind: "field", categorySlug: "restaurants", aliases: ["مطعم", "كافيه"] },
  { id: "furniture", kind: "field", categorySlug: "furniture", aliases: ["مفروشات"] },
  { id: "services", kind: "field", categorySlug: "services", aliases: ["خدمة", "مقاولات"] },
  { id: "fashion", kind: "field", categorySlug: "fashion", aliases: ["ملابس", "موضة"] },
  { id: "jobs", kind: "field", categorySlug: "jobs", aliases: ["وظيفة", "توظيف"] },
  { id: "training", kind: "field", categorySlug: "training", aliases: ["دورات", "courses"] },
  {
    id: "schools",
    kind: "field",
    categorySlug: "schools-universities",
    aliases: [
      "التعليم",
      "تعليم",
      "مدارس",
      "مدرسة",
      "جامعات",
      "جامعة",
      "كليات",
      "كلية",
      "معاهد",
      "معهد",
      "أكاديميات",
      "أكاديمية",
      "education",
      "schools",
      "universities",
      "colleges",
      "institutes",
    ],
  },
  { id: "events", kind: "field", categorySlug: "events", aliases: ["مناسبة", "حفلات"] },
  { id: "programming", kind: "field", categorySlug: "programming", aliases: ["برمجيات", "software"] },
  { id: "gardens", kind: "field", categorySlug: "gardens", aliases: ["زراعة", "نباتات"] },
  { id: "arts", kind: "field", categorySlug: "arts", aliases: ["فن", "لوحات"] },
  { id: "lostfound", kind: "field", categorySlug: "lost-found", aliases: ["مفقود", "موجودات"] },
  {
    id: "projects",
    kind: "field",
    categorySlug: "projects-investments",
    aliases: ["استثمار", "مشروع"],
  },
  {
    id: "travel",
    kind: "field",
    categorySlug: "travel-tourism",
    aliases: ["سياحة", "رحلة", "سفر"],
  },
  { id: "more", kind: "more" },
];

/** Fields a listing may actually be saved under — never «الرئيسية»/«المزيد». */
export const SELECTABLE_FIELDS = PRIMARY_FIELDS.filter((f) => f.kind === "field");

/** Root category slugs, in the approved order, deduplicated. */
export const PRIMARY_ROOT_SLUGS: string[] = SELECTABLE_FIELDS.reduce<string[]>((acc, field) => {
  if (field.categorySlug && !acc.includes(field.categorySlug)) acc.push(field.categorySlug);
  return acc;
}, []);

/** Rank of a root category slug in the approved order (unknown roots last). */
export function rootSlugRank(slug: string): number {
  const index = PRIMARY_ROOT_SLUGS.indexOf(slug);
  return index === -1 ? PRIMARY_ROOT_SLUGS.length : index;
}

/** True when the value must never be stored as a listing category. */
export function isNavigationOnlyField(id: string): boolean {
  const field = PRIMARY_FIELDS.find((f) => f.id === id);
  return !field || field.kind !== "field";
}

/**
 * `/search` params for one field. Existing filters (city, sort, price …) are
 * merged in by the caller so moving between fields keeps the context.
 */
export function fieldSearchParams(field: PrimaryField): Record<string, string> {
  if (!field.categorySlug) return {};
  const params: Record<string, string> = { category: field.categorySlug };
  if (field.subcategorySlug) params["sub"] = field.subcategorySlug;
  return params;
}

/** True when the current search params are showing this field. */
export function isFieldActive(
  field: PrimaryField,
  current: { category?: string | undefined; sub?: string | undefined },
): boolean {
  if (field.kind !== "field" || !field.categorySlug) return false;
  if (current.category !== field.categorySlug) return false;
  const currentSub = current.sub ?? "";
  return field.subcategorySlug ? currentSub === field.subcategorySlug : currentSub === "";
}

/** Arabic/English tolerant match used by the field search boxes. */
export function fieldMatches(field: PrimaryField, term: string, labels: string[]): boolean {
  const needle = normalizeCategoryLabel(term);
  if (!needle) return true;
  const haystack = [field.id, field.categorySlug ?? "", ...(field.aliases ?? []), ...labels];
  return haystack.some((value) => normalizeCategoryLabel(value).includes(needle));
}

/**
 * Duplicate guard: ids, category targets and order are unique by construction.
 * Runs once at import time so a bad edit fails loudly in development instead of
 * silently showing the same field twice.
 */
function assertNoDuplicates(): void {
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const field of PRIMARY_FIELDS) {
    if (ids.has(field.id)) throw new Error(`duplicate primary field id: ${field.id}`);
    ids.add(field.id);
    if (field.kind !== "field") continue;
    const target = `${field.categorySlug}#${field.subcategorySlug ?? ""}`;
    if (targets.has(target)) throw new Error(`duplicate primary field target: ${target}`);
    targets.add(target);
  }
  if (PRIMARY_FIELDS[0]?.kind !== "home" || PRIMARY_FIELDS.at(-1)?.kind !== "more") {
    throw new Error("primary fields must start with home and end with more");
  }
}
assertNoDuplicates();
