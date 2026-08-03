/**
 * Public business-profile reads.
 *
 * Every read goes through a security-definer RPC that decides server-side
 * whether the business may be shown to the public at all (published, active
 * tenant, not suspended/hidden/deleted) and which fields leave the database.
 * `tenant_id`, `owner_user_id`, official numbers, tax/identity numbers,
 * verification documents, review notes and team members are never selected, so
 * the isolation does not depend on the UI hiding anything.
 */
import { supabase } from "@/integrations/supabase/client";

import { resolveMedia, type MktListing } from "@/lib/mkt";
import type { ListingCardData } from "@/components/marketplace/ListingCard";
import { loadCategories, loadListingTypes } from "@/lib/mkt-queries";

export const BUSINESS_PAGE_SIZE = 12;

export interface PublicBusiness {
  slug: string;
  display_name_ar: string;
  display_name_en: string | null;
  headline: string | null;
  about: string | null;
  logo_url: string | null;
  entity_type: string | null;
  main_activity: string | null;
  sub_activities: string[];
  city_ar: string | null;
  city_en: string | null;
  region: string | null;
  joined_at: string;
  verification_status: string;
  active_listings: number;
  public_website: string | null;
  public_phone: string | null;
  public_email: string | null;
  public_whatsapp: string | null;
  /** Any active member of this business — used to hide "contact yourself". */
  is_member: boolean;
  /** Member whose role may edit the public profile (server-decided). */
  can_edit: boolean;
}

export interface BusinessCategory {
  category_id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  listings_count: number;
}

/** Null means "this profile is not available" — unpublished, suspended, deleted. */
export async function loadPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const { data, error } = await supabase.rpc("mkt_public_business", { _slug: slug });
  if (error) throw error;
  const row = ((data ?? []) as PublicBusiness[])[0];
  return row ?? null;
}

export async function loadBusinessCategories(slug: string): Promise<BusinessCategory[]> {
  const { data, error } = await supabase.rpc("mkt_public_business_categories", { _slug: slug });
  if (error) throw error;
  return (data ?? []) as BusinessCategory[];
}

type BusinessListingRow = Pick<
  MktListing,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "price"
  | "price_on_request"
  | "price_unit"
  | "currency"
  | "city"
  | "district"
  | "city_id"
  | "category_id"
  | "subcategory_id"
  | "type_code"
  | "deal_kind"
  | "item_condition"
  | "cover_image_url"
  | "published_at"
  | "created_at"
  | "views_count"
>;

/** One batch of this business's own published listings, ready for cards. */
export async function loadBusinessListings(input: {
  slug: string;
  categoryId: string | null;
  page: number;
  locale: "ar" | "en";
}): Promise<ListingCardData[]> {
  const { data, error } = await supabase.rpc("mkt_public_business_listings", {
    _slug: input.slug,
    ...(input.categoryId ? { _category_id: input.categoryId } : {}),
    _limit: BUSINESS_PAGE_SIZE,
    _offset: input.page * BUSINESS_PAGE_SIZE,
  });
  if (error) throw error;
  const rows = (data ?? []) as BusinessListingRow[];
  if (rows.length === 0) return [];

  const [types, categories, media] = await Promise.all([
    loadListingTypes(),
    loadCategories(),
    resolveMedia(rows.map((r) => r.cover_image_url)),
  ]);
  const typeMap = new Map(types.map((tp) => [tp.code, tp]));
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return rows.map((row) => {
    const type = typeMap.get(row.type_code);
    const cat = catMap.get(row.category_id);
    const subcat = row.subcategory_id ? catMap.get(row.subcategory_id) : undefined;
    return {
      ...row,
      // Tenant and owner ids intentionally never leave the database here.
      owner_user_id: "",
      tenant_id: null,
      advertiser_type: "business",
      region: null,
      country_id: null,
      quantity: null,
      unit: null,
      description: null,
      latitude_public: null,
      longitude_public: null,
      location_visibility: null,
      status: "published",
      rejection_reason: null,
      advertiserKind: "business",
      // The trust check mark belongs to the profile header, never to a card.
      verificationStatus: null,
      imageUrl: row.cover_image_url ? (media[row.cover_image_url] ?? null) : null,
      typeLabel: type ? (input.locale === "ar" ? type.name_ar : type.name_en) : undefined,
      categoryLabel: cat ? (input.locale === "ar" ? cat.name_ar : cat.name_en) : undefined,
      subcategoryLabel: subcat
        ? input.locale === "ar"
          ? subcat.name_ar
          : subcat.name_en
        : undefined,
    } as ListingCardData;
  });
}

/** Fallback logo: initials of the business name — never the owner's avatar. */
export function businessInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => /[\p{L}]/u.test(p));
  if (parts.length === 0) return "";
  const first = parts[0]![0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Activity chips: main activity first, then de-duplicated sub-activities. */
export function activityChips(biz: PublicBusiness): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [biz.main_activity, ...(biz.sub_activities ?? [])]) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Only http(s) links are published, so a crafted website cannot run script. */
export function safeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(value)) return null;
  return value;
}

/**
 * Grammatical wording for the active-listing count, shared with the individual
 * profile so both pages read the same way in Arabic and English.
 */
export { activeListingsKey, sanitizeAbout } from "@/lib/mkt-person";
