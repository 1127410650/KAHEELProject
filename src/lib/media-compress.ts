/**
 * ضغط الصور في المتصفح قبل الرفع.
 *
 * القاعدة المعتمدة لفتحات المظهر: أطول ضلع ١٦٠٠ بكسل، الصيغة WebP، والحجم
 * النهائي ≤ ٣٠٠ كيلوبايت. الضغط يجري على جهاز المسؤول فقط — لا خدمة خارجية
 * ولا معالجة خادمية — لذا لا يخرج الملف الأصلي من الجهاز إلا مضغوطًا.
 */

export const MEDIA_MAX_SIDE = 1600;
export const MEDIA_MAX_BYTES = 300 * 1024;

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      element.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight, draw: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/webp", quality));
}

/**
 * يعيد ملف WebP جاهزًا للرفع. يخفض الجودة تدريجيًا ثم يصغّر الأبعاد إن لزم،
 * حتى ينزل الحجم تحت السقف. إن تعذّر الضغط (متصفح قديم) يُرفض الرفع بخطأ واضح
 * بدل رفع ملف ضخم.
 */
export async function compressToWebp(
  file: File,
  options?: { maxSide?: number; maxBytes?: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxBytes = options?.maxBytes ?? MEDIA_MAX_BYTES;
  let maxSide = options?.maxSide ?? MEDIA_MAX_SIDE;

  const source = await loadBitmap(file);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    context.drawImage(source.draw, 0, 0, width, height);

    for (const quality of [0.86, 0.78, 0.7, 0.6, 0.5]) {
      const blob = await toBlob(canvas, quality);
      if (!blob) throw new Error("WEBP_UNSUPPORTED");
      if (blob.size <= maxBytes) return { blob, width, height };
    }
    maxSide = Math.round(maxSide * 0.75);
  }

  throw new Error("COMPRESS_TOO_LARGE");
}

/** حجم مقروء بالكيلوبايت — للعرض في بطاقة الفتحة. */
export function readableSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-US")} KB`;
}
