import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, MessageSquareWarning, ShieldCheck, XCircle } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadStaffAccess, makeStaffAccess } from "@/lib/mkt-reports";
import {
  loadAdminMessageReports,
  MESSAGE_REPORT_STATUSES,
  reviewMessageReport,
  type MessageReportAction,
  type MessageReportStatus,
} from "@/lib/mkt-chat-reports";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminPageHead, AdminEmptyState } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/chat-reports")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "المحادثات المبلّغ عنها — إدارة كَحيل" },
      {
        name: "description",
        content: "معالجة بلاغات رسائل المحادثات في كَحيل: رفض البلاغ أو إخفاء الرسالة بقرار مسجّل.",
      },
      { property: "og:title", content: "المحادثات المبلّغ عنها — إدارة كَحيل" },
      { property: "og:description", content: "بلاغات الرسائل وقرارات المعالجة في كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminChatReportsPage,
});

function AdminChatReportsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MessageReportStatus | null>("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("reports.inbox_view");
  const canManage = staff.can("reports.review");

  const reports = useQuery({
    queryKey: ["mkt", "admin", "chat-reports", status],
    enabled: canView,
    queryFn: () => loadAdminMessageReports(status),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: MessageReportAction }) =>
      reviewMessageReport(id, action, notes[id]),
    onSuccess: async () => {
      setFeedback(t("admin.chatReports.done"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "chat-reports"] });
    },
    onError: () => setFeedback(t("admin.chatReports.failed")),
  });

  return (
    <AdminShell>
      <AdminPageHead
        title={t("admin.chatReports.title")}
        description={t("admin.chatReports.hint")}
      />

      {!canView ? (
        <AdminCard>
          <p className="text-[14px] text-muted-foreground">{t("admin.chatReports.noAccess")}</p>
        </AdminCard>
      ) : (
        <div className="grid gap-[var(--sp-4)]">
          <AdminCard title={t("admin.chatReports.filter")}>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={status === null ? "default" : "outline"}
                onClick={() => setStatus(null)}
              >
                {t("admin.chatReports.status.all")}
              </Button>
              {MESSAGE_REPORT_STATUSES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                  onClick={() => setStatus(value)}
                >
                  {t(`admin.chatReports.status.${value}`)}
                </Button>
              ))}
            </div>
          </AdminCard>

          {feedback ? (
            <p aria-live="polite" className="text-[14px] text-muted-foreground">
              {feedback}
            </p>
          ) : null}

          {reports.isLoading ? (
            <div className="grid gap-[var(--sp-3)]">
              <Skeleton className="h-28 w-full rounded-[var(--r-card)]" />
              <Skeleton className="h-28 w-full rounded-[var(--r-card)]" />
            </div>
          ) : (reports.data ?? []).length === 0 ? (
            <AdminEmptyState
              icon={ShieldCheck}
              title={t("admin.chatReports.empty")}
              description={t("admin.chatReports.emptyHint")}
            />
          ) : (
            <div className="grid gap-[var(--sp-3)]">
              {(reports.data ?? []).map((report) => {
                const hidden =
                  report.message_moderation_state === "hidden" || !!report.message_deleted_at;
                return (
                  <AdminCard key={report.id}>
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      <MessageSquareWarning className="size-4 text-primary" aria-hidden />
                      <span className="font-bold text-foreground">
                        {t(`admin.chatReports.status.${report.status}`)}
                      </span>
                      <span>{report.reason_code}</span>
                      <span>{formatDateTime(report.created_at)}</span>
                      <span>
                        {t("admin.chatReports.conversationReports")} {report.reports_count}
                      </span>
                      {hidden ? (
                        <span className="font-bold text-primary">
                          {t("admin.chatReports.hiddenBadge")}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-[var(--sp-3)] whitespace-pre-wrap break-words rounded-[var(--r-inner)] bg-muted p-[var(--sp-3)] text-[14px] leading-relaxed text-foreground">
                      {report.message_body ?? t("admin.chatReports.noBody")}
                    </p>

                    {report.note ? (
                      <p className="mt-[var(--sp-2)] text-[13px] text-muted-foreground">
                        {t("admin.chatReports.reporterNote")} {report.note}
                      </p>
                    ) : null}

                    {report.decision ? (
                      <p className="mt-[var(--sp-2)] text-[13px] text-muted-foreground">
                        {t("admin.chatReports.decision")}{" "}
                        {t(`admin.chatReports.action.${report.decision}`)}
                        {report.decision_note ? ` — ${report.decision_note}` : ""}
                      </p>
                    ) : null}

                    {canManage && report.status === "open" ? (
                      <div className="mt-[var(--sp-3)] grid gap-[var(--sp-2)]">
                        <Input
                          value={notes[report.id] ?? ""}
                          onChange={(event) =>
                            setNotes((prev) => ({ ...prev, [report.id]: event.target.value }))
                          }
                          placeholder={t("admin.chatReports.notePlaceholder")}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({ id: report.id, action: "hide_message" })
                            }
                          >
                            <EyeOff className="me-1 size-4" aria-hidden />
                            {t("admin.chatReports.action.hide_message")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: report.id, action: "dismiss" })}
                          >
                            <XCircle className="me-1 size-4" aria-hidden />
                            {t("admin.chatReports.action.dismiss")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({ id: report.id, action: "keep_reviewed" })
                            }
                          >
                            {t("admin.chatReports.action.keep_reviewed")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </AdminCard>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
