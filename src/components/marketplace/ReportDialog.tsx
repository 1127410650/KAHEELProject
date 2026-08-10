import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  loadReportReasons,
  reportErrorKey,
  REPORT_FILE_MAX_COUNT,
  submitReport,
  uploadReportFiles,
  validateReportFile,
} from "@/lib/mkt-reports";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ listingId, listingTitle, open, onOpenChange }: Props) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refNo, setRefNo] = useState<string | null>(null);

  const reasons = useQuery({ queryKey: ["mkt", "report-reasons"], queryFn: loadReportReasons });
  const selected = (reasons.data ?? []).find((r) => r.code === reason);
  const noteRequired = selected?.requires_note === true;

  function reset() {
    setReason("");
    setNote("");
    setFiles([]);
    setConfirmed(false);
    setRefNo(null);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [...files];
    for (const file of Array.from(list)) {
      const problem = validateReportFile(file);
      if (problem) {
        toast.error(t(`market.reports.err.file${problem === "type" ? "Type" : "Size"}`));
        continue;
      }
      if (next.length >= REPORT_FILE_MAX_COUNT) {
        toast.error(t("market.reports.err.tooManyFiles"));
        break;
      }
      next.push(file);
    }
    setFiles(next);
  }

  async function onSubmit() {
    if (!reason) {
      toast.error(t("market.reports.err.reasonRequired"));
      return;
    }
    if (noteRequired && note.trim().length < 10) {
      toast.error(t("market.reports.err.noteRequired"));
      return;
    }
    if (!confirmed) {
      toast.error(t("market.reports.err.confirmRequired"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitReport({
        listingId,
        reasonCode: reason,
        note: note.trim(),
        confirmed,
      });
      if (files.length > 0) {
        try {
          await uploadReportFiles({ reportId: result.report_id, side: "reporter", files });
        } catch {
          toast.error(t("market.reports.err.generic"));
        }
      }
      setRefNo(result.ref_no);
    } catch (error) {
      toast.error(t(`market.reports.err.${reportErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {refNo ? (
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {t("market.reports.submittedTitle")}
            </h2>
            <p className="mt-3 text-desc text-muted-foreground">{t("market.reports.refIs")}</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span dir="ltr" className="font-mono text-sm font-bold text-foreground">
                {refNo}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard?.writeText(refNo);
                  toast.success(t("market.reports.copied"));
                }}
                aria-label={t("market.reports.copyRef")}
              >
                <Copy className="size-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-3 text-desc text-muted-foreground">
              {t("market.reports.submittedHint")}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild size="sm">
                <Link to="/my/reports">{t("market.reports.viewReports")}</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("market.reports.report")}</DialogTitle>
              <DialogDescription>{listingTitle}</DialogDescription>
            </DialogHeader>
            <p className="text-desc text-muted-foreground">{t("market.reports.dialogHint")}</p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="report-reason">{t("market.reports.reason")}</Label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">{t("market.reports.chooseReason")}</option>
                  {(reasons.data ?? []).map((r) => (
                    <option key={r.code} value={r.code}>
                      {locale === "ar" ? r.name_ar : r.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-note">
                  {t("market.reports.note")}
                  {noteRequired ? " *" : ""}
                </Label>
                <Textarea
                  id="report-note"
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("market.reports.notePlaceholder")}
                  required={noteRequired}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-files">{t("market.reports.attachments")}</Label>
                <input
                  id="report-files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="block w-full cursor-pointer rounded-md border border-input bg-background p-2 text-desc text-muted-foreground"
                />
                <p className="text-desc text-muted-foreground">
                  {t("market.reports.attachHint")}
                </p>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-desc text-foreground"
                      >
                        <Paperclip className="size-3 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, i) => i !== index))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={t("common.delete")}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="flex items-start gap-2 text-desc text-foreground">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                  className="mt-0.5"
                />
                <span>{t("market.reports.confirmLabel")}</span>
              </label>

              <Button className="w-full" disabled={busy} onClick={() => void onSubmit()}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {busy ? t("market.reports.submitting") : t("market.reports.submit")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
