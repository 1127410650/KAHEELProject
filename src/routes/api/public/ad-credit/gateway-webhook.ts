/**
 * Card-gateway webhook for ad credit top-ups.
 *
 * Placed under `/api/public/` because the provider calls it without a session,
 * so it trusts nothing: the request is rejected unless the signature over the
 * *raw* body verifies against `STRIPE_WEBHOOK_SECRET`, within a replay window.
 *
 * This is the only place a card payment moves a balance. It never calls the
 * human review function; it calls the card-specific settle/fail/refund
 * functions, which are granted to `service_role` alone and are idempotent — the
 * provider retries deliveries, and duplicates must not credit twice.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/** Reject stale signatures; Stripe's own tolerance is five minutes. */
const TOLERANCE_SECONDS = 300;

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  // Stripe sends `t=<ts>,v1=<hex>`; the signed payload is `<ts>.<body>`.
  const parts = new Map(
    header.split(",").map((piece) => {
      const [k, v] = piece.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""] as const;
    }),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function str(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Minor units back to a decimal amount, matching the currency's exponent. */
const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "isk"]);
function majorUnits(minor: unknown, currency: string | null): number | null {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return null;
  return ZERO_DECIMAL.has((currency ?? "").toLowerCase()) ? minor : minor / 100;
}

export const Route = createFileRoute("/api/public/ad-credit/gateway-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) {
          // Not configured: refuse rather than accept unverifiable money events.
          return new Response("gateway disabled", { status: 503 });
        }

        const rawBody = await request.text();
        if (!verify(rawBody, request.headers.get("stripe-signature"), secret)) {
          return new Response("invalid signature", { status: 401 });
        }

        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(rawBody) as typeof event;
        } catch {
          return new Response("invalid payload", { status: 400 });
        }

        const object = event.data?.object ?? {};
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              const sessionId = str(object, "id");
              if (!sessionId) return new Response("missing session", { status: 400 });
              if (str(object, "payment_status") !== "paid") {
                // Authorised but unpaid (e.g. delayed method) — wait for the
                // succeeded/failed event rather than crediting now.
                return new Response("not paid yet", { status: 200 });
              }
              const currency = str(object, "currency");
              const { error } = await supabaseAdmin.rpc("mkt_ad_credit_topup_card_settle", {
                _session_id: sessionId,
                _payment_id: str(object, "payment_intent") ?? sessionId,
                ...(majorUnits(object["amount_total"], currency) != null
                  ? { _amount: majorUnits(object["amount_total"], currency) as number }
                  : {}),
                ...(currency ? { _currency: currency.toUpperCase() } : {}),
              });
              if (error) throw new Error(error.message);
              return new Response("ok", { status: 200 });
            }

            case "checkout.session.expired": {
              const sessionId = str(object, "id");
              if (!sessionId) return new Response("missing session", { status: 400 });
              await supabaseAdmin.rpc("mkt_ad_credit_topup_card_fail", {
                _session_id: sessionId,
                _status: "expired",
              });
              return new Response("ok", { status: 200 });
            }

            case "checkout.session.async_payment_failed": {
              const sessionId = str(object, "id");
              if (!sessionId) return new Response("missing session", { status: 400 });
              await supabaseAdmin.rpc("mkt_ad_credit_topup_card_fail", {
                _session_id: sessionId,
                _status: "failed",
                _reason: "payment_failed",
              });
              return new Response("ok", { status: 200 });
            }

            case "charge.refunded":
            case "charge.dispute.closed":
            case "charge.dispute.created": {
              // Refunds and disputes are keyed by payment intent, which is what
              // the settle step stored on the claim.
              const paymentId = str(object, "payment_intent");
              if (!paymentId) return new Response("missing payment", { status: 200 });
              if (
                event.type === "charge.dispute.closed" &&
                str(object, "status") === "won"
              ) {
                // The platform kept the money; the credit stays.
                return new Response("ignored", { status: 200 });
              }
              const { error } = await supabaseAdmin.rpc("mkt_ad_credit_topup_card_refund", {
                _payment_id: paymentId,
                _reason: event.type === "charge.refunded" ? "refund" : "dispute",
              });
              if (error) throw new Error(error.message);
              return new Response("ok", { status: 200 });
            }

            default:
              // Acknowledged and ignored, so the provider stops retrying.
              return new Response("ignored", { status: 200 });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`ad-credit webhook ${event.type ?? "unknown"} failed: ${message}`);
          // 500 asks the provider to retry; the settle path is idempotent.
          return new Response("handler failed", { status: 500 });
        }
      },
    },
  },
});
