/**
 * طلباتي في كَحيل عقار — قادمة / سابقة.
 *
 * لكل طلب: العقار، التواريخ، الحالة، مؤقّت انتهاء الطلب، إلغاء، طلب تمديد،
 * ورابط المحادثة. لا حذف نهائي — الإلغاء تغيير حالة يحفظ السجل.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Clock, MessagesSquare, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import { formatAqarAmount } from "@/lib/mkt-aqar";
import {
  AQAR_BOOKING_STATUS_LABELS,
  cancelAqarBooking,
  fetchMyAqarBookings,
  isUpcomingBooking,
  nightsBetween,
  requestAqarExtension,
  type AqarBookingRow,
} from "@/lib/mkt-aqar-booking";
import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aqar/requests")({
  head: () => ({
    meta: [
      { title: "طلباتي — كَحيل عقار" },
      {
        name: "description",
        content:
          "تابع طلبات الحجز والمعاينة في كَحيل عقار: القادمة والسابقة، حالة كل طلب، الإلغاء وطلب التمديد.",
      },
      { property: "og:title", content: "طلباتي — كَحيل عقار" },
      { property: "og:description", content: "طلبات الحجز والمعاينة الخاصة بك في كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AqarRequestsPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  accepted: "bg-primary text-primary-foreground",
  rejected: "bg-muted text-muted-foreground",
  auto_cancelled: "bg-muted text-muted-foreground",
  cancelled_by_customer: "bg-muted text-muted-foreground",
};

function hoursLeft(expiresAt: string): number {
  return Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000));
}

function BookingCard({
  row,
  onCancel,
  onExtend,
  busy,
}: {
  row: AqarBookingRow;
  onCancel: (id: string) => void;
  onExtend: (row: AqarBookingRow, date: string) => void;
  busy: boolean;
}) {
  const [extendTo, setExtendTo] = useState("");
  const listing = row.listing;
  const nights = nightsBetween(row.check_in, row.check_out);
  const canCancel = row.status === "pending" || row.status === "accepted";
  const canExtend = row.status === "accepted" && Boolean(row.check_out);

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="k-pill px-3 py-0.5 text-nav font-bold">
            {listing ? (AQAR_TYPE_LABELS[listing.property_type] ?? "عقار") : "عقار"}
          </span>
          {listing ? (
            <Link
              to="/aqar/$id"
              params={{ id: listing.id }}
              className="mt-1 block truncate text-title font-bold text-foreground"
            >
              {listing.title}
            </Link>
          ) : (
            <strong className="mt-1 block text-title font-bold text-foreground">عقار محذوف</strong>
          )}
          {listing ? (
            <p className="text-desc text-muted-foreground">
              {listing.city}
              {listing.district ? ` — ${listing.district}` : ""}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-nav font-bold ${
            STATUS_TONE[row.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {AQAR_BOOKING_STATUS_LABELS[row.status]}
        </span>
      </div>

      <ul className="mt-2 space-y-1 text-desc text-foreground">
        {row.check_in ? (
          <li className="flex items-center gap-1">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            {formatDate(row.check_in)}
            {row.check_out ? ` → ${formatDate(row.check_out)}` : ""}
            {nights > 0 ? ` • ${nights.toLocaleString("en-US")} ليالٍ` : ""}
          </li>
        ) : null}
        {row.guests ? (
          <li className="flex items-center gap-1">
            <Users className="size-4 shrink-0 text-primary" aria-hidden />
            {row.guests.toLocaleString("en-US")} ضيوف
          </li>
        ) : null}
        {listing ? (
          <li>
            سعر الإعلان: {formatAqarAmount(listing.price, listing.price_currency)}
            {nights > 0 && listing.price_period === "night"
              ? ` • تقدير الإجمالي ${formatAqarAmount(listing.price * nights, listing.price_currency)}`
              : ""}
          </li>
        ) : null}
        {row.status === "pending" ? (
          <li className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-4 shrink-0" aria-hidden />
            ينتهي الطلب تلقائيًا بعد {hoursLeft(row.expires_at).toLocaleString("en-US")} ساعة
          </li>
        ) : null}
        {row.decision_reason ? <li>سبب القرار: {row.decision_reason}</li> : null}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/my/messages"
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 text-desc font-bold text-foreground"
          style={{ minHeight: 44 }}
        >
          <MessagesSquare className="size-4 text-primary" aria-hidden />
          محادثة المعلن
        </Link>
        {canCancel ? (
          <Button
            variant="outline"
            style={{ minHeight: 44 }}
            disabled={busy}
            onClick={() => onCancel(row.id)}
          >
            إلغاء الطلب
          </Button>
        ) : null}
      </div>

      {canExtend ? (
        <div className="mt-3 rounded-xl bg-muted p-3">
          <p className="text-desc font-bold text-foreground">طلب تمديد المدة</p>
          <p className="text-nav text-muted-foreground">
            يُرسل كطلب جديد للمعلن يبدأ من {formatDate(row.check_out as string)} — قراره وحده
            يعتمده، ولا يوجد أي حجز مالي.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="تاريخ الخروج الجديد"
              min={row.check_out ?? undefined}
              value={extendTo}
              onChange={(event) => setExtendTo(event.target.value)}
              className="w-auto"
              style={{ minHeight: 44 }}
            />
            <Button
              style={{ minHeight: 44 }}
              disabled={busy || !extendTo}
              onClick={() => onExtend(row, extendTo)}
            >
              إرسال طلب التمديد
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AqarRequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const session = useQuery({
    queryKey: ["auth", "session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const bookings = useQuery({
    queryKey: ["aqar", "my-bookings"],
    queryFn: fetchMyAqarBookings,
    enabled: Boolean(session.data),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["aqar", "my-bookings"] });

  const cancel = useMutation({
    mutationFn: cancelAqarBooking,
    onSuccess: () => {
      toast.success("أُلغي طلبك.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const extend = useMutation({
    mutationFn: ({ row, date }: { row: AqarBookingRow; date: string }) =>
      requestAqarExtension(row, date),
    onSuccess: () => {
      toast.success("أُرسل طلب التمديد إلى المعلن.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = bookings.data ?? [];
  const upcoming = rows.filter(isUpcomingBooking);
  const past = rows.filter((row) => !isUpcomingBooking(row));
  const shown = tab === "upcoming" ? upcoming : past;
  const busy = cancel.isPending || extend.isPending;

  return (
    <AqarShell title="طلباتي" subtitle="الحجز والمعاينة" back="/aqar" backLabel="عقار">
      <div className="mx-auto w-full max-w-3xl p-4 pb-10">
        {!session.data ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ClipboardList className="size-8 text-primary" aria-hidden />
            <p className="text-body text-foreground">سجّل الدخول لمتابعة طلباتك.</p>
            <Link
              to="/auth"
              search={{ next: "/aqar/requests" } as never}
              className="inline-flex items-center rounded-full bg-primary px-5 text-body font-bold text-primary-foreground"
              style={{ minHeight: 44 }}
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="تصفية الطلبات"
              className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-muted p-1"
            >
              {(
                [
                  ["upcoming", `قادمة (${upcoming.length.toLocaleString("en-US")})`],
                  ["past", `سابقة (${past.length.toLocaleString("en-US")})`],
                ] as const
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-full text-desc font-bold transition-colors ${
                    tab === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {text}
                </button>
              ))}
            </div>

            {bookings.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ClipboardList className="size-8 text-primary" aria-hidden />
                <p className="text-body text-foreground">
                  {tab === "upcoming" ? "لا طلبات قادمة حاليًا." : "لا طلبات سابقة."}
                </p>
                <Link to="/aqar" className="text-desc font-bold text-primary">
                  تصفّح العقارات المتاحة
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {shown.map((row) => (
                  <BookingCard
                    key={row.id}
                    row={row}
                    busy={busy}
                    onCancel={(id) => cancel.mutate(id)}
                    onExtend={(target, date) => extend.mutate({ row: target, date })}
                  />
                ))}
              </ul>
            )}

            <p className="mt-4 text-nav text-muted-foreground">
              لا دفع عبر كَحيل ولا مبلغ محتجز: كل مبلغ يُسدَّد للمعلن مباشرة بعد اتفاقكما.
            </p>
          </>
        )}
      </div>
    </AqarShell>
  );
}
