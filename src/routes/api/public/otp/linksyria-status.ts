/**
 * Webhook حالة التسليم من LinkSyria.
 *
 * يتحقق من التوقيع (HMAC-SHA256 على النص الخام بمفتاح `LINKSYRIA_WEBHOOK_SECRET`)
 * قبل أي كتابة، ثم يحدّث حالة الإرسال في `mkt_otp_sends` بمعرّف رسالة المزوّد.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const payloadSchema = z.object({
  message_id: z.string().min(1).max(200),
  status: z.enum(["queued", "sent", "delivered", "failed", "undelivered", "expired"]),
  error_code: z.string().max(80).nullish(),
  cost: z.coerce.number().min(0).max(1_000_000).nullish(),
});

function verify(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = Buffer.from(signature.replace(/^sha256=/, ""));
  const exp = Buffer.from(expected);
  return got.length === exp.length && timingSafeEqual(got, exp);
}

export const Route = createFileRoute("/api/public/otp/linksyria-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LINKSYRIA_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const signature =
          request.headers.get("x-linksyria-signature") ?? request.headers.get("x-signature");
        if (!verify(raw, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const update = {
          status: parsed.status,
          error_code: parsed.error_code ?? null,
          updated_at: new Date().toISOString(),
          ...(typeof parsed.cost === "number" ? { cost_amount: parsed.cost } : {}),
        };

        const { error } = await supabaseAdmin
          .from("mkt_otp_sends")
          .update(update)
          .eq("provider", "linksyria")
          .eq("provider_message_id", parsed.message_id);
        if (error) return new Response("Update failed", { status: 500 });

        return new Response("ok");
      },
    },
  },
});
