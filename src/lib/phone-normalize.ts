// Tolerant phone normalisation shared by the browser form and the server
// sign-up functions. The goal is that a human never sees an error for the shape
// of what they typed: a leading zero, a missing zero, spaces, dashes, 00 or a
// pasted +country number all collapse to the same E.164 value.
//
// Syria (+963) is the default dial code, but any dial code is accepted: the
// marketplace listings are Syria-only, the *account* is not.
import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface DialCode {
  iso2: string;
  dial: string;
  name_ar: string;
  name_en: string;
}

/** Default dial code shown in the form. */
export const DEFAULT_DIAL = "963";

/** Short, curated list; Syria first so it stays the visible default. */
export const DIAL_CODES: DialCode[] = [
  { iso2: "SY", dial: "963", name_ar: "سوريا", name_en: "Syria" },
  { iso2: "TR", dial: "90", name_ar: "تركيا", name_en: "Türkiye" },
  { iso2: "LB", dial: "961", name_ar: "لبنان", name_en: "Lebanon" },
  { iso2: "JO", dial: "962", name_ar: "الأردن", name_en: "Jordan" },
  { iso2: "IQ", dial: "964", name_ar: "العراق", name_en: "Iraq" },
  { iso2: "SA", dial: "966", name_ar: "السعودية", name_en: "Saudi Arabia" },
  { iso2: "AE", dial: "971", name_ar: "الإمارات", name_en: "UAE" },
  { iso2: "KW", dial: "965", name_ar: "الكويت", name_en: "Kuwait" },
  { iso2: "QA", dial: "974", name_ar: "قطر", name_en: "Qatar" },
  { iso2: "BH", dial: "973", name_ar: "البحرين", name_en: "Bahrain" },
  { iso2: "OM", dial: "968", name_ar: "عُمان", name_en: "Oman" },
  { iso2: "EG", dial: "20", name_ar: "مصر", name_en: "Egypt" },
  { iso2: "DE", dial: "49", name_ar: "ألمانيا", name_en: "Germany" },
  { iso2: "SE", dial: "46", name_ar: "السويد", name_en: "Sweden" },
  { iso2: "FR", dial: "33", name_ar: "فرنسا", name_en: "France" },
  { iso2: "NL", dial: "31", name_ar: "هولندا", name_en: "Netherlands" },
  { iso2: "GB", dial: "44", name_ar: "بريطانيا", name_en: "United Kingdom" },
  { iso2: "US", dial: "1", name_ar: "أمريكا / كندا", name_en: "USA / Canada" },
];

const KNOWN_DIALS = DIAL_CODES.map((row) => row.dial).sort((a, b) => b.length - a.length);

/** Arabic-Indic digits typed on an Arabic keyboard map to plain ASCII digits. */
function asciiDigits(raw: string): string {
  return (raw ?? "").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (char) => {
    const code = char.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Normalise typed input to E.164, or null when there is no plausible number.
 *
 * `dial` is the dial code chosen in the UI and is only used when the input has
 * no international prefix of its own.
 */
export function normalizePhone(dial: string, raw: string): string | null {
  const dialDigits = (dial ?? DEFAULT_DIAL).replace(/\D/g, "") || DEFAULT_DIAL;
  const cleaned = asciiDigits(raw).replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  const candidates: string[] = [];
  if (cleaned.startsWith("+")) {
    candidates.push(cleaned);
  } else if (cleaned.startsWith("00")) {
    candidates.push(`+${cleaned.slice(2)}`);
  } else {
    const digits = cleaned;
    // A local number, with or without the trunk zero.
    const local = digits.replace(/^0+/, "");
    if (local) candidates.push(`+${dialDigits}${local}`);
    // The user may have typed the dial code without any prefix (963…, 90…).
    const owned = KNOWN_DIALS.find((code) => digits.startsWith(code));
    if (owned) candidates.push(`+${digits}`);
  }

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate);
    if (parsed?.isValid()) return parsed.number;
  }

  // Fall back to a shape check so an unusual-but-real number is never rejected
  // just because the offline metadata does not know that range yet.
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  }
  return null;
}

/** True when the input can be normalised into a storable number. */
export function isAcceptablePhone(dial: string, raw: string): boolean {
  return !!normalizePhone(dial, raw);
}

/** Digits a user should keep typing, with the dial code stripped for display. */
export function localPart(dial: string, e164: string | null | undefined): string {
  if (!e164) return "";
  const dialDigits = (dial ?? DEFAULT_DIAL).replace(/\D/g, "");
  const digits = e164.replace(/\D/g, "");
  return digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits;
}
