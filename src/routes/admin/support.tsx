import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, Lock, MessageSquare, Send } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadStaffAccess, makeStaffAccess } from "@/lib/mkt-reports";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  loadSupportMessages,
  loadSupportTickets,
  replySupportTicket,
  updateSupportTicket,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/mkt-support";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminPageHead, AdminEmptyState } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/support")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "الدعم والتذاكر — إدارة كَحيل" },
      {
        name: "description",
        content: "معالجة تذاكر دعم كَحيل: الرد على العميل، الملاحظات الداخلية، الأولوية والحالة.",
      },
      { property: "og:title", content: "الدعم والتذاكر — إدارة كَحيل" },
      { property: "og:description", content: "صندوق تذاكر الدعم في كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSupportPage,
});

function AdminSupportPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SupportStatus | null>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("support.view");
  const canManage = staff.can("support.manage");

  const tickets = useQuery({
    queryKey: ["mkt", "admin", "support", status],
    enabled: canView,
    queryFn: () => loadSupportTickets(status),
  });

  const thread = useQuery({
    queryKey: ["mkt", "admin", "support", "thread", openId],
    enabled: !!openId,
    queryFn: () => loadSupportMessages(openId as string),
  });

  const reply = useMutation({
    mutationFn: ({ id, internal }: { id: string; internal: boolean }) =>
      replySupportTicket(id, drafts[id] ?? "", internal),
    onSuccess: async (_data, variables) => {
      setDrafts((prev) => ({ ...prev, [variables.id]: "" }));
      setFeedback(t("admin.support.replySent"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "support"] });
    },
    onError: () => setFeedback(t("admin.support.failed")),
  });

  const patch = useMutation({
    mutationFn: ({
      id,
      next,
    }: {
      id: string;
      next: { status?: SupportStatus; priority?: SupportPriority };
    }) => updateSupportTicket(id, next),
    onSuccess: async () => {
      setFeedback(t("admin.support.updated"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "support"] });
    },
    onError: () => setFeedback(t("admin.support.failed")),
  });

  return (
    <AdminShell
      title={t("admin.support.title")}
      staffAccess={canView}
      staffChecking={access.isLoading}
    >
      <AdminPageHead title={t("admin.support.title")} description={t("admin.support.hint")} />

      {!canView ? (
        <AdminCard>
          <p className="text-[14px] text-muted-foreground">{t("admin.support.noAccess")}</p>
        </AdminCard>
      ) : (
        <div className="grid gap-[var(--sp-4)]">
          <AdminCard title={t("admin.support.filter")}>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={status === null ? "default" : "outline"}
                onClick={() => setStatus(null)}
              >
                {t("admin.support.status.all")}
              </Button>
              {SUPPORT_STATUSES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                  onClick={() => setStatus(value)}
                >
                  {t(`admin.support.status.${value}`)}
                </Button>
              ))}
            </div>
          </AdminCard>

          {feedback ? (
            <p aria-live="polite" className="text-[14px] text-muted-foreground">
              {feedback}
            </p>
          ) : null}

          {tickets.isLoading ? (
            <div className="grid gap-[var(--sp-3)]">
              <Skeleton className="h-28 w-full rounded-[var(--r-card)]" />
              <Skeleton className="h-28 w-full rounded-[var(--r-card)]" />
            </div>
          ) : (tickets.data ?? []).length === 0 ? (
            <AdminEmptyState
              icon={Headphones}
              title={t("admin.support.empty")}
              hint={t("admin.support.emptyHint")}
            />
          ) : (
            <div className="grid gap-[var(--sp-3)]">
              {(tickets.data ?? []).map((ticket) => {
                const expanded = openId === ticket.id;
                return (
                  <AdminCard key={ticket.id}>
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      <MessageSquare className="size-4 text-primary" aria-hidden />
                      <span className="font-bold text-foreground">{ticket.ref_no}</span>
                      <span className="font-bold text-foreground">
                        {t(`admin.support.status.${ticket.status}`)}
                      </span>
                      <span>{t(`admin.support.priority.${ticket.priority}`)}</span>
                      <span>{t(`admin.support.unit.${ticket.unit}`)}</span>
                      <span>{formatDateTime(ticket.created_at)}</span>
                    </div>

                    <p className="mt-[var(--sp-2)] text-[16px] font-bold text-foreground">
                      {ticket.subject}
                    </p>
                    <p className="mt-[var(--sp-2)] whitespace-pre-wrap break-words rounded-[var(--r-inner)] bg-muted p-[var(--sp-3)] text-[14px] leading-relaxed text-foreground">
                      {ticket.body}
                    </p>

                    <div className="mt-[var(--sp-3)] flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenId(expanded ? null : ticket.id)}
                      >
                        {expanded ? t("admin.support.hideThread") : t("admin.support.showThread")}
                      </Button>
                      {canManage
                        ? SUPPORT_STATUSES.filter((value) => value !== ticket.status).map(
                            (value) => (
                              <Button
                                key={value}
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={patch.isPending}
                                onClick={() =>
                                  patch.mutate({ id: ticket.id, next: { status: value } })
                                }
                              >
                                {t(`admin.support.setStatus.${value}`)}
                              </Button>
                            ),
                          )
                        : null}
                      {canManage
                        ? SUPPORT_PRIORITIES.filter((value) => value !== ticket.priority).map(
                            (value) => (
                              <Button
                                key={`p-${value}`}
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={patch.isPending}
                                onClick={() =>
                                  patch.mutate({ id: ticket.id, next: { priority: value } })
                                }
                              >
                                {t(`admin.support.priority.${value}`)}
                              </Button>
                            ),
                          )
                        : null}
                    </div>

                    {expanded ? (
                      <div className="mt-[var(--sp-3)] grid gap-[var(--sp-2)] border-t border-border pt-[var(--sp-3)]">
                        {thread.isLoading ? (
                          <Skeleton className="h-16 w-full rounded-[var(--r-inner)]" />
                        ) : (thread.data ?? []).length === 0 ? (
                          <p className="text-[13px] text-muted-foreground">
                            {t("admin.support.noReplies")}
                          </p>
                        ) : (
                          (thread.data ?? []).map((message) => (
                            <div
                              key={message.id}
                              className="rounded-[var(--r-inner)] bg-muted p-[var(--sp-3)]"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                                <span>{formatDateTime(message.created_at)}</span>
                                {message.is_internal ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-primary">
                                    <Lock className="size-3" aria-hidden />
                                    {t("admin.support.internalBadge")}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground">
                                {message.body}
                              </p>
                            </div>
                          ))
                        )}

                        {canManage && ticket.status !== "closed" ? (
                          <div className="grid gap-[var(--sp-2)]">
                            <Input
                              value={drafts[ticket.id] ?? ""}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [ticket.id]: event.target.value,
                                }))
                              }
                              placeholder={t("admin.support.replyPlaceholder")}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={reply.isPending || !(drafts[ticket.id] ?? "").trim()}
                                onClick={() =>
                                  reply.mutate({ id: ticket.id, internal: false })
                                }
                              >
                                <Send className="me-1 size-4" aria-hidden />
                                {t("admin.support.sendReply")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={reply.isPending || !(drafts[ticket.id] ?? "").trim()}
                                onClick={() => reply.mutate({ id: ticket.id, internal: true })}
                              >
                                <Lock className="me-1 size-4" aria-hidden />
                                {t("admin.support.sendInternal")}
                              </Button>
                            </div>
                          </div>
                        ) : null}
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
