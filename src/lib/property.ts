import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Locale } from "@/i18n";

/** Loosely typed client for the generic property sections (table name is dynamic). */
export const pdb = supabase as unknown as SupabaseClient;

export type PropertyRow = Record<string, unknown>;

export const PROJECT_KINDS = [
  "real_estate",
  "construction",
  "maintenance",
  "supply",
  "general",
] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_LABELS: Record<ProjectKind, [string, string]> = {
  real_estate: ["مشروع عقاري", "Real estate"],
  construction: ["مشروع إنشائي", "Construction"],
  maintenance: ["صيانة", "Maintenance"],
  supply: ["توريد", "Supply"],
  general: ["عام", "General"],
};

export const SERVICE_TYPES = [
  "water",
  "electricity",
  "sewage",
  "telecom",
  "gas",
  "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, [string, string]> = {
  water: ["مياه", "Water"],
  electricity: ["كهرباء", "Electricity"],
  sewage: ["صرف صحي", "Sewage"],
  telecom: ["اتصالات", "Telecom"],
  gas: ["غاز", "Gas"],
  other: ["أخرى", "Other"],
};

export const SERVICE_STATUSES = [
  "not_started",
  "requested",
  "in_progress",
  "installed",
  "active",
  "suspended",
  "rejected",
] as const;

export const SERVICE_STATUS_LABELS: Record<string, [string, string]> = {
  not_started: ["لم يبدأ", "Not started"],
  requested: ["مطلوب", "Requested"],
  in_progress: ["جاري التنفيذ", "In progress"],
  installed: ["تم التركيب", "Installed"],
  active: ["مفعّل", "Active"],
  suspended: ["موقوف", "Suspended"],
  rejected: ["مرفوض", "Rejected"],
};

export const DOC_VISIBILITIES = [
  "project_shared",
  "requester_private",
  "internal",
  "sensitive",
] as const;
export type DocVisibility = (typeof DOC_VISIBILITIES)[number];

export const DOC_VISIBILITY_LABELS: Record<DocVisibility, [string, string]> = {
  project_shared: ["مشترك مع فريق المشروع", "Shared with project team"],
  requester_private: ["خاص بمقدم الطلب", "Requester private"],
  internal: ["داخلي (الموظفون)", "Internal (staff)"],
  sensitive: ["حساس (المحاسب)", "Sensitive (accountant)"],
};

export const DOC_CATEGORIES = [
  "deed",
  "license",
  "plan",
  "contract",
  "partition",
  "service",
  "invoice",
  "receipt",
  "correspondence",
  "other",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DOC_CATEGORY_LABELS: Record<DocCategory, [string, string]> = {
  deed: ["صك ملكية", "Title deed"],
  license: ["رخصة بناء", "Building license"],
  plan: ["مخطط", "Plan"],
  contract: ["عقد", "Contract"],
  partition: ["محضر فرز", "Partition report"],
  service: ["خدمة / عداد", "Service / meter"],
  invoice: ["فاتورة", "Invoice"],
  receipt: ["إيصال سداد", "Payment receipt"],
  correspondence: ["مخاطبات", "Correspondence"],
  other: ["أخرى", "Other"],
};

export const PARTITION_PART_TYPES: Record<string, [string, string]> = {
  private: ["خاص بالوحدة", "Private"],
  shared: ["مشترك", "Shared"],
  exclusive_shared: ["مشترك بانتفاع خاص", "Exclusive shared"],
};

export const UNIT_STATUSES: Record<string, [string, string]> = {
  available: ["متاح", "Available"],
  reserved: ["محجوز", "Reserved"],
  sold: ["مبيع", "Sold"],
  rented: ["مؤجر", "Rented"],
  owner_use: ["استخدام المالك", "Owner use"],
};

export const PLAN_TYPES: Record<string, [string, string]> = {
  architectural: ["معماري", "Architectural"],
  structural: ["إنشائي", "Structural"],
  electrical: ["كهربائي", "Electrical"],
  mechanical: ["ميكانيكي", "Mechanical"],
  site: ["موقع عام", "Site plan"],
  survey: ["مساحي", "Survey"],
  partition: ["فرز وحدات", "Partition"],
  other: ["أخرى", "Other"],
};

export const BOUNDARY_SIDES: Record<string, [string, string]> = {
  north: ["الحد الشمالي", "North"],
  south: ["الحد الجنوبي", "South"],
  east: ["الحد الشرقي", "East"],
  west: ["الحد الغربي", "West"],
};

/** Picks the localized label out of an [ar, en] pair. */
export function pick(locale: Locale, pair?: [string, string]): string {
  if (!pair) return "—";
  return locale === "ar" ? pair[0] : pair[1];
}

export function labelOf(
  locale: Locale,
  map: Record<string, [string, string]>,
  key?: string | null,
): string {
  if (!key) return "—";
  return pick(locale, map[key]) ?? key;
}

export interface CompletionSection {
  key: string;
  done: boolean;
}

export interface PropertyCompletion {
  percent: number;
  done: number;
  total: number;
  sections: CompletionSection[];
}

export interface PropertySummary {
  property_no: string | null;
  district: string | null;
  plan_no: string | null;
  parcel_no: string | null;
  land_area: number | null;
  deed_no: string | null;
  license_no: string | null;
  units_count: number;
  supervisors_count: number;
  documents_count: number;
  open_requests: number;
  water: string | null;
  electricity: string | null;
  sewage: string | null;
  completion: PropertyCompletion;
}

export const COMPLETION_LABELS: Record<string, [string, string]> = {
  basic: ["البيانات الأساسية", "Basics"],
  land: ["الأرض والموقع", "Land"],
  deed: ["الصك", "Deed"],
  owners: ["الملاك", "Owners"],
  license: ["رخصة البناء", "License"],
  contracts: ["العقود", "Contracts"],
  plans: ["المخططات", "Plans"],
  units: ["الوحدات", "Units"],
  services: ["الخدمات", "Services"],
  documents: ["المستندات", "Documents"],
};

/** Masks a national id / commercial number for users without sensitive access. */
export function maskId(value?: string | null): string {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
