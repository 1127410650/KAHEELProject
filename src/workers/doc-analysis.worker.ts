/// <reference lib="webworker" />
/**
 * Local document analyzer — runs entirely inside a Web Worker so the UI never freezes.
 * Pipeline: embedded XML -> PDF text layer -> QR/barcode -> local OCR (Tesseract.js).
 * No network calls to any paid service; all libraries are bundled with the app.
 */
import {
  classify,
  detectLanguage,
  extractFields,
  toWesternDigits,
  type AnalyzeResult,
  type DocType,
  type ExtractedField,
  type ExtractionMethod,
  type ProgressStage,
  type QrFinding,
} from "@/lib/doc-analysis";

const MAX_PAGES = 15;
const OCR_MAX_PAGES = 6;
const MIN_TEXT_CHARS = 120;

export interface WorkerRequest {
  bytes: ArrayBuffer;
  mime: string;
  fileName: string;
  /** Quick mode skips OCR and only reads the text layer / QR. */
  quick: boolean;
  /** OCR language preference; both scripts are always loaded. */
  locale: "ar" | "en";
}

export type WorkerResponse =
  | { kind: "progress"; stage: ProgressStage; percent: number; note?: string }
  | { kind: "done"; result: AnalyzeResult }
  | { kind: "error"; message: string; code: string };

const post = (msg: WorkerResponse) => (self as unknown as Worker).postMessage(msg);

function progress(stage: ProgressStage, percent: number, note?: string) {
  post({ kind: "progress", stage, percent, ...(note ? { note } : {}) });
}

/* ------------------------------------------------------------------ helpers */

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as unknown as { default: string }).default;
  return pdfjs;
}

function findEmbeddedXml(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const start = text.search(/<(\w+:)?(Invoice|Deed|Document)[\s>]/);
    if (start === -1) return null;
    const end = /<\/(\w+:)?(Invoice|Deed|Document)>/.exec(text.slice(start));
    if (!end) return null;
    return text.slice(start, start + end.index + end[0].length);
  } catch {
    return null;
  }
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeQr(raw: string): { url: string | null; decoded: Record<string, string> | null } {
  const url = /^https?:\/\//i.test(raw) ? raw.split(/\s/)[0]! : null;
  let decoded: Record<string, string> | null = null;
  if (url) {
    try {
      const parsed = new URL(url);
      const entries = [...parsed.searchParams.entries()];
      if (entries.length) decoded = Object.fromEntries(entries);
    } catch {
      /* keep raw */
    }
  } else if (/[:=]/.test(raw)) {
    const pairs = raw
      .split(/[\n;|]/)
      .map((part) => part.split(/[:=]/))
      .filter((p) => p.length >= 2);
    if (pairs.length)
      decoded = Object.fromEntries(pairs.map((p) => [p[0]!.trim(), p.slice(1).join(":").trim()]));
  }
  return { url, decoded };
}

function toGray(data: ImageData): ImageData {
  const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    px[i] = lum;
    px[i + 1] = lum;
    px[i + 2] = lum;
  }
  return out;
}

async function scanImageDataForQr(data: ImageData): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  for (const variant of [data, toGray(data)]) {
    const hit = jsQR(variant.data, variant.width, variant.height, {
      inversionAttempts: "attemptBoth",
    });
    if (hit?.data) return hit.data;
  }
  return null;
}

async function canvasToBlob(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: "image/png" });
}

async function ocrBlobs(
  blobs: { page: number; blob: Blob }[],
  locale: "ar" | "en",
  onPage: (page: number, index: number) => void,
): Promise<{ page: number; text: string; confidence: number }[]> {
  const { default: Tesseract } = await import("tesseract.js");
  const langs = locale === "ar" ? "ara+eng" : "eng+ara";
  const out: { page: number; text: string; confidence: number }[] = [];
  for (let i = 0; i < blobs.length; i += 1) {
    const item = blobs[i]!;
    onPage(item.page, i);
    const result = await Tesseract.recognize(item.blob, langs);
    out.push({
      page: item.page,
      text: result.data.text ?? "",
      confidence: (result.data.confidence ?? 0) / 100,
    });
  }
  return out;
}

/* -------------------------------------------------------------- pdf branch */

interface PageText {
  page: number;
  text: string;
  method: ExtractionMethod;
}

async function analyzePdf(req: WorkerRequest): Promise<AnalyzeResult> {
  const bytes = new Uint8Array(req.bytes);
  const xml = findEmbeddedXml(bytes);

  progress("extracting_text", 15);
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = doc.numPages;
  const readPages = Math.min(pageCount, MAX_PAGES);

  const pages: PageText[] = [];
  const qr: QrFinding[] = [];
  const imageBlobs: { page: number; blob: Blob }[] = [];

  for (let p = 1; p <= readPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push({ page: p, text, method: "pdf_text" });

    const viewport = page.getViewport({ scale: 2 });
    const width = Math.min(2200, Math.round(viewport.width));
    const scale = (2 * width) / viewport.width;
    const scaled = page.getViewport({ scale });
    const canvas = new OffscreenCanvas(Math.round(scaled.width), Math.round(scaled.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport: scaled,
      }).promise;
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = await scanImageDataForQr(image);
      if (found) qr.push({ page: p, format: "qr_code", text: found, ...decodeQr(found) });
      if (!req.quick && imageBlobs.length < OCR_MAX_PAGES) {
        imageBlobs.push({ page: p, blob: await canvasToBlob(canvas) });
      }
    }
    progress("extracting_text", 15 + Math.round((p / readPages) * 30));
  }

  let method: ExtractionMethod = "pdf_text";
  if (xml) {
    pages.unshift({ page: 1, text: xmlToText(xml), method: "embedded_xml" });
    method = "embedded_xml";
  }

  // Source order is strict: embedded XML -> PDF text -> QR -> OCR (last resort) -> manual.
  // OCR never runs when precise values already came from embedded XML or a real PDF text layer.
  const pdfTextChars = pages
    .filter((p) => p.method === "pdf_text")
    .reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  const hasPreciseSource = !!xml || pdfTextChars >= MIN_TEXT_CHARS;
  let ocrConfidence = 0;
  if (!req.quick && !hasPreciseSource && imageBlobs.length > 0) {
    progress("ocr", 50, `0/${imageBlobs.length}`);
    const results = await ocrBlobs(imageBlobs, req.locale, (_page, index) =>
      progress("ocr", 50 + Math.round((index / imageBlobs.length) * 30), `${index + 1}/${imageBlobs.length}`),
    );
    for (const r of results) {
      if (r.text.trim()) pages.push({ page: r.page, text: r.text, method: "ocr" });
      ocrConfidence = Math.max(ocrConfidence, r.confidence);
    }
    if (!xml) method = "ocr";
  }

  return finish(req, pages, qr, pageCount, method, ocrConfidence);
}

/* ------------------------------------------------------------ image branch */

async function analyzeImage(req: WorkerRequest): Promise<AnalyzeResult> {
  progress("extracting_text", 20);
  const blob = new Blob([req.bytes], { type: req.mime || "image/png" });
  const bitmap = await createImageBitmap(blob);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const qr: QrFinding[] = [];
  const pages: PageText[] = [];
  let ocrConfidence = 0;

  if (ctx) {
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = await scanImageDataForQr(image);
    if (found) qr.push({ page: 1, format: "qr_code", text: found, ...decodeQr(found) });

    if (!req.quick) {
      progress("ocr", 45, "1/1");
      const results = await ocrBlobs(
        [{ page: 1, blob: await canvasToBlob(canvas) }],
        req.locale,
        () => progress("ocr", 55, "1/1"),
      );
      for (const r of results) {
        if (r.text.trim()) pages.push({ page: 1, text: r.text, method: "ocr" });
        ocrConfidence = Math.max(ocrConfidence, r.confidence);
      }
    }
  }

  return finish(req, pages, qr, 1, pages.length ? "ocr" : "qr", ocrConfidence);
}

/* ----------------------------------------------------------------- finish */

function fieldsFromQr(qr: QrFinding[]): ExtractedField[] {
  const out: ExtractedField[] = [];
  for (const item of qr) {
    if (item.url) {
      out.push({
        field_key: "deed.verify_url",
        field_label: "رابط التحقق",
        extracted_value: item.url,
        normalized_value: item.url,
        original_text: item.text.slice(0, 200),
        page_number: item.page,
        extraction_method: "qr",
        confidence: 0.9,
        is_sensitive: false,
      });
    }
    for (const [key, value] of Object.entries(item.decoded ?? {})) {
      const clean = toWesternDigits(String(value)).trim();
      if (!clean) continue;
      out.push({
        field_key: `qr.${key}`,
        field_label: key,
        extracted_value: clean,
        normalized_value: clean,
        original_text: item.text.slice(0, 200),
        page_number: item.page,
        extraction_method: "qr",
        confidence: 0.9,
        is_sensitive: /id|iqama|hoya|hawiya/i.test(key),
      });
    }
  }
  return out;
}

function finish(
  req: WorkerRequest,
  pages: PageText[],
  qr: QrFinding[],
  pageCount: number,
  method: ExtractionMethod,
  ocrConfidence: number,
): AnalyzeResult {
  progress("extracting_fields", 85);
  const rawText = pages.map((p) => p.text).join("\n").trim();
  const nameHint = req.fileName.replace(/[_\-.]+/g, " ");
  const classified = classify(`${rawText}\n${nameHint}`);
  let documentType: DocType = classified.type;
  if (documentType === "unknown" && /^image\//.test(req.mime) && !rawText) documentType = "site_photo";

  const fields = [...fieldsFromQr(qr), ...extractFields(pages, documentType)];
  const adjusted = fields.map((f) =>
    f.extraction_method === "ocr" && ocrConfidence
      ? { ...f, confidence: Math.max(0.2, Math.min(f.confidence, ocrConfidence)) }
      : f,
  );

  progress("ready_for_review", 100);
  return {
    documentType,
    pageCount,
    language: detectLanguage(rawText),
    method,
    rawText,
    fields: adjusted,
    qr,
    quick: req.quick,
  };
}

/* ------------------------------------------------------------------ entry */

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    progress("preparing", 5);
    const isPdf = req.mime === "application/pdf" || /\.pdf$/i.test(req.fileName);
    const result = isPdf ? await analyzePdf(req) : await analyzeImage(req);
    post({ kind: "done", result });
  } catch (error) {
    const message = (error as Error)?.message ?? "ANALYSIS_FAILED";
    post({
      kind: "error",
      message,
      code: /password|encrypt/i.test(message)
        ? "PROTECTED"
        : /Invalid PDF|corrupt/i.test(message)
          ? "CORRUPT"
          : "FAILED",
    });
  }
};
