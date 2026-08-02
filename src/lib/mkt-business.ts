/**
 * Official business data and officer identity.
 *
 * Official numbers (commercial registration / unified number) and the officer's
 * identity number are private: they live in `mkt_business_registry` and
 * `mkt_business_officers`, are never selected by public listing/profile
 * queries, and are never written to local or session storage. Only members who
 * can manage the business — or platform staff holding the verification-review
 * permission — can read them, enforced by row level security.
 */

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";

export const ENTITY_TYPES = [
  "establishment",
  "company",
  "office",
  "factory",
  "branch",
  "non_profit",
  "government",
  "other",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ID_TYPES = ["national_id", "iqama", "gcc_id", "passport", "other"] as const;
export type OfficerIdType = (typeof ID_TYPES)[number];

export const OFFICER_CAPACITIES = ["owner", "manager", "authorized", "employee"] as const;
export type OfficerCapacity = (typeof OFFICER_CAPACITIES)[number];

export const DOC_KINDS = ["cr", "authorization", "id", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** Only these document types are accepted; the extension alone is never trusted. */
export const ALLOWED_DOC_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

const MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
];

/** Reject a file whose real content does not match its declared type. */
export async function isRealDocument(file: File): Promise<boolean> {
  if (!ALLOWED_DOC_MIME.includes(file.type as (typeof ALLOWED_DOC_MIME)[number])) return false;
  if (file.size === 0 || file.size > MAX_DOC_BYTES) return false;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/webp") {
    const riff = [0x52, 0x49, 0x46, 0x46];
    return riff.every((b, i) => head[i] === b) && head[8] === 0x57 && head[9] === 0x45;
  }
  const expected = MAGIC.find((m) => m.mime === file.type);
  if (!expected) return false;
  return expected.bytes.every((b, i) => head[i] === b);
}

export interface BusinessRegistry {
  tenant_id: string;
  country_id: string | null;
  entity_type: EntityType;
  legal_name: string;
  cr_number: string | null;
  unified_number: string | null;
  cr_issue_date: string | null;
  cr_expiry_date: string | null;
  main_activity: string | null;
  sub_activities: string[];
  national_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface BusinessOfficer {
  id: string;
  tenant_id: string;
  full_name: string;
  id_type: OfficerIdType;
  /** Masked view only: the last two characters of the identity number. */
  id_last2: string | null;
  capacity: OfficerCapacity;
  relation: string | null;
  phone: string;
  email: string | null;
  authorization_expires_on: string | null;
}

/**
 * Columns safe to read into the UI. `id_number` is deliberately excluded so a
 * full identity number never reaches the browser, the console, or a log.
 */
export const OFFICER_SAFE_COLUMNS =
  "id, tenant_id, full_name, id_type, id_last2, capacity, relation, phone, email, authorization_expires_on";

export const REGISTRY_COLUMNS =
  "tenant_id, country_id, entity_type, legal_name, cr_number, unified_number, cr_issue_date, cr_expiry_date, main_activity, sub_activities, national_address, contact_phone, contact_email";

/** `********12` — never the full number. */
export function maskIdentity(last2: string | null | undefined): string {
  return `********${last2 ?? ""}`;
}

export function isValidOfficialNumber(value: string): boolean {
  return /^[0-9A-Za-z-]{5,30}$/.test(value.trim());
}

export function isValidIdentityNumber(value: string): boolean {
  return /^[0-9A-Za-z]{6,20}$/.test(value.replace(/[^0-9A-Za-z]/g, ""));
}

/** Yes/no duplicate check; it never reveals anything about the other business. */
export async function isOfficialNumberTaken(cr: string, unified: string): Promise<boolean> {
  const { data } = await supabase.rpc("mkt_business_number_taken", {
    _cr_number: cr.trim() || null,
    _unified_number: unified.trim() || null,
  });
  return data === true;
}

export interface DocUpload {
  kind: DocKind;
  file: File;
}

/**
 * Upload verification documents into the existing private bucket and record who
 * uploaded them and when. Access is always through short-lived signed URLs.
 */
export async function uploadVerificationDocs(params: {
  tenantId: string;
  requestId: string;
  userId: string;
  docs: DocUpload[];
}): Promise<number> {
  let stored = 0;
  for (const doc of params.docs) {
    if (!(await isRealDocument(doc.file))) continue;
    const ext = doc.file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `verification/${params.tenantId}/${params.requestId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, doc.file, {
      contentType: doc.file.type,
      upsert: false,
    });
    if (error) continue;
    const { error: rowError } = await supabase.from("mkt_verification_files").insert({
      tenant_id: params.tenantId,
      request_id: params.requestId,
      file_path: path,
      file_name: doc.file.name.slice(0, 120),
      mime_type: doc.file.type,
      size_bytes: doc.file.size,
      doc_kind: doc.kind,
      uploaded_by: params.userId,
    });
    if (!rowError) stored += 1;
  }
  return stored;
}
