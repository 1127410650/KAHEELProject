import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTable } from "@/components/InfoTable";
import {
  buildVerdict,
  checkCryptoLocally,
  compareWithPrinted,
  decodeZatcaQr,
  type ComparisonRow,
  type VerdictLevel,
  type ZatcaDecoded,
} from "@/lib/zatca";
import {
  ocrImage,
  scanImageFileForQr,
  scanVideoFrameForQr,
  validateScanFile,
  type PrintedInvoice,
} from "@/lib/invoice-scan";
import { parseInvoiceText } from "@/lib/invoice-parse";

export interface VerificationResult {
  qr: ZatcaDecoded | null;
  printed: PrintedInvoice | null;
  comparison: ComparisonRow[];
  verdict: { level: VerdictLevel; reasons: string[] };
  cryptoNotes: string[];
  source: "camera" | "file" | "manual";
  fileName?: string;
}

const VERDICT_STYLE: Record<
  VerdictLevel,
  { box: string; tint: string; icon: typeof ShieldCheck }
> = {
  green: {
    box: "border-success/40 bg-success/10 text-foreground",
    tint: "text-success",
    icon: ShieldCheck,
  },
  yellow: {
    box: "border-warning/50 bg-warning/10 text-foreground",
    tint: "text-warning",
    icon: ShieldAlert,
  },
  red: {
    box: "border-destructive/40 bg-destructive/10 text-foreground",
    tint: "text-destructive",
    icon: XCircle,
  },
  gray: {
    box: "border-border bg-muted text-foreground",
    tint: "text-muted-foreground",
    icon: ShieldQuestion,
  },
};

export function InvoiceVerifier({
  onResult,
  footer,
}: {
  onResult?: (result: VerificationResult) => void;
  footer?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loopRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (loopRef.current) window.clearTimeout(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const finalize = useCallback(
    async (
      qrRaw: string | null,
      printed: PrintedInvoice | null,
      source: VerificationResult["source"],
      fileName?: string,
    ) => {
      const qr = qrRaw ? decodeZatcaQr(qrRaw) : null;
      let cryptoNotes: string[] = [];
      let cryptoChecked = false;
      if (qr && qr.phase === 2) {
        const check = await checkCryptoLocally(qr);
        cryptoNotes = check.notes;
        cryptoChecked = check.ok;
      }
      const comparison =
        qr && printed
          ? compareWithPrinted(qr, {
              ...(printed.sellerName ? { sellerName: printed.sellerName } : {}),
              ...(printed.vatNumber ? { vatNumber: printed.vatNumber } : {}),
              ...(printed.timestamp ? { timestamp: printed.timestamp } : {}),
              ...(printed.total ? { total: printed.total } : {}),
              ...(printed.vatTotal ? { vatTotal: printed.vatTotal } : {}),
            })
          : [];
      const verdict = buildVerdict(qr, comparison, {
        cryptoChecked,
        lowOcrConfidence: printed?.method === "ocr" && printed.confidence < 0.6,
      });
      const next: VerificationResult = {
        qr,
        printed,
        comparison,
        verdict,
        cryptoNotes,
        source,
        ...(fileName ? { fileName } : {}),
      };
      setResult(next);
      onResult?.(next);
      if (!qr) toast.error(t("verify.noQrFound"));
    },
    [onResult, t],
  );

  async function handleFile(file: File): Promise<void> {
    const guard = validateScanFile(file);
    if (guard === "TYPE") {
      toast.error(t("verify.badType"));
      return;
    }
    if (guard === "SIZE") {
      toast.error(t("verify.badSize"));
      return;
    }

    setBusy("file");
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { scanPdf, printedFromPdf } = await import("@/lib/pdf-extract");
        const scan = await scanPdf(file);
        let printed = printedFromPdf(scan);
        if (!printed && scan.pageBlobs[0]) {
          setBusy("ocr");
          const ocr = await ocrImage(scan.pageBlobs[0], locale === "en" ? "en" : "ar");
          printed = { ...parseInvoiceText(ocr.text, "ocr"), confidence: ocr.confidence };
        }
        await finalize(scan.qr, printed, "file", file.name);
        return;
      }

      const qr = await scanImageFileForQr(file);
      setBusy("ocr");
      const ocr = await ocrImage(file, locale === "en" ? "en" : "ar");
      const printed =
        ocr.text.replace(/\s/g, "").length > 20
          ? { ...parseInvoiceText(ocr.text, "ocr" as const), confidence: ocr.confidence }
          : null;
      await finalize(qr, printed, "file", file.name);
    } catch (error) {
      console.error(error);
      toast.error(t("verify.scanFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      window.setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const tick = async () => {
          if (!streamRef.current || !videoRef.current) return;
          const found = await scanVideoFrameForQr(videoRef.current).catch(() => null);
          if (found) {
            stopCamera();
            await finalize(found, null, "camera");
            return;
          }
          loopRef.current = window.setTimeout(tick, 350);
        };
        void tick();
      }, 60);
    } catch {
      toast.error(t("verify.cameraDenied"));
    }
  }

  async function verifyManual() {
    if (!manual.trim()) return;
    setBusy("manual");
    try {
      await finalize(manual.trim(), null, "manual");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setResult(null);
    setManual("");
    stopCamera();
  }

  return (
    <div className="space-y-4">
      {!result && (
        <div className="surface space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("verify.scanTitle")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("verify.scanHint")}
            </p>
          </div>

          {cameraOn ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-[3/4] w-full object-cover sm:aspect-video"
                />
                <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
              </div>
              <Button variant="outline" className="w-full" onClick={stopCamera}>
                {t("verify.stopCamera")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={startCamera} disabled={busy !== null}>
                <Camera className="size-4" aria-hidden />
                {t("verify.useCamera")}
              </Button>
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileUp className="size-4" aria-hidden />
                )}
                {busy === "ocr" ? t("verify.readingText") : t("verify.uploadFile")}
              </Button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />

          <div className="space-y-2 border-t border-border pt-3">
            <Label htmlFor="manual-qr" className="text-xs">
              {t("verify.manualLabel")}
            </Label>
            <Input
              id="manual-qr"
              dir="ltr"
              value={manual}
              placeholder="AQ..."
              onChange={(event) => setManual(event.target.value)}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={verifyManual}
              disabled={!manual.trim() || busy !== null}
            >
              <ClipboardPaste className="size-4" aria-hidden />
              {t("verify.verifyManual")}
            </Button>
          </div>
        </div>
      )}

      {result && <ResultView result={result} onReset={reset} />}
      {footer}
    </div>
  );
}

function ResultView({ result, onReset }: { result: VerificationResult; onReset: () => void }) {
  const { t, locale } = useI18n();
  const [showTech, setShowTech] = useState(false);
  const style = VERDICT_STYLE[result.verdict.level];
  const Icon = style.icon;
  const qr = result.qr;

  const rows: { label: string; value: React.ReactNode }[] = qr
    ? [
        { label: t("verify.field.sellerName"), value: qr.sellerName ?? "—" },
        { label: t("verify.field.vatNumber"), value: qr.vatNumber ?? "—" },
        { label: t("verify.field.timestamp"), value: qr.timestamp ?? "—" },
        { label: t("verify.field.netTotal"), value: qr.netTotal ?? "—" },
        { label: t("verify.field.vatTotal"), value: qr.vatTotal ?? "—" },
        { label: t("verify.field.total"), value: qr.total ?? "—" },
        {
          label: t("verify.field.phase"),
          value: qr.phase === 2 ? t("verify.phase2") : t("verify.phase1"),
        },
      ]
    : [];

  const items = result.printed?.lineItems ?? [];

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 ${style.box}`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 size-6 shrink-0 ${style.tint}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold">{t(`verify.verdict.${result.verdict.level}`)}</p>
            <p className="mt-1 text-xs leading-relaxed">
              {t(`verify.verdictHint.${result.verdict.level}`)}
            </p>
            {result.verdict.reasons.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {result.verdict.reasons.slice(0, 6).map((reason) => (
                  <li key={reason}>• {t(`verify.reason.${reason}`)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {qr && (
        <div className="surface space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("verify.qrData")}</h3>
          <InfoTable rows={rows} dense />
        </div>
      )}

      {result.comparison.length > 0 && (
        <div className="surface space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("verify.comparison")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t("verify.fieldName")}</th>
                  <th className="p-2 text-start">{t("verify.fromQr")}</th>
                  <th className="p-2 text-start">{t("verify.fromDocument")}</th>
                  <th className="p-2 text-start">{t("verify.state")}</th>
                </tr>
              </thead>
              <tbody>
                {result.comparison.map((row) => (
                  <tr key={row.field} className="border-t border-border">
                    <td className="p-2 font-medium text-foreground">
                      {t(`verify.field.${row.field}`)}
                    </td>
                    <td className="p-2" dir="auto">
                      {row.qrValue ?? "—"}
                    </td>
                    <td className="p-2" dir="auto">
                      {row.printedValue ?? "—"}
                    </td>
                    <td className="p-2">{t(`verify.match.${row.state}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="surface space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("verify.lineItems")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t("verify.item")}</th>
                  <th className="p-2 text-start">{t("verify.qty")}</th>
                  <th className="p-2 text-start">{t("verify.unitPrice")}</th>
                  <th className="p-2 text-start">{t("verify.taxRate")}</th>
                  <th className="p-2 text-start">{t("verify.lineTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t border-border">
                    <td className="p-2 text-foreground" dir="auto">
                      {item.name}
                    </td>
                    <td className="p-2">{item.quantity ?? "—"}</td>
                    <td className="p-2">{item.unitPrice ?? "—"}</td>
                    <td className="p-2">{item.taxRate ? `${item.taxRate}%` : "—"}</td>
                    <td className="p-2">{item.grossAmount ?? item.netAmount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t(`verify.method.${result.printed?.method ?? "manual"}`)}
          </p>
        </div>
      )}

      {result.printed && items.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {t("verify.noItemsFound")} — {t(`verify.method.${result.printed.method}`)}
        </p>
      )}

      <div className="surface">
        <button
          type="button"
          onClick={() => setShowTech((value) => !value)}
          className="text-xs font-semibold text-primary"
        >
          {showTech ? t("verify.hideTechnical") : t("verify.showTechnical")}
        </button>
        {showTech && qr && (
          <div className="mt-3 space-y-2 text-[11px]">
            <table className="w-full">
              <tbody>
                {qr.fields.map((field, index) => (
                  <tr key={`${field.tag}-${index}`} className="border-t border-border align-top">
                    <td className="w-16 p-1.5 font-semibold text-foreground">
                      {t("verify.tag")} {field.tag}
                    </td>
                    <td className="p-1.5 break-all text-muted-foreground" dir="ltr">
                      {field.value.length > 160 ? `${field.value.slice(0, 160)}…` : field.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.cryptoNotes.length > 0 && (
              <p className="text-muted-foreground">
                {result.cryptoNotes.map((note) => t(`verify.reason.${note}`)).join(" · ")}
              </p>
            )}
            <p className="break-all text-muted-foreground" dir="ltr">
              {qr.raw.slice(0, 300)}
              {qr.raw.length > 300 ? "…" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <CheckCircle2 className="me-1 inline size-3.5" aria-hidden />
        {t("verify.disclaimer")}
      </div>

      <Button variant="outline" className="w-full" onClick={onReset}>
        <RefreshCw className="size-4" aria-hidden />
        {locale === "ar" ? "فحص فاتورة أخرى" : "Verify another invoice"}
      </Button>
    </div>
  );
}
