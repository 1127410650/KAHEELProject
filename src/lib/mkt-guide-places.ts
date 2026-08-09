/**
 * Syria guide places — reads for /guides/syria.
 *
 * Two rules are enforced here on purpose, in addition to the database side:
 * 1) A hard blocklist: any record carrying a forbidden term in any field is
 *    never returned, even if it somehow slipped into the table.
 * 2) Verification honesty: the "verified" badge is derived from the record's
 *    own verification status, and OSM-sourced records are always shown as
 *    preliminary information instead.
 */
import { supabase } from "@/integrations/supabase/client";

export const GUIDE_PAGE_SIZE = 24;

/** Terms that must never appear in the guide, in any field. */
const FORBIDDEN_TERMS = ["الأسد", "الاسد", "assad"];

export interface GuidePlace {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  sector: string | null;
  category: string | null;
  subcategory: string | null;
  governorate: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  address_status: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  map_url_status: string | null;
  phone: string | null;
  phone_status: string | null;
  whatsapp: string | null;
  whatsapp_status: string | null;
  whatsapp_link: string | null;
  email: string | null;
  website: string | null;
  opening_hours: string | null;
  stars: number | null;
  source_label: string | null;
  source_type: string | null;
  source_date: string | null;
  verification_status: string;
  completeness: number | null;
  notes: string | null;
}

export interface GuideFilters {
  query: string;
  sector: string;
  governorate: string;
  category: string;
  subcategory: string;
}

export const EMPTY_GUIDE_FILTERS: GuideFilters = {
  query: "",
  sector: "",
  governorate: "",
  category: "",
  subcategory: "",
};


const SELECT_COLUMNS =
  "id,slug,name_ar,name_en,sector,category,subcategory,governorate,city,district,address,address_status,latitude,longitude,map_url,map_url_status,phone,phone_status,whatsapp,whatsapp_status,whatsapp_link,email,website,opening_hours,stars,source_label,source_type,source_date,verification_status,completeness,notes";

/** True when the record must never be displayed. */
export function isForbiddenPlace(place: Partial<GuidePlace>): boolean {
  const blob = Object.values(place)
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return FORBIDDEN_TERMS.some((term) => blob.includes(term.toLowerCase()));
}

/** Escape user input before it reaches a PostgREST pattern filter. */
function safePattern(value: string): string {
  return value.replace(/[%_,()\\]/g, " ").trim();
}

export function isVerified(place: GuidePlace): boolean {
  return place.verification_status === "verified" && !isOpenStreetMap(place);
}

export function isOpenStreetMap(place: GuidePlace): boolean {
  const source = `${place.source_type ?? ""} ${place.source_label ?? ""}`.toLowerCase();
  return source.includes("osm") || source.includes("openstreetmap");
}

export interface GuidePlacesPage {
  rows: GuidePlace[];
  total: number;
}

export async function fetchGuidePlaces(
  filters: GuideFilters,
  page: number,
): Promise<GuidePlacesPage> {
  let request = supabase
    .from("mkt_guide_places")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("is_published", true);

  const term = safePattern(filters.query);
  if (term.length > 0) {
    request = request.or(
      `name_ar.ilike.%${term}%,name_en.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%,subcategory.ilike.%${term}%`,
    );
  }
  if (filters.sector) request = request.eq("sector", filters.sector);
  if (filters.governorate) request = request.eq("governorate", filters.governorate);
  if (filters.category) request = request.eq("category", filters.category);
  if (filters.subcategory) request = request.eq("subcategory", filters.subcategory);


  const from = page * GUIDE_PAGE_SIZE;
  const { data, error, count } = await request
    // Richer, source-backed records first; ties fall back to the Arabic name.
    .order("completeness", { ascending: false, nullsFirst: false })
    .order("name_ar", { ascending: true })
    .range(from, from + GUIDE_PAGE_SIZE - 1);

  if (error) throw error;

  const rows = ((data ?? []) as unknown as GuidePlace[]).filter(
    (row) => !isForbiddenPlace(row),
  );
  return { rows, total: count ?? rows.length };
}

export async function fetchGuidePlace(slug: string): Promise<GuidePlace | null> {
  const { data, error } = await supabase
    .from("mkt_guide_places")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  const place = (data as unknown as GuidePlace | null) ?? null;
  if (!place || isForbiddenPlace(place)) return null;
  return place;
}

export interface GuideFacets {
  sectors: string[];
  governorates: string[];
  categories: string[];
}

/** Distinct filter values, read from a bounded slice to stay cheap. */
export async function fetchGuideFacets(): Promise<GuideFacets> {
  const { data, error } = await supabase
    .from("mkt_guide_places")
    .select("sector,governorate,category")
    .eq("is_published", true)
    .limit(10000);

  if (error) throw error;

  const sectors = new Set<string>();
  const governorates = new Set<string>();
  const categories = new Set<string>();

  for (const row of (data ?? []) as Array<{
    sector: string | null;
    governorate: string | null;
    category: string | null;
  }>) {
    if (row.sector) sectors.add(row.sector);
    if (row.governorate) governorates.add(row.governorate);
    if (row.category) categories.add(row.category);
  }

  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, "ar"));
  return {
    sectors: sort(sectors),
    governorates: sort(governorates),
    categories: sort(categories),
  };
}

/** Directions link: the record's own map URL, else a plain place search. */
export function directionsHref(place: GuidePlace): string | null {
  if (place.map_url && /^https?:\/\//.test(place.map_url)) return place.map_url;
  if (place.latitude !== null && place.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const query = [place.name_ar, place.district, place.city, place.governorate, "سوريا"]
    .filter(Boolean)
    .join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function whatsappHref(place: GuidePlace): string | null {
  if (place.whatsapp_link && /^https?:\/\//.test(place.whatsapp_link)) return place.whatsapp_link;
  const digits = (place.whatsapp ?? "").replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function websiteHref(place: GuidePlace): string | null {
  if (!place.website) return null;
  return /^https?:\/\//.test(place.website) ? place.website : `https://${place.website}`;
}
