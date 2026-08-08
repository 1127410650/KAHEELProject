import type { FormEvent } from "react";
import { CalendarCheck2, Loader2, ShieldCheck, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { AppointmentService, PublicProvider, Slot } from "./api";
import type { Busy } from "./CustomerArea";
import { AUTH_URL, getCopy, today } from "./copy";
import { Card, Spinner, cx, money } from "./ui";

export function BookingPanel({
  copy,
  locale,
  isAr,
  status,
  profileReady,
  provider,
  service,
  date,
  slots,
  slot,
  slotsLoading,
  name,
  phone,
  notes,
  busy,
  setDate,
  setSlot,
  setNotes,
  onClose,
  onSubmit,
  onQueue,
}: {
  copy: ReturnType<typeof getCopy>;
  locale: "ar" | "en";
  isAr: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  profileReady: boolean;
  provider: PublicProvider;
  service: AppointmentService;
  date: string;
  slots: Slot[];
  slot: string;
  slotsLoading: boolean;
  name: string;
  phone: string;
  notes: string;
  busy: Busy;
  setDate: (value: string) => void;
  setSlot: (value: string) => void;
  setNotes: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onQueue: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "حجز موعد" : "Book appointment"}
    >
      <Card className="max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">{provider.name_ar}</p>
            <h2 className="mt-1 text-xl font-black">
              {isAr ? service.name_ar : service.name_en || service.name_ar}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {service.duration_minutes} {copy.minutes} · {money(service.price, service.currency_code, locale)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={isAr ? "إغلاق" : "Close"}>×</Button>
        </div>

        {status !== "authenticated" || !profileReady ? (
          <div className="mt-6 rounded-2xl bg-secondary p-5 text-center">
            <ShieldCheck className="mx-auto size-7 text-primary" />
            <p className="mt-3 text-sm font-bold leading-7">{copy.loginFirst}</p>
            <Button asChild className="mt-4 min-h-11">
              <a href={AUTH_URL}>{copy.signIn}</a>
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={(event) => void onSubmit(event)}>
            <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{name}</p>
                <p dir="ltr" className="mt-1 truncate text-start text-xs text-muted-foreground">{phone}</p>
              </div>
              <span className="ms-auto text-[10px] font-black text-primary">
                {isAr ? "جوال موثق" : "Verified mobile"}
              </span>
            </div>

            {service.booking_mode !== "queue" ? (
              <>
                <div>
                  <Label htmlFor="appt-date">{copy.date}</Label>
                  <Input
                    id="appt-date"
                    type="date"
                    min={today()}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-2 h-11"
                  />
                </div>
                <div>
                  <Label>{copy.slots}</Label>
                  {slotsLoading ? (
                    <div className="mt-3"><Spinner label={copy.slots} /></div>
                  ) : slots.length === 0 ? (
                    <p className="mt-3 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{copy.noSlots}</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((item) => (
                        <button
                          key={item.starts_at}
                          type="button"
                          onClick={() => setSlot(item.starts_at)}
                          className={cx(
                            "rounded-xl border px-2 py-2 text-xs font-bold",
                            slot === item.starts_at
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          {new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-GB", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: item.timezone,
                          }).format(new Date(item.starts_at))}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            <div>
              <Label htmlFor="customer-notes">{copy.notes}</Label>
              <Textarea
                id="customer-notes"
                className="mt-2"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {service.booking_mode !== "queue" ? (
                <Button type="submit" className="min-h-11" disabled={!slot || busy === "book"}>
                  {busy === "book" ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
                  {copy.confirm}
                </Button>
              ) : null}
              {service.booking_mode !== "scheduled" ? (
                <Button
                  type="button"
                  variant={service.booking_mode === "queue" ? "default" : "outline"}
                  className="min-h-11"
                  disabled={busy === "queue"}
                  onClick={onQueue}
                >
                  {busy === "queue" ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />}
                  {copy.joinQueue}
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
