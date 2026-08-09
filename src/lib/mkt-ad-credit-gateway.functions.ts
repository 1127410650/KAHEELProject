/**
 * Card-gateway path for ad credit — live, and deliberately narrow.
 *
 * The browser asks for a credit pack; it never states a price. The pack price
 * comes from `mkt_platform_settings` key `ad_credit.card_gateway` inside
 * `mkt_ad_credit_topup_card_start`, so a tampered client can at most pick a
 * different published pack.
 *
 * Nothing here credits a wallet. A checkout session only *claims* a row in
 * `mkt_ad_credit_topups`; the balance moves in
 * `mkt_ad_credit_topup_card_settle`, called exclusively from the
 * signature-verified webhook. The success page is a courtesy, never proof of
 * payment.
 *
 * Requires the project secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`,
 * plus `{"enabled": true}` on that settings key. While either is missing the
 * call answers `not_configured` / `gateway_disabled` and the UI hides the card
 * option instead of promising a payment the backend would refuse.
 *
 * Note for the Syrian market: Stripe serves neither Syrian sellers nor Syrian
 * cards, so this path is for a non-Syrian (Saudi) selling entity collecting
 * from outside Syria. Sham Cash remains the primary method.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdCreditCheckoutReason =
  | "gateway_disabled"
  | "not_configured"
  | "unknown_pack"
  | "pending_topup_exists"
  | "provider_error";

export interface AdCreditCheckoutResult {
  ok: boolean;
  /** Present only when `ok` — the provider-hosted payment page. */
  url?: string;
  topupId?: string;
  reason?: AdCreditCheckoutReason;
  /** Provider/database message, kept short and non-sensitive, for support. */
  detail?: string;
}

/** Zero-decimal currencies take the amount as-is; the rest use minor units. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

function minorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

function originOf(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

function mapDbReason(message: string): AdCreditCheckoutReason {
  if (message.includes("gateway_disabled")) return "gateway_disabled";
  if (message.includes("unknown_pack") || message.includes("invalid_pack_price")) {
    return "unknown_pack";
  }
  if (message.includes("pending_topup_exists")) return "pending_topup_exists";
  return "provider_error";
}

export const createAdCreditCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { credits: number; tenantId?: string | null }) => {
    if (!Number.isInteger(data.credits) || data.credits <= 0 || data.credits > 1_000_000) {
      throw new Error("invalid_credits");
    }
    if (data.tenantId != null && !/^[0-9a-f-]{36}$/i.test(data.tenantId)) {
      throw new Error("invalid_tenant");
    }
    return { credits: data.credits, tenantId: data.tenantId ?? null };
  })
  .handler(async ({ data, context }): Promise<AdCreditCheckoutResult> => {
    const secret = process.env["STRIPE_SECRET_KEY"];
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!secret || !webhookSecret) {
      // No keys yet: the honest answer, not a fake session URL. The webhook
      // secret is required too — a payable session with no verifiable callback
      // would take money without ever crediting the wallet.
      return { ok: false, reason: "not_configured" };
    }

    // Price and pack validity are decided in the database, not here.
    const { data: started, error: startErr } = await context.supabase.rpc(
      "mkt_ad_credit_topup_card_start",
      { _credits: data.credits, ...(data.tenantId ? { _tenant_id: data.tenantId } : {}) },
    );
    if (startErr) {
      return { ok: false, reason: mapDbReason(startErr.message), detail: startErr.message };
    }

    const claim = (started ?? {}) as {
      topup_id?: string;
      credits?: number;
      amount?: number | string;
      currency?: string;
    };
    const topupId = claim.topup_id;
    const amount = Number(claim.amount);
    const currency = (claim.currency ?? "SAR").toUpperCase();
    if (!topupId || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: "provider_error", detail: "claim_incomplete" };
    }

    const origin = originOf(getRequest());
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("client_reference_id", topupId);
    body.set("success_url", `${origin}/my/ad-credit?checkout=success`);
    body.set("cancel_url", `${origin}/my/ad-credit?checkout=cancel`);
    body.set("metadata[topup_id]", topupId);
    body.set("metadata[credits]", String(data.credits));
    body.set("metadata[user_id]", context.userId);
    body.set("payment_intent_data[metadata][topup_id]", topupId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", currency.toLowerCase());
    body.set("line_items[0][price_data][unit_amount]", String(minorUnits(amount, currency)));
    body.set(
      "line_items[0][price_data][product_data][name]",
      `Kaheel ad credit · ${data.credits}`,
    );

    let sessionId: string | null = null;
    let sessionUrl: string | null = null;
    try {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
          // Retried calls must not create a second payable session.
          "Idempotency-Key": `adcredit-${topupId}`,
        },
        body: body.toString(),
      });
      const payload = (await response.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.id || !payload.url) {
        console.error(
          `ad-credit checkout create failed [${topupId}]: ${payload.error?.message ?? response.status}`,
        );
        return { ok: false, reason: "provider_error" };
      }
      sessionId = payload.id;
      sessionUrl = payload.url;
    } catch (error) {
      console.error(`ad-credit checkout network error [${topupId}]: ${String(error)}`);
      return { ok: false, reason: "provider_error" };
    }

    // The webhook finds the claim by session id, so this link must exist before
    // the provider can possibly call back.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: attachErr } = await supabaseAdmin.rpc("mkt_ad_credit_topup_card_attach", {
      _topup_id: topupId,
      _session_id: sessionId,
    });
    if (attachErr) {
      console.error(`ad-credit session attach failed [${topupId}]: ${attachErr.message}`);
      return { ok: false, reason: "provider_error" };
    }

    return { ok: true, url: sessionUrl, topupId };
  });
