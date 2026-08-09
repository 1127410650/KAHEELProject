import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import { supabase } from "@/integrations/supabase/client";

export interface MktCountry {
  id: string;
  iso2: string;
  name_ar: string;
  name_en: string;
  calling_code: string;
  currency_code: string;
  sort_order: number;
}

export interface MktCity {
  id: string;
  country_id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
}

export const COUNTRY_COLUMNS =
  "id, iso2, name_ar, name_en, calling_code, currency_code, sort_order";
export const CITY_COLUMNS = "id, country_id, name_ar, name_en, sort_order";

/**
 * نطاق السوق لا يُكتب في الكود: يُقرأ من `mkt_countries` عبر `mkt-markets`.
 * `FALLBACK_MARKET_ISO2` تُستخدم فقط قبل وصول الإعدادات أو عند انقطاع الشبكة.
 */
export { FALLBACK_MARKET_ISO2 } from "@/lib/mkt-markets";

const countryIdRequests = new Map<string, Promise<string | null>>();
const COUNTRY_LOOKUP_RETRY_DELAY_MS = 15_000;

/**
 * Share country lookups across simultaneous home-feed, featured-feed and
 * preference requests. This matters on high-latency connections and also keeps
 * a failed lookup from accidentally falling back to an unfiltered market query.
 */
export function loadCountryIdByIso2(iso2: string, activeOnly = false): Promise<string | null> {
  const normalized = iso2.trim().toUpperCase();
  const cacheKey = `${normalized}:${activeOnly ? "active" : "all"}`;
  const cached = countryIdRequests.get(cacheKey);
  if (cached) return cached;

  const request: Promise<string | null> = (async () => {
    let query = supabase.from("mkt_countries").select("id").eq("iso2", normalized);
    if (activeOnly) query = query.eq("is_active", true).eq("is_market_enabled", true);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  })().catch((error: unknown) => {
    // Keep the rejected request briefly so several home widgets do not hammer
    // the same endpoint while the connection is down. A manual retry can reach
    // the network again after this short cool-down.
    setTimeout(() => {
      if (countryIdRequests.get(cacheKey) === request) countryIdRequests.delete(cacheKey);
    }, COUNTRY_LOOKUP_RETRY_DELAY_MS);
    throw error;
  });

  countryIdRequests.set(cacheKey, request);
  return request;
}

/** الدول المتاحة للجمهور = الدول المفعّلة للسوق من لوحة الإدارة. */
export async function loadCountries(): Promise<MktCountry[]> {
  const markets = await loadEnabledMarkets().catch(() => []);
  return markets as unknown as MktCountry[];
}

/** كل الدول (بما فيها المعطّلة) — للوحة الإدارة فقط. */
export async function loadAllCountries(): Promise<
  (MktCountry & { is_active: boolean; is_market_enabled: boolean; phone_only_otp: boolean; is_default_market: boolean })[]
> {
  const { data } = await supabase
    .from("mkt_countries")
    .select(
      "id, iso2, name_ar, name_en, calling_code, currency_code, sort_order, is_active, is_market_enabled, phone_only_otp, is_default_market",
    )
    .order("sort_order");
  return (data ?? []) as never;
}

export async function loadCities(countryId?: string | null): Promise<MktCity[]> {
  let activeCountryId = countryId ?? null;
  if (!activeCountryId) {
    activeCountryId = await loadCountryIdByIso2(await defaultMarketIso2(), true);
  }
  if (!activeCountryId) return [];

  const { data } = await supabase
    .from("mkt_cities")
    .select(CITY_COLUMNS)
    .eq("is_active", true)
    .eq("country_id", activeCountryId)
    .order("sort_order");
  return (data ?? []) as MktCity[];
}


export function geoName(
  row: { name_ar: string; name_en: string } | undefined,
  locale: "ar" | "en",
) {
  if (!row) return "";
  return locale === "en" ? row.name_en || row.name_ar : row.name_ar;
}

/** Readable "Country — City" label for a stored country/city pair. */
export async function loadGeoLabel(
  countryId: string | null,
  cityId: string | null,
  locale: "ar" | "en",
): Promise<string | null> {
  if (!countryId && !cityId) return null;
  const [country, city] = await Promise.all([
    countryId
      ? supabase.from("mkt_countries").select(COUNTRY_COLUMNS).eq("id", countryId).maybeSingle()
      : Promise.resolve({ data: null }),
    cityId
      ? supabase.from("mkt_cities").select(CITY_COLUMNS).eq("id", cityId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const parts = [
    geoName((country.data as MktCountry | null) ?? undefined, locale),
    geoName((city.data as MktCity | null) ?? undefined, locale),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

/** A visitor's browsing market: Syria, and optionally a Syrian city. */
export interface MarketPreference {
  countryIso2: string;
  cityId: string | null;
}

const STORAGE_KEY = "tahqaq.mkt.market";
const DEFAULT_PREFERENCE: MarketPreference = { countryIso2: ACTIVE_MARKET_ISO2, cityId: null };

function readStored(): MarketPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<MarketPreference>;
    const storedWasSyria = parsed.countryIso2 === ACTIVE_MARKET_ISO2;
    return {
      countryIso2: ACTIVE_MARKET_ISO2,
      cityId: storedWasSyria && typeof parsed.cityId === "string" ? parsed.cityId : null,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

const listeners = new Set<(value: MarketPreference) => void>();

/**
 * The public version is temporarily Syria-only. Old Saudi or other-country
 * preferences are ignored, not deleted, and cannot leak back into public queries.
 */
export function useMarketPreference() {
  const [preference, setPreference] = useState<MarketPreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    const stored = readStored();
    setPreference(stored);
    const listener = (value: MarketPreference) => void setPreference(value);
    listeners.add(listener);

    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) return;

      const [countryId, { data: row }] = await Promise.all([
        loadCountryIdByIso2(ACTIVE_MARKET_ISO2, true),
        supabase
          .from("mkt_user_market_preferences")
          .select("browsing_city_id")
          .eq("user_id", auth.session.user.id)
          .maybeSingle(),
      ]);

      const candidateCityId = row?.browsing_city_id ?? stored.cityId;
      let cityId: string | null = null;
      if (candidateCityId && countryId) {
        const { data: city } = await supabase
          .from("mkt_cities")
          .select("id")
          .eq("id", candidateCityId)
          .eq("country_id", countryId)
          .eq("is_active", true)
          .maybeSingle();
        cityId = city?.id ?? null;
      }

      const next: MarketPreference = {
        countryIso2: ACTIVE_MARKET_ISO2,
        cityId,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      listeners.forEach((currentListener) => currentListener(next));
    })();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback(async (requested: MarketPreference) => {
    const countryId = await loadCountryIdByIso2(ACTIVE_MARKET_ISO2, true);

    let cityId: string | null = null;
    if (requested.cityId && countryId) {
      const { data: city } = await supabase
        .from("mkt_cities")
        .select("id")
        .eq("id", requested.cityId)
        .eq("country_id", countryId)
        .eq("is_active", true)
        .maybeSingle();
      cityId = city?.id ?? null;
    }

    const next: MarketPreference = {
      countryIso2: ACTIVE_MARKET_ISO2,
      cityId,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    listeners.forEach((listener) => listener(next));

    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session || !countryId) return;
    await supabase.from("mkt_user_market_preferences").upsert({
      user_id: auth.session.user.id,
      browsing_country_id: countryId,
      browsing_city_id: cityId,
      updated_at: new Date().toISOString(),
    });
  }, []);

  return { preference, setPreference: update };
}

/** Syria is the only selectable account country while this version is active. */
export async function loadAccountCountry(): Promise<MktCountry | null> {
  const countries = await loadCountries();
  return countries.find((country) => country.iso2 === ACTIVE_MARKET_ISO2) ?? countries[0] ?? null;
}

export function useAccountCountry() {
  return useQuery({
    queryKey: ["mkt", "account-country", ACTIVE_MARKET_ISO2],
    queryFn: loadAccountCountry,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Normalise a national number typed by a user into E.164 for the chosen country.
 * The country calling code is never duplicated: a pasted +963..., 00963... or a
 * leading 0 all collapse to the same stored value.
 */
export function toE164(iso2: string, input: string): string | null {
  const country = iso2.toUpperCase() as CountryCode;
  const digits = callingDigits(iso2);
  const cleaned = input.replace(/[^\d+]/g, "").replace(/^00/, "+");

  const attempt = (value: string): string | null => {
    const parsed = parsePhoneNumberFromString(value, country);
    if (!parsed || !parsed.isValid()) return null;
    if (parsed.country && parsed.country !== country) return null;
    return parsed.number;
  };

  if (cleaned.startsWith("+")) return attempt(cleaned);

  const local = cleaned.replace(/^0+/, "");
  const withCode = attempt(`+${digits}${local}`);
  if (withCode) return withCode;
  if (digits && local.startsWith(digits)) {
    return attempt(`+${local}`);
  }
  return null;
}

/** Digits of a supported country's calling code. */
function callingDigits(iso2: string): string {
  return CALLING_CODES[iso2.toUpperCase()] ?? "";
}

/** Calling codes retained for stored historic data and future market reopening. */
const CALLING_CODES: Record<string, string> = {
  SA: "966",
  KW: "965",
  AE: "971",
  JO: "962",
  LB: "961",
  EG: "20",
  SY: "963",
  IQ: "964",
};

export function isValidNationalPhone(iso2: string, input: string): boolean {
  const e164 = toE164(iso2, input);
  return !!e164 && isValidPhoneNumber(e164);
}

/** The part a user types, without the country calling code. */
export function nationalPart(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.nationalNumber ? String(parsed.nationalNumber) : e164.replace(/^\+\d{1,3}/, "");
}

export type PhoneVisibility = "hidden" | "on_request" | "public";

export interface MktUserContact {
  user_id: string;
  country_id: string | null;
  phone_e164: string | null;
  phone_status: "unverified" | "verified";
  phone_visibility: PhoneVisibility;
}

const CONTACT_COLUMNS = "user_id, country_id, phone_e164, phone_status, phone_visibility";

export async function loadMyContact(userId: string): Promise<MktUserContact | null> {
  const { data } = await supabase
    .from("mkt_user_contacts")
    .select(CONTACT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as MktUserContact | null) ?? null;
}

export async function saveMyContact(input: {
  userId: string;
  countryId: string | null;
  phoneE164: string | null;
  visibility: PhoneVisibility;
}): Promise<void> {
  if (input.phoneE164) {
    const username = input.phoneE164.replace(/\D/g, "");
    const { error: profileError } = await supabase
      .from("mkt_user_profiles")
      .update({ username })
      .eq("user_id", input.userId);
    if (profileError) throw profileError;
  }

  const { error } = await supabase.from("mkt_user_contacts").upsert({
    user_id: input.userId,
    country_id: input.countryId,
    phone_e164: input.phoneE164,
    phone_status: "unverified",
    phone_visibility: input.visibility,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Public contact number of an advertiser, only when they made it public. */
export async function loadPublicPhone(userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("mkt_public_phone", { _user_id: userId });
  return (data as string | null) ?? null;
}

/** A user-proposed city; it stays out of the public lists until an admin approves it. */
export async function suggestCity(input: {
  countryId: string;
  name: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.from("mkt_city_suggestions").insert({
    country_id: input.countryId,
    suggested_name: input.name.trim(),
    suggested_by: input.userId,
    status: "pending",
  });
  if (error) throw error;
}
