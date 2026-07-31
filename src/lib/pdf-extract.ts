/**
 * PDF handling (client-only). Dynamically imported so pdf.js never runs during SSR.
 */
import type { InvoiceLineItem, PrintedInvoice } from "./invoice-scan";
import { scanCanvasForQr } from "./invoice-scan";
import { parseUblXml, parseInvoiceText } from "./invoice-parse";

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as unknown as { default: string }).default;
  return pdfjs;
}

export interface PdfScanResult {
  qr: string | null;
  text: string;
  xml: string | null;
  pages: number;
  /** Rendered page images, used as OCR fallback when the PDF has no text layer. */
  pageBlobs: Blob[];
}

const MAX_PAGES = 10;

function findEmbeddedXml(bytes: Uint8Array): string | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const start = text.search(/<(\w+:)?Invoice[\s>]/);
  if (start === -1) return null;
  const endMatch = /<\/(\w+:)?Invoice>/.exec(text.slice(start));
  if (!endMatch) return null;
  return text.slice(start, start + endMatch.index + endMatch[0].length);
}

export async function scanPdf(file: File): Promise<PdfScanResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  let text = "";
  let qr: string | null = null;
  const pageBlobs: Blob[] = [];

  for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    text += `${content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")}\n`;

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(2400, Math.round(viewport.width));
    canvas.height = Math.round((canvas.width / viewport.width) * viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport: page.getViewport({ scale: (2 * canvas.width) / viewport.width }),
      }).promise;
      if (!qr) qr = await scanCanvasForQr(canvas);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (blob) pageBlobs.push(blob);
    }
  }

  let xml = findEmbeddedXml(bytes);
  if (!xml) {
    try {
      const attachments = (await doc.getAttachments()) as Record<
        string,
        { content?: Uint8Array }
      > | null;
      for (const entry of Object.values(attachments ?? {})) {
        if (!entry?.content) continue;
        const candidate = findEmbeddedXml(entry.content);
        if (candidate) {
          xml = candidate;
          break;
        }
      }
    } catch {
      /* no attachments */
    }
  }

  return { qr, text: text.trim(), xml, pages: doc.numPages, pageBlobs };
}

export function printedFromPdf(result: PdfScanResult): PrintedInvoice | null {
  if (result.xml) {
    const parsed = parseUblXml(result.xml);
    if (parsed) return parsed;
  }
  if (result.text.replace(/\s/g, "").length > 40) {
    return parseInvoiceText(result.text, "pdf-text");
  }
  return null;
}

export type { InvoiceLineItem };
