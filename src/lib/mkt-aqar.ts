/**
 * كَحيل عقار — طبقة القراءة للواجهة العامة.
 *
 * كل الاستعلامات قراءة فقط على جداول `mkt_realestate_*` عبر سياسات القراءة
 * العامة الموجودة أصلًا (`status = 'published'`). لا كتابة ولا منطق خلفي جديد.
 *
 * الصور: `storage_path` قد يكون مسار كائن في الحاوية الخاصة (يُوقّع عبر
 * `resolveMedia`) أو مسار أصل CDN داخلي للبيانات التجريبية. الروابط الموقّعة
 * تُخزَّن مؤقتًا في الذاكرة حتى لا يُعاد توقيعها في كل تصفّح.
 */

import { supabase } from "@/integrations/supabase/client";
import { resolveMedia } from "@/lib/mkt";

export type AqarTrack = "daily_rent" | "long_rent" | "sale";

export const AQAR_TRACKS: { key: AqarTrack; label: string }[] = [
  { key: "daily_rent", label: "يومي" },
  { key: "long_rent", label: "طويل" },
  { key: "sale", label: "بيع" },
];

export function isAqarTrack(value: string | undefined | null): value is AqarTrack {
  return value === "daily_rent" || value === "long_rent" || value === "sale";
}

export interface AqarListing {
  id: string;
  provider_id: string;
  deal_track: AqarTrack;
  property_type: string;
  title: string;
  description: string | null;
  city: string;
  district: string;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  area_sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  build_year: number | null;
  is_furnished: boolean;
  floor_no: number | null;
  amenities: string[] | null;
  price: number;
  price_currency: "SYP" | "USD";
  price_period: "night" | "month" | "year" | "total";
  currency_display: "both" | "entered_only";
  published_at: string | null;
  is_demo: boolean;
  /** روابط صور جاهزة للعرض، مرتّبة (الغلاف أولًا). */
  photos: string[];
}

export interface AqarProvider {
  id: string;
  display_name: string;
  provider_type: "agency" | "hotel" | "individual";
  city: string | null;
  verification_status: "unverified" | "pending" | "verified";
  is_demo: boolean;
}

const LISTING_COLUMNS =
  "id, provider_id, deal_track, property_type, title, description, city, district, address_text, latitude, longitude, area_sqm, rooms, bathrooms, build_year, is_furnished, floor_no, amenities, price, price_currency, price_period, currency_display, published_at, is_demo";

/** ذاكرة روابط الصور: المسار ← الرابط + وقت الانتهاء (توقيع ساعة، نُجدّد قبلها). */
const mediaCache = new Map<string, { url: string; expires: number }>();
const MEDIA_TTL_MS = 45 * 60 * 1000;

async function resolvePhotoPaths(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of Array.from(new Set(paths))) {
    const hit = mediaCache.get(path);
    if (hit && hit.expires > now) result[path] = hit.url;
    else missing.push(path);
  }
  if (missing.length > 0) {
    const fresh = await resolveMedia(missing);
    for (const [path, url] of Object.entries(fresh)) {
      result[path] = url;
      mediaCache.set(path, { url, expires: now + MEDIA_TTL_MS });
    }
  }
  return result;
}

/** يجلب صور مجموعة إعلانات في استعلام واحد ويعيدها مرتّبة لكل إعلان. */
async function attachPhotos(rows: Omit<AqarListing, "photos">[]): Promise<AqarListing[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase
    .from("mkt_realestate_photos")
    .select("listing_id, storage_path, is_cover, sort_order")
    .in(
      "listing_id",
      rows.map((row) => row.id),
    )
    .is("deleted_at", null)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true });

  const photoRows = data ?? [];
  const urls = await resolvePhotoPaths(photoRows.map((photo) => photo.storage_path));
  const byListing = new Map<string, string[]>();
  for (const photo of photoRows) {
    const url = urls[photo.storage_path];
    if (!url) continue;
    const list = byListing.get(photo.listing_id) ?? [];
    list.push(url);
    byListing.set(photo.listing_id, list);
  }
  return rows.map((row) => ({ ...row, photos: byListing.get(row.id) ?? [] }));
}

export interface AqarQuery {
  track: AqarTrack;
  /** نوع العقار المطلوب مع أنواعه المضمومة (محلات = محل/مكتب/مستودع). */
  types?: string[];
  city?: string;
  district?: string;
  /** حدود السعر بالعملة المدخلة — تُطبَّق على `price` كما هو. */
  minPrice?: number;
  maxPrice?: number;
  furnishedOnly?: boolean;
  minRooms?: number;
  minArea?: number;
  limit?: number;
}

function applyFilters(
  builder: ReturnType<typeof buildBase>,
  query: AqarQuery,
): ReturnType<typeof buildBase> {
  let out = builder.eq("deal_track", query.track);
  if (query.types && query.types.length > 0) out = out.in("property_type", query.types);
  if (query.city) out = out.eq("city", query.city);
  if (query.district) out = out.eq("district", query.district);
  if (typeof query.minPrice === "number") out = out.gte("price", query.minPrice);
  if (typeof query.maxPrice === "number") out = out.lte("price", query.maxPrice);
  if (query.furnishedOnly) out = out.eq("is_furnished", true);
  if (typeof query.minRooms === "number") out = out.gte("rooms", query.minRooms);
  if (typeof query.minArea === "number") out = out.gte("area_sqm", query.minArea);
  return out;
}

function buildBase() {
  return supabase
    .from("mkt_realestate_listings")
    .select(LISTING_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null);
}

/** «الأحدث» ونتائج الفلترة: أحدث المنشور أولًا. */
export async function fetchAqarListings(query: AqarQuery): Promise<AqarListing[]> {
  const { data } = await applyFilters(buildBase(), query)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(query.limit ?? 24);
  return attachPhotos((data ?? []) as unknown as Omit<AqarListing, "photos">[]);
}

/** «مميزة»: الإعلانات التي لها ترويج نشط، داخل المسار الحالي. */
export async function fetchAqarPromoted(track: AqarTrack, limit = 12): Promise<AqarListing[]> {
  const { data: promos } = await supabase
    .from("mkt_realestate_promotions")
    .select("listing_id, ends_at")
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(60);

  const ids = Array.from(new Set((promos ?? []).map((row) => row.listing_id)));
  if (ids.length === 0) return [];

  const { data } = await buildBase().eq("deal_track", track).in("id", ids).limit(limit);
  return attachPhotos((data ?? []) as unknown as Omit<AqarListing, "photos">[]);
}

/** عدّاد لكل نوع عقار داخل المسار — يُستخدم على بطاقات الأنواع. */
export async function fetchAqarTypeCounts(track: AqarTrack): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("mkt_realestate_listings")
    .select("property_type")
    .eq("status", "published")
    .eq("deal_track", track)
    .is("deleted_at", null)
    .limit(2000);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.property_type] = (counts[row.property_type] ?? 0) + 1;
  return counts;
}

/** المدن والأحياء المتاحة فعلًا داخل المسار — لتغذية الفلاتر. */
export async function fetchAqarPlaces(
  track: AqarTrack,
): Promise<{ cities: string[]; districtsByCity: Record<string, string[]> }> {
  const { data } = await supabase
    .from("mkt_realestate_listings")
    .select("city, district")
    .eq("status", "published")
    .eq("deal_track", track)
    .is("deleted_at", null)
    .limit(2000);

  const districtsByCity: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const list = districtsByCity[row.city] ?? [];
    if (row.district && !list.includes(row.district)) list.push(row.district);
    districtsByCity[row.city] = list;
  }
  return { cities: Object.keys(districtsByCity).sort(), districtsByCity };
}

export async function fetchAqarListing(id: string): Promise<AqarListing | null> {
  const { data } = await supabase
    .from("mkt_realestate_listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const [listing] = await attachPhotos([data as unknown as Omit<AqarListing, "photos">]);
  return listing ?? null;
}

export async function fetchAqarProvider(id: string): Promise<AqarProvider | null> {
  const { data } = await supabase
    .from("mkt_realestate_providers")
    .select("id, display_name, provider_type, city, verification_status, is_demo")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as AqarProvider | null) ?? null;
}

export interface AqarRoomType {
  id: string;
  name: string;
  price: number;
  price_currency: "SYP" | "USD";
  availability: "available" | "full";
}

export async function fetchAqarRoomTypes(listingId: string): Promise<AqarRoomType[]> {
  const { data } = await supabase
    .from("mkt_realestate_room_types")
    .select("id, name, price, price_currency, availability")
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []) as AqarRoomType[];
}

/** سعر الصرف اليدوي المعتمد (USD → SYP)، أو null إن لم يُعتمد بعد. */
export async function fetchAqarUsdRate(): Promise<number | null> {
  const { data } = await supabase
    .from("mkt_realestate_exchange_rates")
    .select("rate")
    .eq("base_currency", "USD")
    .eq("quote_currency", "SYP")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Number(data.rate) : null;
}

// ── تنسيق العرض ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<AqarListing["price_period"], string> = {
  night: "/ الليلة",
  month: "/ الشهر",
  year: "/ السنة",
  total: "",
};

const CURRENCY_LABELS: Record<"SYP" | "USD", string> = { SYP: "ل.س", USD: "$" };

/** الأرقام إنجليزية دائمًا، والعملة بلاحقتها العربية. */
export function formatAqarAmount(value: number, currency: "SYP" | "USD"): string {
  return `${Math.round(value).toLocaleString("en-US")} ${CURRENCY_LABELS[currency]}`;
}

/** السعر بعملته + المعادل حين يسمح `currency_display` ويوجد سعر صرف معتمد. */
export function formatAqarPrice(
  listing: Pick<AqarListing, "price" | "price_currency" | "price_period" | "currency_display">,
  usdRate: number | null,
): { main: string; secondary: string | null; period: string } {
  const main = formatAqarAmount(listing.price, listing.price_currency);
  let secondary: string | null = null;
  if (listing.currency_display === "both" && usdRate && usdRate > 0) {
    secondary =
      listing.price_currency === "USD"
        ? formatAqarAmount(listing.price * usdRate, "SYP")
        : formatAqarAmount(listing.price / usdRate, "USD");
  }
  return { main, secondary, period: PERIOD_LABELS[listing.price_period] };
}

/** المساحة للبيع، والليالي/المدة للتأجير — سطر واحد أسفل السعر. */
export function aqarMetaLine(listing: AqarListing): string {
  if (listing.deal_track === "sale") {
    const area = listing.area_sqm ? `${Number(listing.area_sqm).toLocaleString("en-US")} م²` : null;
    const year = listing.build_year ? `بناء ${listing.build_year}` : null;
    return [area, year].filter(Boolean).join(" • ") || "للبيع";
  }
  if (listing.deal_track === "daily_rent") {
    const guests = listing.rooms ? `${listing.rooms} غرف` : null;
    return [guests, "إيجار يومي"].filter(Boolean).join(" • ");
  }
  return [listing.is_furnished ? "مفروش" : "غير مفروش", "إيجار طويل"].join(" • ");
}
