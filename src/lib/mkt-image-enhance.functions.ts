/**
 * تكبير خارجي عالي الجودة (اختياري) — يعمل فقط إذا أضاف المالك المفتاح في
 * إعدادات المشروع → الأسرار باسم `IMAGE_ENHANCE_API_KEY` (Replicate).
 *
 * المفتاح يُقرأ داخل المُعالِج ولا يصل إلى المتصفح. إذا لم يوجد المفتاح تُعاد
 * `missing_key` وتكمل الواجهة بالمسار المحلي دون أي خطأ للمستخدم. الحوكمة
 * المالية (السقف الشهري والسجل) تُطبَّق في المتصفح عبر `mkt_ai_enhance_claim`
 * قبل النداء، والتحقق من دور مسؤول المنصة يجري في نفس الدالة داخل القاعدة.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL_VERSION = "nightmareai/real-esrgan";

export interface ExternalUpscaleResult {
  ok: boolean;
  /** صورة النتيجة كـ base64 بدون بادئة data:. */
  b64?: string | undefined;
  mime?: string | undefined;
  reason?: "missing_key" | "not_authorized" | "provider_error" | undefined;
  detail?: string | undefined;
}

export const upscaleImageExternally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { b64: string; mime?: string; scale?: number }) => {
    const b64 = String(data.b64 ?? "");
    if (b64.length < 64 || b64.length > 12_000_000) throw new Error("invalid_image");
    return {
      b64,
      mime: data.mime === "image/png" ? "image/png" : "image/webp",
      scale: data.scale === 4 ? 4 : 2,
    };
  })
  .handler(async ({ data, context }): Promise<ExternalUpscaleResult> => {
    const key = process.env["IMAGE_ENHANCE_API_KEY"];
    if (!key) return { ok: false, reason: "missing_key" };

    const { data: isAdmin } = await context.supabase.rpc("mkt_is_platform_admin");
    if (!isAdmin) return { ok: false, reason: "not_authorized" };

    try {
      const created = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          model: MODEL_VERSION,
          input: {
            image: `data:${data.mime};base64,${data.b64}`,
            scale: data.scale,
            face_enhance: false,
          },
        }),
      });

      if (!created.ok) {
        return { ok: false, reason: "provider_error", detail: String(created.status) };
      }

      const payload = (await created.json()) as { output?: string | string[] };
      const url = Array.isArray(payload.output) ? payload.output[0] : payload.output;
      if (!url) return { ok: false, reason: "provider_error", detail: "no_output" };

      const image = await fetch(url);
      if (!image.ok) return { ok: false, reason: "provider_error", detail: "download_failed" };
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);

      return {
        ok: true,
        b64: btoa(binary),
        mime: image.headers.get("content-type") ?? "image/png",
      };
    } catch (cause) {
      return {
        ok: false,
        reason: "provider_error",
        detail: cause instanceof Error ? cause.message.slice(0, 200) : "unknown",
      };
    }
  });
