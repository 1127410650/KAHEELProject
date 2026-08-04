/**
 * Mini stores & restaurants — client access layer (batch 2).
 *
 * Nothing here decides ownership, slug, country or status: every write goes
 * through the server functions created in the database (`mkt_store_save`,
 * `mkt_store_hours_save`, `mkt_store_zones_save`, `mkt_store_submit`), which
 * resolve the ACTIVE account from `auth.uid()` and refuse anything else. The
 * browser only carries form values.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import { prepareFile, removeObjects, signPaths } from "@/lib/mkt-listing-media";

export const STORE_TYPES = ["restaurant", "retail", "services", "mixed"] as const;
export type StoreType = (typeof STORE_TYPES)[number];

export type StoreStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "suspended"
  | "archived";

export interface MyStorefront {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  store_type: StoreType;
  status: StoreStatus;
  accepts_orders: boolean;
  is_open_manually: boolean;
  logo_path: string | null;
  cover_path: string | null;
  tenant_id: string | null;
}

export interface StoreHourRow {
  weekday: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  second_opens_at: string | null;
  second_closes_at: string | null;
}

export interface StoreZoneRow {
  city_id: string | null;
  district: string | null;
  radius_km: number | null;
  delivery_fee: number | null;
  minimum_order_amount: number | null;
  estimated_minutes_min: number | null;
  estimated_minutes_max: number | null;
  is_active: boolean;
}

export interface StoreDraft {
  store: {
    id: string;
    store_type: StoreType;
    cuisine_id: string | null;
    slug: string;
    name_ar: string;
    name_en: string | null;
    short_description_ar: string | null;
    short_description_en: string | null;
    logo_path: string | null;
    cover_path: string | null;
    country_id: string | null;
    city_id: string | null;
    district: string | null;
    address_text: string | null;
    latitude: number | null;
    longitude: number | null;
    location_precision: "exact" | "approximate";
    public_phone_enabled: boolean;
    chat_enabled: boolean;
    call_enabled: boolean;
    pickup_enabled: boolean;
    merchant_delivery_enabled: boolean;
    minimum_order_amount: number;
    delivery_fee: number;
    estimated_delivery_minutes_min: number | null;
    estimated_delivery_minutes_max: number | null;
    currency_code: string;
    status: StoreStatus;
    is_open_manually: boolean;
    accepts_orders: boolean;
    verification_status: string;
    draft_step: number;
  };
  private: {
    contact_phone: string | null;
    delivery_phone: string | null;
    delivery_permit_number: string | null;
    delivery_permit_expires_on: string | null;
    delivery_declaration_accepted_at: string | null;
    permit_review_status: string | null;
    has_permit_doc: boolean;
  } | null;
  hours: StoreHourRow[];
  zones: StoreZoneRow[];
  city_name: string | null;
}

export interface StoreOpenState {
  open: boolean;
  accepts_orders: boolean;
  closes_at: string | null;
  next_open_weekday: number | null;
  next_open_at: string | null;
  timezone: string;
  server_time: string;
}

/** The single storefront of the active account, or null when there is none. */
export function useMyStorefront(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "my-storefront", accountKey],
    enabled: !!accountKey,
    staleTime: 15_000,
    queryFn: async (): Promise<MyStorefront | null> => {
      const { data, error } = await supabase.rpc("mkt_my_storefront", {
        _account_key: accountKey,
      });
      if (error) throw error;
      return ((data ?? []) as MyStorefront[])[0] ?? null;
    },
  });
}

/** Full draft (identity, location, delivery, hours, zones) for the wizard. */
export function useStoreDraft(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "store-draft", accountKey],
    enabled: !!accountKey,
    staleTime: 0,
    queryFn: async (): Promise<StoreDraft | null> => {
      const { data, error } = await supabase.rpc("mkt_store_draft", {
        _account_key: accountKey,
      });
      if (error) throw error;
      return (data as StoreDraft | null) ?? null;
    },
  });
}

export function useStoreOpenState(storefrontId: string | null) {
  return useQuery({
    queryKey: ["mkt", "store-open", storefrontId],
    enabled: !!storefrontId,
    staleTime: 60_000,
    queryFn: async (): Promise<StoreOpenState | null> => {
      const { data, error } = await supabase.rpc("mkt_store_open_state", {
        _storefront_id: storefrontId!,
      });
      if (error) throw error;
      return (data as StoreOpenState | null) ?? null;
    },
  });
}

export type StorePatch = Record<string, string | number | boolean | null>;

/** Create-or-update the active account's storefront; returns its id. */
export async function saveStore(
  accountKey: string,
  patch: StorePatch,
  step: number,
  idempotencyKey?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_store_save", {
    _account_key: accountKey,
    _patch: patch as never,
    _step: step,
    _idempotency_key: idempotencyKey ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function saveStoreHours(storefrontId: string, rows: StoreHourRow[]): Promise<void> {
  const { error } = await supabase.rpc("mkt_store_hours_save", {
    _storefront_id: storefrontId,
    _rows: rows as never,
  });
  if (error) throw error;
}

export async function saveStoreZones(storefrontId: string, rows: StoreZoneRow[]): Promise<void> {
  const { error } = await supabase.rpc("mkt_store_zones_save", {
    _storefront_id: storefrontId,
    _rows: rows as never,
  });
  if (error) throw error;
}

export interface SubmitResult {
  ok: boolean;
  missing?: string[];
}

export async function submitStore(storefrontId: string): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc("mkt_store_submit", {
    _storefront_id: storefrontId,
  });
  if (error) throw error;
  return (data as SubmitResult) ?? { ok: false };
}

/* ── media ─────────────────────────────────────────────────────────────────── */

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export type StoreImageKind = "logo" | "cover";

/**
 * Upload a store image, then swap the record path only after the new object is
 * really stored — the old object is removed last, so a failed upload can never
 * leave the store without a picture.
 */
export async function uploadStoreImage(
  storefrontId: string,
  kind: StoreImageKind,
  file: File,
  previousPath: string | null,
): Promise<{ path: string } | { error: string }> {
  const prepared = await prepareFile(file);
  if (prepared.error) return { error: prepared.error };

  const path = `stores/${storefrontId}/${kind}-${crypto.randomUUID()}.${extensionFor(prepared.mime)}`;
  const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, prepared.blob, {
    contentType: prepared.mime,
    upsert: false,
  });
  if (error) return { error: "upload" };

  if (previousPath && previousPath !== path) await removeObjects([previousPath]);
  return { path };
}

/** Delivery-permit document: private prefix, never public-readable. */
export async function uploadPermitDoc(
  storefrontId: string,
  file: File,
  previousPath: string | null,
): Promise<{ path: string } | { error: string }> {
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return { error: "type" };
  if (file.size > 10 * 1024 * 1024) return { error: "tooLarge" };

  const ext = file.type === "application/pdf" ? "pdf" : extensionFor(file.type);
  const path = `store-docs/${storefrontId}/permit-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: "upload" };
  if (previousPath && previousPath !== path) await removeObjects([previousPath]);
  return { path };
}

/** Short-lived link for one stored object (images and documents alike). */
export async function signStorePath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const map = await signPaths([path]);
  return map[path] ?? null;
}

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function emptyHours(): StoreHourRow[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    is_closed: false,
    opens_at: "09:00",
    closes_at: "23:00",
    second_opens_at: null,
    second_closes_at: null,
  }));
}
