import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "التنبيهات — تحقّق | Notifications — Tahqaq" },
      { name: "description", content: "تنبيهات طلباتك: الإسناد، طلب الاستكمال، الردود والقرارات." },
      { property: "og:title", content: "التنبيهات — تحقّق" },
      { property: "og:description", content: "Request alerts: assignment, info requests, decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["notifications", "page", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, event, title, body, request_id, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unread = rows.filter((r) => !r.read_at);

  const markAll = useMutation({
    mutationFn: async () => {
      if (unread.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in(
          "id",
          unread.map((r) => r.id),
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={unread.length === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {t("notifications.markAll")}
          </Button>
        }
      />

      {rows.length === 0 ? (
        <div className="surface p-10 text-center text-muted-foreground">
          {t("notifications.empty")}
        </div>
      ) : (
        <ul className="surface divide-y divide-border">
          {rows.map((n) => (
            <li
              key={n.id}
              className={cn("flex gap-3 p-4 text-sm", !n.read_at && "bg-primary/5")}
            >
              <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {n.request_id ? (
                  <Link
                    to="/requests/$id"
                    params={{ id: n.request_id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-medium">{n.title}</span>
                )}
                {n.body && <p className="text-muted-foreground">{n.body}</p>}
                <p className="num text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
