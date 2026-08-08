const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

function asciiDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

/**
 * Normalises appointment phone input to E.164 without guessing arbitrary
 * countries. Local Syrian (09...) and Saudi (05...) numbers are supported as
 * convenience formats; every other country must include its international code.
 */
export function normalizeAppointmentPhone(value: string): string | null {
  let phone = asciiDigits(value ?? "")
    .trim()
    .replace(/[\s().-]/g, "");

  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^09\d{8}$/.test(phone)) phone = `+963${phone.slice(1)}`;
  if (/^05\d{8}$/.test(phone)) phone = `+966${phone.slice(1)}`;

  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function appointmentPhoneCandidates(phoneE164: string): string[] {
  const candidates = new Set<string>([phoneE164, phoneE164.slice(1)]);
  if (phoneE164.startsWith("+9639")) candidates.add(`0${phoneE164.slice(4)}`);
  if (phoneE164.startsWith("+9665")) candidates.add(`0${phoneE164.slice(4)}`);
  return [...candidates];
}

export function maskAppointmentPhone(phoneE164: string) {
  if (phoneE164.length < 8) return phoneE164;
  return `${phoneE164.slice(0, 4)}••••${phoneE164.slice(-3)}`;
}
