import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { markMktNotificationRead, type MktNotification } from "@/lib/mkt-reports";
import {
  loadAllMktNotifications,
  markAllMktNotificationsRead,
  notificationTarget,
} from "@/lib/mkt-notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Renders the notification title as a link to the related report/violation. */
export function MktNotificationLink({
  notification,
  className,
  onNavigate,
}: {
  notification: MktNotification;
  className?: string;
  onNavigate?: () => void;
}) {
  const target = notificationTarget(notification);
  if (target.kind === "none") return <span className={className}>{notification.title}</span>;
  if (target.kind === "violations") {
    return (
      <Link to="/dashboard/violations" className={className} onClick={onNavigate}>
        {notification.title}
      </Link>
    );
  }
  if (target.kind === "admin") {
    return (
      <Link
        to="/admin/reports/$id"
        params={{ id: target.reportId }}
        className={className}
        onClick={onNavigate}
      >
        {notification.title}
      </Link>
    );
  }
  return (
    <Link
      to="/dashboard/reports/$id"
      params={{ id: target.reportId }}
      className={className}
      onClick={onNavigate}
    >
      {notification.title}
    </Link>
  );
}

/** Marketplace bell: unread count + latest report notifications. */
export function MktNotificationsBell() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["mkt", "notifications", session?.user.id],
    enabled: !!session?.user.id,
    refetchInterval: 60_000,
    queryFn: () => loadAllMktNotifications(20),
  });

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

  if (!session) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={t("market.notif.title")}
          data-testid="mkt-bell"
        >
          <Bell className="size-5" aria-hidden />
          {unread.length > 0 && (
            <span
              data-testid="mkt-bell-count"
              className="num absolute -top-0.5 end-0 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            >
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[92vw] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">{t("market.notif.title")}</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            onClick={() => markAll.mutate()}
            disabled={unread.length === 0 || markAll.isPending}
          >
            {t("market.notif.markAll")}
          </button>
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {rows.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("market.notif.empty")}
            </li>
          )}
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} className={cn("px-3 py-2", !row.read_at && "bg-primary/5")}>
              <MktNotificationLink
                notification={row}
                className="block text-sm font-medium hover:underline"
                onNavigate={() => {
                  if (!row.read_at) markOne.mutate(row.id);
                }}
              />
              {row.body && <p className="text-xs text-muted-foreground">{row.body}</p>}
              <p className="num text-[11px] text-muted-foreground">
                {formatDateTime(row.created_at)}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-3 py-2 text-center">
          <Link
            to="/dashboard/notifications"
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("market.notif.viewAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
