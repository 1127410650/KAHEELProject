/**
 * «ينتظرك اليوم» — صندوق وارد المدير العام: بطاقة لكل طابور مع عدّاد حقيقي
 * ورابط مباشر، مرتبة بحسب الاستعجال، وحالة فراغ لكل طابور.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminCard } from "@/components/admin/AdminPage";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGmQueues } from "@/lib/mkt-gm-dashboard";
import { formatNumber } from "@/lib/format";

export function WorkQueue() {
  const { t } = useI18n();
  const queues = useQuery({
    queryKey: ["mkt", "admin", "gm", "queues"],
    queryFn: loadGmQueues,
    refetchInterval: 60_000,
  });

  return (
    <AdminCard
      className="mt-[var(--sp-4)]"
      title={t("admin.gm.queue.title")}
      description={t("admin.gm.queue.hint")}
    >
      {queues.isLoading ? (
        <div className="grid grid-cols-1 gap-[var(--sp-2)] sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-[var(--r-card)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--sp-2)] sm:grid-cols-2">
          {(queues.data ?? []).map((queue) => (
            <Link
              key={queue.key}
              to={queue.to}
              className="k-press flex min-h-[64px] items-center justify-between gap-[var(--sp-3)] rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-3)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold text-foreground">
                  {t(`admin.gm.queue.${queue.key}`)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[14px] text-muted-foreground">
                  {queue.count > 0 ? (
                    queue.isOverdue ? (
                      <>
                        <AlertTriangle className="size-4 shrink-0 text-primary" aria-hidden />
                        {t("admin.gm.now.overdue")}
                      </>
                    ) : (
                      t("admin.gm.queue.waiting")
                    )
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                      {t("admin.gm.queue.empty")}
                    </>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span
                  className={
                    "grid min-h-9 min-w-9 place-items-center rounded-[var(--r-chip,12px)] px-2 text-[16px] font-black tabular-nums " +
                    (queue.count > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground")
                  }
                >
                  {formatNumber(queue.count)}
                </span>
                <ChevronLeft className="size-4 text-muted-foreground rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
