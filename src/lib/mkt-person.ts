/**
 * Public individual-advertiser profile reads.
 *
 * Everything here goes through security-definer RPCs that decide server-side
 * whether the profile may be shown at all (published, not suspended/banned)
 * and which fields leave the database. The Data API never sends `user_id`,
 * `tenant_id`, verification documents, restrictions or admin notes to this
 * page, so the isolation does not depend on the UI hiding anything.
 */
import { supabase } from "@/integrations/supabase/client";

import { resolveMedia, type MktListing } from "@/lib/mkt";
import type { ListingCardData } from "@/components/marketplace/ListingCard";
import { loadCategories, loadListingTypes } from "@/lib/mkt-queries";

export const PERSON_PAGE_SIZE = 12;

export interface PublicPerson {
  username: string;
  display_name: string;
  headline: string | null;
  about: string | null;
  city_ar: string | null;
  city_en: string | null;
  avatar_url: string | null;
  verification_status: string;
  joined_at: string;
  active_listings: number;
  is_owner: boolean;
  public_phone: string | null;
  public_email: string | null;
  public_whatsapp: string | null;
}

export interface PersonCategory {
  category_id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  listings_count: number;
}

/** Null means "this profile is not available" — deleted, hidden or suspended. */
export async function loadPublicPerson(username: string): Promise<PublicPerson | null> {
  const { data, error } = await supabase.rpc("mkt_public_person", { _username: username });
  if (error) throw error;
  const row = ((data ?? []) as PublicPerson[])[0];
  return row ?? null;
}

export async function loadPersonCategories(username: string): Promise<PersonCategory[]> {
  const { data, error } = await supabase.rpc("mkt_public_person_categories", {
    _username: username,
  });
  if (error) throw error;
  return (data ?? []) as PersonCategory[];
}

type PersonListingRow = Pick<
  MktListing,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "price"
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

/** One batch of the advertiser's published personal listings, ready for cards. */
export async function loadPersonListings(input: {
  username: string;
  categoryId: string | null;
  page: number;
  locale: "ar" | "en";
}): Promise<ListingCardData[]> {
  const { data, error } = await supabase.rpc("mkt_public_person_listings", {
    _username: input.username,
    ...(input.categoryId ? { _category_id: input.categoryId } : {}),
    _limit: PERSON_PAGE_SIZE,
    _offset: input.page * PERSON_PAGE_SIZE,
  });
  if (error) throw error;
  const rows = (data ?? []) as PersonListingRow[];
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
      // Owner and tenant ids intentionally never leave the database for this
      // page; cards only need them for links they do not render here.
      owner_user_id: "",
      tenant_id: null,
      advertiser_type: "individual",
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
      advertiserKind: "individual",
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

/**
 * The bio is free text written by the advertiser. It is rendered as plain text,
 * and additionally scrubbed of markup, script-ish links and inline contact
 * numbers, which the platform only publishes through the contact block.
 */
export function sanitizeAbout(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\b(?:javascript|data|vbscript):\S*/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi, " ")
    // Hidden phone numbers: any run of 7+ digits, with or without separators.
    .replace(/(?:\+?\d[\d\s\-().]{5,}\d)/g, (match) =>
      (match.match(/\d/g) ?? []).length >= 7 ? " " : match,
    );
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

/** Fallback avatar: initials of the display name, never a phone-like string. */
export function personInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => /[\p{L}]/u.test(p));
  if (parts.length === 0) return "";
  const first = parts[0]![0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + second).toUpperCase();
}

/**
 * Grammatical wording for the active-listing count. Arabic needs singular /
 * dual / plural forms; English needs singular vs plural. Digits stay western.
 */
export function activeListingsKey(count: number): string {
  if (count <= 0) return "market.person.count.zero";
  if (count === 1) return "market.person.count.one";
  if (count === 2) return "market.person.count.two";
  return "market.person.count.many";
}
