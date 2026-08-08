import { CalendarCheck2, Clock3, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { CustomerAppointment, CustomerQueue, MyContext } from "./api";
import { AUTH_URL, MARKET_AUTH_URL, statusAr, statusEn, type Copy } from "./copy";
import { Card, Empty, Pill, Spinner, dateTime } from "./ui";

export type Busy = string | null;

export function CustomerArea({
  copy,
  locale,
  status,
  context,
  loading,
  busy,
  onRefresh,
  onCancel,
  onCancelQueue,
  onBook,
}: {
  copy: Copy;
  locale: "ar" | "en";
  status: "loading" | "authenticated" | "unauthenticated";
  context: MyContext | null;
  loading: boolean;
  busy: Busy;
  onRefresh: () => void;
  onCancel: (item: CustomerAppointment) => void;
  onCancelQueue: (item: CustomerQueue) => void;
  onBook: () => void;
}) {
  const statuses = locale === "ar" ? statusAr : statusEn;
  if (status === "loading" || loading) {
    return <div className="mx-auto max-w-7xl px-4 py-12"><Spinner label={copy.mine} /></div>;
  }
  if (status === "unauthenticated" || !context?.profile) return <AuthRequired copy={copy} locale={locale} />;

  const appointments = context.appointments ?? [];
  const queues = context.queues ?? [];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">{copy.mine}</h1>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />{copy.refresh}
        </Button>
      </div>

      {queues.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-xl font-black">{copy.activeQueue}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {queues.map((entry) => (
              <Card key={entry.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-primary">{entry.provider_name}</p>
                    <h3 className="mt-1 font-black">{entry.service_name}</h3>
                  </div>
                  <Pill tone={entry.status === "called" || entry.status === "serving" ? "green" : "amber"}>
                    {statuses[entry.status] ?? entry.status}
                  </Pill>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-secondary p-3">
                    <strong className="block text-2xl font-black">{entry.queue_number}</strong>
                    <span className="text-[10px] text-muted-foreground">{copy.queueNumber}</span>
                  </div>
                  <div className="rounded-2xl bg-secondary p-3">
                    <strong className="block text-2xl font-black">{entry.waiting_ahead}</strong>
                    <span className="text-[10px] text-muted-foreground">{copy.ahead}</span>
                  </div>
                  <div className="rounded-2xl bg-secondary p-3">
                    <strong className="block text-2xl font-black">{entry.estimated_wait_minutes}</strong>
                    <span className="text-[10px] text-muted-foreground">{copy.minutes}</span>
                  </div>
                </div>
                {entry.status !== "serving" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    disabled={busy === entry.id}
                    onClick={() => onCancelQueue(entry)}
                  >
                    {busy === entry.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {copy.cancel}
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">{copy.upcoming}</h2>
        <Button size="sm" onClick={onBook}><Plus className="size-4" />{copy.discover}</Button>
      </div>

      {appointments.length === 0 ? (
        <div className="mt-4"><Empty title={copy.noAppointments} body={copy.noAppointmentsBody} /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {appointments.map((item) => {
            const cancellable = item.status === "requested" || item.status === "confirmed";
            const tone = item.status === "confirmed" || item.status === "completed"
              ? "green"
              : item.status.includes("cancel") || item.status === "rejected"
                ? "red"
                : "amber";
            return (
              <Card key={item.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <CalendarCheck2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">{item.service_name}</h3>
                      <Pill tone={tone}>{statuses[item.status] ?? item.status}</Pill>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.provider_name}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold">
                      <Clock3 className="size-3.5 text-primary" />
                      {dateTime(item.starts_at, locale, item.timezone)}
                    </p>
                  </div>
                  {cancellable ? (
                    <Button variant="outline" size="sm" disabled={busy === item.id} onClick={() => onCancel(item)}>
                      {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : null}
                      {copy.cancel}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function AuthRequired({ copy, locale = "ar" }: { copy: Copy; locale?: "ar" | "en" }) {
  const isAr = locale === "ar";
  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <Card className="p-8 text-center">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-black">{copy.loginFirst}</h1>
        <Button asChild className="mt-6 min-h-11">
          <a href={AUTH_URL}>{copy.signIn}</a>
        </Button>
        <p className="mt-5 text-xs text-muted-foreground">
          {isAr ? "لديك حساب في سوق كَحيل؟" : "Already have a KAHEEL Market account?"}{" "}
          <a href={MARKET_AUTH_URL} className="font-bold text-primary hover:underline">
            {isAr ? "سجّل الدخول من هنا" : "Sign in here"}
          </a>
        </p>
      </Card>
    </section>
  );
}
