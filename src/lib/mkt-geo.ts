import { useCallback, useEffect, useState } from "react";

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
    const listener = (value: MarketPreference) => setPreference(value);
    listeners.add(listener);
    return () => listeners.delete(listener);
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
      country_id: country.id,
      city_id: next.cityId,
      updated_at: new Date().toISOString(),
    });
  }, []);

  return { preference, setPreference: update };
}

/** Digits-only international phone, stored as +<code><national> with no spaces. */
export function toE164(callingCode: string, national: string): string | null {
  const digits = national.replace(/\D+/g, "").replace(/^0+/, "");
  const code = callingCode.replace(/\D+/g, "");
  if (digits.length < 6 || digits.length > 12) return null;
  return `+${code}${digits}`;
}
