import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bell with unread count for request events (assignment, info requests, replies, decisions). */
export function NotificationsBell() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["notifications", session?.user.id],
    enabled: !!session?.user.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, event, title, body, request_id, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
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
        .in("id", unread.map((r) => r.id));
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notifications.title")}
        >
          <Bell className="size-5" aria-hidden />
          {unread.length > 0 && (
            <span className="num absolute -top-0.5 end-0 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => markAll.mutate()}
            disabled={unread.length === 0 || markAll.isPending}
          >
            {t("notifications.markAll")}
          </button>
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {rows.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </li>
          )}
          {rows.map((row) => (
            <li key={row.id} className={cn("px-3 py-2", !row.read_at && "bg-primary/5")}>
              {row.request_id ? (
                <Link
                  to="/requests/$id"
                  params={{ id: row.request_id }}
                  className="block text-sm font-medium hover:underline"
                >
                  {row.title}
                </Link>
              ) : (
                <p className="text-sm font-medium">{row.title}</p>
              )}
              {row.body && <p className="text-xs text-muted-foreground">{row.body}</p>}
              <p className="num text-[11px] text-muted-foreground">
                {formatDateTime(row.created_at)}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
