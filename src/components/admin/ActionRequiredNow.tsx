/**
 * «يتطلب إجراء الآن» — أعلى صندوق في مركز قيادة مدير المنصة.
 *
 * لا يعرض إلا الطوابير التي تجاوز أقدم عنصر فيها حدّ الاستجابة التشغيلي
 * (`slaHours`) المحسوب في `loadGmQueues`. لا رقم تقديري: العدّ وعمر أقدم عنصر
 * يُقرآن من الجداول نفسها، وإذا لم يوجد أي تأخر تظهر حالة «لا شيء متأخر»
 * بوضوح بدل بطاقة فارغة. كل صف رابط عميق إلى الشاشة التي تُنفَّذ منها المعالجة.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminCard } from "@/components/admin/AdminPage";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGmQueues } from "@/lib/mkt-gm-dashboard";
import { formatNumber } from "@/lib/format";

/** عمر مقروء: أيام كاملة إن تجاوز 48 ساعة، وإلا ساعات. */
function useAgeLabel() {
  const { t } = useI18n();
  return (hours: number) => {
    if (hours >= 48) {
      return `${formatNumber(Math.floor(hours / 24))} ${t("admin.gm.now.days")}`;
    }
    return `${formatNumber(Math.max(1, Math.round(hours)))} ${t("admin.gm.now.hours")}`;
  };
}

export function ActionRequiredNow() {
  const { t } = useI18n();
  const ageLabel = useAgeLabel();
  const queues = useQuery({
    queryKey: ["mkt", "admin", "gm", "queues"],
    queryFn: loadGmQueues,
    refetchInterval: 60_000,
  });

  const overdue = (queues.data ?? []).filter((queue) => queue.isOverdue);
  const overdueItems = overdue.reduce((sum, queue) => sum + queue.count, 0);

  return (
    <AdminCard
      className="mt-[var(--sp-4)] border-s-[3px] border-s-primary"
      title={t("admin.gm.now.title")}
      description={t("admin.gm.now.hint")}
    >
      {queues.isLoading ? (
        <div className="grid gap-[var(--sp-2)]">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-[var(--r-card)]" />
          ))}
        </div>
      ) : overdue.length === 0 ? (
        <p className="flex min-h-11 items-center gap-2 text-[16px] text-muted-foreground">
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
          {t("admin.gm.now.clear")}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
            <AlertTriangle className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="tabular-nums">{formatNumber(overdueItems)}</span>
            <span className="min-w-0 font-normal text-muted-foreground">
              {t("admin.gm.now.overdueItems")}
            </span>
          </p>
          <ul className="mt-[var(--sp-3)] grid gap-[var(--sp-2)]">
            {overdue.map((queue) => (
              <li key={queue.key}>
                <Link
                  to={queue.to}
                  className="k-press flex min-h-[64px] items-center justify-between gap-[var(--sp-3)] rounded-[var(--r-card)] border border-border bg-[color-mix(in_srgb,var(--kt-primary)_7%,var(--kt-card))] p-[var(--sp-3)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold text-foreground">
                      {t(`admin.gm.queue.${queue.key}`)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[14px] text-muted-foreground">
                      <Clock className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {t("admin.gm.now.oldest")} {ageLabel(queue.ageHours ?? 0)} ·{" "}
                        {t("admin.gm.now.sla")} {formatNumber(queue.slaHours)}{" "}
                        {t("admin.gm.now.hours")}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="grid min-h-9 min-w-9 place-items-center rounded-[var(--r-chip,12px)] bg-primary px-2 text-[16px] font-black tabular-nums text-primary-foreground">
                      {formatNumber(queue.count)}
                    </span>
                    <ChevronLeft
                      className="size-4 text-muted-foreground ltr:rotate-180 rtl:rotate-0"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminCard>
  );
}
