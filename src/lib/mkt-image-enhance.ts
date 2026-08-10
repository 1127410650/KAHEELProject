/**
 * تحسين الصور («النصاعة») — المسار الافتراضي محلي بالكامل في المتصفح:
 * تكبير إلى المقاس الهدف، إزالة ضجيج خفيفة، إبراز حدود (Unsharp)، ثم إعادة
 * ضغط WebP بحد أقصى 300 كيلوبايت. لا مفتاح خارجي ولا تكلفة لهذا المسار.
 *
 * حين تُطلب جودة تكبير أعلى (صور صغيرة جدًا أو تنظيف خلفية) يُستخدم مزوّد
 * خارجي عبر دالة خادم فقط — المفتاح لا يصل إلى المتصفح إطلاقًا. وكل عملية
 * تُسجَّل في `mkt_ai_image_jobs` مع السقف الشهري لقدرة «التحسين».
 */
import { supabase } from "@/integrations/supabase/client";

export const ENHANCE_MAX_BYTES = 300 * 1024;

export interface EnhanceOptions {
  /** أصغر عرض مطلوب للنتيجة (يُكبَّر إليه إن كانت الصورة أصغر). */
  targetWidth?: number;
  /** شدة إبراز الحدود بين 0 و 1. */
  sharpen?: number;
}

export interface EnhancedImage {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  scaled: number;
}

/** نواة 3×3 لإبراز الحدود مع تهدئة الضجيج، بشدّة قابلة للضبط. */
function sharpenPixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
) {
  if (amount <= 0) return;
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = source.data;
  const dst = output.data;
  const center = 1 + 4 * amount;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const at = (dx: number, dy: number) => {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          return src[(ny * width + nx) * 4 + channel] ?? 0;
        };
        const value = center * at(0, 0) - amount * (at(-1, 0) + at(1, 0) + at(0, -1) + at(0, 1));
        dst[index + channel] = Math.min(255, Math.max(0, value));
      }
      dst[index + 3] = src[index + 3] ?? 255;
    }
  }
  ctx.putImageData(output, 0, 0);
}

async function encodeWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  let last: Blob | null = null;
  for (const quality of [0.9, 0.82, 0.72, 0.62, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob) {
      last = blob;
      if (blob.size <= ENHANCE_MAX_BYTES) return blob;
    }
  }
  if (last) return last;
  throw new Error("ENCODE_FAILED");
}

/** المسار المحلي: تكبير + تهدئة + إبراز + إعادة ضغط WebP. */
export async function enhanceImageLocally(
  input: Blob,
  options: EnhanceOptions = {},
): Promise<EnhancedImage> {
  const targetWidth = Math.min(Math.max(options.targetWidth ?? 1536, 320), 2560);
  const sharpen = Math.min(Math.max(options.sharpen ?? 0.35, 0), 1);

  const bitmap = await createImageBitmap(input);
  const scale = Math.min(3, Math.max(1, targetWidth / bitmap.width));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // الضجيج يظهر أكثر بعد التكبير، فيُهدَّأ قبل إبراز الحدود.
  if (scale > 1.2) {
    ctx.filter = "blur(0.4px)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }
  if (width * height <= 4_200_000) sharpenPixels(ctx, width, height, sharpen);

  const blob = await encodeWebp(canvas);
  return { blob, width, height, bytes: blob.size, scaled: Number(scale.toFixed(2)) };
}

/** حجز عملية تحسين + إغلاقها في السجل (يفرض دور مسؤول المنصة والسقف الشهري). */
export async function withEnhanceAudit<T>(
  input: { provider: string; purpose?: string; slotKey?: string; unitUsd?: number },
  run: () => Promise<{ result: T; bytes: number }>,
): Promise<{ result: T; jobId: string | null }> {
  const { data, error } = await supabase.rpc("mkt_ai_enhance_claim", {
    _provider: input.provider,
    ...(input.purpose ? { _purpose: input.purpose } : {}),
    ...(input.slotKey ? { _slot_key: input.slotKey } : {}),
    _unit_usd: input.unitUsd ?? 0,
  });
  if (error) throw error;
  const jobId = ((data ?? {}) as { job_id?: string }).job_id ?? null;

  try {
    const { result, bytes } = await run();
    if (jobId) {
      await supabase.rpc("mkt_ai_image_finish", {
        _job_id: jobId,
        _status: "generated",
        _bytes: bytes,
      });
    }
    return { result, jobId };
  } catch (cause) {
    if (jobId) {
      await supabase.rpc("mkt_ai_image_finish", {
        _job_id: jobId,
        _status: "failed",
        _bytes: 0,
        _detail: cause instanceof Error ? cause.message.slice(0, 400) : "enhance_failed",
      });
    }
    throw cause;
  }
}

export function enhanceErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("monthly_budget_reached")) return "admin.gm.ai.capReached";
  if (message.includes("daily_limit_reached")) return "admin.gm.ai.dailyReached";
  if (message.includes("not_authorized")) return "admin.gm.ai.notAllowed";
  return "admin.gm.ai.failed";
}
