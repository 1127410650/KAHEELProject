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
import { nearbyGuidePlaceIds, orderByIds, type RadiusKm } from "@/lib/mkt-nearby";
import { defaultMarketIso2 } from "@/lib/mkt-markets";

export const GUIDE_PAGE_SIZE = 24;

/** Terms that must never appear in the guide, in any field. */
const FORBIDDEN_TERMS = ["الأسد", "الاسد", "assad"];

export interface GuidePlace {
  id: string;
  country_iso2?: string;
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
  /** المسافة بالأمتار من موقع المستخدم عند الترتيب حسب القرب. */
  distanceM?: number | null;
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
  "id,country_iso2,slug,name_ar,name_en,sector,category,subcategory,governorate,city,district,address,address_status,latitude,longitude,map_url,map_url_status,phone,phone_status,whatsapp,whatsapp_status,whatsapp_link,email,website,opening_hours,stars,source_label,source_type,source_date,verification_status,completeness,notes";

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
  /** «الأقرب إليك»: القاعدة ترتّب وتحسب المسافة، ولا يُجلب سوى صفحة واحدة. */
  near?: { lat: number; lng: number; radiusKm: RadiusKm } | undefined,
): Promise<GuidePlacesPage> {
  const iso2 = await defaultMarketIso2();
  if (near) {
    const nearPage = await nearbyGuidePlaceIds({
      lat: near.lat,
      lng: near.lng,
      radiusKm: near.radiusKm,
      limit: GUIDE_PAGE_SIZE,
      offset: page * GUIDE_PAGE_SIZE,
      countryIso2: iso2,
      sector: filters.sector || undefined,
      governorate: filters.governorate || undefined,
      category: filters.category || undefined,
      subcategory: filters.subcategory || undefined,
      q: filters.query || undefined,
    });
    if (nearPage.ids.length === 0) return { rows: [], total: 0 };
    const { data, error: nearError } = await supabase
      .from("mkt_guide_places")
      .select(SELECT_COLUMNS)
      .in("id", nearPage.ids);
    if (nearError) throw nearError;
    const ordered = orderByIds((data ?? []) as unknown as GuidePlace[], nearPage.ids)
      .filter((row) => !isForbiddenPlace(row))
      .map((row) => ({ ...row, distanceM: nearPage.distances[row.id] ?? null }));
    // ترقيم متدرّج: صفحة ممتلئة تعني وجود صفحة تالية على الأقل.
    const seen = page * GUIDE_PAGE_SIZE + ordered.length;
    return { rows: ordered, total: ordered.length === GUIDE_PAGE_SIZE ? seen + 1 : seen };
  }
  // نطاق الدولة من إعداد «الدول المفعّلة»، لا من قيمة ثابتة في الكود.
  let request = supabase
    .from("mkt_guide_places")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .eq("country_iso2", iso2);

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

/** One raw facet row: the four dimensions the filters are built from. */
export interface GuideFacetRow {
  sector: string | null;
  governorate: string | null;
  category: string | null;
  subcategory: string | null;
}

export interface GuideFacetOption {
  value: string;
  count: number;
}

export interface GuideFacets {
  sectors: GuideFacetOption[];
  governorates: GuideFacetOption[];
  categories: GuideFacetOption[];
  subcategories: GuideFacetOption[];
}

/**
 * Facet rows are fetched once and cached; the dependent option lists and their
 * counts are then derived in memory so changing a filter never hits the network.
 * The read is paginated because the Data API caps a single response at 1,000 rows,
 * which would otherwise make the counts silently wrong.
 */
export async function fetchGuideFacetRows(): Promise<GuideFacetRow[]> {
  const CHUNK = 1000;
  const iso2 = await defaultMarketIso2();
  const readChunk = async (from: number) => {
    const { data, error, count } = await supabase
      .from("mkt_guide_places")
      .select("sector,governorate,category,subcategory", { count: "exact" })
      .eq("is_published", true)
      .eq("country_iso2", iso2)
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);

    if (error) throw error;
    return { rows: (data ?? []) as GuideFacetRow[], count: count ?? 0 };
  };

  // First page also reports the exact total, so the rest is fetched in parallel.
  const first = await readChunk(0);
  const pages = Math.min(20, Math.ceil(first.count / CHUNK));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => readChunk((index + 1) * CHUNK)),
  );

  return [first.rows, ...rest.map((page) => page.rows)].flat();
}



function tally(
  rows: GuideFacetRow[],
  key: keyof GuideFacetRow,
  matches: (row: GuideFacetRow) => boolean,
): GuideFacetOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!matches(row)) continue;
    const value = row[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "ar"));
}

/**
 * Cascading facets: each list is counted against the *other* active filters, so
 * picking a sector narrows its categories, and picking a category narrows its
 * subcategories — while every list keeps showing its own alternatives.
 */
export function buildGuideFacets(rows: GuideFacetRow[], filters: GuideFilters): GuideFacets {
  const bySector = (row: GuideFacetRow) => !filters.sector || row.sector === filters.sector;
  const byGov = (row: GuideFacetRow) =>
    !filters.governorate || row.governorate === filters.governorate;
  const byCategory = (row: GuideFacetRow) =>
    !filters.category || row.category === filters.category;

  return {
    sectors: tally(rows, "sector", byGov),
    governorates: tally(rows, "governorate", (row) => bySector(row) && byCategory(row)),
    categories: tally(rows, "category", (row) => bySector(row) && byGov(row)),
    subcategories: tally(
      rows,
      "subcategory",
      (row) => bySector(row) && byGov(row) && byCategory(row),
    ),
  };
}

function readableSourceName(place: GuidePlace): string | null {
  const candidates = [place.source_type, place.source_label];
  // Prefer a human name; a bare URL is reduced to its site (or OpenStreetMap).
  for (const candidate of candidates) {
    const value = (candidate ?? "").trim();
    if (!value || /^https?:\/\//.test(value)) continue;
    return value;
  }
  for (const candidate of candidates) {
    const value = (candidate ?? "").trim();
    if (!/^https?:\/\//.test(value)) continue;
    if (value.includes("openstreetmap")) return "OpenStreetMap";
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  }
  return isOpenStreetMap(place) ? "OpenStreetMap" : null;
}

/** Human label for a record's source, with its date when present. */
export function sourceLabel(place: GuidePlace): string | null {
  const source = readableSourceName(place);
  if (!source) return null;
  const date = (place.source_date ?? "").trim();
  if (!date) return source;
  const parsed = new Date(date);
  const shown = Number.isNaN(parsed.getTime())
    ? date
    : `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
  return `${source} — ${shown}`;
}

/** The source's own page, when the record stores a usable link. */
export function sourceHref(place: GuidePlace): string | null {
  const value = (place.source_label ?? "").trim();
  return /^https?:\/\//.test(value) ? value : null;
}




/** Directions link: the record's own map URL, else a plain place search. */
export function directionsHref(place: GuidePlace): string | null {
  if (place.map_url && /^https?:\/\//.test(place.map_url)) return place.map_url;
  if (place.latitude !== null && place.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const query = [place.name_ar, place.district, place.city, place.governorate, place.country_iso2 === "LB" ? "لبنان" : "سوريا"]
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
