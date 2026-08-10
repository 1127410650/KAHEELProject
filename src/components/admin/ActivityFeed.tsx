/**
 * سجل النشاط + بطاقة صحّة النظام. القراءة فقط، وتوقيت نسبي، وزر «امسح
 * التجريبي» بتأكيد مزدوج وإخفاء ناعم لا حذف نهائي.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Palette,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { AdminCard, AdminEmptyState } from "@/components/admin/AdminPage";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber } from "@/lib/format";
import { loadGmFeed, loadGmHealth, softPurgeDemoData } from "@/lib/mkt-gm-dashboard";

const KIND_ICON = {
  listing: Megaphone,
  report: ShieldAlert,
  appearance: ImageIcon,
  palette: Palette,
  blocks: Activity,
} as const;

export function ActivityFeed() {
  const { t } = useI18n();
  const feed = useQuery({
    queryKey: ["mkt", "admin", "gm", "feed"],
    queryFn: loadGmFeed,
    refetchInterval: 120_000,
  });

  return (
    <AdminCard title={t("admin.gm.feed.title")} description={t("admin.gm.feed.hint")}>
      {feed.isLoading ? (
        <div className="grid gap-[var(--sp-2)]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-[var(--r-card)]" />
          ))}
        </div>
      ) : (feed.data ?? []).length === 0 ? (
        <AdminEmptyState icon={Activity} title={t("admin.gm.feed.empty")} />
      ) : (
        <ul className="max-h-[420px] space-y-[var(--sp-2)] overflow-y-auto">
          {(feed.data ?? []).map((event) => {
            const Icon = KIND_ICON[event.kind];
            return (
              <li
                key={event.id}
                className="flex items-start gap-[var(--sp-3)] rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-chip,12px)] bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-foreground">
                    {event.title}
                  </span>
                  <span className="block text-[14px] text-muted-foreground">
                    {t(`admin.gm.feed.kind.${event.kind}`)} · {formatDateTime(event.at)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AdminCard>
  );
}

export function SystemHealthCard() {
  const { t } = useI18n();
  const client = useQueryClient();
  const [confirmStep, setConfirmStep] = useState(0);
  const [purging, setPurging] = useState(false);

  const health = useQuery({
    queryKey: ["mkt", "admin", "gm", "health"],
    queryFn: loadGmHealth,
  });

  const data = health.data;
  const demoTotal = (data?.demoListings ?? 0) + (data?.demoStories ?? 0) + (data?.demoAccounts ?? 0);

  async function purge() {
    setPurging(true);
    try {
      const result = await softPurgeDemoData();
      toast.success(
        `${t("admin.gm.health.purged")} · ${formatNumber(result.listings + result.stories)}`,
      );
      await client.invalidateQueries({ queryKey: ["mkt", "admin", "gm"] });
    } catch {
      toast.error(t("admin.gm.health.purgeFailed"));
    } finally {
      setPurging(false);
      setConfirmStep(0);
    }
  }

  const rows: { labelKey: string; value: string }[] = [
    { labelKey: "admin.gm.health.emptySlots", value: formatNumber(data?.emptySlots ?? 0) },
    { labelKey: "admin.gm.health.demoRows", value: formatNumber(demoTotal) },
    {
      labelKey: "admin.gm.health.lastEdit",
      value: data?.lastAppearanceEdit ? formatDateTime(data.lastAppearanceEdit) : "—",
    },
    { labelKey: "admin.gm.health.palette", value: data?.activePalette ?? "—" },
  ];

  return (
    <AdminCard title={t("admin.gm.health.title")} description={t("admin.gm.health.hint")}>
      {health.isLoading ? (
        <Skeleton className="h-32 w-full rounded-[var(--r-card)]" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-[var(--sp-2)]">
            {rows.map((row) => (
              <div
                key={row.labelKey}
                className="min-w-0 rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]"
              >
                <dt className="truncate text-[14px] text-muted-foreground">{t(row.labelKey)}</dt>
                <dd className="mt-1 truncate text-[16px] font-bold tabular-nums text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-[var(--sp-3)] rounded-[var(--r-card)] border border-dashed border-border p-[var(--sp-3)]">
            <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0 text-primary" aria-hidden />
              {t("admin.gm.health.purgeHint")}
            </p>
            <div className="mt-[var(--sp-2)] flex flex-wrap items-center gap-2">
              {confirmStep === 0 ? (
                <button
                  type="button"
                  onClick={() => setConfirmStep(1)}
                  disabled={demoTotal === 0}
                  className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] border border-border px-4 text-[14px] font-bold disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t("admin.gm.health.purge")}
                </button>
              ) : confirmStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(2)}
                    className="k-press min-h-11 rounded-[var(--r-btn,12px)] border border-primary px-4 text-[14px] font-bold text-primary"
                  >
                    {t("admin.gm.health.purgeConfirm1")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(0)}
                    className="min-h-11 px-2 text-[14px] font-bold text-muted-foreground"
                  >
                    {t("admin.gm.health.cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={purge}
                    disabled={purging}
                    className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-primary px-4 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {purging ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {t("admin.gm.health.purgeConfirm2")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(0)}
                    className="min-h-11 px-2 text-[14px] font-bold text-muted-foreground"
                  >
                    {t("admin.gm.health.cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AdminCard>
  );
}
