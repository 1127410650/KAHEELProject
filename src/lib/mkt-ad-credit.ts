/**
 * Ad credit wallet — the provider buys credit, the platform settles it, and the
 * credit is spent to promote a store or a listing.
 *
 * The balance is never written from the browser: `mkt_ad_credit_*` definer
 * functions own every movement and write the matching ledger entry, so a client
 * can only read its own wallet, request a purchase, or spend what it already
 * has.
 *
 * No payment provider is connected yet, and that shows in one place only: a
 * purchase request lands as a `pending` entry and adds nothing to the balance
 * until a platform admin settles it (`mkt_ad_credit_admin_settle`) with a
 * payment reference. Wiring a real gateway later means settling that same
 * pending entry from a verified webhook — the wallet, the ledger and the
 * consumption path do not change.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AdCreditKind = "purchase" | "admin_grant" | "consume" | "adjustment" | "refund";
export type AdCreditStatus = "pending" | "settled" | "cancelled";

export interface AdCreditWallet {
  id: string;
  owner_user_id: string;
  tenant_id: string | null;
  balance: number;
  total_purchased: number;
  total_consumed: number;
  updated_at: string;
}

export interface AdCreditEntry {
  id: string;
  wallet_id: string;
  kind: AdCreditKind;
  status: AdCreditStatus;
  amount: number;
  balance_after: number | null;
  price_sar: number | null;
  payment_ref: string | null;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

const ENTRY_COLUMNS =
  "id, wallet_id, kind, status, amount, balance_after, price_sar, payment_ref, reference_type, reference_id, note, created_at";

/** Resolves (and creates on first use) the wallet of the active account. */
export function useAdCreditWallet(accountKey: string | null, tenantId: string | null) {
  return useQuery({
    queryKey: ["mkt", "ad-credit-wallet", accountKey],
    enabled: !!accountKey,
    staleTime: 15_000,
    queryFn: async (): Promise<AdCreditWallet> => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_wallet", {
        ...(tenantId ? { _tenant_id: tenantId } : {}),
      });
      if (error) throw error;
      return data as unknown as AdCreditWallet;
    },
  });
}

export function useAdCreditEntries(walletId: string | null) {
  return useQuery({
    queryKey: ["mkt", "ad-credit-entries", walletId],
    enabled: !!walletId,
    staleTime: 15_000,
    queryFn: async (): Promise<AdCreditEntry[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_credit_entries")
        .select(ENTRY_COLUMNS)
        .eq("wallet_id", walletId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdCreditEntry[];
    },
  });
}

/**
 * Sale price of credit, in SAR. Kept here (not in the database) because it is
 * a presentational price list the platform changes freely; the authoritative
 * amount of a purchase is the `price_sar` recorded on the ledger entry.
 */
export interface AdCreditPack {
  credits: number;
  priceSar: number;
}

export const AD_CREDIT_PACKS: readonly AdCreditPack[] = [
  { credits: 100, priceSar: 100 },
  { credits: 500, priceSar: 450 },
  { credits: 1000, priceSar: 850 },
  { credits: 5000, priceSar: 4000 },
];

/**
 * Records a purchase request. Returns the pending entry id; the balance stays
 * untouched until an admin settles it.
 */
export function useRequestAdCredit(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ credits, priceSar }: { credits: number; priceSar?: number | null }) => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_request_purchase", {
        _amount: credits,
        ...(priceSar != null ? { _price_sar: priceSar } : {}),
        ...(tenantId ? { _tenant_id: tenantId } : {}),
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-entries"] });
    },
  });
}

/** Withdraws the caller's own still-unpaid purchase request. */
export function useCancelAdCreditRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.rpc("mkt_ad_credit_cancel_request", { _entry_id: entryId });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-entries"] });
    },
  });
}

export function useConsumeAdCredit(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      credits,
      referenceType,
      referenceId,
    }: {
      credits: number;
      referenceType: string;
      referenceId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_consume", {
        _amount: credits,
        _reference_type: referenceType,
        ...(referenceId ? { _reference_id: referenceId } : {}),
        ...(tenantId ? { _tenant_id: tenantId } : {}),
      });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-entries"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-wallet"] });
    },
  });
}

/* ── platform admin ───────────────────────────────────────────────────────── */

export interface AdCreditWalletRow extends AdCreditWallet {
  created_at: string;
}

export function useAllAdCreditWallets(enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "admin", "ad-credit-wallets"],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<AdCreditWalletRow[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_credit_wallets")
        .select("id, owner_user_id, tenant_id, balance, total_purchased, total_consumed, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdCreditWalletRow[];
    },
  });
}

export function useAllAdCreditEntries(enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "admin", "ad-credit-entries"],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<AdCreditEntry[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_credit_entries")
        .select(ENTRY_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdCreditEntry[];
    },
  });
}

export function useAdminGrantAdCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      walletId,
      amount,
      kind,
      note,
      priceSar,
    }: {
      walletId: string;
      amount: number;
      kind: Exclude<AdCreditKind, "consume">;
      note?: string | null;
      priceSar?: number | null;
    }) => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_admin_grant", {
        _wallet_id: walletId,
        _amount: amount,
        _kind: kind,
        // Optional RPC arguments are omitted rather than sent as null so the
        // function's own defaults apply.
        ...(note ? { _note: note } : {}),
        ...(priceSar != null ? { _price_sar: priceSar } : {}),
      });

      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-entries"] });
    },
  });
}

export function useAdminSettleAdCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, paymentRef }: { entryId: string; paymentRef?: string | null }) => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_admin_settle", {
        _entry_id: entryId,
        ...(paymentRef ? { _payment_ref: paymentRef } : {}),
      });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-entries"] });
    },
  });
}
