/**
 * Local invoice scanning helpers — QR detection, PDF handling, UBL XML and OCR.
 * Everything runs in the browser. No paid API, no per-scan cost.
 */

export const MAX_SCAN_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
export const ALLOWED_SCAN_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export type ExtractionMethod = "xml" | "pdf-text" | "ocr" | "manual" | "qr";

export interface PrintedInvoice {
  method: ExtractionMethod;
  confidence: number;
  sellerName?: string;
  vatNumber?: string;
  buyerName?: string;
  buyerVatNumber?: string;
  invoiceNo?: string;
  uuid?: string;
  invoiceTypeCode?: string;
  timestamp?: string;
  currency?: string;
  netTotal?: string;
  discount?: string;
  vatTotal?: string;
  total?: string;
  paymentMeans?: string;
  reference?: string;
  lineItems: InvoiceLineItem[];
  rawText?: string;
}

export interface InvoiceLineItem {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  taxRate?: string;
  taxAmount?: string;
  discount?: string;
  netAmount?: string;
  grossAmount?: string;
  sku?: string;
}

/* --------------------------------------------------------------- file guards */

export function validateScanFile(file: File): "OK" | "SIZE" | "TYPE" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const okExt = ["pdf", "jpg", "jpeg", "png", "webp", "heic"].includes(ext);
  const okMime = !file.type || ALLOWED_SCAN_MIME.includes(file.type);
  if (!okExt || !okMime) return "TYPE";
  if (file.size > MAX_SCAN_FILE_SIZE) return "SIZE";
  return "OK";
}

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof data === "string" ? new TextEncoder().encode(data).buffer as ArrayBuffer : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------ QR from canvas */

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

let nativeDetector: Detector | null | undefined;

async function getNativeDetector(): Promise<Detector | null> {
  if (nativeDetector !== undefined) return nativeDetector;
  const ctor = (globalThis as unknown as { BarcodeDetector?: new (o: unknown) => Detector })
    .BarcodeDetector;
  if (!ctor) {
    nativeDetector = null;
    return null;
  }
  try {
    nativeDetector = new ctor({ formats: ["qr_code"] });
  } catch {
    nativeDetector = null;
  }
  return nativeDetector;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return { canvas, ctx };
}

function enhance(data: ImageData, mode: "gray" | "contrast"): ImageData {
  const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    const value = mode === "gray" ? lum : lum > 128 ? 255 : 0;
    px[i] = value;
    px[i + 1] = value;
    px[i + 2] = value;
  }
  return out;
}

async function jsqrScan(data: ImageData): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const result = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
  return result?.data ?? null;
}

/** Scans a full canvas, then tiles, then rotations. Returns the raw QR string. */
export async function scanCanvasForQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const detector = await getNativeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(canvas);
      if (codes.length > 0 && codes[0]!.rawValue) return codes[0]!.rawValue;
    } catch {
      /* fall through to jsQR */
    }
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const full = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (const variant of [full, enhance(full, "gray"), enhance(full, "contrast")]) {
    const found = await jsqrScan(variant);
    if (found) return found;
  }

  // tiled search: QR is often in a corner of a full-page scan
  const cols = 3;
  const rows = 3;
  const tileW = Math.floor(canvas.width / cols);
  const tileH = Math.floor(canvas.height / rows);
  if (tileW > 60 && tileH > 60) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const tile = ctx.getImageData(c * tileW, r * tileH, tileW, tileH);
        const found = (await jsqrScan(tile)) ?? (await jsqrScan(enhance(tile, "contrast")));
        if (found) return found;
      }
    }
  }

  // rotations
  for (const angle of [90, 180, 270]) {
    const swap = angle % 180 !== 0;
    const { canvas: rot, ctx: rctx } = makeCanvas(
      swap ? canvas.height : canvas.width,
      swap ? canvas.width : canvas.height,
    );
    if (!rctx) continue;
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate((angle * Math.PI) / 180);
    rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    const data = rctx.getImageData(0, 0, rot.width, rot.height);
    const found = await jsqrScan(data);
    if (found) return found;
  }

  return null;
}

async function fileToCanvas(file: File | Blob, maxSide = 2200): Promise<HTMLCanvasElement | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const { canvas, ctx } = makeCanvas(width, height);
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas;
}

export async function scanImageFileForQr(file: File | Blob): Promise<string | null> {
  const canvas = await fileToCanvas(file);
  if (!canvas) return null;
  return scanCanvasForQr(canvas);
}

export async function scanVideoFrameForQr(video: HTMLVideoElement): Promise<string | null> {
  if (!video.videoWidth) return null;
  const { canvas, ctx } = makeCanvas(video.videoWidth, video.videoHeight);
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  const detector = await getNativeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(canvas);
      if (codes.length > 0 && codes[0]!.rawValue) return codes[0]!.rawValue;
    } catch {
      /* ignore */
    }
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return (await jsqrScan(data)) ?? (await jsqrScan(enhance(data, "contrast")));
}

/* ------------------------------------------------------------------ OCR (local) */

export async function ocrImage(
  file: File | Blob,
  locale: "ar" | "en",
): Promise<{ text: string; confidence: number }> {
  const { default: Tesseract } = await import("tesseract.js");
  const langs = locale === "ar" ? "ara+eng" : "eng+ara";
  const result = await Tesseract.recognize(file, langs);
  return { text: result.data.text ?? "", confidence: (result.data.confidence ?? 0) / 100 };
}
