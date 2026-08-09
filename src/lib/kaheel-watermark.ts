/**
 * العلامة المائية وحقوق كَحيل — الدالة الموحّدة `applyKaheelWatermark`.
 *
 * ── أين تُستدعى (مسار واحد لكل نوع أصل، فلا يُنسى مكان) ──────────────────────
 *  1. `uploadCampaignAsset` في `src/lib/mkt-campaigns.ts`
 *     → يغطّي: أصول الحملات والبانرات (`/admin/campaigns`)، مكتبة الخلفيات
 *       (`BackdropLibraryCard`)، الخلفيات الموسمية (`SeasonalBackdropsCard`)،
 *       وصور الاستوديو المولّدة بعد اعتمادها (`approveAiAsset`).
 *  2. `toCampaignWebp` في `src/lib/mkt-ai-image.ts`
 *     → يغطّي: كل صورة يولّدها استوديو الذكاء الاصطناعي (بانرات، مربعات،
 *       والشخصيات المولّدة) لحظة ظهورها في المعاينة قبل الاعتماد.
 *  3. `uploadStoryImage` في `src/lib/mkt-stories.ts`
 *     → يغطّي: صور الستوريات التي تنشرها المنصة.
 *
 * ── أين لا تُستدعى عن قصد ───────────────────────────────────────────────────
 *  • صور المستخدمين والمتاجر والإعلانات المرفوعة (`mkt-listing-media`،
 *    `mkt-store*`، الصور الشخصية) — ملك أصحابها، ولا نضع حقوقنا على ملك غيرنا.
 *  • صور جهات دليل سوريا وأي أصل مستورد من سجلات أو مصادر خارجية.
 *  • شعار المنصة وأيقوناتها، وسبرايتات الواجهة الصغيرة (الشخصيات المدمجة في
 *    الواجهة) — عنصر واجهة لا أصل قابل للنشر، والعلامة عليه تشوّه الشاشة؛
 *    تكتفي هذه بحقول الحقوق في البيانات الوصفية عند التصدير.
 *  • الفيديو (mp4) وملفات Lottie — ليست صورًا نقطية.
 */
import { supabase } from "@/integrations/supabase/client";
import { embedKaheelCopyright, KAHEEL_COPYRIGHT } from "@/lib/kaheel-image-metadata";

export type WatermarkPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";

export interface WatermarkConfig {
  enabled: boolean;
  position: WatermarkPosition;
  /** شفافية النص ٢٠–٩٠٪. */
  opacity: number;
  /** حجم الخط كنسبة من أصغر بُعد في الصورة (١–٨٪). */
  sizePct: number;
  text: string;
  url: string;
}

export const WATERMARK_SETTING_KEY = "assets.watermark";

export const WATERMARK_DEFAULTS: WatermarkConfig = {
  enabled: true,
  position: "bottom-left",
  opacity: 50,
  sizePct: 3.2,
  text: "كَحيل · KAHEEL",
  url: "kaheel.market",
};

export const WATERMARK_POSITIONS: { key: WatermarkPosition; ar: string; en: string }[] = [
  { key: "bottom-left", ar: "أسفل اليسار", en: "Bottom left" },
  { key: "bottom-right", ar: "أسفل اليمين", en: "Bottom right" },
  { key: "top-left", ar: "أعلى اليسار", en: "Top left" },
  { key: "top-right", ar: "أعلى اليمين", en: "Top right" },
];

/** لا نثق بقيم قادمة من جدول الإعدادات: نحصرها في مجالات آمنة. */
export function normalizeWatermarkConfig(raw: unknown): WatermarkConfig {
  const value = (raw ?? {}) as Partial<Record<keyof WatermarkConfig, unknown>>;
  const position = WATERMARK_POSITIONS.some((item) => item.key === value.position)
    ? (value.position as WatermarkPosition)
    : WATERMARK_DEFAULTS.position;
  const opacity = Number(value.opacity);
  const sizePct = Number(value.sizePct);
  const text = String(value.text ?? "").trim();
  const url = String(value.url ?? "").trim();
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : WATERMARK_DEFAULTS.enabled,
    position,
    opacity: Number.isFinite(opacity) ? Math.min(90, Math.max(20, Math.round(opacity))) : WATERMARK_DEFAULTS.opacity,
    sizePct: Number.isFinite(sizePct) ? Math.min(8, Math.max(1, sizePct)) : WATERMARK_DEFAULTS.sizePct,
    text: text ? text.slice(0, 60) : WATERMARK_DEFAULTS.text,
    url: url ? url.slice(0, 60) : WATERMARK_DEFAULTS.url,
  };
}

export function watermarkLabel(config: WatermarkConfig): string {
  return [config.text, config.url].filter(Boolean).join(" · ");
}

let cached: { at: number; config: WatermarkConfig } | null = null;

/** إعدادات العلامة من جدول الإعدادات، مع كاش دقيقة واحدة وسقوط آمن للافتراضي. */
export async function loadWatermarkConfig(force = false): Promise<WatermarkConfig> {
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.config;
  try {
    const { data } = await supabase
      .from("mkt_platform_settings")
      .select("value")
      .eq("key", WATERMARK_SETTING_KEY)
      .maybeSingle();
    const config = normalizeWatermarkConfig((data as { value?: unknown } | null)?.value);
    cached = { at: Date.now(), config };
    return config;
  } catch {
    return WATERMARK_DEFAULTS;
  }
}

export function clearWatermarkCache(): void {
  cached = null;
}

const RASTER = new Set(["image/png", "image/webp", "image/jpeg", "image/jpg"]);

function isRaster(blob: Blob): boolean {
  return RASTER.has((blob.type || "").toLowerCase());
}

/** يرسم شريط الحقوق على سياق موجود — تُستخدم للمعاينة أيضًا. */
export function drawKaheelWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
): void {
  const label = watermarkLabel(config);
  const minSide = Math.min(width, height);
  const fontSize = Math.max(10, Math.round((minSide * config.sizePct) / 100));
  const pad = Math.round(minSide * 0.025) + Math.round(fontSize * 0.2);

  ctx.save();
  ctx.direction = "rtl";
  ctx.font = `700 ${fontSize}px "Segoe UI", "Noto Sans Arabic", system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = config.opacity / 100;
  const top = config.position.startsWith("top");
  const left = config.position.endsWith("left");
  ctx.textAlign = left ? "left" : "right";
  const x = left ? pad : width - pad;
  const y = top ? pad + fontSize : height - pad;

  // ظل رقيق يجعل النص مقروءًا على الفاتح والغامق بلا صندوق يحجب الصورة.
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.35));
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x, y);
  ctx.restore();
}

async function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((out) => resolve(out), type, quality));
}

export interface WatermarkOptions {
  /** تخطٍ صريح (أصل ليس ملك المنصة). */
  skip?: boolean;
  config?: WatermarkConfig;
}

/**
 * الدالة الموحّدة: تُعيد نسخة من الصورة عليها علامة كَحيل المائية + حقوق كَحيل
 * في بياناتها الوصفية. تحافظ على الصيغة والأبعاد والشفافية، وتلتزم بسقف زيادة
 * ٥٪ في الحجم للصيغ المضغوطة. أي مدخل غير صورة نقطية يُعاد كما هو.
 */
export async function applyKaheelWatermark(
  input: Blob,
  options: WatermarkOptions = {},
): Promise<Blob> {
  if (options.skip) return input;
  if (typeof document === "undefined" || !isRaster(input)) return input;

  const config = options.config ?? (await loadWatermarkConfig());
  if (!config.enabled) return input;

  const type = input.type.toLowerCase() === "image/jpg" ? "image/jpeg" : input.type.toLowerCase();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input);
  } catch {
    return input;
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return input;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  drawKaheelWatermark(ctx, canvas.width, canvas.height, config);

  const ceiling = Math.round(input.size * 1.05);
  let marked: Blob | null = null;
  if (type === "image/png") {
    marked = await encode(canvas, "image/png");
  } else {
    for (const quality of [0.92, 0.86, 0.8, 0.72, 0.64]) {
      marked = await encode(canvas, type, quality);
      if (marked && marked.size <= ceiling) break;
    }
  }
  if (!marked) return input;

  const stamped = await embedKaheelCopyright(marked, KAHEEL_COPYRIGHT);
  // لو تجاوزت النسخة الموسومة سقف ٥٪ (يحدث مع PNG المضغوط مسبقًا) نُبقي الأصل
  // بدل تضخيم الأصل — الحقوق تبقى في البيانات الوصفية.
  if (stamped.size > ceiling) {
    const fallback = await embedKaheelCopyright(input, KAHEEL_COPYRIGHT);
    return fallback.size <= ceiling ? fallback : input;
  }
  return stamped;
}
