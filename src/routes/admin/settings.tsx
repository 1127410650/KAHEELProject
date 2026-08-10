import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { OtpChannelsCard } from "@/components/marketplace/campaign/OtpChannelsCard";
import { WatermarkCard } from "@/components/marketplace/campaign/WatermarkCard";
import { formatDateTime } from "@/lib/format";
import {
  adminErrorMessage,
  loadPlatformSettings,
  savePlatformSetting,
  type PlatformSetting,
} from "@/lib/mkt-platform";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/settings")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إعدادات المنصة — إدارة المنصة" },
      {
        name: "description",
        content: "إعدادات تشغيل السوق: مدة الإعلان، حدود الرفع، ومراجعة الإعلانات قبل النشر — لمدير النظام فقط.",
      },
      { property: "og:title", content: "إعدادات المنصة — إدارة المنصة" },
      { property: "og:description", content: "إعدادات تشغيل منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettingsPage,
});

/** A setting value is `{ enabled: boolean }` or `{ value: number }`. */
function readBool(setting: PlatformSetting): boolean | null {
  const raw = setting.value?.["enabled"];
  return typeof raw === "boolean" ? raw : null;
}
function readNumber(setting: PlatformSetting): number | null {
  const raw = setting.value?.["value"];
  return typeof raw === "number" ? raw : null;
}

function AdminSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ setting: PlatformSetting; next: Record<string, unknown> } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const settings = useQuery({ queryKey: ["mkt", "admin", "settings"], queryFn: loadPlatformSettings });
  // للعلامة المائية لوحة مخصّصة أدناه، فتُستثنى من العرض الجدولي العام.
  const rows = (settings.data ?? []).filter((row) => row.key !== "assets.watermark");

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await savePlatformSetting(pending.setting.key, pending.next, reason);
      toast.success(t("admin.actionDone"));
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "settings"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const sections = [...new Set(rows.map((row) => row.section))];

  return (
    <AdminShell title={t("admin.nav.settings")} systemOwnerOnly>
      <p className="text-desc text-muted-foreground">{t("admin.settings.hint")}</p>

      {settings.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {sections.map((section) => (
            <section key={section} className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">{t(`admin.settings.section.${section}`)}</h2>
              <div className="mt-3 grid gap-2">
                {rows
                  .filter((row) => row.section === section)
                  .map((row) => {
                    const bool = readBool(row);
                    const num = readNumber(row);
                    const draft = drafts[row.key] ?? (num === null ? "" : String(num));
                    return (
                      <div
                        key={row.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {row.description_ar || row.key}
                          </p>
                          <p className="text-desc tabular-nums text-muted-foreground">
                            {t("admin.settings.updatedAt")}: {formatDateTime(row.updated_at)}
                          </p>
                        </div>
                        {bool !== null && (
                          /* The switch itself is 20px tall; the padded wrapper keeps
                             the tap area at 44px on touch screens. */
                          <span className="grid min-h-11 min-w-11 shrink-0 place-items-center">
                            <Switch
                              checked={bool}
                              aria-label={row.description_ar || row.key}
                              onCheckedChange={(next) =>
                                setPending({ setting: row, next: { enabled: next } })
                              }
                            />
                          </span>
                        )}
                        {num !== null && (
                          <div className="flex shrink-0 items-center gap-2">
                            <Input
                              value={draft}
                              inputMode="numeric"
                              className="h-11 w-24 tabular-nums"
                              aria-label={row.description_ar || row.key}
                              onChange={(event) =>
                                setDrafts((prev) => ({ ...prev, [row.key]: event.target.value }))
                              }
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              disabled={draft.trim() === "" || Number(draft) === num || Number.isNaN(Number(draft))}
                              onClick={() =>
                                setPending({ setting: row, next: { value: Number(draft) } })
                              }
                            >
                              {t("common.save")}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4">
        <WatermarkCard />
        <OtpChannelsCard />
      </div>

      <ReasonDialog
        open={!!pending}
        title={t("admin.settings.confirmTitle")}
        description={pending?.setting.description_ar ?? pending?.setting.key}
        confirmLabel={t("common.save")}
        pending={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </AdminShell>
  );
}
