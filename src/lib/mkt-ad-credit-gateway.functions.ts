/**
 * Card-gateway path for ad credit — wired end to end, deliberately inactive.
 *
 * Nothing here runs until two things are true:
 *   1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` exist as project
 *      secrets, and
 *   2. `mkt_platform_settings` key `ad_credit.card_gateway` has
 *      `{"enabled": true}`.
 *
 * Until then `createAdCreditCheckout` returns `{ ok: false, reason:
 * "gateway_disabled" }` and the UI keeps the card option hidden. Note for the
 * Syrian market: Stripe does not serve Syrian sellers or buyers, so this path
 * is only meaningful for a non-Syrian (e.g. Saudi) selling entity taking cards
 * from outside Syria. Sham Cash stays the primary method.
 *
 * The gateway never credits a wallet by itself: a successful payment settles
 * the same `mkt_ad_credit_topups` claim the manual flow uses, through the same
 * `mkt_ad_credit_topup_review` function, so the ledger and consumption logic
 * have exactly one shape.
 */
import { createServerFn } from "@tanstack/react-start";

export interface AdCreditCheckoutResult {
  ok: boolean;
  /** Present only when `ok` — the provider-hosted payment page. */
  url?: string;
  reason?: "gateway_disabled" | "not_configured" | "unauthorized";
}

export const createAdCreditCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { credits: number; topupId: string }) => {
    if (!Number.isInteger(data.credits) || data.credits <= 0 || data.credits > 1_000_000) {
      throw new Error("invalid_credits");
    }
    if (!/^[0-9a-f-]{36}$/i.test(data.topupId)) throw new Error("invalid_topup");
    return data;
  })
  .handler(async (): Promise<AdCreditCheckoutResult> => {
    const secret = process.env["STRIPE_SECRET_KEY"];
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!secret || !webhookSecret) {
      // No keys yet: the honest answer, not a fake session URL.
      return { ok: false, reason: "not_configured" };
    }
    // Activation step (left unimplemented on purpose): create the provider
    // checkout session for `credits`, store its id on the claim row
    // (`provider_session_id`) with the service-role client, and return its URL.
    return { ok: false, reason: "gateway_disabled" };
  });
