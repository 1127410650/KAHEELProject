/**
 * /admin/integrations — سجل الخدمات الخارجية.
 *
 * كل خدمة تُضاف من قائمة مزوّدين معتمدة فقط، ولها مفتاح تشغيل وسقف صرف شهري
 * بالدولار. المفاتيح لا تُخزَّن هنا ولا تُعرض: يظهر اسم السر فقط، وقيمته تُضاف من
 * إعدادات المشروع. الاستهلاك يُقرأ من سجل `mkt_ai_usage` للشهر الجاري، وعند
 * الوصول للسقف تتوقّف الخدمة تلقائيًا في المولّدات التي تستدعيها.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, KeyRound, Plug, Plus } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminEmptyState, AdminPageHead } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  ADAPTERS,
  PROVIDER_PRESETS,
  presetOf,
  useIntegrationMutations,
  useIntegrationUsage,
  useIntegrations,
  type IntegrationRow,
} from "@/lib/mkt-integrations";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({
    meta: [
      { title: "سجل الخدمات الخارجية — كَحيل" },
      {
        name: "description",
        content: "تشغيل خدمات الذكاء والوسائط الخارجية وضبط سقف الصرف الشهري ومتابعة الاستهلاك.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "سجل الخدمات الخارجية — كَحيل" },
      { property: "og:description", content: "سجل موحّد للخدمات الخارجية بأسقف صرف ومتابعة استهلاك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

const SELECT =
  "mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-[16px] font-bold text-foreground";

function IntegrationsPage() {
  const integrations = useIntegrations();
  const usage = useIntegrationUsage();
  const mutations = useIntegrationMutations();
  const [provider, setProvider] = useState(PROVIDER_PRESETS[0]?.provider ?? "");
  const [name, setName] = useState("");

  const rows = integrations.data ?? [];
  const spentOf = (row: IntegrationRow) =>
    (usage.data ?? []).find((u) => u.service === row.code || u.service === row.provider)?.spent_usd ?? 0;

  async function addService() {
    try {
      await mutations.add.mutateAsync({ provider, name_ar: name });
      setName("");
      toast.success("أُضيفت الخدمة — فعّلها بعد إضافة السر في إعدادات المشروع.");
    } catch {
      toast.error("تعذّرت الإضافة — قد تكون الخدمة مسجّلة مسبقًا.");
    }
  }

  return (
    <AdminShell title="سجل الخدمات الخارجية">
      <AdminPageHead
        title="سجل الخدمات الخارجية"
        description="مزوّدون معتمدون فقط، سقف صرف شهري لكل خدمة، والمفاتيح تبقى في إعدادات المشروع لا في القاعدة."
      />

      <div className="space-y-[var(--sp-4)]">
        <AdminCard title="إضافة خدمة" description="اختر مزوّدًا من القائمة المعتمدة وسمّه باسم واضح للفريق.">
          <div className="grid gap-[var(--sp-3)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <Label htmlFor="provider">المزوّد</Label>
              <select
                id="provider"
                className={SELECT}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {ADAPTERS.map((adapter) => (
                  <optgroup key={adapter.kind} label={adapter.label_ar}>
                    {PROVIDER_PRESETS.filter((preset) => preset.adapter === adapter.kind).map((preset) => (
                      <option key={preset.provider} value={preset.provider}>
                        {preset.label_ar}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="service-name">اسم الخدمة</Label>
              <Input
                id="service-name"
                value={name}
                maxLength={60}
                placeholder={presetOf(provider)?.label_ar ?? ""}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Button type="button" className="min-h-11" onClick={() => void addService()}>
              <Plus aria-hidden className="me-1 size-4" /> إضافة
            </Button>
          </div>
          {presetOf(provider) ? (
            <p className="mt-[var(--sp-3)] rounded-[var(--r-card)] border border-primary/25 bg-primary/8 p-3 text-[14px] text-foreground">
              يحتاج السر <span className="font-bold">{presetOf(provider)!.secret_name}</span> في إعدادات
              المشروع ← الأسرار. التكلفة التقديرية {formatNumber(presetOf(provider)!.unit_cost_usd)} دولار
              لكل {presetOf(provider)!.unit_ar}.
            </p>
          ) : null}
        </AdminCard>

        {integrations.isLoading ? (
          <Skeleton className="h-40 w-full rounded-[var(--r-card)]" />
        ) : rows.length === 0 ? (
          <AdminCard title="الخدمات المسجّلة">
            <AdminEmptyState
              icon={Plug}
              title="لا خدمات مسجّلة"
              hint="أضف أول خدمة من القائمة أعلاه، ثم اضبط سقف صرفها الشهري."
            />
          </AdminCard>
        ) : (
          ADAPTERS.filter((adapter) => rows.some((row) => row.adapter === adapter.kind)).map((adapter) => (
            <AdminCard key={adapter.kind} title={adapter.label_ar} description={adapter.hint_ar}>
              <ul className="space-y-[var(--sp-3)]">
                {rows
                  .filter((row) => row.adapter === adapter.kind)
                  .map((row) => {
                    const spent = spentOf(row);
                    const ratio = row.monthly_cap_usd > 0 ? Math.min(1, spent / row.monthly_cap_usd) : 0;
                    const capped = row.monthly_cap_usd > 0 && spent >= row.monthly_cap_usd;
                    return (
                      <li
                        key={row.id}
                        className="rounded-[var(--r-card)] border border-border bg-secondary/30 p-[var(--sp-3)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-[var(--sp-3)]">
                          <div className="min-w-0">
                            <p className="truncate text-[16px] font-bold text-foreground">{row.name_ar}</p>
                            <p className="text-[14px] text-muted-foreground">
                              {row.provider} · آخر تحديث {formatDateTime(row.updated_at)}
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-[14px] font-bold text-foreground">
                            {row.enabled ? "مفعّلة" : "متوقّفة"}
                            <Switch
                              checked={row.enabled}
                              aria-label={`تشغيل ${row.name_ar}`}
                              onCheckedChange={(checked) => {
                                void mutations.update
                                  .mutateAsync({ id: row.id, patch: { enabled: checked } })
                                  .catch(() => toast.error("تعذّر التحديث."));
                              }}
                            />
                          </label>
                        </div>

                        <div className="mt-[var(--sp-3)] grid gap-[var(--sp-3)] sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`${row.id}-cap`}>السقف الشهري (دولار)</Label>
                            <Input
                              id={`${row.id}-cap`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={5000}
                              defaultValue={row.monthly_cap_usd}
                              onBlur={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value) || value === row.monthly_cap_usd) return;
                                void mutations.update
                                  .mutateAsync({ id: row.id, patch: { monthly_cap_usd: value } })
                                  .then(() => toast.success("حُدِّث السقف."))
                                  .catch(() => toast.error("تعذّر تحديث السقف."));
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-[14px] text-muted-foreground">استهلاك هذا الشهر</p>
                            <p className="text-[16px] font-bold text-foreground">
                              {formatNumber(Math.round(spent * 100) / 100)} / {formatNumber(row.monthly_cap_usd)}{" "}
                              دولار
                            </p>
                            <div
                              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border"
                              role="progressbar"
                              aria-valuenow={Math.round(ratio * 100)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`نسبة الصرف من سقف ${row.name_ar}`}
                            >
                              <span
                                className={"block h-full " + (capped ? "bg-destructive" : "bg-primary")}
                                style={{ width: `${ratio * 100}%` }}
                              />
                            </div>
                            {capped ? (
                              <p className="mt-1 text-[14px] font-bold text-destructive">
                                بلغت السقف — الخدمة متوقّفة حتى بداية الشهر أو رفع السقف.
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-[var(--sp-3)] flex flex-wrap items-center gap-[var(--sp-3)] text-[14px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <KeyRound aria-hidden className="size-4" />
                            {row.secret_name ?? "لا سر مطلوب"}
                          </span>
                          {row.signup_url ? (
                            <a
                              href={row.signup_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex min-h-11 items-center gap-1 font-bold text-primary underline"
                            >
                              <ExternalLink aria-hidden className="size-4" /> صفحة المزوّد
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </AdminCard>
          ))
        )}
      </div>
    </AdminShell>
  );
}
