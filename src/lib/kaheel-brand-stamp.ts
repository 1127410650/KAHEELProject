/**
 * ختم العلامة التلقائي (Brand Stamp) — تركيب اسم كَحيل على أي صورة تُرفع لفتحة.
 *
 * الختم يجري كاملًا في متصفح المدير على `canvas`: لا خدمة خارجية ولا معالجة
 * خادمية، والصورة الأصلية تُحفظ كما هي بجانب النسخة المختومة فتبقى كلتاهما في
 * المكتبة. الخيارات قيم مقيّدة فقط (موضع من قائمة مغلقة، حجم ولون وشفافية من
 * مجالات محدودة) — لا نص حر ولا كود.
 *
 * هذا ختم هوية على أصول المنصة، ولا يُستدعى على صور المستخدمين أو المتاجر أو
 * جهات الدليل (ملك أصحابها) — انظر `src/lib/kaheel-watermark.ts`.
 */

export const BRAND_STAMP_TEXT = "كَحيل · KAHEEL";

export type StampPosition =
  | "corner-tl"
  | "corner-tr"
  | "corner-bl"
  | "corner-br"
  | "bottom-bar";

export const STAMP_POSITIONS: { value: StampPosition; label: string }[] = [
  { value: "corner-br", label: "زاوية أسفل النهاية" },
  { value: "corner-bl", label: "زاوية أسفل البداية" },
  { value: "corner-tr", label: "زاوية أعلى النهاية" },
  { value: "corner-tl", label: "زاوية أعلى البداية" },
  { value: "bottom-bar", label: "شريط سفلي" },
];

export type StampColor = "white" | "primary";

export const STAMP_COLORS: { value: StampColor; label: string; hex: string }[] = [
  { value: "white", label: "أبيض", hex: "#ffffff" },
  { value: "primary", label: "بنفسجي الهوية", hex: "#8a4fff" },
];

export const STAMP_SIZES = [
  { value: "sm", label: "صغير", pct: 2.6 },
  { value: "md", label: "عادي", pct: 3.6 },
  { value: "lg", label: "كبير", pct: 5 },
] as const;

export type StampSize = (typeof STAMP_SIZES)[number]["value"];

export interface BrandStampOptions {
  position: StampPosition;
  size: StampSize;
  color: StampColor;
  /** شفافية ٣٠–١٠٠٪. */
  opacity: number;
  /** خلفية شريط بتدرّج الهوية خلف النص. */
  ribbon: boolean;
}

export const BRAND_STAMP_DEFAULTS: BrandStampOptions = {
  position: "corner-br",
  size: "md",
  color: "white",
  opacity: 90,
  ribbon: true,
};

const GRADIENT_FROM = "#8a4fff";
const GRADIENT_TO = "#c3abff";

function clampOpacity(value: number): number {
  return Math.min(100, Math.max(30, Math.round(value))) / 100;
}

function sizePct(size: StampSize): number {
  return STAMP_SIZES.find((item) => item.value === size)?.pct ?? 3.6;
}

function colorHex(color: StampColor): string {
  return STAMP_COLORS.find((item) => item.value === color)?.hex ?? "#ffffff";
}

/** يرسم الختم على سياق جاهز — تُستخدم أيضًا في المعاينة الحيّة. */
export function drawBrandStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: BrandStampOptions,
): void {
  const minSide = Math.min(width, height);
  const fontSize = Math.max(11, Math.round((minSide * sizePct(options.size)) / 100));
  const pad = Math.round(minSide * 0.03);
  const alpha = clampOpacity(options.opacity);

  ctx.save();
  ctx.direction = "ltr";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif`;
  const label = `\u2066${BRAND_STAMP_TEXT}\u2069`;
  const textWidth = ctx.measureText(label).width;

  if (options.position === "bottom-bar") {
    const barHeight = Math.round(fontSize * 2.1);
    const y = height - barHeight;
    ctx.globalAlpha = alpha;
    if (options.ribbon) {
      const grad = ctx.createLinearGradient(0, y, width, y);
      grad.addColorStop(0, GRADIENT_FROM);
      grad.addColorStop(1, GRADIENT_TO);
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, width, barHeight);
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = colorHex(options.color);
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = Math.round(fontSize * 0.35);
    }
    ctx.textAlign = "center";
    ctx.fillText(label, width / 2, y + barHeight / 2);
    ctx.restore();
    return;
  }

  const top = options.position.startsWith("corner-t");
  const left = options.position.endsWith("l");
  const boxHeight = Math.round(fontSize * 1.9);
  const boxWidth = Math.round(textWidth + fontSize * 1.4);
  const x = left ? pad : width - pad - boxWidth;
  const y = top ? pad : height - pad - boxHeight;

  ctx.globalAlpha = alpha;
  if (options.ribbon) {
    const grad = ctx.createLinearGradient(x, y, x + boxWidth, y);
    grad.addColorStop(0, GRADIENT_FROM);
    grad.addColorStop(1, GRADIENT_TO);
    ctx.fillStyle = grad;
    const radius = Math.round(boxHeight / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
    ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
    ctx.arcTo(x, y + boxHeight, x, y, radius);
    ctx.arcTo(x, y, x + boxWidth, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
  } else {
    ctx.fillStyle = colorHex(options.color);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = Math.round(fontSize * 0.35);
  }
  ctx.textAlign = "center";
  ctx.fillText(label, x + boxWidth / 2, y + boxHeight / 2);
  ctx.restore();
}

/**
 * يعيد نسخة WebP مختومة من الصورة (بنفس الأبعاد). المدخل الأصلي لا يُمَس، فيُحفظ
 * الاثنان في المكتبة. إن تعذّر الختم يُعاد المدخل كما هو بلا إسقاط الرفع.
 */
export async function stampImageBlob(
  input: Blob,
  options: BrandStampOptions = BRAND_STAMP_DEFAULTS,
): Promise<Blob> {
  if (typeof document === "undefined") return input;
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
  drawBrandStamp(ctx, canvas.width, canvas.height, options);

  for (const quality of [0.86, 0.78, 0.7, 0.6]) {
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/webp", quality),
    );
    if (out && out.size <= 300 * 1024) return out;
    if (out && quality === 0.6) return out;
  }
  return input;
}
