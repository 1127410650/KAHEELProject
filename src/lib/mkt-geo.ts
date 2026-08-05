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

export async function loadCountries(): Promise<MktCountry[]> {
  const { data } = await supabase
    .from("mkt_countries")
    .select(COUNTRY_COLUMNS)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as MktCountry[];
}

export async function loadCities(countryId?: string | null): Promise<MktCity[]> {
  let query = supabase.from("mkt_cities").select(CITY_COLUMNS).eq("is_active", true);
  if (countryId) query = query.eq("country_id", countryId);
  const { data } = await query.order("sort_order");
  return (data ?? []) as MktCity[];
}

export function geoName(row: { name_ar: string; name_en: string } | undefined, locale: "ar" | "en") {
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

/** A visitor's browsing market: which country, and optionally which city inside it. */
export interface MarketPreference {
  countryIso2: string;
  cityId: string | null;
}

const STORAGE_KEY = "tahqaq.mkt.market";
const DEFAULT_PREFERENCE: MarketPreference = { countryIso2: "SA", cityId: null };

function readStored(): MarketPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<MarketPreference>;
    return {
      countryIso2:
        typeof parsed.countryIso2 === "string" && /^[A-Z]{2}$/.test(parsed.countryIso2)
          ? parsed.countryIso2
          : DEFAULT_PREFERENCE.countryIso2,
      cityId: typeof parsed.cityId === "string" ? parsed.cityId : null,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

const listeners = new Set<(value: MarketPreference) => void>();

/**
 * The chosen market lives in local storage so guests keep it too; signed-in
 * users additionally get it mirrored to their account, best effort.
 */
export function useMarketPreference() {
  const [preference, setPreference] = useState<MarketPreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    setPreference(readStored());
    const listener = (value: MarketPreference) => void setPreference(value);
    listeners.add(listener);

    // Signed in? The country saved on the account is the single source of truth
    // (defaulting to Saudi Arabia for older accounts without one); only the city
    // stays a browsing preference.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const [{ data: profile }, { data: row }] = await Promise.all([
        supabase
          .from("mkt_user_profiles")
          .select("country_id")
          .eq("user_id", data.session.user.id)
          .maybeSingle(),
        supabase
          .from("mkt_user_market_preferences")
          .select("browsing_city_id")
          .eq("user_id", data.session.user.id)
          .maybeSingle(),
      ]);
      let iso2 = DEFAULT_PREFERENCE.countryIso2;
      if (profile?.country_id) {
        const { data: country } = await supabase
          .from("mkt_countries")
          .select("iso2")
          .eq("id", profile.country_id)
          .maybeSingle();
        if (country?.iso2) iso2 = country.iso2;
      }
      const next: MarketPreference = {
        countryIso2: iso2,
        cityId: row?.browsing_city_id ?? readStored().cityId,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      listeners.forEach((l) => l(next));
    })();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback(async (next: MarketPreference) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    listeners.forEach((listener) => listener(next));

    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: country } = await supabase
      .from("mkt_countries")
      .select("id")
      .eq("iso2", next.countryIso2)
      .maybeSingle();
    if (!country) return;
    await supabase.from("mkt_user_market_preferences").upsert({
      user_id: data.session.user.id,
      browsing_country_id: country.id,
      browsing_city_id: next.cityId,
      updated_at: new Date().toISOString(),
    });
  }, []);

  return { preference, setPreference: update };
}

/**
 * The country stored on the signed-in account — the single source of truth for
 * every location form. Older accounts without one fall back to Saudi Arabia.
 * It is only changed from Settings → Account → Country.
 */
export async function loadAccountCountry(): Promise<MktCountry | null> {
  const countries = await loadCountries();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  let countryId: string | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from("mkt_user_profiles")
      .select("country_id")
      .eq("user_id", userId)
      .maybeSingle();
    countryId = profile?.country_id ?? null;
  }
  return (
    countries.find((c) => c.id === countryId) ??
    countries.find((c) => c.iso2 === "SA") ??
    countries[0] ??
    null
  );
}

export function useAccountCountry() {
  return useQuery({
    queryKey: ["mkt", "account-country"],
    queryFn: loadAccountCountry,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Normalise a national number typed by a user into E.164 for the chosen country.
 * The country calling code is never duplicated: a pasted +966..., 00966... or a
 * leading 0 all collapse to the same stored value.
 */
export function toE164(iso2: string, input: string): string | null {
  const country = iso2.toUpperCase() as CountryCode;
  const digits = callingDigits(iso2);
  const cleaned = input.replace(/[^\d+]/g, "").replace(/^00/, "+");

  const attempt = (value: string): string | null => {
    const parsed = parsePhoneNumberFromString(value, country);
    if (!parsed || !parsed.isValid()) return null;
    // Guard against a number that is valid but belongs to another country.
    if (parsed.country && parsed.country !== country) return null;
    return parsed.number;
  };

  if (cleaned.startsWith("+")) return attempt(cleaned);

  const local = cleaned.replace(/^0+/, "");
  const withCode = attempt(`+${digits}${local}`);
  if (withCode) return withCode;
  // The calling code typed without a leading "+" must not be duplicated.
  if (digits && local.startsWith(digits)) {
    return attempt(`+${local}`);
  }
  return null;
}

/** Digits of a supported country's calling code. */
function callingDigits(iso2: string): string {
  return CALLING_CODES[iso2.toUpperCase()] ?? "";
}

/** Calling codes for the eight supported markets (mirrors mkt_countries). */
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
  // The international mobile number is the marketplace username in every
  // country/version. The leading plus is removed so it stays URL-safe.
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
    // No SMS/OTP provider exists, so a number is never marked verified here.
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
