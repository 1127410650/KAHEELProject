/**
 * Mini stores — catalog (sections, items, options), ad linking and the public
 * storefront payload.
 *
 * Ownership is never sent from the browser: every table write below is checked
 * by the row-level policies through `mkt_store_manage(storefront_id)`, and every
 * read of somebody else's store goes through `mkt_store_public`, which returns a
 * safe payload only (no owner id, no tenant, no documents, phone only when the
 * merchant enabled it, coarse coordinates for approximate locations).
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET, resolveMedia } from "@/lib/mkt";
import { prepareFile, removeObjects } from "@/lib/mkt-listing-media";

/* ── types ────────────────────────────────────────────────────────────────── */

export interface StoreSection {
  id: string;
  storefront_id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface StoreItem {
  id: string;
  storefront_id: string;
  section_id: string | null;
  item_type: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  base_price: number;
  compare_at_price: number | null;
  currency_code: string;
  image_path: string | null;
  preparation_minutes: number | null;
  duration_minutes: number | null;
  stock_quantity: number | null;
  track_inventory: boolean;
  is_available: boolean;
  is_featured: boolean;
  allow_notes: boolean;
  sort_order: number;
}

export interface StoreAddonOption {
  id: string;
  addon_group_id: string;
  name_ar: string;
  name_en: string | null;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
}

export interface StoreAddonGroup {
  id: string;
  item_id: string;
  name_ar: string;
  name_en: string | null;
  selection_type: "single" | "multiple";
  is_required: boolean;
  minimum_choices: number;
  maximum_choices: number | null;
  sort_order: number;
  options: StoreAddonOption[];
}

export interface StoreCatalog {
  sections: StoreSection[];
  items: StoreItem[];
  groups: StoreAddonGroup[];
  /** Signed URLs for the item photos, keyed by storage path. */
  media: Record<string, string>;
}

export interface StoreOverview {
  storefront_id: string;
  slug: string;
  store_type: string;
  status: string;
  is_open_manually: boolean;
  city_name_ar: string | null;
  city_name_en: string | null;
  logo_path: string | null;
  cover_path: string | null;
  name_ar: string;
  name_en: string | null;
  verification_status: string;
  draft_step: number;
  sections_count: number;
  items_published: number;
  items_hidden: number;
  linked_listings: number;
  missing: string[];
  complete: boolean;
}

export interface PublicStoreItem {
  id: string;
  section_id: string | null;
  item_type: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  base_price: number;
  compare_at_price: number | null;
  currency_code: string;
  image_path: string | null;
  is_available: boolean;
  is_featured: boolean;
  preparation_minutes: number | null;
  duration_minutes: number | null;
  track_inventory: boolean;
  stock_quantity: number | null;
  addon_groups: Omit<StoreAddonGroup, "item_id" | "sort_order">[];
}

export interface PublicStoreListing {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  price_on_request: boolean;
  price_unit: string | null;
  currency: string;
  cover_image_url: string | null;
  city: string | null;
}

export interface PublicStore {
  id: string;
  slug: string;
  store_type: string;
  status: string;
  name_ar: string;
  name_en: string | null;
  short_description_ar: string | null;
  short_description_en: string | null;
  logo_path: string | null;
  cover_path: string | null;
  city_name_ar: string | null;
  city_name_en: string | null;
  district: string | null;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: "exact" | "approximate";
  verification_status: string;
  currency_code: string;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee: number | null;
  minimum_order_amount: number | null;
  chat_enabled: boolean;
  call_enabled: boolean;
  public_phone: string | null;
  cuisine: { name_ar: string; name_en: string | null } | null;
  open_state: { open: boolean; closes_at: string | null; next_open_at: string | null } | null;
  hours: {
    weekday: number;
    is_closed: boolean;
    opens_at: string | null;
    closes_at: string | null;
    second_opens_at: string | null;
    second_closes_at: string | null;
  }[];
  sections: Pick<
    StoreSection,
    "id" | "name_ar" | "name_en" | "description_ar" | "description_en" | "sort_order"
  >[];
  items: PublicStoreItem[];
  listings: PublicStoreListing[];
  /** Signed URLs for logo, cover and item photos. */
  media: Record<string, string>;
}

/* ── owner reads ──────────────────────────────────────────────────────────── */

const CATALOG_KEY = (id: string | null) => ["mkt", "store-catalog", id] as const;

export function useStoreCatalog(storefrontId: string | null) {
  return useQuery({
    queryKey: CATALOG_KEY(storefrontId),
    enabled: !!storefrontId,
    staleTime: 5_000,
    queryFn: async (): Promise<StoreCatalog> => {
      const id = storefrontId!;
      const [sections, items] = await Promise.all([
        supabase
          .from("mkt_store_sections")
          .select("*")
          .eq("storefront_id", id)
          .is("deleted_at", null)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("mkt_store_items")
          .select("*")
          .eq("storefront_id", id)
          .is("deleted_at", null)
          .order("sort_order")
          .order("created_at"),
      ]);
      if (sections.error) throw sections.error;
      if (items.error) throw items.error;

      const itemRows = (items.data ?? []) as unknown as StoreItem[];
      let groups: StoreAddonGroup[] = [];
      if (itemRows.length > 0) {
        const ids = itemRows.map((i) => i.id);
        const [g, o] = await Promise.all([
          supabase
            .from("mkt_store_addon_groups")
            .select("*")
            .in("item_id", ids)
            .is("deleted_at", null)
            .order("sort_order")
            .order("created_at"),
          supabase
            .from("mkt_store_addons")
            .select("*")
            .is("deleted_at", null)
            .order("sort_order")
            .order("created_at"),
        ]);
        if (g.error) throw g.error;
        if (o.error) throw o.error;
        const options = (o.data ?? []) as unknown as StoreAddonOption[];
        groups = ((g.data ?? []) as unknown as StoreAddonGroup[]).map((row) => ({
          ...row,
          options: options.filter((op) => op.addon_group_id === row.id),
        }));
      }

      const media = await resolveMedia(itemRows.map((i) => i.image_path));
      return {
        sections: (sections.data ?? []) as unknown as StoreSection[],
        items: itemRows,
        groups,
        media,
      };
    },
  });
}

export function useStoreOverview(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "store-overview", accountKey],
    enabled: !!accountKey,
    staleTime: 5_000,
    queryFn: async (): Promise<StoreOverview | null> => {
      const { data, error } = await supabase.rpc("mkt_store_overview", {
        _account_key: accountKey!,
      });
      if (error) throw error;
      return (data as unknown as StoreOverview | null) ?? null;
    },
  });
}

/* ── sections ─────────────────────────────────────────────────────────────── */

export interface SectionInput {
  id?: string | undefined;
  name_ar: string;
  name_en?: string | null | undefined;
  description_ar?: string | null | undefined;
  is_active?: boolean | undefined;
  sort_order?: number | undefined;
}

export async function saveSection(storefrontId: string, input: SectionInput): Promise<string> {
  const patch = {
    name_ar: input.name_ar.trim(),
    name_en: input.name_en?.trim() || null,
    description_ar: input.description_ar?.trim() || null,
    ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
    ...(input.sort_order === undefined ? {} : { sort_order: input.sort_order }),
  };
  if (input.id) {
    const { error } = await supabase.from("mkt_store_sections").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("mkt_store_sections")
    .insert({ storefront_id: storefrontId, ...patch } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteSection(sectionId: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_store_sections")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function reorderSections(ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase
      .from("mkt_store_sections")
      .update({ sort_order: index })
      .eq("id", ids[index]!);
    if (error) throw error;
  }
}

/* ── items ────────────────────────────────────────────────────────────────── */

export interface ItemInput {
  id?: string | undefined;
  section_id: string | null;
  item_type: string;
  name_ar: string;
  name_en?: string | null | undefined;
  description_ar?: string | null | undefined;
  base_price: number;
  compare_at_price?: number | null | undefined;
  image_path?: string | null | undefined;
  preparation_minutes?: number | null | undefined;
  duration_minutes?: number | null | undefined;
  track_inventory?: boolean | undefined;
  stock_quantity?: number | null | undefined;
  is_available?: boolean | undefined;
  is_featured?: boolean | undefined;
  allow_notes?: boolean | undefined;
  sort_order?: number | undefined;
}

export async function saveItem(storefrontId: string, input: ItemInput): Promise<string> {
  const patch = {
    section_id: input.section_id,
    item_type: input.item_type,
    name_ar: input.name_ar.trim(),
    name_en: input.name_en?.trim() || null,
    description_ar: input.description_ar?.trim() || null,
    base_price: input.base_price,
    compare_at_price: input.compare_at_price ?? null,
    image_path: input.image_path ?? null,
    preparation_minutes: input.preparation_minutes ?? null,
    duration_minutes: input.duration_minutes ?? null,
    track_inventory: input.track_inventory ?? false,
    stock_quantity: input.track_inventory ? (input.stock_quantity ?? 0) : null,
    is_available: input.is_available ?? true,
    is_featured: input.is_featured ?? false,
    allow_notes: input.allow_notes ?? true,
    ...(input.sort_order === undefined ? {} : { sort_order: input.sort_order }),
  };
  if (input.id) {
    const { error } = await supabase.from("mkt_store_items").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("mkt_store_items")
    .insert({ storefront_id: storefrontId, ...patch } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function setItemAvailability(itemId: string, available: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_store_items")
    .update({ is_available: available })
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_store_items")
    .update({ deleted_at: new Date().toISOString(), is_available: false })
    .eq("id", itemId);
  if (error) throw error;
}

export async function reorderItems(ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase
      .from("mkt_store_items")
      .update({ sort_order: index })
      .eq("id", ids[index]!);
    if (error) throw error;
  }
}

/** Item photo: public `stores/<id>/…` prefix, replaced only after a real upload. */
export async function uploadItemImage(
  storefrontId: string,
  file: File,
  previousPath: string | null,
): Promise<{ path: string } | { error: string }> {
  const prepared = await prepareFile(file);
  if (prepared.error) return { error: prepared.error };
  const ext = prepared.mime === "image/png" ? "png" : prepared.mime === "image/webp" ? "webp" : "jpg";
  const path = `stores/${storefrontId}/item-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, prepared.blob, {
    contentType: prepared.mime,
    upsert: false,
  });
  if (error) return { error: "upload" };
  if (previousPath && previousPath !== path) await removeObjects([previousPath]);
  return { path };
}

/* ── option groups and options (restaurants and mixed stores) ─────────────── */

export interface GroupInput {
  id?: string | undefined;
  name_ar: string;
  selection_type: "single" | "multiple";
  is_required: boolean;
  minimum_choices: number;
  maximum_choices: number | null;
  sort_order?: number | undefined;
}

export async function saveAddonGroup(itemId: string, input: GroupInput): Promise<string> {
  const patch = {
    name_ar: input.name_ar.trim(),
    selection_type: input.selection_type,
    is_required: input.is_required,
    minimum_choices: input.minimum_choices,
    maximum_choices: input.selection_type === "single" ? 1 : input.maximum_choices,
    ...(input.sort_order === undefined ? {} : { sort_order: input.sort_order }),
  };
  if (input.id) {
    const { error } = await supabase.from("mkt_store_addon_groups").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("mkt_store_addon_groups")
    .insert({ item_id: itemId, ...patch } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteAddonGroup(groupId: string): Promise<void> {
  const stamp = new Date().toISOString();
  const { error } = await supabase
    .from("mkt_store_addon_groups")
    .update({ deleted_at: stamp })
    .eq("id", groupId);
  if (error) throw error;
  await supabase.from("mkt_store_addons").update({ deleted_at: stamp }).eq("addon_group_id", groupId);
}

export interface OptionInput {
  id?: string | undefined;
  name_ar: string;
  price_delta: number;
  is_available?: boolean | undefined;
}

export async function saveAddonOption(groupId: string, input: OptionInput): Promise<string> {
  const patch = {
    name_ar: input.name_ar.trim(),
    price_delta: input.price_delta,
    is_available: input.is_available ?? true,
  };
  if (input.id) {
    const { error } = await supabase.from("mkt_store_addons").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("mkt_store_addons")
    .insert({ addon_group_id: groupId, ...patch } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteAddonOption(optionId: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_store_addons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", optionId);
  if (error) throw error;
}

/* ── ads ↔ store ──────────────────────────────────────────────────────────── */

export interface LinkableListing {
  id: string;
  slug: string;
  title: string;
  status: string;
  storefront_id: string | null;
  cover_image_url: string | null;
}

export function useLinkableListings(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "store-linkable-ads", accountKey],
    enabled: !!accountKey,
    staleTime: 5_000,
    queryFn: async (): Promise<LinkableListing[]> => {
      const { data, error } = await supabase.rpc("mkt_store_linkable_listings", {
        _account_key: accountKey!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LinkableListing[];
    },
  });
}

/** Link or unlink one ad. The database refuses a store from another account. */
export async function setListingStore(
  listingId: string,
  storefrontId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("mkt_listings")
    .update({ storefront_id: storefrontId })
    .eq("id", listingId);
  if (error) throw error;
}

/* ── public storefront ────────────────────────────────────────────────────── */

export function usePublicStore(slug: string) {
  return useQuery({
    queryKey: ["mkt", "store-public", slug],
    staleTime: 30_000,
    queryFn: async (): Promise<PublicStore | { unavailable: true } | null> => {
      const { data, error } = await supabase.rpc("mkt_store_public", { _slug: slug });
      if (error) throw error;
      if (!data) return null;
      const payload = data as unknown as PublicStore | { unavailable: true };
      if ("unavailable" in payload) return payload;
      const media = await resolveMedia([
        payload.logo_path,
        payload.cover_path,
        ...payload.items.map((i) => i.image_path),
        ...payload.listings.map((l) => l.cover_image_url),
      ]);
      return { ...payload, media };
    },
  });
}

/* ── errors ───────────────────────────────────────────────────────────────── */

const GUARD_KEYS = [
  "section_name_required",
  "section_has_published_items",
  "section_other_store",
  "item_name_required",
  "item_price_negative",
  "item_compare_price_negative",
  "group_name_required",
  "group_min_above_max",
  "addon_name_required",
  "addon_price_negative",
  "store_account_mismatch",
  "store_not_found",
] as const;

/** Map a database guard message to a translation key under `market.store.err`. */
export function catalogErrorKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("mkt_store_sections_unique_name")) return "market.store.err.duplicateSection";
  const hit = GUARD_KEYS.find((key) => message.includes(key));
  return hit ? `market.store.err.${hit}` : "market.store.err.generic";
}
