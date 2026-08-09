/**
 * Ad credit wallet — the provider buys credit, the platform settles it, and the
 * credit is spent to promote a store or a listing.
 *
 * The balance is never written from the browser: `mkt_ad_credit_*` definer
 * functions own every movement and write the matching ledger entry, so a client
 * can only read its own wallet and ask for a purchase.
 *
 * No payment provider is connected at this stage, and no self-service purchase
 * path exists: a provider cannot top itself up. Credit is added manually by a
 * platform admin (`mkt_ad_credit_admin_grant`), which also writes the ledger
 * entry. `mkt_ad_credit_request_purchase` is revoked from clients in the
 * database until a payment provider is actually available.
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
