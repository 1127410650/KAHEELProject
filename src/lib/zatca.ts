/**
 * ZATCA (Saudi e-invoicing) QR payload decoding + structural validation.
 * Fully local: Base64 -> TLV -> field validation. No paid APIs, no network calls.
 */

export type ZatcaTag = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ZatcaField {
  tag: number;
  /** Human readable value (UTF-8 text for 1-5, base64 for 6-9). */
  value: string;
  length: number;
  /** true when the tag is not part of the official 1..9 set. */
  unknown: boolean;
}

export type VerdictLevel = "green" | "yellow" | "red" | "gray";

export interface ZatcaIssue {
  code: string;
  level: "error" | "warning";
}

export interface ZatcaDecoded {
  raw: string;
  fields: ZatcaField[];
  byTag: Partial<Record<number, string>>;
  /** 1 = phase one (tags 1-5), 2 = phase two (tags 6+ present). */
  phase: 1 | 2;
  sellerName?: string;
  vatNumber?: string;
  timestamp?: string;
  total?: string;
  vatTotal?: string;
  netTotal?: string;
  hash?: string;
  signature?: string;
  publicKey?: string;
  stampSignature?: string;
  issues: ZatcaIssue[];
}

/* ------------------------------------------------------------------ helpers */

const REQUIRED_PHASE_ONE = [1, 2, 3, 4, 5];

function base64ToBytes(input: string): Uint8Array | null {
  const cleaned = input.trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) return null;
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Exact decimal comparison without floating point drift. */
export function decimalCompare(a: string, b: string): number {
  const norm = (v: string) => {
    const clean = v.replace(/[^\d.-]/g, "");
    const neg = clean.startsWith("-");
    const [int = "0", frac = ""] = clean.replace("-", "").split(".");
    return { neg, int: int.replace(/^0+(?=\d)/, ""), frac: frac.replace(/0+$/, "") };
  };
  const x = norm(a);
  const y = norm(b);
  if (x.neg !== y.neg) return x.neg ? -1 : 1;
  const sign = x.neg ? -1 : 1;
  if (x.int.length !== y.int.length) return x.int.length > y.int.length ? sign : -sign;
  if (x.int !== y.int) return (x.int > y.int ? 1 : -1) * sign;
  const len = Math.max(x.frac.length, y.frac.length);
  const fx = x.frac.padEnd(len, "0");
  const fy = y.frac.padEnd(len, "0");
  if (fx === fy) return 0;
  return (fx > fy ? 1 : -1) * sign;
}

export function decimalSubtract(a: string, b: string): string | undefined {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return undefined;
  // amounts are 2-decimal money values; integer cents math avoids float drift
  const cents = Math.round(na * 100) - Math.round(nb * 100);
  return (cents / 100).toFixed(2);
}

const AMOUNT_RE = /^\d{1,15}(\.\d{1,6})?$/;
const VAT_RE = /^3\d{13}3$/;

function isValidTimestamp(value: string): boolean {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
    return !Number.isNaN(new Date(value.replace(" ", "T")).getTime());
  }
  return false;
}

/* ------------------------------------------------------------------- decode */

export function decodeZatcaQr(raw: string): ZatcaDecoded | null {
  const bytes = base64ToBytes(raw);
  if (!bytes) return null;

  const fields: ZatcaField[] = [];
  const issues: ZatcaIssue[] = [];
  let offset = 0;

  while (offset + 2 <= bytes.length) {
    const tag = bytes[offset]!;
    const length = bytes[offset + 1]!;
    const start = offset + 2;
    const end = start + length;
    if (end > bytes.length) {
      issues.push({ code: "tlvTruncated", level: "error" });
      break;
    }
    const slice = bytes.slice(start, end);
    const unknown = tag < 1 || tag > 9;
    const value = tag >= 6 && tag <= 9 ? bytesToBase64(slice) : utf8(slice);
    fields.push({ tag, value, length, unknown });
    offset = end;
  }

  if (fields.length === 0) return null;
  if (offset !== bytes.length) issues.push({ code: "tlvTrailingBytes", level: "warning" });

  const byTag: Partial<Record<number, string>> = {};
  const seen = new Set<number>();
  for (const field of fields) {
    if (seen.has(field.tag)) issues.push({ code: "duplicateTag", level: "error" });
    seen.add(field.tag);
    if (byTag[field.tag] === undefined) byTag[field.tag] = field.value;
    if (field.unknown) issues.push({ code: "unknownTag", level: "warning" });
  }

  const tagOrder = fields.map((f) => f.tag);
  const sorted = [...tagOrder].sort((a, b) => a - b);
  if (tagOrder.join(",") !== sorted.join(",")) issues.push({ code: "tagOrder", level: "warning" });

  for (const tag of REQUIRED_PHASE_ONE) {
    if (byTag[tag] === undefined) issues.push({ code: `missingTag${tag}`, level: "error" });
  }

  const phase: 1 | 2 = byTag[6] !== undefined || byTag[7] !== undefined ? 2 : 1;

  const sellerName = byTag[1]?.trim();
  const vatNumber = byTag[2]?.replace(/\s+/g, "");
  const timestamp = byTag[3]?.trim();
  const total = byTag[4]?.trim();
  const vatTotal = byTag[5]?.trim();

  if (sellerName !== undefined && sellerName.length === 0)
    issues.push({ code: "emptySeller", level: "error" });
  if (vatNumber && !VAT_RE.test(vatNumber)) issues.push({ code: "vatFormat", level: "error" });
  if (timestamp && !isValidTimestamp(timestamp))
    issues.push({ code: "timestampFormat", level: "error" });
  if (total && !AMOUNT_RE.test(total)) issues.push({ code: "totalFormat", level: "error" });
  if (vatTotal && !AMOUNT_RE.test(vatTotal)) issues.push({ code: "vatFormat2", level: "error" });
  if (total && vatTotal && AMOUNT_RE.test(total) && AMOUNT_RE.test(vatTotal)) {
    if (decimalCompare(vatTotal, total) > 0) issues.push({ code: "vatOverTotal", level: "error" });
  }

  if (phase === 2) {
    for (const tag of [6, 7, 8]) {
      if (byTag[tag] === undefined)
        issues.push({ code: `missingPhase2Tag${tag}`, level: "warning" });
    }
    if (byTag[6] && byTag[6].length < 20) issues.push({ code: "hashShort", level: "warning" });
  }

  const netTotal = total && vatTotal ? decimalSubtract(total, vatTotal) : undefined;

  return {
    raw,
    fields,
    byTag,
    phase,
    ...(sellerName ? { sellerName } : {}),
    ...(vatNumber ? { vatNumber } : {}),
    ...(timestamp ? { timestamp } : {}),
    ...(total ? { total } : {}),
    ...(vatTotal ? { vatTotal } : {}),
    ...(netTotal ? { netTotal } : {}),
    ...(byTag[6] ? { hash: byTag[6] } : {}),
    ...(byTag[7] ? { signature: byTag[7] } : {}),
    ...(byTag[8] ? { publicKey: byTag[8] } : {}),
    ...(byTag[9] ? { stampSignature: byTag[9] } : {}),
    issues,
  };
}

/* ------------------------------------------------------------------ verdict */

export type MatchState = "match" | "minor" | "major" | "unavailable";

export interface ComparisonRow {
  field: "sellerName" | "vatNumber" | "timestamp" | "total" | "vatTotal";
  qrValue?: string;
  printedValue?: string;
  state: MatchState;
}

export interface VerificationVerdict {
  level: VerdictLevel;
  reasons: string[];
}

export function compareWithPrinted(
  qr: ZatcaDecoded,
  printed: Partial<Record<ComparisonRow["field"], string>>,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const push = (
    field: ComparisonRow["field"],
    qrValue: string | undefined,
    printedValue: string | undefined,
    compare: (a: string, b: string) => MatchState,
  ) => {
    if (!qrValue || !printedValue) {
      rows.push({
        field,
        ...(qrValue ? { qrValue } : {}),
        ...(printedValue ? { printedValue } : {}),
        state: "unavailable",
      });
      return;
    }
    rows.push({ field, qrValue, printedValue, state: compare(qrValue, printedValue) });
  };

  const normText = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

  push(
    "sellerName",
    qr.sellerName,
    printed.sellerName,
    (a, b) => (normText(a) === normText(b) ? "match" : "minor"),
  );
  push("vatNumber", qr.vatNumber, printed.vatNumber, (a, b) =>
    a.replace(/\D/g, "") === b.replace(/\D/g, "") ? "match" : "major",
  );
  push("timestamp", qr.timestamp, printed.timestamp, (a, b) =>
    a.slice(0, 10) === b.slice(0, 10) ? "match" : "minor",
  );
  push("total", qr.total, printed.total, (a, b) =>
    decimalCompare(a, b) === 0 ? "match" : "major",
  );
  push("vatTotal", qr.vatTotal, printed.vatTotal, (a, b) =>
    decimalCompare(a, b) === 0 ? "match" : "minor",
  );

  return rows;
}

export function buildVerdict(
  qr: ZatcaDecoded | null,
  comparison: ComparisonRow[] = [],
  options: { cryptoChecked?: boolean; lowOcrConfidence?: boolean } = {},
): VerificationVerdict {
  if (!qr) return { level: "gray", reasons: ["noQr"] };

  const errors = qr.issues.filter((i) => i.level === "error");
  const warnings = qr.issues.filter((i) => i.level === "warning");
  const major = comparison.filter((r) => r.state === "major");
  const minor = comparison.filter((r) => r.state === "minor");

  if (errors.length > 0) {
    return { level: "red", reasons: errors.map((e) => e.code) };
  }
  if (major.length > 0) {
    return { level: "red", reasons: major.map((r) => `mismatch.${r.field}`) };
  }

  const reasons: string[] = [...warnings.map((w) => w.code), ...minor.map((r) => `minor.${r.field}`)];
  if (qr.phase === 1) reasons.push("phaseOneOnly");
  if (!options.cryptoChecked) reasons.push("cryptoNotVerified");
  if (options.lowOcrConfidence) reasons.push("lowOcrConfidence");

  if (
    qr.phase === 2 &&
    reasons.length === 0 &&
    options.cryptoChecked === true &&
    !options.lowOcrConfidence
  ) {
    return { level: "green", reasons: [] };
  }

  return { level: "yellow", reasons };
}

/** Local cryptographic sanity check on tags 6-8 (structure + digest length + key parse). */
export async function checkCryptoLocally(
  qr: ZatcaDecoded,
): Promise<{ ok: boolean; notes: string[] }> {
  const notes: string[] = [];
  if (!qr.hash || !qr.signature || !qr.publicKey) {
    return { ok: false, notes: ["cryptoTagsMissing"] };
  }
  const hashBytes = base64ToBytes(qr.hash);
  if (!hashBytes || hashBytes.length !== 32) notes.push("hashNotSha256");
  const sigBytes = base64ToBytes(qr.signature);
  if (!sigBytes || sigBytes.length < 32) notes.push("signatureShort");
  const keyBytes = base64ToBytes(qr.publicKey);
  if (!keyBytes) {
    notes.push("publicKeyInvalid");
  } else {
    try {
      await crypto.subtle.importKey(
        "spki",
        keyBytes as unknown as ArrayBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
      );
    } catch {
      notes.push("publicKeyNotP256");
    }
  }
  return { ok: notes.length === 0, notes };
}
