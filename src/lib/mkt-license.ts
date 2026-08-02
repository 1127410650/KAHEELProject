import { supabase } from "@/integrations/supabase/client";

/**
 * Real estate advertising licence (Saudi Real Estate General Authority).
 *
 * The public side of an ad may only show the licence number, its expiry, the
 * activity/FAL licence number when it applies, and a plain status. Everything
 * else (documents, admin notes, verification trail, deed and brokerage contract
 * numbers) lives behind row policies and never reaches the ad page.
 */

export const RE_ROOT_SLUG = "real-estate";

export type AdvertiserRole =
  | "owner"
  | "broker_individual"
  | "brokerage_business"
  | "authorized_agent";

export const ADVERTISER_ROLES: AdvertiserRole[] = [
  "owner",
  "broker_individual",
  "brokerage_business",
  "authorized_agent",
];

/** Roles that must also carry an activity (FAL) licence number. */
export function needsPracticeLicense(role: AdvertiserRole): boolean {
  return role === "broker_individual" || role === "brokerage_business";
}

export type LicenseVerificationStatus =
  | "not_entered"
  | "pending_verification"
  | "valid"
  | "expired"
  | "invalid"
  | "needs_completion"
  | "exempt";

/** Columns any visitor may read. */
export const PUBLIC_LICENSE_COLUMNS =
  "listing_id, advertiser_role, ad_license_number, ad_license_expiry, practice_license_number, verification_status";

export interface PublicListingLicense {
  listing_id: string;
  advertiser_role: AdvertiserRole;
  ad_license_number: string | null;
  ad_license_expiry: string | null;
  practice_license_number: string | null;
  verification_status: LicenseVerificationStatus;
}

/** The owner's editable record; documents and the exemption request included. */
export interface OwnerListingLicense extends PublicListingLicense {
  license_doc_path: string | null;
  exemption_requested: boolean;
  exemption_reason: string | null;
  exemption_doc_path: string | null;
  exemption_approved: boolean;
}

/** Official inquiry services — opened in a new tab, never scraped. */
export const REGA_AD_LICENSE_INQUIRY =
  "https://rega.gov.sa/rega-services/eservices/%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85-%D8%B9%D9%86-%D8%AA%D8%B1%D8%AE%D9%8A%D8%B5-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%86-%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A/";
export const REGA_BROKER_LICENSE_INQUIRY =
  "https://rega.gov.sa/rega-services/eservices/%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85-%D8%B9%D9%86-%D9%88%D8%B3%D9%8A%D8%B7-%D8%B9%D9%82%D8%A7%D8%B1%D9%8A-%D8%B1%D8%AE%D8%B5%D8%A9-%D9%88%D8%B3%D9%8A%D8%B7-%D8%B9%D9%82%D8%A7%D8%B1%D9%8A/";

/** Riyadh "today" — the whole product runs on Asia/Riyadh dates. */
export function riyadhToday(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00Z`);
}

export function daysUntil(expiry: string): number {
  const target = new Date(`${expiry}T00:00:00Z`).getTime();
  return Math.round((target - riyadhToday().getTime()) / 86_400_000);
}

/** DD/MM/YYYY, English digits, everywhere. */
export function licenseDate(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

export type LicenseBadge = "active" | "expiringSoon" | "expired" | "pending" | "exempt" | "invalid";

/** What the public may be told about the licence, in one word. */
export function licenseBadge(license: PublicListingLicense): LicenseBadge {
  if (license.verification_status === "exempt") return "exempt";
  if (license.verification_status === "invalid") return "invalid";
  if (license.ad_license_expiry) {
    const left = daysUntil(license.ad_license_expiry);
    if (left < 0) return "expired";
    if (left <= 30) return "expiringSoon";
  }
  if (license.verification_status === "valid") return "active";
  return "pending";
}

/** Blocking reasons for sending a real estate ad to review. */
export type LicenseBlock =
  | "numberRequired"
  | "expiryRequired"
  | "expiredLicense"
  | "practiceRequired"
  | "exemptionPending";

export interface LicenseDraftInput {
  advertiserRole: AdvertiserRole;
  adLicenseNumber: string;
  adLicenseExpiry: string;
  practiceLicenseNumber: string;
  exemptionRequested: boolean;
  exemptionReason: string;
  exemptionApproved: boolean;
}

export function licenseBlockers(input: LicenseDraftInput): LicenseBlock[] {
  if (input.exemptionApproved) return [];
  if (input.exemptionRequested) return ["exemptionPending"];
  const blocks: LicenseBlock[] = [];
  if (!input.adLicenseNumber.trim()) blocks.push("numberRequired");
  if (!input.adLicenseExpiry) blocks.push("expiryRequired");
  else if (daysUntil(input.adLicenseExpiry) < 0) blocks.push("expiredLicense");
  if (needsPracticeLicense(input.advertiserRole) && !input.practiceLicenseNumber.trim())
    blocks.push("practiceRequired");
  return blocks;
}

/** Public licence facts of one ad; null when the ad carries none. */
export async function loadPublicLicense(listingId: string): Promise<PublicListingLicense | null> {
  const { data } = await supabase
    .from("mkt_listing_licenses")
    .select(PUBLIC_LICENSE_COLUMNS)
    .eq("listing_id", listingId)
    .maybeSingle();
  return (data as PublicListingLicense | null) ?? null;
}

/** The owner's own record, used by the ad form. */
export async function loadOwnerLicense(listingId: string): Promise<OwnerListingLicense | null> {
  const { data } = await supabase
    .from("mkt_listing_licenses")
    .select(
      `${PUBLIC_LICENSE_COLUMNS}, license_doc_path, exemption_requested, exemption_reason, exemption_doc_path, exemption_approved`,
    )
    .eq("listing_id", listingId)
    .maybeSingle();
  return (data as OwnerListingLicense | null) ?? null;
}

/**
 * Save what the advertiser is allowed to say about their licence. Verification
 * columns are deliberately absent: the database overwrites them anyway.
 */
export async function saveListingLicense(
  listingId: string,
  input: LicenseDraftInput & { licenseDocPath?: string | null; exemptionDocPath?: string | null },
): Promise<void> {
  const row = {
    listing_id: listingId,
    advertiser_role: input.advertiserRole,
    ad_license_number: input.adLicenseNumber.trim() || null,
    ad_license_expiry: input.adLicenseExpiry || null,
    practice_license_number: needsPracticeLicense(input.advertiserRole)
      ? input.practiceLicenseNumber.trim() || null
      : input.practiceLicenseNumber.trim() || null,
    exemption_requested: input.exemptionRequested,
    exemption_reason: input.exemptionRequested ? input.exemptionReason.trim() || null : null,
    ...(input.licenseDocPath !== undefined ? { license_doc_path: input.licenseDocPath } : {}),
    ...(input.exemptionDocPath !== undefined ? { exemption_doc_path: input.exemptionDocPath } : {}),
  };
  const { error } = await supabase
    .from("mkt_listing_licenses")
    .upsert(row, { onConflict: "listing_id" });
  if (error) throw error;
}
