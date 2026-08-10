/**
 * عدّادات صرف الذكاء الاصطناعي — قدرتان مستقلتان (التوليد / التحسين)، لكل
 * واحدة سقف شهري بالدولار قابل للتعديل من هنا، مع إيقاف تلقائي عند السقف.
 * كل الأرقام من دالة القاعدة `mkt_ai_spend_summary` (مسؤول المنصة فقط).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { AdminCard } from "@/components/admin/AdminPage";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { loadAiSpend, setAiCapabilityBudget } from "@/lib/mkt-gm-dashboard";

export function AiSpendCard() {
  const { t } = useI18n();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const spend = useQuery({
    queryKey: ["mkt", "admin", "gm", "ai-spend"],
    queryFn: loadAiSpend,
  });

  async function save(capability: "generation" | "enhancement") {
    const value = Number(draft[capability]);
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t("admin.gm.ai.badCap"));
      return;
    }
    setSaving(capability);
    try {
      await setAiCapabilityBudget(capability, value);
      toast.success(t("admin.gm.ai.saved"));
      await client.invalidateQueries({ queryKey: ["mkt", "admin", "gm", "ai-spend"] });
    } catch {
      toast.error(t("admin.gm.ai.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminCard title={t("admin.gm.ai.title")} description={t("admin.gm.ai.hint")}>
      {spend.isLoading ? (
        <Skeleton className="h-32 w-full rounded-[var(--r-card)]" />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--sp-3)] sm:grid-cols-2">
          {(spend.data ?? []).map((row) => {
            const Icon = row.capability === "generation" ? Sparkles : Wand2;
            const used = row.monthly_usd > 0 ? (row.spent_usd / row.monthly_usd) * 100 : 0;
            return (
              <div
                key={row.capability}
                className="min-w-0 rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]"
              >
                <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t(`admin.gm.ai.${row.capability}`)}</span>
                  {row.blocked ? (
                    <span className="ms-auto inline-flex items-center gap-1 rounded-[var(--r-chip,12px)] bg-destructive/10 px-2 py-0.5 text-[14px] font-bold text-destructive">
                      <Ban className="size-3.5" aria-hidden />
                      {t("admin.gm.ai.stopped")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {t("admin.gm.ai.thisMonth")}: {formatNumber(row.count)} ·{" "}
                  {row.spent_usd.toFixed(2)}$ / {row.monthly_usd.toFixed(0)}$ ·{" "}
                  {t("admin.gm.ai.remaining")} {row.remaining_usd.toFixed(2)}$
                </p>
                <div className="mt-[var(--sp-2)] h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
                  />
                </div>
                <div className="mt-[var(--sp-3)] flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    inputMode="numeric"
                    value={draft[row.capability] ?? String(row.monthly_usd)}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [row.capability]: event.target.value }))
                    }
                    aria-label={t("admin.gm.ai.capLabel")}
                    className="min-h-11 w-24 rounded-[var(--r-btn,12px)] border border-border bg-card px-3 text-[14px] font-bold tabular-nums text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => save(row.capability)}
                    disabled={saving === row.capability}
                    className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-primary px-4 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {saving === row.capability ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {t("admin.gm.ai.saveCap")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}
