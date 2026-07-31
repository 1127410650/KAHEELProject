import type { Locale } from "@/i18n";

export const TIMEZONE = "Asia/Riyadh";

/** DD/MM/YYYY with Latin digits, in Asia/Riyadh. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value.length <= 10 ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: typeof value === "string" && value.length <= 10 ? "UTC" : TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** DD/MM/YYYY HH:mm (24h), Asia/Riyadh, Latin digits. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Today's date in Asia/Riyadh as YYYY-MM-DD (for date inputs). */
export function todayInRiyadh(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

/** Latin-digit amount with the locale's currency label (ر.س / SAR). */
export function formatMoney(value: number | string | null | undefined, locale: Locale): string {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return locale === "ar" ? `${num} ر.س` : `SAR ${num}`;
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

/** Pick the display name for a bilingual entity. */
export function pickName(
  locale: Locale,
  ar: string | null | undefined,
  en: string | null | undefined,
): string {
  if (locale === "en") return en?.trim() || ar?.trim() || "—";
  return ar?.trim() || en?.trim() || "—";
}
