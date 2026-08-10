import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { adminErrorMessage, savePlatformSetting } from "@/lib/mkt-platform";
import { loadStudentBotPlans, type StudentBotPlan } from "@/lib/mkt-student-bot";

export const Route = createFileRoute("/admin/student-bot")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مساعد الطالب — إدارة المنصة" },
      {
        name: "description",
        content: "استهلاك مساعد الطالب بالدولار، الحدود المجانية، الباقات، وتفعيل أو إيقاف المساعد.",
      },
      { property: "og:title", content: "مساعد الطالب — إدارة المنصة" },
      { property: "og:description", content: "متابعة استهلاك مساعد الطالب وضبط حدوده." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminStudentBotPage,
});

interface Stats {
  enabled: boolean;
  monthly_cap_usd: number;
  free_daily: number;
  ip_daily: number;
  conversation_max: number;
  month_spend_usd: number;
  month_questions: number;
  today_spend_usd: number;
  today_questions: number;
  students: number;
  subscriptions: number;
  daily: { day: string; usd: number; questions: number }[];
  monthly: { month: string; usd: number; questions: number }[];
  subjects: { subject: string; grade: string; count: number }[];
  top_questions: { question: string; count: number }[];
}

const usd = (value: number) => `$${(value ?? 0).toFixed(2)}`;

const STATS_KEY = ["mkt", "admin", "student-bot"] as const;

function AdminStudentBotPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<
    { key: string; value: Record<string, unknown>; label: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, Partial<StudentBotPlan>>>({});

  const stats = useQuery({
    queryKey: [...STATS_KEY, "stats"],
    queryFn: async (): Promise<Stats | null> => {
      const { data, error } = await supabase.rpc("mkt_student_bot_admin_stats", { _days: 30 });
      if (error) throw error;
      return (data ?? null) as unknown as Stats | null;
    },
  });

  const plans = useQuery({ queryKey: [...STATS_KEY, "plans"], queryFn: loadStudentBotPlans });

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await savePlatformSetting(pending.key, pending.value, reason);
      toast.success("تم الحفظ.");
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: STATS_KEY });
    } catch (error) {
      toast.error(adminErrorMessage(error, "تعذّر الحفظ."));
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(plan: StudentBotPlan) {
    const draft = planDrafts[plan.id];
    if (!draft) return;
    const { error } = await supabase
      .from("mkt_student_bot_plans")
      .update({
        price_credits: draft.price_credits ?? plan.price_credits,
        daily_limit: draft.daily_limit ?? plan.daily_limit,
        season_ends_at: draft.season_ends_at ?? plan.season_ends_at,
        is_active: draft.is_active ?? plan.is_active,
      })
      .eq("id", plan.id);
    if (error) {
      toast.error(adminErrorMessage(error, "تعذّر تحديث الباقة."));
      return;
    }
    toast.success("حُدّثت الباقة.");
    setPlanDrafts((prev) => {
      const next = { ...prev };
      delete next[plan.id];
      return next;
    });
    await queryClient.invalidateQueries({ queryKey: STATS_KEY });
  }

  if (stats.isLoading) {
    return (
      <AdminShell>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </AdminShell>
    );
  }

  const data = stats.data;
  if (!data) {
    return (
      <AdminShell>
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          لا تملك صلاحية عرض هذه اللوحة.
        </p>
      </AdminShell>
    );
  }

  const capPct = data.monthly_cap_usd > 0 ? (data.month_spend_usd / data.monthly_cap_usd) * 100 : 0;

  const numberSetting = (
    key: string,
    label: string,
    current: number,
    hint: string,
  ) => (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-black text-foreground">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <Input
          inputMode="decimal"
          className="h-9 max-w-28 text-xs tabular-nums"
          value={drafts[key] ?? String(current)}
          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={(drafts[key] ?? String(current)) === String(current)}
          onClick={() => {
            const next = Number(drafts[key]);
            if (!Number.isFinite(next) || next < 0) {
              toast.error("أدخل رقمًا صحيحًا.");
              return;
            }
            setPending({ key, value: { value: next }, label });
          }}
        >
          حفظ
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell>
      <div className="grid gap-3">
        <header className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <h1 className="text-sm font-black text-foreground">مساعد الطالب</h1>
          <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
            الاستهلاك يُحسب تقديريًا من رموز الإدخال والإخراج لكل طلب. عند بلوغ السقف الشهري يتوقف
            المساعد تلقائيًا، وتُرسل تنبيهات للإدارة عند ٥٠٪ و٨٠٪ و١٠٠٪.
          </p>
        </header>

        {/* Snapshot */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "استهلاك الشهر", value: usd(data.month_spend_usd) },
            { label: "السقف الشهري", value: usd(data.monthly_cap_usd) },
            { label: "استهلاك اليوم", value: usd(data.today_spend_usd) },
            { label: "أسئلة الشهر", value: formatNumber(data.month_questions) },
            { label: "طلاب هذا الشهر", value: formatNumber(data.students) },
            { label: "اشتراكات نشطة", value: formatNumber(data.subscriptions) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-sm font-black tabular-nums text-foreground">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black text-foreground">نسبة السقف الشهري</p>
            <p className="text-[11px] font-black tabular-nums text-foreground">
              {capPct.toFixed(0)}%
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={
                capPct >= 100
                  ? "h-full rounded-full bg-destructive"
                  : capPct >= 80
                    ? "h-full rounded-full bg-accent"
                    : "h-full rounded-full bg-primary"
              }
              style={{ width: `${Math.min(100, Math.max(2, capPct))}%` }}
            />
          </div>
          {capPct >= 100 ? (
            <p className="mt-2 text-[10px] font-bold text-destructive">
              المساعد متوقف الآن حتى بداية الشهر أو حتى ترفع السقف.
            </p>
          ) : null}
        </section>

        {/* Charts */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-panel">
            <p className="mb-2 text-[11px] font-black text-foreground">الاستهلاك اليومي (٣٠ يومًا)</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="usd" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 shadow-panel">
            <p className="mb-2 text-[11px] font-black text-foreground">الاستهلاك الشهري</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="usd" fill="var(--primary)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-foreground">تفعيل المساعد</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                عند الإيقاف يرى الطالب رسالة لطيفة بلا أي طلب خارجي.
              </p>
            </div>
            <Switch
              checked={data.enabled}
              onCheckedChange={(next) =>
                setPending({
                  key: "student_bot.enabled",
                  value: { enabled: next },
                  label: "تفعيل المساعد",
                })
              }
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {numberSetting(
              "student_bot.monthly_cap_usd",
              "السقف الشهري (دولار)",
              data.monthly_cap_usd,
              "يتوقف المساعد تلقائيًا عند بلوغه.",
            )}
            {numberSetting(
              "student_bot.free_daily",
              "الأسئلة المجانية يوميًا",
              data.free_daily,
              "لكل طالب، بلا بيانات دفع.",
            )}
            {numberSetting(
              "student_bot.ip_daily",
              "الحد اليومي لكل شبكة",
              data.ip_daily,
              "يمنع التحايل بحسابات متعددة.",
            )}
            {numberSetting(
              "student_bot.conversation_max",
              "رسائل المحادثة الواحدة",
              data.conversation_max,
              "بعدها تُفتح محادثة جديدة بملخّص السياق.",
            )}
          </div>
        </section>

        {/* Plans */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <p className="text-[11px] font-black text-foreground">الباقات والأسعار</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            السعر بوحدات رصيد المحفظة — احسبه على التكلفة الفعلية بهامش ربحك.
          </p>
          <div className="mt-2 grid gap-2">
            {(plans.data ?? []).map((plan) => {
              const draft = planDrafts[plan.id] ?? {};
              const patch = (next: Partial<StudentBotPlan>) =>
                setPlanDrafts((prev) => ({ ...prev, [plan.id]: { ...prev[plan.id], ...next } }));
              return (
                <div key={plan.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black text-foreground">
                      {plan.name_ar}{" "}
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {plan.kind === "season" ? "موسمية" : "شهرية"}
                      </span>
                    </p>
                    <Switch
                      checked={draft.is_active ?? plan.is_active}
                      onCheckedChange={(next) => patch({ is_active: next })}
                    />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="grid gap-1 text-[10px] font-bold text-muted-foreground">
                      السعر (رصيد)
                      <Input
                        inputMode="numeric"
                        className="h-9 text-xs tabular-nums"
                        value={String(draft.price_credits ?? plan.price_credits)}
                        onChange={(event) => patch({ price_credits: Number(event.target.value) })}
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] font-bold text-muted-foreground">
                      أسئلة يوميًا
                      <Input
                        inputMode="numeric"
                        className="h-9 text-xs tabular-nums"
                        value={String(draft.daily_limit ?? plan.daily_limit)}
                        onChange={(event) => patch({ daily_limit: Number(event.target.value) })}
                      />
                    </label>
                    {plan.kind === "season" ? (
                      <label className="grid gap-1 text-[10px] font-bold text-muted-foreground">
                        ينتهي الموسم
                        <Input
                          type="date"
                          className="h-9 text-xs tabular-nums"
                          value={(draft.season_ends_at ?? plan.season_ends_at ?? "").slice(0, 10)}
                          onChange={(event) =>
                            patch({ season_ends_at: `${event.target.value}T23:59:00+03:00` })
                          }
                        />
                      </label>
                    ) : (
                      <p className="self-end text-[10px] text-muted-foreground">
                        مدة الاشتراك: {formatNumber(plan.duration_days ?? 30)} يومًا
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {plan.season_ends_at ? `الموسم الحالي حتى ${formatDate(plan.season_ends_at)}` : ""}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!planDrafts[plan.id]}
                      onClick={() => void savePlan(plan)}
                    >
                      حفظ الباقة
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Content signals */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
            <p className="text-[11px] font-black text-foreground">أكثر المواد سؤالًا</p>
            {data.subjects.length === 0 ? (
              <p className="mt-2 text-[10px] text-muted-foreground">لا أسئلة بعد.</p>
            ) : (
              <ul className="mt-2 grid gap-1">
                {data.subjects.map((row) => (
                  <li
                    key={`${row.grade}-${row.subject}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5"
                  >
                    <span className="truncate text-[11px] font-bold text-foreground">
                      {row.subject}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatNumber(row.count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
            <p className="text-[11px] font-black text-foreground">أكثر الأسئلة تكرارًا</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              مادة خام لتطوير محتوى دليل الطالب لاحقًا.
            </p>
            {data.top_questions.length === 0 ? (
              <p className="mt-2 text-[10px] text-muted-foreground">لا تكرار بعد.</p>
            ) : (
              <ol className="mt-2 grid gap-1">
                {data.top_questions.map((row, index) => (
                  <li
                    key={`${index}-${row.question.slice(0, 12)}`}
                    className="flex items-start justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5"
                  >
                    <span className="line-clamp-2 text-[11px] text-foreground">{row.question}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatNumber(row.count)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <ReasonDialog
        open={!!pending}
        title={`تعديل: ${pending?.label ?? ""}`}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </AdminShell>
  );
}
