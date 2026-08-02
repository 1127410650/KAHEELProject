import { supabase } from "@/integrations/supabase/client";

export const MKT_BUCKET = "mkt-media";

export type ListingStatus =
  "draft" | "pending" | "published" | "rejected" | "suspended" | "expired" | "archived" | "deleted";

export type QuoteStatus =
  | "new"
  | "viewed"
  | "needs_info"
  | "preparing"
  | "quoted"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

export const LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "pending",
  "published",
  "rejected",
  "suspended",
  "expired",
  "archived",
  "deleted",
];

export const QUOTE_STATUSES: QuoteStatus[] = [
  "new",
  "viewed",
  "needs_info",
  "preparing",
  "quoted",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
];

/** Marketplace actions that require a signed-in user. */
export type MktAction = "quote" | "contact" | "save" | "report";

export const SA_CITIES = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "بريدة",
  "أبها",
  "خميس مشيط",
  "تبوك",
  "حائل",
  "نجران",
  "جيزان",
  "الطائف",
  "ينبع",
];

export interface MktCategory {
  id: string;
  parent_id: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  sort_order: number;
}

export interface MktListingType {
  code: string;
  name_ar: string;
  name_en: string;
  is_request: boolean;
  sort_order: number;
}

export interface MktListing {
  id: string;
  slug: string | null;
  owner_user_id: string;
  tenant_id: string | null;
  advertiser_type?: "individual" | "business";
  type_code: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  specs: unknown;
  price: number | null;
  price_on_request: boolean;
  price_unit: string | null;
  currency: string;
  quantity: number | null;
  unit: string | null;
  item_condition: string | null;
  deal_kind: string | null;
  city: string | null;
  region: string | null;
  country_id: string | null;
  city_id: string | null;

  cover_image_url: string | null;
  status: string;
  rejection_reason: string | null;
  published_at: string | null;
  views_count: number;
  created_at: string;
}

export interface MktBusiness {
  tenant_id: string;
  slug: string;
  display_name_ar: string;
  display_name_en: string | null;
  headline: string | null;
  about: string | null;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  country_id: string | null;
  city_id: string | null;
  categories: string[];
  verification_status: string;
  verification_note: string | null;

  is_published: boolean;
  joined_at: string;
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  public_phone: string | null;
  public_email: string | null;
  public_whatsapp: string | null;
  public_website: string | null;
}

/** Public marketplace identity of an individual (non-business) advertiser. */
export interface MktUserProfile {
  user_id: string;
  username: string;
  display_name: string;
  headline: string | null;
  about: string | null;
  city: string | null;
  region: string | null;
  country_id: string | null;
  city_id: string | null;
  avatar_url: string | null;
  verification_status: string;
  is_published: boolean;
  joined_at: string;
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  public_phone: string | null;
  public_email: string | null;
  public_whatsapp: string | null;
}

export const USER_PROFILE_COLUMNS =
  "user_id, username, display_name, headline, about, city, region, country_id, city_id, avatar_url, verification_status, is_published, joined_at, show_phone, show_email, show_whatsapp, public_phone, public_email, public_whatsapp";

export const LISTING_COLUMNS =
  "id, slug, owner_user_id, tenant_id, advertiser_type, type_code, category_id, subcategory_id, title, summary, description, specs, price, price_on_request, price_unit, currency, quantity, unit, item_condition, deal_kind, city, region, country_id, city_id, cover_image_url, status, rejection_reason, published_at, views_count, created_at";



export const BUSINESS_COLUMNS =
  "tenant_id, slug, display_name_ar, display_name_en, headline, about, logo_url, city, region, country_id, city_id, categories, verification_status, verification_note, is_published, joined_at, show_phone, show_email, show_whatsapp, public_phone, public_email, public_whatsapp, public_website";

/** Resolve stored media references (storage paths or absolute URLs) to displayable URLs. */
export async function resolveMedia(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result: Record<string, string> = {};
  const storagePaths: string[] = [];

  for (const path of unique) {
    if (/^https?:\/\//i.test(path)) result[path] = path;
    else storagePaths.push(path);
  }

  if (storagePaths.length > 0) {
    const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrls(storagePaths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
    }
  }
  return result;
}

/** Only same-origin internal paths are accepted, so a crafted link cannot redirect off-site. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("://") || raw.includes("\\")) return null;
  return raw;
}

/** Build a sign-in link that returns the visitor to the same listing and re-opens the action. */
export function loginHref(returnPath: string, action?: MktAction): string {
  const safe = safeInternalPath(returnPath) ?? "/";
  const withAction = action ? `${safe}${safe.includes("?") ? "&" : "?"}action=${action}` : safe;
  return `/login?next=${encodeURIComponent(withAction)}`;
}

export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

export function priceLabel(
  listing: Pick<MktListing, "price" | "price_on_request" | "price_unit" | "currency">,
  onRequestText: string,
): string {
  if (listing.price_on_request || listing.price === null) return onRequestText;
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(listing.price);
  return `${amount} ${listing.currency}${listing.price_unit ? ` / ${listing.price_unit}` : ""}`;
}

/** Short "x days ago" style label used across marketplace cards. */
export function relativeTime(iso: string | null, locale: "ar" | "en"): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  const fmt = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    numeric: "auto",
    style: "short",
  });
  if (mins < 60) return fmt.format(-Math.max(mins, 0), "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return fmt.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return fmt.format(-days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return fmt.format(-months, "month");
  return fmt.format(-Math.round(months / 12), "year");
}
