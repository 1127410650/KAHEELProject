import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import {
  loadReportFiles,
  loadReportMessages,
  replyToReport,
  reportErrorKey,
  reportFileUrl,
  uploadReportFiles,
  validateReportFile,
  type MktReportMessage,
} from "@/lib/mkt-reports";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  reportId: string;
  /** Which side the current viewer is on — controls attachment folder and labels. */
  side: "reporter" | "advertiser";
  canReply?: boolean;
}

/** Single-channel thread between one party and the review team. */
export function ReportThread({ reportId, side, canReply = true }: Props) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const messages = useQuery({
    queryKey: ["mkt", "report-thread", reportId, side],
    queryFn: () => loadReportMessages(reportId, side),
  });
  const files = useQuery({
    queryKey: ["mkt", "report-thread-files", reportId, side],
    queryFn: () => loadReportFiles(reportId, side),
  });

  async function openFile(path: string) {
    const url = await reportFileUrl(path);
    if (!url) {
      toast.error(t("market.reports.err.notAuthorized"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await replyToReport(reportId, text);
      if (file) {
        await uploadReportFiles({ reportId, side, files: [file] });
        void files.refetch();
      }
      setBody("");
      setFile(null);
      void messages.refetch();
    } catch (error) {
      toast.error(t(`market.reports.err.${reportErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("market.reports.detail.channel")}</h3>
      <p className="mt-1 text-desc text-muted-foreground">
        {t("market.reports.detail.channelHint")}
      </p>

      <div className="mt-3 space-y-2">
        {messages.isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : (messages.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-desc text-muted-foreground">
            {t("market.reports.detail.noMessages")}
          </p>
        ) : (
          (messages.data ?? []).map((message: MktReportMessage) => {
            const fromStaff = message.sender_side === "staff";
            return (
              <div
                key={message.id}
                className={
                  fromStaff
                    ? "rounded-lg border border-border bg-muted/60 p-3"
                    : "rounded-lg border border-primary/30 bg-primary/5 p-3"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-desc font-semibold text-foreground">
                    {fromStaff ? t("market.reports.detail.staff") : t("market.reports.detail.you")}
                  </span>
                  <span className="text-desc text-muted-foreground">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-desc text-foreground">{message.body}</p>
                {message.due_at && (
                  <p className="mt-1 text-desc font-medium text-destructive">
                    {t("market.reports.detail.dueAt")}: {formatDateTime(message.due_at)}
                  </p>
                )}
                {message.attachment_path && (
                  <button
                    type="button"
                    onClick={() => void openFile(message.attachment_path!)}
                    className="mt-1 inline-flex items-center gap-1 text-desc text-primary hover:underline"
                  >
                    <Paperclip className="size-3" aria-hidden />
                    {t("market.reports.detail.files")}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {(files.data ?? []).length > 0 && (
        <ul className="mt-3 space-y-1">
          {(files.data ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void openFile(item.storage_path)}
                className="inline-flex items-center gap-1 text-desc text-primary hover:underline"
              >
                <Paperclip className="size-3" aria-hidden />
                {item.file_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canReply && (
        <div className="mt-4 space-y-2">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("market.reports.detail.replyPlaceholder")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                if (picked) {
                  const problem = validateReportFile(picked);
                  if (problem) {
                    toast.error(
                      t(`market.reports.err.file${problem === "type" ? "Type" : "Size"}`),
                    );
                    e.target.value = "";
                    return;
                  }
                }
                setFile(picked);
              }}
              className="min-w-0 flex-1 cursor-pointer rounded-md border border-input bg-background p-[var(--sp-2)] text-desc text-muted-foreground"
            />
            <Button size="sm" disabled={busy || !body.trim()} onClick={() => void send()}>
              <Send className="size-3.5" aria-hidden />
              {t("market.reports.detail.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
