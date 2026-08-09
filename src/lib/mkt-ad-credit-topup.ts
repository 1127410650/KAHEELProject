/**
 * Ad credit top-up: how credit actually gets into the wallet.
 *
 * Two paths share one review queue (`mkt_ad_credit_topups`):
 *
 * 1. Documented manual transfer — Sham Cash (the primary method for the Syrian
 *    market) or a bank transfer. The provider transfers from their own wallet
 *    app, then files a *claim* here: transfer reference, amount, and a receipt
 *    image stored privately in `mkt-media` under `ad-credit/<uid>/`. Nothing is
 *    credited by filing the claim; a platform admin matches the transfer and
 *    approves or rejects it with a reason, and the definer function
 *    `mkt_ad_credit_topup_review` is the only thing that moves the balance and
 *    writes the ledger entry.
 * 2. Card gateway — the same claim row, created with `method: "card_gateway"`
 *    and settled by a verified provider callback instead of a human. It is
 *    switched off in `mkt_platform_settings` (`ad_credit.card_gateway`) until
 *    API keys exist, and the submit function refuses it while disabled, so the
 *    button can be revealed later without touching the wallet, the ledger, or
 *    the consumption path.
 *
 * The browser never writes this table: there is no INSERT/UPDATE policy on it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import { isRealDocument } from "@/lib/mkt-business";

export type TopupMethod = "sham_cash" | "bank_transfer" | "card_gateway";
export type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TopupCurrency = "SYP" | "SAR" | "USD" | "TRY";

export const TOPUP_CURRENCIES: readonly TopupCurrency[] = ["SYP", "SAR", "USD", "TRY"];

export interface AdCreditTopup {
  id: string;
  wallet_id: string;
  requested_by: string;
  method: TopupMethod;
  credits: number;
  amount: number | null;
  currency: TopupCurrency;
  transfer_ref: string | null;
  receipt_path: string | null;
  sender_note: string | null;
  status: TopupStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  entry_id: string | null;
  provider: string | null;
  created_at: string;
}

const TOPUP_COLUMNS =
  "id, wallet_id, requested_by, method, credits, amount, currency, transfer_ref, receipt_path, sender_note, status, reject_reason, reviewed_by, reviewed_at, entry_id, provider, created_at";

/** Payment details the provider must see (platform wallet id, instructions). */
export interface TopupMethodsConfig {
  shamCash: {
    enabled: boolean;
    walletId: string;
    walletName: string;
    instructionsAr: string;
    instructionsEn: string;
  };
  cardGateway: { enabled: boolean; provider: string };
}

export function useTopupMethods(enabled = true) {
  return useQuery({
    queryKey: ["mkt", "ad-credit-topup-methods"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<TopupMethodsConfig> => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_topup_methods");
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, Record<string, unknown>>;
      const sham = raw["sham_cash"] ?? {};
      const card = raw["card_gateway"] ?? {};
      return {
        shamCash: {
          enabled: sham["enabled"] !== false,
          walletId: String(sham["wallet_id"] ?? ""),
          walletName: String(sham["wallet_name"] ?? ""),
          instructionsAr: String(sham["instructions_ar"] ?? ""),
          instructionsEn: String(sham["instructions_en"] ?? ""),
        },
        cardGateway: {
          enabled: card["enabled"] === true,
          provider: String(card["provider"] ?? "stripe"),
        },
      };
    },
  });
}

export function useMyAdCreditTopups(walletId: string | null) {
  return useQuery({
    queryKey: ["mkt", "ad-credit-topups", walletId],
    enabled: !!walletId,
    staleTime: 10_000,
    queryFn: async (): Promise<AdCreditTopup[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_credit_topups")
        .select(TOPUP_COLUMNS)
        .eq("wallet_id", walletId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AdCreditTopup[];
    },
  });
}

export interface SubmitTopupInput {
  method: Exclude<TopupMethod, "card_gateway">;
  credits: number;
  amount: number;
  currency: TopupCurrency;
  transferRef: string;
  senderNote?: string | null;
  receipt?: File | null;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

/**
 * Uploads the receipt (when provided) and files the claim. The receipt path is
 * pinned to the caller's own folder because the database rejects any other
 * prefix.
 */
export function useSubmitAdCreditTopup(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitTopupInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("unauthorized");

      let receiptPath: string | null = null;
      if (input.receipt) {
        if (input.receipt.size > MAX_RECEIPT_BYTES) throw new Error("receipt_too_large");
        if (!(await isRealDocument(input.receipt))) throw new Error("receipt_invalid");
        const ext = input.receipt.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `ad-credit/${userId}/${crypto.randomUUID()}.${ext.slice(0, 8)}`;
        const { error: upErr } = await supabase.storage
          .from(MKT_BUCKET)
          .upload(path, input.receipt, { contentType: input.receipt.type, upsert: false });
        if (upErr) throw upErr;
        receiptPath = path;
      }

      const { data, error } = await supabase.rpc("mkt_ad_credit_topup_submit", {
        _method: input.method,
        _credits: input.credits,
        _amount: input.amount,
        _currency: input.currency,
        _transfer_ref: input.transferRef,
        ...(receiptPath ? { _receipt_path: receiptPath } : {}),
        ...(input.senderNote ? { _sender_note: input.senderNote } : {}),
        ...(tenantId ? { _tenant_id: tenantId } : {}),
      });
      if (error) {
        // The claim failed, so the orphan receipt has no reason to stay.
        if (receiptPath) await supabase.storage.from(MKT_BUCKET).remove([receiptPath]);
        throw error;
      }
      return data as unknown as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-topups"] });
    },
  });
}

export function useCancelAdCreditTopup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (topupId: string) => {
      const { error } = await supabase.rpc("mkt_ad_credit_topup_cancel", { _topup_id: topupId });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-topups"] });
    },
  });
}

/* ── platform admin ───────────────────────────────────────────────────────── */

export function useAdminAdCreditTopups(enabled: boolean, status: TopupStatus | "all" = "pending") {
  return useQuery({
    queryKey: ["mkt", "admin", "ad-credit-topups", status],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AdCreditTopup[]> => {
      let query = supabase
        .from("mkt_ad_credit_topups")
        .select(TOPUP_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AdCreditTopup[];
    },
  });
}

export function useReviewAdCreditTopup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      topupId,
      approve,
      rejectReason,
      paymentRef,
      creditsOverride,
    }: {
      topupId: string;
      approve: boolean;
      rejectReason?: string | null;
      paymentRef?: string | null;
      creditsOverride?: number | null;
    }) => {
      const { data, error } = await supabase.rpc("mkt_ad_credit_topup_review", {
        _topup_id: topupId,
        _approve: approve,
        ...(rejectReason ? { _reject_reason: rejectReason } : {}),
        ...(paymentRef ? { _payment_ref: paymentRef } : {}),
        ...(creditsOverride != null ? { _credits_override: creditsOverride } : {}),
      });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-topups"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "ad-credit-entries"] });
    },
  });
}

/** Short-lived link to a receipt; readable by authorised staff only. */
export async function receiptSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MKT_BUCKET).createSignedUrl(path, 120);
  if (error) return null;
  return data?.signedUrl ?? null;
}
