// ترتيب «الأقرب إليك» — نقطة انطلاق واحدة لكل المنصة.
//
// الخصوصية: الموقع الحيّ لا يُخزَّن إطلاقًا — لا في localStorage ولا في القاعدة.
// يبقى في الذاكرة فقط طوال الجلسة الحالية (وحدة مشتركة + useSyncExternalStore).
// أما العناوين المحفوظة فهي بيانات كتبها المستخدم بنفسه، ويُقرأ منها العنوان
// الافتراضي كنقطة انطلاق ثابتة عندما لا يوجد موقع حيّ.
//
// الترتيب والتصفية وحساب المسافة كلها في قاعدة البيانات عبر دوال
// `mkt_nearby_*` (haversine + فهارس مكانية). المتصفح يستلم معرّفات مرتّبة
// ومسافة كل عنصر فقط، لا كل السجلات.
import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";

export interface NearbyOrigin {
  lat: number;
  lng: number;
  /** المدينة/المحافظة كنص قصير للعرض. */
  city: string | null;
  /** الحي كنص قصير للعرض. */
  district: string | null;
  source: "device" | "map" | "address";
}

/** أنصاف الأقطار المتاحة للمستخدم بالكيلومتر؛ `null` تعني «كل سوريا». */
export const RADIUS_OPTIONS = [5, 10, 20, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number] | null;

export function parseRadius(raw: string | undefined): RadiusKm {
  const value = Number(raw);
  return (RADIUS_OPTIONS as readonly number[]).includes(value) ? (value as RadiusKm) : null;
}

/* ────────────────────────── الموقع الحيّ في الذاكرة ────────────────────────── */

let liveOrigin: NearbyOrigin | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** يُستدعى من لوحة الموقع بعد تحديد الجهاز أو الدبوس على الخريطة. */
export function setLiveOrigin(origin: NearbyOrigin | null): void {
  liveOrigin = origin;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): NearbyOrigin | null {
  return liveOrigin;
}

function serverSnapshot(): NearbyOrigin | null {
  return null;
}

/** العنوان الافتراضي المحفوظ (إن وُجد) كنقطة انطلاق دائمة. */
async function loadSavedOrigin(locale: "ar" | "en"): Promise<NearbyOrigin | null> {
  const { data } = await supabase
    .from("mkt_user_addresses")
    .select("city_id, district, lat, lng, is_default, created_at")
    .not("lat", "is", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const row = (data ?? [])[0] as
    | { city_id: string | null; district: string | null; lat: number | null; lng: number | null }
    | undefined;
  if (!row || row.lat === null || row.lng === null) return null;

  let city: string | null = null;
  if (row.city_id) {
    const { data: cityRow } = await supabase
      .from("mkt_cities")
      .select("name_ar, name_en")
      .eq("id", row.city_id)
      .maybeSingle();
    const named = cityRow as { name_ar: string; name_en: string } | null;
    if (named) city = locale === "en" ? named.name_en || named.name_ar : named.name_ar;
  }

  return { lat: row.lat, lng: row.lng, city, district: row.district, source: "address" };
}

/**
 * نقطة الانطلاق الحالية: الموقع الحيّ إن حُدِّد في هذه الجلسة، وإلا العنوان
 * الافتراضي المحفوظ. `shortLabel` نص سطر واحد مثل «دمشق · المزة».
 */
export function useNearbyOrigin(): {
  origin: NearbyOrigin | null;
  shortLabel: string | null;
  ready: boolean;
} {
  const { locale } = useI18n();
  const { session } = useSession();
  const live = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const saved = useQuery({
    queryKey: ["mkt", "nearby-origin", session?.user.id ?? null, locale],
    enabled: !!session && !live,
    staleTime: 60_000,
    queryFn: () => loadSavedOrigin(locale === "en" ? "en" : "ar"),
  });

  const origin = live ?? saved.data ?? null;
  return {
    origin,
    shortLabel: origin ? shortPlaceLabel(origin) : null,
    ready: !!live || !session || !saved.isLoading,
  };
}

/**
 * «دمشق · المزة» — سطر واحد بلا التفاف. عند الطول: يُختصر الحي، ثم تُعرض
 * المدينة وحدها؛ لا قصّ مشوّه في منتصف كلمة.
 */
export function shortPlaceLabel(
  origin: Pick<NearbyOrigin, "city" | "district">,
  maxChars = 22,
): string | null {
  const city = (origin.city ?? "").trim();
  const district = (origin.district ?? "").trim();
  if (!city && !district) return null;
  if (!city) return district.slice(0, maxChars);
  if (!district) return city;
  const full = `${city} · ${district}`;
  if (full.length <= maxChars) return full;
  const room = maxChars - city.length - 3;
  // الحي لا يُقصّ إلى بقايا غير مفهومة: إما اختصار محترم أو المدينة وحدها.
  if (room >= 5) return `${city} · ${district.slice(0, room).trim()}…`;
  return city;
}

/** «450 م» أو «1.2 كم» — الأرقام إنجليزية دائمًا. */
export function formatDistance(
  meters: number | null | undefined,
  locale: "ar" | "en",
): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  if (meters < 950) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return locale === "en" ? `${rounded} m` : `${rounded} م`;
  }
  const km = meters / 1000;
  const value = km >= 10 ? Math.round(km).toString() : km.toFixed(1);
  return locale === "en" ? `${value} km` : `${value} كم`;
}

/* ──────────────────────── قراءة المعرّفات المرتّبة بالقرب ──────────────────────── */

export interface NearbyPage {
  /** المعرّفات بترتيب القرب الفعلي، ثم العناصر بلا إحداثيات. */
  ids: string[];
  /** المسافة بالأمتار لكل معرّف (null لمن لا يملك إحداثيات). */
  distances: Record<string, number | null>;
}

type NearbyRow = { id: string; distance_m: number | null };

/**
 * الوسائط الاختيارية تُحذف بدل تمريرها `undefined`: دوال القاعدة تعتمد قيمها
 * الافتراضية، والمشروع يمنع الخصائص الاختيارية الحاملة لـ `undefined`.
 */
function compact<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) delete (input as Record<string, unknown>)[key];
  }
  return input;
}

function toPage(rows: NearbyRow[] | null | undefined): NearbyPage {
  const list = rows ?? [];
  const distances: Record<string, number | null> = {};
  for (const row of list) distances[row.id] = row.distance_m;
  return { ids: list.map((row) => row.id), distances };
}

export interface NearbyListingArgs {
  lat: number;
  lng: number;
  radiusKm: RadiusKm;
  limit: number;
  offset: number;
  countryId?: string | undefined;
  cityId?: string | undefined;
  categoryId?: string | undefined;
  subcategoryId?: string | undefined;
  typeCode?: string | undefined;
  deal?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  q?: string | undefined;
  advertiser?: string | undefined;
  withImage?: boolean | undefined;
  hasPrice?: boolean | undefined;
  featuredOnly?: boolean | undefined;
}

export async function nearbyListingIds(args: NearbyListingArgs): Promise<NearbyPage> {
  const { data, error } = await supabase.rpc("mkt_nearby_listings", compact({
    _lat: args.lat,
    _lng: args.lng,
    _radius_km: args.radiusKm ?? undefined,
    _limit: args.limit,
    _offset: args.offset,
    _country_id: args.countryId ?? undefined,
    _city_id: args.cityId ?? undefined,
    _category_id: args.categoryId ?? undefined,
    _subcategory_id: args.subcategoryId ?? undefined,
    _type_code: args.typeCode ?? undefined,
    _deal: args.deal ?? undefined,
    _min_price: args.minPrice ?? undefined,
    _max_price: args.maxPrice ?? undefined,
    _q: sanitizeTerm(args.q),
    _advertiser: args.advertiser ?? undefined,
    _with_image: args.withImage ?? false,
    _has_price: args.hasPrice ?? false,
    _featured_only: args.featuredOnly ?? false,
  }) as never);
  if (error) throw error;
  return toPage(data as unknown as NearbyRow[]);
}

export async function nearbyGuidePlaceIds(args: {
  lat: number;
  lng: number;
  radiusKm: RadiusKm;
  limit: number;
  offset: number;
  countryIso2?: string | undefined;
  sector?: string | undefined;
  governorate?: string | undefined;
  category?: string | undefined;
  subcategory?: string | undefined;
  q?: string | undefined;
}): Promise<NearbyPage> {
  const { data, error } = await supabase.rpc("mkt_nearby_guide_places", compact({
    _lat: args.lat,
    _lng: args.lng,
    _radius_km: args.radiusKm ?? undefined,
    _limit: args.limit,
    _offset: args.offset,
    _country_iso2: args.countryIso2 ?? undefined,
    _sector: args.sector ?? undefined,
    _governorate: args.governorate ?? undefined,
    _category: args.category ?? undefined,
    _subcategory: args.subcategory ?? undefined,
    _q: sanitizeTerm(args.q),
  }) as never);
  if (error) throw error;
  return toPage(data as unknown as NearbyRow[]);
}

export async function nearbyStorefrontIds(args: {
  lat: number;
  lng: number;
  radiusKm: RadiusKm;
  limit: number;
  offset: number;
  countryId?: string | undefined;
  cityId?: string | undefined;
  storeType?: string | undefined;
  q?: string | undefined;
}): Promise<NearbyPage> {
  const { data, error } = await supabase.rpc("mkt_nearby_storefronts", compact({
    _lat: args.lat,
    _lng: args.lng,
    _radius_km: args.radiusKm ?? undefined,
    _limit: args.limit,
    _offset: args.offset,
    _country_id: args.countryId ?? undefined,
    _city_id: args.cityId ?? undefined,
    _store_type: args.storeType ?? undefined,
    _q: sanitizeTerm(args.q),
  }) as never);
  if (error) throw error;
  return toPage(data as unknown as NearbyRow[]);
}

export async function nearbyDirectoryIds(args: {
  lat: number;
  lng: number;
  radiusKm: RadiusKm;
  limit: number;
  offset: number;
  sector?: string | undefined;
  governorate?: string | undefined;
  q?: string | undefined;
}): Promise<NearbyPage> {
  const { data, error } = await supabase.rpc("mkt_nearby_directory", compact({
    _lat: args.lat,
    _lng: args.lng,
    _radius_km: args.radiusKm ?? undefined,
    _limit: args.limit,
    _offset: args.offset,
    _sector: args.sector ?? undefined,
    _governorate: args.governorate ?? undefined,
    _q: sanitizeTerm(args.q),
  }) as never);
  if (error) throw error;
  return toPage(data as unknown as NearbyRow[]);
}

/** المصطلح يمرّ كوسيط منفصل، لكن نحيّد رموز `like` حتى لا تتحول إلى أنماط. */
function sanitizeTerm(raw: string | undefined): string | undefined {
  const cleaned = (raw ?? "").replace(/[%_\\]/g, " ").trim().slice(0, 80);
  return cleaned.length > 0 ? cleaned : undefined;
}

/** ترتيب صفوف مجلوبة بالمعرّف حسب ترتيب القرب القادم من القاعدة. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const map = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => map.get(id)).filter((row): row is T => !!row);
}

/** خطّاف مساعد: هل نقطة الانطلاق جاهزة للاستخدام في الاستعلام؟ */
export function useNearbyReady(): () => boolean {
  const { origin } = useNearbyOrigin();
  return useCallback(() => !!origin, [origin]);
}
