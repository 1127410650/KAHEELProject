import { supabase } from "@/integrations/supabase/client";

import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  resolveMedia,
  type MktBusiness,
  type MktCategory,
  type MktListing,
  type MktListingType,
} from "@/lib/mkt";
import type { ListingCardData } from "@/components/marketplace/ListingCard";

export interface ListingFilters {
  q?: string | undefined;
  categorySlug?: string | undefined;
  subcategoryId?: string | undefined;
  type?: string | undefined;
  city?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  verifiedOnly?: boolean | undefined;
  deal?: "sale" | "rent" | undefined;
  sort?: "newest" | "views" | "price_asc" | "price_desc" | undefined;
  limit?: number | undefined;
}

export async function loadCategories(): Promise<MktCategory[]> {
  const { data } = await supabase
    .from("mkt_categories")
    .select("id, parent_id, slug, name_ar, name_en, icon, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as MktCategory[];
}

export async function loadListingTypes(): Promise<MktListingType[]> {
  const { data } = await supabase
    .from("mkt_listing_types")
    .select("code, name_ar, name_en, is_request, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as MktListingType[];
}

/** Enrich raw listings with business name, verification state and a displayable image. */
export async function decorateListings(
  rows: MktListing[],
  locale: "ar" | "en",
): Promise<ListingCardData[]> {
  if (rows.length === 0) return [];

  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter((v): v is string => !!v)));
  const [{ data: businesses }, types, media] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("mkt_business_profiles").select(BUSINESS_COLUMNS).in("tenant_id", tenantIds)
      : Promise.resolve({ data: [] as MktBusiness[] }),
    loadListingTypes(),
    resolveMedia(rows.map((r) => r.cover_image_url)),
  ]);

  const bizMap = new Map<string, MktBusiness>(
    ((businesses ?? []) as MktBusiness[]).map((b) => [b.tenant_id, b]),
  );
  const typeMap = new Map(types.map((tp) => [tp.code, tp]));

  return rows.map((row) => {
    const biz = row.tenant_id ? bizMap.get(row.tenant_id) : undefined;
    const type = typeMap.get(row.type_code);
    return {
      ...row,
      businessName: biz ? (locale === "ar" ? biz.display_name_ar : biz.display_name_en || biz.display_name_ar) : null,
      businessSlug: biz?.slug ?? null,
      verificationStatus: biz?.verification_status ?? null,
      imageUrl: row.cover_image_url ? media[row.cover_image_url] ?? null : null,
      typeLabel: type ? (locale === "ar" ? type.name_ar : type.name_en) : undefined,
    };
  });
}

export async function loadListings(
  filters: ListingFilters,
  locale: "ar" | "en",
): Promise<ListingCardData[]> {
  let categoryId: string | undefined;
  if (filters.categorySlug) {
    const { data } = await supabase
      .from("mkt_categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .maybeSingle();
    categoryId = data?.id;
    if (!categoryId) return [];
  }

  let query = supabase
    .from("mkt_listings")
    .select(LISTING_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.type) query = query.eq("type_code", filters.type);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.deal) query = query.eq("deal_kind", filters.deal);
  if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term},description.ilike.${term}`);
  }

  switch (filters.sort) {
    case "views":
      query = query.order("views_count", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data } = await query.limit(filters.limit ?? 48);
  const decorated = await decorateListings((data ?? []) as unknown as MktListing[], locale);
  return filters.verifiedOnly
    ? decorated.filter((l) => l.verificationStatus === "verified")
    : decorated;
}

export async function loadVerifiedBusinesses(limit = 8): Promise<MktBusiness[]> {
  const { data } = await supabase
    .from("mkt_business_profiles")
    .select(BUSINESS_COLUMNS)
    .eq("is_published", true)
    .eq("verification_status", "verified")
    .order("joined_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MktBusiness[];
}
