import { supabase } from "@/integrations/supabase/client";

import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  USER_PROFILE_COLUMNS,
  resolveMedia,
  type MktBusiness,
  type MktCategory,
  type MktListing,
  type MktListingType,
  type MktUserProfile,
} from "@/lib/mkt";
import type { ListingCardData } from "@/components/marketplace/ListingCard";

export interface ListingFilters {
  q?: string | undefined;
  categorySlug?: string | undefined;
  /** Suggestion feeds pass several category ids at once. */
  categoryIds?: string[] | undefined;
  subcategoryId?: string | undefined;

  type?: string | undefined;
  city?: string | undefined;
  countryIso2?: string | undefined;
  cityId?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  
  deal?: "sale" | "rent" | undefined;
  sort?: "newest" | "oldest" | "views" | "price_asc" | "price_desc" | undefined;
  limit?: number | undefined;
  advertiser?: "individual" | "business" | undefined;
  withImageOnly?: boolean | undefined;
  hasPrice?: boolean | undefined;
  page?: number | undefined;
}


export const PAGE_SIZE = 20;

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

  const tenantIds = Array.from(
    new Set(rows.map((r) => r.tenant_id).filter((v): v is string => !!v)),
  );
  const ownerIds = Array.from(
    new Set(rows.filter((r) => !r.tenant_id).map((r) => r.owner_user_id)),
  );

  const [{ data: businesses }, { data: people }, types, categories, media] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("mkt_business_profiles").select(BUSINESS_COLUMNS).in("tenant_id", tenantIds)
      : Promise.resolve({ data: [] as MktBusiness[] }),
    ownerIds.length > 0
      ? supabase.from("mkt_user_profiles").select(USER_PROFILE_COLUMNS).in("user_id", ownerIds)
      : Promise.resolve({ data: [] as MktUserProfile[] }),
    loadListingTypes(),
    loadCategories(),
    resolveMedia(rows.map((r) => r.cover_image_url)),
  ]);

  const personMap = new Map<string, MktUserProfile>(
    ((people ?? []) as MktUserProfile[]).map((p) => [p.user_id, p]),
  );

  const bizMap = new Map<string, MktBusiness>(
    ((businesses ?? []) as MktBusiness[]).map((b) => [b.tenant_id, b]),
  );
  const typeMap = new Map(types.map((tp) => [tp.code, tp]));
  const catMap = new Map(categories.map((c) => [c.id, c]));


  return rows.map((row) => {
    const biz = row.tenant_id ? bizMap.get(row.tenant_id) : undefined;
    const person = row.tenant_id ? undefined : personMap.get(row.owner_user_id);
    const type = typeMap.get(row.type_code);
    const cat = catMap.get(row.category_id);
    const subcat = row.subcategory_id ? catMap.get(row.subcategory_id) : undefined;
    const businessName = biz
      ? locale === "ar"
        ? biz.display_name_ar
        : biz.display_name_en || biz.display_name_ar
      : null;
    return {
      ...row,
      // The trust badge always belongs to the identity that published the ad.
      advertiserKind: (row.tenant_id ? "business" : "individual") as "business" | "individual",
      advertiserName: businessName ?? person?.display_name ?? null,
      advertiserUsername: person?.username ?? null,
      businessName,
      businessSlug: biz?.slug ?? null,
      verificationStatus: (biz?.verification_status ?? person?.verification_status) ?? null,
      imageUrl: row.cover_image_url ? (media[row.cover_image_url] ?? null) : null,
      typeLabel: type ? (locale === "ar" ? type.name_ar : type.name_en) : undefined,
      categoryLabel: cat ? (locale === "ar" ? cat.name_ar : cat.name_en) : undefined,
      subcategoryLabel: subcat ? (locale === "ar" ? subcat.name_ar : subcat.name_en) : undefined,
    };
  });

}

async function queryListings(
  filters: ListingFilters,
  locale: "ar" | "en",
): Promise<{ rows: ListingCardData[]; fetched: number }> {
  let categoryId: string | undefined;
  if (filters.categorySlug) {
    const { data } = await supabase
      .from("mkt_categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .maybeSingle();
    categoryId = data?.id;
    if (!categoryId) return { rows: [], fetched: 0 };
  }

  let countryId: string | undefined;
  if (filters.countryIso2) {
    const { data } = await supabase
      .from("mkt_countries")
      .select("id")
      .eq("iso2", filters.countryIso2)
      .maybeSingle();
    countryId = data?.id;
  }

  let query = supabase
    .from("mkt_listings")
    .select(LISTING_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (countryId) query = query.eq("country_id", countryId);
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.in("category_id", filters.categoryIds);
  }
  if (filters.cityId) query = query.eq("city_id", filters.cityId);

  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.type) query = query.eq("type_code", filters.type);
  if (filters.advertiser) query = query.eq("advertiser_type", filters.advertiser);
  if (filters.withImageOnly) query = query.not("cover_image_url", "is", null);
  if (filters.hasPrice) query = query.eq("price_on_request", false).not("price", "is", null);
  if (filters.city) query = query.eq("city", filters.city);

  if (filters.deal) query = query.eq("deal_kind", filters.deal);
  if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term},description.ilike.${term}`);
  }

  switch (filters.sort) {
    case "oldest":
      query = query.order("published_at", { ascending: true, nullsFirst: false });
      break;
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
  // Tie-breaker so rows never shift between pages and appear twice.
  query = query.order("id", { ascending: false });

  const size = filters.limit ?? 48;
  if (filters.page !== undefined) {
    const from = filters.page * size;
    query = query.range(from, from + size - 1);
  } else {
    query = query.limit(size);
  }

  const { data } = await query;
  const raw = (data ?? []) as unknown as MktListing[];
  const decorated = await decorateListings(raw, locale);
  // Verification is a visual badge only: it never filters or reorders results.
  const rows = decorated;
  return { rows, fetched: raw.length };
}

export async function loadListings(
  filters: ListingFilters,
  locale: "ar" | "en",
): Promise<ListingCardData[]> {
  const { rows } = await queryListings(filters, locale);
  return rows;
}

/**
 * One page of results for infinite scrolling. `fetched` is the raw row count
 * before the client-side "verified only" pass, so paging never stops early.
 */
export async function loadListingsPage(
  filters: ListingFilters,
  locale: "ar" | "en",
  page: number,
): Promise<{ rows: ListingCardData[]; fetched: number }> {
  return queryListings({ ...filters, limit: filters.limit ?? PAGE_SIZE, page }, locale);
}

export async function loadUserProfileBySlug(username: string): Promise<MktUserProfile | null> {
  const { data } = await supabase
    .from("mkt_user_profiles")
    .select(USER_PROFILE_COLUMNS)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as MktUserProfile | null) ?? null;
}

/** Recently joined published businesses. Verification is never a criterion —
 *  it only decides whether a check mark renders next to the name. */
export async function loadBusinesses(limit = 8): Promise<MktBusiness[]> {
  const { data } = await supabase
    .from("mkt_business_profiles")
    .select(BUSINESS_COLUMNS)
    .eq("is_published", true)
    .order("joined_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MktBusiness[];
}

export interface BusinessSearchFilters {
  q?: string | undefined;
  countryIso2?: string | undefined;
  cityId?: string | undefined;
  sort?: "newest" | "oldest" | undefined;
}

/**
 * One page of published businesses for the "suppliers & businesses" field of the
 * search page. Verification never filters or reorders: it only decides whether a
 * check mark renders under the name inside the identity block.
 */
export async function loadBusinessesPage(
  filters: BusinessSearchFilters,
  page: number,
): Promise<{ rows: MktBusiness[]; logos: Record<string, string>; fetched: number }> {
  let countryId: string | undefined;
  if (filters.countryIso2) {
    const { data } = await supabase
      .from("mkt_countries")
      .select("id")
      .eq("iso2", filters.countryIso2)
      .maybeSingle();
    countryId = data?.id;
  }

  let query = supabase
    .from("mkt_business_profiles")
    .select(BUSINESS_COLUMNS)
    .eq("is_published", true);

  if (countryId) query = query.eq("country_id", countryId);
  if (filters.cityId) query = query.eq("city_id", filters.cityId);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `display_name_ar.ilike.${term},display_name_en.ilike.${term},headline.ilike.${term}`,
    );
  }
  query = query
    .order("joined_at", { ascending: filters.sort === "oldest", nullsFirst: false })
    .order("tenant_id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const { data } = await query;
  const rows = (data ?? []) as MktBusiness[];
  const logos = await resolveMedia(rows.map((r) => r.logo_url));
  return { rows, logos, fetched: rows.length };
}
