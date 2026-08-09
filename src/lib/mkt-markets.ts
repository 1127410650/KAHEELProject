/**
 * نطاق الدول المفعّلة في السوق — مصدر الحقيقة الوحيد.
 *
 * لا يوجد اسم دولة مكتوب بشكل ثابت في منطق التطبيق: كل شيء (الدليل، الفلاتر،
 * العناوين، الإعلانات، وطريقة تسجيل الدخول) يقرأ من جدول `mkt_countries`:
 * • `is_market_enabled` — الدولة مفتوحة للسوق العام.
 * • `phone_only_otp` — الدخول برقم الجوال فقط (كود واتساب/SMS بلا بريد).
 * • `is_default_market` — الدولة الافتراضية للزائر الجديد.
 *
 * لتفعيل دولة جديدة (لبنان مثلًا) لا حاجة لأي نشر: المدير يفعّلها من
 * «الدول والمدن» في لوحة الإدارة، فتظهر محافظاتها وإعلاناتها فورًا.
 *
 * `FALLBACK_MARKET_ISO2` ليست إعدادًا: هي شبكة أمان للحظة الأولى قبل وصول
 * الإعدادات من الخادم (أو عند انقطاع الشبكة) حتى لا تُقرأ سوق غير مفعّلة.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const FALLBACK_MARKET_ISO2 = "SY";

export interface MarketCountry {
  id: string;
  iso2: string;
  name_ar: string;
  name_en: string;
  calling_code: string;
  currency_code: string;
  sort_order: number;
  phone_only_otp: boolean;
  is_default_market: boolean;
}

export const MARKET_COUNTRY_COLUMNS =
  "id, iso2, name_ar, name_en, calling_code, currency_code, sort_order, phone_only_otp, is_default_market";

let cache: Promise<MarketCountry[]> | null = null;
const CACHE_RETRY_MS = 15_000;

/** كل الدول المفعّلة للسوق، مرتّبة كما ضبطها المدير. */
export function loadEnabledMarkets(): Promise<MarketCountry[]> {
  if (cache) return cache;
  const request = (async () => {
    const { data, error } = await supabase
      .from("mkt_countries")
      .select(MARKET_COUNTRY_COLUMNS)
      .eq("is_active", true)
      .eq("is_market_enabled", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as MarketCountry[];
  })().catch((error: unknown) => {
    setTimeout(() => {
      if (cache === request) cache = null;
    }, CACHE_RETRY_MS);
    throw error;
  });
  cache = request;
  return request;
}

/** استدعِها بعد أي تعديل إداري على الدول. */
export function resetMarketCache() {
  cache = null;
}

export async function loadDefaultMarket(): Promise<MarketCountry | null> {
  const markets = await loadEnabledMarkets();
  return markets.find((row) => row.is_default_market) ?? markets[0] ?? null;
}

export async function defaultMarketIso2(): Promise<string> {
  const market = await loadDefaultMarket().catch(() => null);
  return market?.iso2 ?? FALLBACK_MARKET_ISO2;
}

/** هل هذه الدولة مفعّلة للسوق؟ يُستخدم لتقييد الاستعلامات العامة. */
export async function isEnabledMarket(iso2: string | null | undefined): Promise<boolean> {
  if (!iso2) return false;
  const markets = await loadEnabledMarkets().catch(() => []);
  const normalized = iso2.trim().toUpperCase();
  if (markets.length === 0) return normalized === FALLBACK_MARKET_ISO2;
  return markets.some((row) => row.iso2 === normalized);
}

/** مفاتيح الاتصال التي تدخل برقم الجوال فقط (بلا بريد إلكتروني). */
export async function loadPhoneOnlyDials(): Promise<string[]> {
  const markets = await loadEnabledMarkets().catch(() => []);
  return markets
    .filter((row) => row.phone_only_otp)
    .map((row) => row.calling_code.replace(/\D/g, ""))
    .filter(Boolean);
}

export function useEnabledMarkets() {
  return useQuery({
    queryKey: ["mkt", "enabled-markets"],
    queryFn: loadEnabledMarkets,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePhoneOnlyDials() {
  return useQuery({
    queryKey: ["mkt", "phone-only-dials"],
    queryFn: loadPhoneOnlyDials,
    staleTime: 5 * 60 * 1000,
  });
}
