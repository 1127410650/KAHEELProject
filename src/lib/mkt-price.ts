/**
 * Unified single-price policy.
 *
 * Every listing carries exactly one positive price plus an optional unit.
 * There is no "on request", "starts from", "negotiable", price range or hidden
 * price any more, and the currency always follows the account country — the
 * advertiser can never pick it by hand.
 */

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Converts Arabic-Indic digits to western digits and strips separators. */
export function normalizePriceDigits(raw: string): string {
  return raw
    .replace(ARABIC_DIGITS, (d) => {
      const code = d.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .replace(/[\u066B]/g, ".") // Arabic decimal separator
    .replace(/[\u066C,\s_]/g, "")
    .trim();
}

export const MAX_LISTING_PRICE = 999_999_999_999;

export type PriceError =
  | "required"
  | "not_a_number"
  | "zero"
  | "negative"
  | "too_large"
  | "fraction_not_allowed";

export interface PriceCheck {
  value: number | null;
  error: PriceError | null;
}

/** Validates a raw price input under the unified price policy. */
export function checkPrice(raw: string, allowFractions = true): PriceCheck {
  const text = normalizePriceDigits(raw ?? "");
  if (!text) return { value: null, error: "required" };
  if (!/^-?\d*(\.\d+)?$/.test(text)) return { value: null, error: "not_a_number" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { value: null, error: "not_a_number" };
  if (value < 0) return { value: null, error: "negative" };
  if (value === 0) return { value: null, error: "zero" };
  if (value > MAX_LISTING_PRICE) return { value: null, error: "too_large" };
  if (!allowFractions && !Number.isInteger(value))
    return { value: null, error: "fraction_not_allowed" };
  return { value: allowFractions ? Math.round(value * 100) / 100 : Math.round(value), error: null };
}

/** Currencies where fractions are not meaningful. */
const NO_FRACTION_CURRENCIES = new Set(["JPY", "KRW", "IQD", "OMR_INT"]);

export function currencyAllowsFractions(code: string | null | undefined): boolean {
  return !NO_FRACTION_CURRENCIES.has((code ?? "").toUpperCase());
}

/** Optional classification unit shown next to the price (500 SAR / day). */
export const PRICE_UNITS = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "piece",
  "meter",
  "sqm",
  "ton",
  "kg",
  "litre",
  "trip",
  "service",
] as const;

export type PriceUnit = (typeof PRICE_UNITS)[number];

export function isPriceUnit(value: unknown): value is PriceUnit {
  return typeof value === "string" && (PRICE_UNITS as readonly string[]).includes(value);
}
