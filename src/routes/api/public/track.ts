/**
 * نقطة استقبال أحداث التتبع — تستدعيها صفحات الموقع فقط عبر `src/lib/track.ts`.
 *
 * تحت `/api/public/*` لأنها تُستدعى بـ `sendBeacon` بلا جلسة، فالحماية داخل
 * المعالج نفسه:
 *  - تحقق صريح بـ Zod، وحد ٢٠ حدثًا للدفعة و٣٢ كيلوبايت للجسم.
 *  - حد معدّل بسيط لكل مفتاح جلسة (أفضل جهد في نطاق العملية الواحدة).
 *  - منع التكرار: `event_id` مفتاح فريد في جدول الأحداث، فإعادة الإرسال لا تُضاعف.
 *  - لا تُعيد أي بيانات: الرد 204 دائمًا، فلا سطح قراءة عام هنا.
 *  - لا IP ولا User-Agent يُخزَّن (§24).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const EventSchema = z.object({
  event_id: z.string().uuid().optional(),
  occurred_at: z.string().datetime().optional(),
  name: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-z0-9_.]+$/),
  surface: z.string().max(40).optional(),
  route_path: z.string().max(200).optional(),
  entity_kind: z.string().max(40).optional(),
  entity_id: z.string().uuid().optional(),
  session_key: z.string().max(64).optional(),
  device: z.string().max(12).optional(),
  referrer_host: z.string().max(120).optional(),
  props: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean()])).optional(),
});

const BodySchema = z.object({
  events: z.array(EventSchema).min(1).max(20),
  is_test: z.boolean().optional(),
});

const MAX_BODY_BYTES = 32_768;

/**
 * حد معدّل تشغيلي بسيط: ٦٠ دفعة لكل مفتاح جلسة في الدقيقة. المنصة لا تملك
 * أداة حدّ معدّل مركزية بعد، وهذا حدّ أفضل-جهد في العملية الواحدة يمنع
 * الضجيج العابر لا الإساءة الموزّعة.
 */
const WINDOW_MS = 60_000;
const MAX_BATCHES = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  row.count += 1;
  return row.count > MAX_BATCHES;
}

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(JSON.parse(raw));
        } catch {
          return new Response(null, { status: 204 });
        }

        const key = parsed.events[0]?.session_key ?? "anon";
        if (rateLimited(key)) return new Response(null, { status: 429 });

        const url = process.env["SUPABASE_URL"];
        const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !publishable) return new Response(null, { status: 204 });

        const supabase = createClient(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (publishable.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishable}`)
                headers.delete("Authorization");
              headers.set("apikey", publishable);
              // تمرير جلسة الزائر إن وُجدت، ليُسجَّل الفاعل داخل الدالة.
              const auth = request.headers.get("authorization");
              if (auth) headers.set("Authorization", auth);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { error } = await supabase.rpc("mkt_analytics_ingest", {
          _events: parsed.events,
          _is_test: parsed.is_test === true,
        } as never);
        if (error) console.error("track ingest failed", error.message);

        return new Response(null, { status: 204 });
      },
    },
  },
});
