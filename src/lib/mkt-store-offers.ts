/**
 * Provider offers ("سند كَحيل") — a merchant-managed list of discounts shown to
 * customers on the public store page.
 *
 * Ownership is never sent from the browser: every write below is authorised by
 * the row-level policies through `mkt_store_manage(storefront_id)`, and the
 * public read path only ever returns offers that are active, in their validity
 * window and attached to a published store.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type OfferDiscountType = "percent" | "amount";

export interface StoreOffer {
  id: string;
  storefront_id: string;
  title: string;
  description: string | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  applies_to_all: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface StoreOfferInput {
  title: string;
  description: string | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  applies_to_all: boolean;
  item_ids: string[];
}

const OFFER_COLUMNS =
  "id, storefront_id, title, description, discount_type, discount_value, starts_at, ends_at, is_active, applies_to_all, sort_order, archived_at, created_at";

export function offersKey(storefrontId: string | null, scope: "owner" | "public") {
  return ["mkt", "store-offers", scope, storefrontId] as const;
}

/** Owner view: includes paused, scheduled and expired offers. */
export function useMyStoreOffers(storefrontId: string | null) {
  return useQuery({
    queryKey: offersKey(storefrontId, "owner"),
    enabled: !!storefrontId,
    staleTime: 30_000,
    queryFn: async (): Promise<StoreOffer[]> => {
      const { data, error } = await supabase
        .from("mkt_store_offers")
        .select(OFFER_COLUMNS)
        .eq("storefront_id", storefrontId!)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreOffer[];
    },
  });
}

/** Public view: the policy already hides anything a visitor must not see. */
export function useStoreOffers(storefrontId: string | null) {
  return useQuery({
    queryKey: offersKey(storefrontId, "public"),
    enabled: !!storefrontId,
    staleTime: 60_000,
    queryFn: async (): Promise<StoreOffer[]> => {
      const { data, error } = await supabase
        .from("mkt_store_offers")
        .select(OFFER_COLUMNS)
        .eq("storefront_id", storefrontId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreOffer[];
    },
  });
}

export function useOfferItemIds(offerId: string | null) {
  return useQuery({
    queryKey: ["mkt", "store-offer-items", offerId],
    enabled: !!offerId,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("mkt_store_offer_items")
        .select("item_id")
        .eq("offer_id", offerId!);
      if (error) throw error;
      return (data ?? []).map((row) => (row as { item_id: string }).item_id);
    },
  });
}

async function syncOfferItems(offerId: string, itemIds: string[]): Promise<void> {
  const { error: clearError } = await supabase
    .from("mkt_store_offer_items")
    .delete()
    .eq("offer_id", offerId);
  if (clearError) throw clearError;
  if (itemIds.length === 0) return;
  const { error } = await supabase
    .from("mkt_store_offer_items")
    .insert(itemIds.map((item_id) => ({ offer_id: offerId, item_id })));
  if (error) throw error;
}

export function useSaveStoreOffer(storefrontId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StoreOfferInput & { id?: string }): Promise<string> => {
      if (!storefrontId) throw new Error("no_store");
      const payload = {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        is_active: input.is_active,
        applies_to_all: input.applies_to_all,
      };

      let offerId = input.id;
      if (offerId) {
        const { error } = await supabase
          .from("mkt_store_offers")
          .update(payload)
          .eq("id", offerId);
        if (error) throw error;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("mkt_store_offers")
          .insert({
            ...payload,
            storefront_id: storefrontId,
            // The insert policy demands the row is stamped with the caller.
            created_by: auth.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        offerId = (data as { id: string }).id;
      }

      await syncOfferItems(offerId, input.applies_to_all ? [] : input.item_ids);
      return offerId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "store-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "store-offer-items"] });
    },
  });
}

export function useToggleStoreOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("mkt_store_offers")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "store-offers"] });
    },
  });
}

/** Offers are archived, never hard-deleted, so the history stays auditable. */
export function useArchiveStoreOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mkt_store_offers")
        .update({ archived_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "store-offers"] });
    },
  });
}

export function offerIsLive(offer: StoreOffer, now = Date.now()): boolean {
  if (!offer.is_active || offer.archived_at) return false;
  if (new Date(offer.starts_at).getTime() > now) return false;
  if (offer.ends_at && new Date(offer.ends_at).getTime() <= now) return false;
  return true;
}

export function offerStatus(offer: StoreOffer, now = Date.now()): "live" | "scheduled" | "expired" | "paused" {
  if (!offer.is_active) return "paused";
  if (new Date(offer.starts_at).getTime() > now) return "scheduled";
  if (offer.ends_at && new Date(offer.ends_at).getTime() <= now) return "expired";
  return "live";
}
