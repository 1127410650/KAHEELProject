/**
 * Plan cards for «مساعد الطالب».
 *
 * Prices are whatever the admin set in the panel — nothing is hardcoded here.
 * Payment goes through the existing wallet balance; there is no new gateway.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import {
  loadStudentBotPlans,
  STUDENT_BOT_KEY,
  subscribeStudentBotPlan,
} from "@/lib/mkt-student-bot";

export function StudentBotPlans({ className }: { className?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: [...STUDENT_BOT_KEY, "plans"],
    queryFn: loadStudentBotPlans,
    staleTime: 60_000,
  });

  const active = (plans.data ?? []).filter((plan) => plan.is_active);
  if (active.length === 0) return null;

  async function subscribe(planId: string) {
    setPending(planId);
    try {
      await subscribeStudentBotPlan(planId);
      await queryClient.invalidateQueries({ queryKey: STUDENT_BOT_KEY });
      toast.success(ar ? "تم تفعيل الباقة 🎉" : "Plan activated 🎉");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("insufficient")
          ? ar
            ? "رصيدك لا يكفي — اشحن رصيدك ثم أعد المحاولة."
            : "Not enough balance — top up and try again."
          : ar
            ? "تعذّر تفعيل الباقة."
            : "Could not activate the plan.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={className}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {active.map((plan) => (
          <li key={plan.id} className="rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-desc font-black text-foreground">
              {plan.kind === "season" ? (
                <CalendarClock className="size-3.5 text-accent" aria-hidden />
              ) : (
                <Repeat className="size-3.5 text-primary" aria-hidden />
              )}
              {ar ? plan.name_ar : plan.name_en}
            </p>
            <p className="mt-1 text-desc leading-5 text-muted-foreground">
              {ar
                ? `${formatNumber(plan.daily_limit)} سؤالًا يوميًا · حفظ المحادثات · أسئلة تدريب`
                : `${formatNumber(plan.daily_limit)} questions a day · saved chats · practice questions`}
              {plan.kind === "season" && plan.season_ends_at
                ? ar
                  ? ` · حتى ${formatDate(plan.season_ends_at)}`
                  : ` · until ${formatDate(plan.season_ends_at)}`
                : null}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-desc font-black tabular-nums text-foreground">
                {formatNumber(plan.price_credits)}{" "}
                <span className="text-desc font-bold text-muted-foreground">
                  {ar ? "من رصيدك" : "credits"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void subscribe(plan.id)}
                disabled={pending !== null}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-desc font-black text-primary-foreground disabled:opacity-60"
              >
                {pending === plan.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                {ar ? "اشترك" : "Subscribe"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-desc text-muted-foreground">
        {ar
          ? "الدفع من رصيد محفظتك الحالي — لا بوابة دفع جديدة."
          : "Paid from your existing wallet balance — no new payment gateway."}
      </p>
    </div>
  );
}
