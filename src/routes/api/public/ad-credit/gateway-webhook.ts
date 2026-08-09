/**
 * Card-gateway webhook for ad credit top-ups — inactive until keys exist.
 *
 * Placed under `/api/public/` because the provider calls it without a session.
 * It therefore trusts nothing: the request is rejected unless the signature
 * over the raw body verifies against `STRIPE_WEBHOOK_SECRET`. Only then is the
 * matching `mkt_ad_credit_topups` claim settled through
 * `mkt_ad_credit_topup_review`, which is the same function the human review
 * queue uses — the webhook has no private path to a wallet balance.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

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

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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

        if (event.type !== "checkout.session.completed") {
          // Anything else is acknowledged and ignored, so the provider stops retrying.
          return new Response("ignored", { status: 200 });
        }

        const session = event.data?.object ?? {};
        const metadata = (session["metadata"] ?? {}) as Record<string, unknown>;
        const topupId = typeof metadata["topup_id"] === "string" ? metadata["topup_id"] : null;
        if (!topupId || !/^[0-9a-f-]{36}$/i.test(topupId)) {
          return new Response("missing topup reference", { status: 400 });
        }

        const paymentId =
          typeof session["payment_intent"] === "string" ? session["payment_intent"] : topupId;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("mkt_ad_credit_topup_review", {
          _topup_id: topupId,
          _approve: true,
          _payment_ref: paymentId,
        });
        if (error) {
          console.error(`ad-credit gateway settle failed [${topupId}]: ${error.message}`);
          return new Response("settle failed", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
