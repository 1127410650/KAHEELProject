import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { markMktNotificationRead } from "@/lib/mkt-reports";
import { loadAllMktNotifications, markAllMktNotificationsRead } from "@/lib/mkt-notifications";
import { MktNotificationLink } from "@/components/marketplace/MktNotificationsBell";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my/notifications")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "تنبيهات السوق — كَحيل" },
      {
        name: "description",
        content: "تنبيهات البلاغات والمخالفات والاعتراضات الخاصة بحسابك في كَحيل.",
      },
      { property: "og:title", content: "تنبيهات السوق — كَحيل" },
      { property: "og:description", content: "متابعة تنبيهات البلاغات والقرارات والاعتراضات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MktNotificationsPage,
});

function MktNotificationsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["mkt", "notifications", "page", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: () => loadAllMktNotifications(100),
  });

  const rows = list.data ?? [];
  const unread = rows.filter((r) => !r.read_at);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mkt", "notifications"] });
  };
  const markAll = useMutation({
    mutationFn: () => markAllMktNotificationsRead(unread.map((r) => r.id)),
    onSuccess: invalidate,
  });
  const markOne = useMutation({
    mutationFn: (id: string) => markMktNotificationRead(id),
    onSuccess: invalidate,
  });

  return (
    <DashboardShell title={t("market.notif.title")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="num text-xs text-muted-foreground">
          {t("market.notif.unread")}: {unread.length}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="mkt-notif-mark-all"
          disabled={unread.length === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          {t("market.notif.markAll")}
        </Button>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("market.notif.empty")}
        </div>
      ) : (
        <ul
          data-testid="mkt-notif-list"
          className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        >
          {rows.map((n) => (
            <li
              key={n.id}
              data-testid="mkt-notif-item"
              className={cn("flex gap-3 p-4 text-sm", !n.read_at && "bg-primary/5")}
            >
              <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <MktNotificationLink
                  notification={n}
                  className="font-medium text-primary hover:underline"
                />
                {n.body && <p className="break-words text-muted-foreground">{n.body}</p>}
                <p className="num text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <button
                  type="button"
                  className="shrink-0 self-start text-xs text-primary hover:underline"
                  onClick={() => markOne.mutate(n.id)}
                  disabled={markOne.isPending}
                >
                  {t("market.notif.markOne")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
