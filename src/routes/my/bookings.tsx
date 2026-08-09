import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarCheck2, Clock3, Loader2, MapPin, Store, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { currencyLabel } from "@/lib/mkt";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  serviceBookingAction,
  serviceErrorMessage,
  useServiceBookings,
  type BookingStatus,
  type ServiceBooking,
  type ServiceMode,
} from "@/lib/mkt-services";

export const Route = createFileRoute("/dashboard/bookings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "حجوزاتي — گحيل" },
      { name: "description", content: "متابعة مواعيد الخدمات وحالاتها." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyBookingsPage,
});

const FINAL = new Set<BookingStatus>([
  "completed",
  "rejected",
  "cancelled_by_customer",
  "cancelled_by_provider",
  "no_show",
]);

function statusLabel(status: BookingStatus, locale: "ar" | "en") {
  const ar: Record<BookingStatus, string> = {
    pending: "بانتظار التأكيد",
    confirmed: "مؤكد",
    en_route: "المختص في الطريق",
    in_progress: "الخدمة جارية",
    completed: "مكتمل",
    rejected: "مرفوض",
    cancelled_by_customer: "ألغيت الحجز",
    cancelled_by_provider: "ألغاه مقدم الخدمة",
    no_show: "لم يحضر العميل",
  };
  const en: Record<BookingStatus, string> = {
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    en_route: "Professional en route",
    in_progress: "In progress",
    completed: "Completed",
    rejected: "Rejected",
    cancelled_by_customer: "Cancelled by you",
    cancelled_by_provider: "Cancelled by provider",
    no_show: "No show",
  };
  return locale === "ar" ? ar[status] : en[status];
}

function modeLabel(mode: ServiceMode, locale: "ar" | "en") {
  const ar = { at_provider: "لدى مقدم الخدمة", at_customer: "في موقعك", remote: "عن بُعد" };
  const en = { at_provider: "At provider", at_customer: "At your location", remote: "Remote" };
  return locale === "ar" ? ar[mode] : en[mode];
}

function MyBookingsPage() {
  const { locale } = useI18n();
  const { account } = useActiveAccount();
  const queryClient = useQueryClient();
  const bookings = useServiceBookings(account?.account_key ?? null, "customer");
  const [tab, setTab] = useState("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = bookings.data ?? [];
    if (tab === "history") return all.filter((row) => FINAL.has(row.status));
    return all.filter((row) => !FINAL.has(row.status));
  }, [bookings.data, tab]);

  const cancel = async (booking: ServiceBooking) => {
    if (!account) return;
    const confirmed = window.confirm(
      locale === "ar" ? "هل تريد إلغاء هذا الموعد؟" : "Cancel this appointment?",
    );
    if (!confirmed) return;
    setBusyId(booking.id);
    try {
      await serviceBookingAction(
        booking.id,
        account.account_key,
        "cancelled_by_customer",
        locale === "ar" ? "إلغاء من العميل" : "Cancelled by customer",
      );
      await queryClient.invalidateQueries({ queryKey: ["mkt", "service-bookings"] });
      toast.success(locale === "ar" ? "تم إلغاء الحجز." : "Booking cancelled.");
    } catch (error) {
      toast.error(serviceErrorMessage(error, locale));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell title={locale === "ar" ? "حجوزاتي" : "My bookings"}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="upcoming">{locale === "ar" ? "القادمة" : "Upcoming"}</TabsTrigger>
              <TabsTrigger value="history">{locale === "ar" ? "السجل" : "History"}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button asChild>
            <Link to="/services">{locale === "ar" ? "حجز خدمة جديدة" : "Book a service"}</Link>
          </Button>
        </div>

        {bookings.isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-52 rounded-3xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card px-4 py-14 text-center">
            <CalendarCheck2 className="mx-auto size-10 text-primary" />
            <h2 className="mt-3 font-black">
              {tab === "upcoming"
                ? locale === "ar"
                  ? "لا توجد مواعيد قادمة"
                  : "No upcoming appointments"
                : locale === "ar"
                  ? "لا يوجد سجل حجوزات"
                  : "No booking history"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "اختر خدمة وموعدًا مناسبًا، وستظهر المتابعة هنا."
                : "Choose a service and time, then track it here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((booking) => {
              const cancellationClosesAt =
                new Date(booking.starts_at).getTime() -
                booking.cancellation_window_hours * 60 * 60 * 1000;
              const canCancel =
                (booking.status === "pending" || booking.status === "confirmed") &&
                Date.now() < cancellationClosesAt;
              return (
                <Card key={booking.id} className="overflow-hidden rounded-3xl">
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black">{booking.service_name}</p>
                        <Link
                          to="/stores/$slug"
                          params={{ slug: booking.store_slug }}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"
                        >
                          <Store className="size-3.5" />
                          {booking.store_name}
                        </Link>
                      </div>
                      <Badge
                        variant={
                          booking.status === "confirmed" || booking.status === "in_progress"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {statusLabel(booking.status, locale)}
                      </Badge>
                    </div>
                    <div className="grid gap-2 rounded-2xl bg-secondary/50 p-3 text-sm sm:grid-cols-2">
                      <p>
                        <CalendarCheck2 className="me-1.5 inline size-4 text-primary" />
                        {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                          dateStyle: "medium",
                          timeZone: booking.timezone,
                        }).format(new Date(booking.starts_at))}
                      </p>
                      <p>
                        <Clock3 className="me-1.5 inline size-4 text-primary" />
                        {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: booking.timezone,
                        }).format(new Date(booking.starts_at))}
                      </p>
                      <p className="text-muted-foreground">
                        {modeLabel(booking.service_mode, locale)}
                      </p>
                      <p className="font-black text-primary">
                        {booking.total} {currencyLabel(booking.currency_code, locale)}
                      </p>
                    </div>
                    {booking.address_text ? (
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="me-1 inline size-3.5" />
                        {booking.address_text}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
                      <span className="font-mono text-muted-foreground" dir="ltr">
                        {booking.booking_number}
                      </span>
                      {canCancel ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === booking.id}
                          onClick={() => void cancel(booking)}
                        >
                          {busyId === booking.id ? (
                            <Loader2 className="me-1 size-4 animate-spin" />
                          ) : (
                            <X className="me-1 size-4" />
                          )}
                          {locale === "ar" ? "إلغاء" : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
