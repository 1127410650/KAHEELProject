/**
 * مركز الإيقاف الطارئ (Safe Mode) — يعمل فوق مفاتيح الميزات الحالية لا بنظام موازٍ.
 *
 * قواعد ملزمة مفروضة خادميًا في `mkt_flag_change_request` / `_decide`:
 *  - الدخول والإدارة لا تُعطَّل أبدًا (مفاتيح محمية).
 *  - السبب والمدة المتوقعة إلزاميان لكل تغيير.
 *  - الإجراء على مستوى «عام» لا يُطبَّق إلا بموافقة شخص ثانٍ غير مقدّم الطلب.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminEmptyState, AdminTableScroll } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  FLAG_STATUS_LABEL_AR,
  SWITCH_LEVEL_LABEL_AR,
  decideFlagChange,
  flagErrorAr,
  loadFeatureFlags,
  loadFlagRequests,
  requestFlagChange,
  type FeatureFlagRow,
} from "@/lib/mkt-reliability";

const FLAGS_KEY = ["mkt", "admin", "feature-flags"];
const REQUESTS_KEY = ["mkt", "admin", "flag-requests"];

export function KillSwitchPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<FeatureFlagRow | null>(null);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("60");

  const flags = useQuery({ queryKey: FLAGS_KEY, queryFn: loadFeatureFlags });
  const requests = useQuery({ queryKey: REQUESTS_KEY, queryFn: () => loadFlagRequests(40) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: FLAGS_KEY });
    void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
  };

  const change = useMutation({
    mutationFn: (input: { flag: FeatureFlagRow; status: "on" | "off" | "internal" }) =>
      requestFlagChange({
        flagKey: input.flag.flag_key,
        targetStatus: input.status,
        reason,
        expectedMinutes: Number(minutes),
      }),
    onSuccess: (result) => {
      toast.success(
        result.needs_second_approval
          ? "سُجّل الطلب — الإجراء العام ينتظر موافقة شخص ثانٍ."
          : "طُبّق التغيير وسُجّل في سجل العمليات.",
      );
      setTarget(null);
      setReason("");
      refresh();
    },
    onError: (error) => toast.error(flagErrorAr(error)),
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; approve: boolean }) =>
      decideFlagChange(input.id, input.approve),
    onSuccess: () => {
      toast.success("سُجّل القرار.");
      refresh();
    },
    onError: (error) => toast.error(flagErrorAr(error)),
  });

  const pending = (requests.data ?? []).filter((r) => r.state === "pending");
  const flagName = (id: string) =>
    (flags.data ?? []).find((f) => f.id === id)?.flag_key ?? "—";

  return (
    <div className="grid gap-[var(--sp-4)]">
      <AdminCard
        title="طلبات بانتظار موافقة ثانية"
        description="الإيقاف على مستوى «عام» لا يُطبَّق بقرار شخص واحد."
        accent={pending.length > 0}
      >
        {pending.length === 0 ? (
          <AdminEmptyState icon={ShieldAlert} title="لا طلب معلّق" hint="لا إجراء عام بانتظار موافقة." />
        ) : (
          <ul className="grid gap-[var(--sp-3)]">
            {pending.map((row) => (
              <li key={row.id} className="rounded-[var(--r-inner)] border border-border p-[var(--sp-3)]">
                <p className="text-[14px] font-semibold text-foreground">
                  {flagName(row.flag_id)} → {FLAG_STATUS_LABEL_AR[row.target_status] ?? row.target_status}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {SWITCH_LEVEL_LABEL_AR[row.switch_level] ?? row.switch_level} ·{" "}
                  {formatNumber(row.expected_minutes)} دقيقة · {formatDateTime(row.requested_at)}
                </p>
                <p className="mt-1 text-[13px] text-foreground">السبب: {row.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="k-press"
                    disabled={!canManage || decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, approve: true })}
                  >
                    موافقة وتطبيق
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="k-press"
                    disabled={!canManage || decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, approve: false })}
                  >
                    رفض
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        title="مفاتيح الإيقاف"
        description="كل تغيير يحتاج سببًا ومدة متوقعة، ويُسجَّل في سجل العمليات بحالتيه قبل وبعد."
      >
        {target ? (
          <div className="mb-[var(--sp-4)] grid gap-[var(--sp-2)] rounded-[var(--r-inner)] border border-primary/30 bg-primary/5 p-[var(--sp-3)]">
            <p className="text-[14px] font-semibold text-foreground">
              تغيير المفتاح: {target.flag_key}
            </p>
            <label className="text-[13px] text-muted-foreground" htmlFor="switch-reason">
              سبب التغيير (عشرة أحرف على الأقل)
            </label>
            <Textarea
              id="switch-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <label className="text-[13px] text-muted-foreground" htmlFor="switch-minutes">
              المدة المتوقعة بالدقائق (٥ إلى ١٠٠٨٠)
            </label>
            <Input
              id="switch-minutes"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <div className="flex flex-wrap gap-2">
              {(["off", "internal", "on"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  className="k-press"
                  variant={status === "off" ? "destructive" : status === "on" ? "default" : "outline"}
                  disabled={change.isPending || reason.trim().length < 10 || Number(minutes) < 5}
                  onClick={() => change.mutate({ flag: target, status })}
                >
                  {FLAG_STATUS_LABEL_AR[status]}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="k-press"
                onClick={() => setTarget(null)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}

        {(flags.data ?? []).length === 0 ? (
          <AdminEmptyState icon={ShieldAlert} title="لا مفاتيح" hint="لم يُسجَّل أي مفتاح ميزة بعد." />
        ) : (
          <AdminTableScroll>
            <table className="w-full text-[14px]">
              <thead className="text-start text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">المفتاح</th>
                  <th className="p-2 text-start">الوحدة</th>
                  <th className="p-2 text-start">المستوى</th>
                  <th className="p-2 text-start">الحالة</th>
                  <th className="p-2 text-start">بديل التعطيل</th>
                  <th className="p-2 text-start">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {(flags.data ?? []).map((flag) => {
                  const protectedFlag =
                    flag.flag_key.startsWith("auth.") ||
                    flag.flag_key.startsWith("admin.") ||
                    flag.unit === "auth" ||
                    flag.unit === "admin";
                  return (
                    <tr key={flag.id} className="border-t border-border">
                      <td className="p-2 font-medium text-foreground">
                        {flag.flag_key}
                        {flag.is_kill_switch ? (
                          <span className="ms-1 text-[12px] text-destructive">مفتاح إيقاف</span>
                        ) : null}
                      </td>
                      <td className="p-2 text-muted-foreground">{flag.unit}</td>
                      <td className="p-2 text-muted-foreground">
                        {SWITCH_LEVEL_LABEL_AR[flag.scope] ?? flag.scope}
                      </td>
                      <td className="p-2">{FLAG_STATUS_LABEL_AR[flag.status] ?? flag.status}</td>
                      <td className="p-2 text-muted-foreground">{flag.fallback_note ?? "—"}</td>
                      <td className="p-2">
                        {protectedFlag ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                            <Lock aria-hidden className="size-4" />
                            محمي
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="k-press"
                            disabled={!canManage}
                            onClick={() => {
                              setTarget(flag);
                              setReason("");
                            }}
                          >
                            تغيير
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminCard>
    </div>
  );
}
