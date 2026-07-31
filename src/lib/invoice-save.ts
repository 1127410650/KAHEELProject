/**
 * Bridge between the local (browser-only) tax-invoice verification engine and the
 * server-side save routines. Nothing here uploads anything unless the user is signed in
 * and explicitly asks to save.
 */
import { supabase } from "@/integrations/supabase/client";
import type { VerificationResult } from "@/components/InvoiceVerifier";
import type { InvoiceLineItem } from "@/lib/invoice-scan";

const STASH_KEY = "tahqaq:pending-verification";

/** Serializable snapshot of a verification (no File object). */
export interface StashedVerification {
  qrRaw: string | null;
  phase: number | null;
  level: string;
  reasons: string[];
  sellerName: string | null;
  vatNumber: string | null;
  timestamp: string | null;
  total: string | null;
  vatTotal: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  decodedTags: { tag: number; value: string }[];
  extractionMethod: string;
  qrHash: string | null;
  fileHash: string | null;
  fileName: string | null;
  lineItems: InvoiceLineItem[];
  savedAt: string;
}

export function toStash(result: VerificationResult): StashedVerification {
  const printed = result.printed;
  return {
    qrRaw: result.qr?.raw ?? null,
    phase: result.qr?.phase ?? null,
    level: result.verdict.level,
    reasons: result.verdict.reasons,
    sellerName: result.qr?.sellerName ?? printed?.sellerName ?? null,
    vatNumber: result.qr?.vatNumber ?? printed?.vatNumber ?? null,
    timestamp: result.qr?.timestamp ?? printed?.timestamp ?? null,
    total: result.qr?.total ?? printed?.total ?? null,
    vatTotal: result.qr?.vatTotal ?? printed?.vatTotal ?? null,
    invoiceNo: printed?.invoiceNo ?? null,
    invoiceDate: printed?.timestamp?.slice(0, 10) ?? null,
    decodedTags: (result.qr?.fields ?? []).map((f) => ({ tag: f.tag, value: f.value })),
    extractionMethod: printed?.method ?? (result.qr ? "qr" : "manual"),
    qrHash: result.qrHash ?? null,
    fileHash: result.fileHash ?? null,
    fileName: result.fileName ?? null,
    lineItems: printed?.lineItems ?? [],
    savedAt: new Date().toISOString(),
  };
}

/** Keep the last public-page scan for 30 minutes so signing in doesn't lose it. */
export function stashVerification(result: VerificationResult): void {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(toStash(result)));
  } catch {
    /* storage unavailable — the scan simply won't be carried over */
  }
}

export function readStashedVerification(): StashedVerification | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StashedVerification;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(age) || age > 30 * 60 * 1000) {
      sessionStorage.removeItem(STASH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStashedVerification(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ helpers */

function num(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Split a VAT-inclusive total into base + tax using the invoice's own VAT amount. */
export function splitAmounts(total: string | null, vat: string | null) {
  const t = num(total);
  const v = num(vat);
  const tax = v ?? (t !== null ? Number((t - t / 1.15).toFixed(2)) : null);
  const before = t !== null && tax !== null ? Number((t - tax).toFixed(2)) : null;
  return { before, tax, total: t };
}

export interface SaveInvoiceInput {
  stash: StashedVerification;
  invoiceNo: string;
  invoiceDate: string;
  supplierId?: string | null;
  createSupplier?: boolean;
  sellerName?: string | null | undefined;
  sellerVat?: string | null | undefined;
  projectId?: string | null;
  supervisorId?: string | null;
  amountBeforeTax: number | null;
  taxAmount: number | null;
  description?: string | null;
  status: "tech_verified" | "needs_review";
  lineItems: InvoiceLineItem[];
  clientToken: string;
  duplicateOverrideReason?: string | null;
  /** Original file — uploaded to the private bucket after the invoice row exists. */
  file?: File | null;
}

export interface SaveInvoiceOutcome {
  saved: boolean;
  invoiceId?: string;
  verificationId?: string;
  lines?: number;
  duplicate?: {
    duplicate: boolean;
    reasons: string[];
    invoices: {
      id: string;
      internal_no: string | null;
      invoice_no: string | null;
      invoice_date: string | null;
      total_amount: number | null;
      status: string;
      reason: string;
    }[];
  } | null;
  reused?: boolean;
  fileUploaded?: boolean;
}

export async function checkDuplicate(args: {
  fileHash?: string | null;
  qrHash?: string | null;
  zatcaUuid?: string | null;
  supplierId?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
}) {
  const { data, error } = await supabase.rpc("tiv_check_duplicate", {
    ...(args.fileHash ? { _file_hash: args.fileHash } : {}),
    ...(args.qrHash ? { _qr_hash: args.qrHash } : {}),
    ...(args.zatcaUuid ? { _zatca_uuid: args.zatcaUuid } : {}),
    ...(args.supplierId ? { _supplier_id: args.supplierId } : {}),
    ...(args.invoiceNo ? { _invoice_no: args.invoiceNo } : {}),
    ...(args.invoiceDate ? { _invoice_date: args.invoiceDate } : {}),
  });
  if (error) throw error;
  return data as unknown as SaveInvoiceOutcome["duplicate"];
}

export async function saveVerifiedInvoice(input: SaveInvoiceInput): Promise<SaveInvoiceOutcome> {
  const s = input.stash;
  const payload = {
    client_token: input.clientToken,
    supplier_id: input.supplierId ?? null,
    create_supplier: input.createSupplier ?? false,
    seller_name: input.sellerName ?? s.sellerName,
    seller_vat_number: input.sellerVat ?? s.vatNumber,
    invoice_no: input.invoiceNo,
    invoice_date: input.invoiceDate,
    project_id: input.projectId ?? null,
    supervisor_id: input.supervisorId ?? null,
    amount_before_tax: input.amountBeforeTax,
    tax_amount: input.taxAmount,
    description: input.description ?? null,
    status: input.status,
    currency: "SAR",
    zatca_uuid: s.decodedTags.find((f) => f.tag === 6)?.value ?? null,
    qr_hash: s.qrHash,
    file_hash: s.fileHash,
    extraction_method: s.extractionMethod,
    duplicate_override_reason: input.duplicateOverrideReason ?? null,
    verification: {
      qr_hash: s.qrHash,
      file_hash: s.fileHash,
      detected_phase: s.phase,
      result_status: s.level,
      seller_name: s.sellerName,
      seller_vat_number: s.vatNumber,
      invoice_timestamp: s.timestamp,
      total_with_vat: num(s.total),
      vat_total: num(s.vatTotal),
      decoded_tags: s.decodedTags,
      verification_reasons: s.reasons,
      extraction_method: s.extractionMethod,
    },
    line_items: input.lineItems.map((li) => ({
      original_name: li.name,
      description: li.description ?? null,
      sku: li.sku ?? null,
      quantity: li.quantity ?? null,
      unit: li.unit ?? null,
      unit_price_before_vat: li.unitPrice ?? null,
      discount: li.discount ?? null,
      vat_rate: li.taxRate ?? null,
      vat_amount: li.taxAmount ?? null,
      subtotal_before_vat: li.netAmount ?? null,
      total_with_vat: li.grossAmount ?? null,
      extraction_method: s.extractionMethod,
      confidence: null,
    })),
  };

  const { data, error } = await supabase.rpc("tiv_save_verified_invoice", {
    _payload: payload as never,
  });
  if (error) throw error;
  const outcome = data as unknown as {
    saved?: boolean;
    reused?: boolean;
    invoice_id?: string;
    verification_id?: string;
    lines?: number;
    duplicate?: SaveInvoiceOutcome["duplicate"];
  };

  if (!outcome?.invoice_id) {
    return { saved: false, duplicate: outcome?.duplicate ?? null };
  }

  let fileUploaded = false;
  if (input.file && outcome.verification_id) {
    const ext = (input.file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
    const path = `${outcome.invoice_id}/${outcome.verification_id}.${ext}`;
    const upload = await supabase.storage
      .from("invoice-files")
      .upload(path, input.file, { contentType: input.file.type || "application/octet-stream" });
    if (!upload.error) {
      const { error: linkError } = await supabase.rpc("tiv_set_verification_file", {
        _verification_id: outcome.verification_id,
        _storage_path: path,
        ...(s.fileHash ? { _file_hash: s.fileHash } : {}),
      });
      fileUploaded = !linkError;
    }
  }

  return {
    saved: Boolean(outcome.saved ?? outcome.reused),
    ...(outcome.invoice_id ? { invoiceId: outcome.invoice_id } : {}),
    ...(outcome.verification_id ? { verificationId: outcome.verification_id } : {}),
    ...(typeof outcome.lines === "number" ? { lines: outcome.lines } : {}),
    ...(outcome.reused ? { reused: true } : {}),
    duplicate: outcome.duplicate ?? null,
    fileUploaded,
  };
}

/** Short-lived signed URL for the stored original file. */
export async function signedInvoiceFileUrl(path: string, seconds = 60) {
  const { data, error } = await supabase.storage
    .from("invoice-files")
    .createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
