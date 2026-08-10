/**
 * لوحة قنوات كود الدخول (OTP) — لمدير النظام.
 *
 * تعرض القنوات والمزوّدين مع تفعيل/إيقاف كل قناة، وإحصاءات الإرسال آخر ٣٠ يومًا
 * (العدد، نسبة النجاح، التكلفة التقديرية)، وحالة توفّر مفاتيح المزوّد.
 * كل الاستعلامات تمر عبر RLS الخاص بالمدير (`mkt_is_platform_admin`).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { otpProviderStatus } from "@/lib/otp.functions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type ChannelRow = {
  id: string;
  channel: string;
  provider: string;
  dial_codes: string[];
  label_ar: string;
  label_en: string;
  is_enabled: boolean;
  is_fallback: boolean;
  priority: number;
  cost_per_message: number;
  currency_code: string;
  notes: string | null;
};

type SendRow = {
  id: string;
  channel: string;
  provider: string;
  status: string;
  cost_amount: number;
  currency_code: string;
  phone_masked: string;
  error_code: string | null;
  created_at: string;
};

const SUCCESS = new Set(["sent", "delivered"]);

export function OtpChannelsCard() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const readProviders = useServerFn(otpProviderStatus);
  const [savingId, setSavingId] = useState<string | null>(null);

  const channels = useQuery({
    queryKey: ["mkt", "admin", "otp-channels"],
    queryFn: async (): Promise<ChannelRow[]> => {
      const { data, error } = await supabase
        .from("mkt_otp_channels")
        .select(
          "id, channel, provider, dial_codes, label_ar, label_en, is_enabled, is_fallback, priority, cost_per_message, currency_code, notes",
        )
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChannelRow[];
    },
  });

  const sends = useQuery({
    queryKey: ["mkt", "admin", "otp-sends"],
    queryFn: async (): Promise<SendRow[]> => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("mkt_otp_sends")
        .select("id, channel, provider, status, cost_amount, currency_code, phone_masked, error_code, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SendRow[];
    },
  });

  const providers = useQuery({
    queryKey: ["mkt", "admin", "otp-providers"],
    queryFn: () => readProviders(),
  });

  const stats = useMemo(() => {
    const rows = sends.data ?? [];
    const byProvider = new Map<string, { total: number; ok: number; cost: number; currency: string }>();
    for (const row of rows) {
      const key = `${row.channel}:${row.provider}`;
      const entry = byProvider.get(key) ?? { total: 0, ok: 0, cost: 0, currency: row.currency_code };
      entry.total += 1;
      if (SUCCESS.has(row.status)) entry.ok += 1;
      entry.cost += Number(row.cost_amount ?? 0);
      byProvider.set(key, entry);
    }
    return byProvider;
  }, [sends.data]);

  const toggle = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("mkt_otp_channels").update({ is_enabled: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("admin.actionDone"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "otp-channels"] });
    },
    onError: () => toast.error(t("admin.actionFailed")),
    onSettled: () => setSavingId(null),
  });

  /** جاهزية المفاتيح لكل مزوّد على حدة (لا لكل قناة). */
  const configured = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of providers.data?.providers ?? []) {
      map.set(`${row.channel}:${row.provider}`, row.configured);
    }
    return map;
  }, [providers.data]);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-section font-bold text-foreground">{t("admin.otp.title")}</h2>
      <p className="mt-1 text-desc text-muted-foreground">{t("admin.otp.hint")}</p>

      {channels.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      ) : (channels.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {(channels.data ?? []).map((row) => {
            const stat = stats.get(`${row.channel}:${row.provider}`);
            const rate = stat && stat.total > 0 ? Math.round((stat.ok / stat.total) * 100) : null;
            return (
              <li key={row.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {locale === "ar" ? row.label_ar : row.label_en}
                    </p>
                    <p className="num truncate text-desc text-muted-foreground" dir="ltr">
                      {row.provider} · {row.channel} · {row.dial_codes.join(" ") || "*"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        configured.get(`${row.channel}:${row.provider}`) ? "secondary" : "outline"
                      }
                    >
                      {configured.get(`${row.channel}:${row.provider}`)
                        ? t("admin.otp.configured")
                        : t("admin.otp.missingKeys")}
                    </Badge>
                    <Switch
                      checked={row.is_enabled}
                      disabled={savingId === row.id}
                      onCheckedChange={(next) => {
                        setSavingId(row.id);
                        toggle.mutate({ id: row.id, next });
                      }}
                      aria-label={t("admin.otp.toggle")}
                    />
                  </div>
                </div>
                <dl className="num mt-2 grid grid-cols-3 gap-2 text-desc text-muted-foreground">
                  <div>
                    <dt>{t("admin.otp.sent30")}</dt>
                    <dd className="font-semibold text-foreground">{stat?.total ?? 0}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.otp.successRate")}</dt>
                    <dd className="font-semibold text-foreground">{rate === null ? "—" : `${rate}%`}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.otp.cost")}</dt>
                    <dd className="font-semibold text-foreground">
                      <span dir="ltr">
                        {formatNumber(Number((stat?.cost ?? 0).toFixed(2)))}{" "}
                        {stat?.currency ?? row.currency_code}
                      </span>
                    </dd>
                  </div>
                </dl>
                {row.notes && <p className="mt-1 text-desc text-muted-foreground">{row.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-4 text-desc font-bold text-foreground">{t("admin.otp.recent")}</h3>
      {sends.isLoading ? (
        <Skeleton className="mt-2 h-24 w-full rounded-xl" />
      ) : (sends.data ?? []).length === 0 ? (
        <p className="mt-2 text-desc text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {(sends.data ?? []).slice(0, 10).map((row) => (
            <li
              key={row.id}
              className="num flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-2 py-1 text-desc"
            >
              <span dir="ltr">{row.phone_masked}</span>
              <span dir="ltr">
                {row.provider}/{row.channel}
              </span>
              <Badge variant={SUCCESS.has(row.status) ? "secondary" : "outline"}>
                {row.error_code ?? row.status}
              </Badge>
              <span>{formatDateTime(row.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
