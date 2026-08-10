import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Play,
  Settings2,
  Store,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
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
  useProviderSetup,
  useServiceBookings,
  type BookingStatus,
  type ServiceBooking,
  type ServiceMode,
} from "@/lib/mkt-services";
import { useMyStorefront } from "@/lib/mkt-store";

export const Route = createFileRoute("/business/services/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مركز مقدم الخدمة — كَحيل" },
      { name: "description", content: "إدارة طلبات الحجز ومواعيد مقدم الخدمة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProviderServiceCenter,
});

function providerStatusLabel(status: BookingStatus, locale: "ar" | "en") {
  const ar: Record<BookingStatus, string> = {
    pending: "طلب جديد",
    confirmed: "مؤكد",
    en_route: "في الطريق",
    in_progress: "قيد التنفيذ",
    completed: "مكتمل",
    rejected: "مرفوض",
    cancelled_by_customer: "ألغاه العميل",
    cancelled_by_provider: "ملغي",
    no_show: "لم يحضر العميل",
  };
  const en: Record<BookingStatus, string> = {
    pending: "New request",
    confirmed: "Confirmed",
    en_route: "En route",
    in_progress: "In progress",
    completed: "Completed",
    rejected: "Rejected",
    cancelled_by_customer: "Customer cancelled",
    cancelled_by_provider: "Cancelled",
    no_show: "No show",
  };
  return locale === "ar" ? ar[status] : en[status];
}

function providerModeLabel(mode: ServiceMode, locale: "ar" | "en") {
  const ar = { at_provider: "في مقر الخدمة", at_customer: "زيارة العميل", remote: "عن بُعد" };
  const en = { at_provider: "At provider", at_customer: "Customer visit", remote: "Remote" };
  return locale === "ar" ? ar[mode] : en[mode];
}

function ProviderServiceCenter() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const store = useMyStorefront(accountKey);
  const setup = useProviderSetup(accountKey);
  const bookings = useServiceBookings(accountKey, "provider");
  const [tab, setTab] = useState("requests");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = bookings.data ?? [];
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: setup.data?.settings.timezone ?? "Asia/Riyadh",
    }).format(new Date());
    if (tab === "requests") return all.filter((row) => row.status === "pending");
    if (tab === "today")
      return all.filter(
        (row) =>
          new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone }).format(
            new Date(row.starts_at),
          ) === today && ["confirmed", "en_route", "in_progress"].includes(row.status),
      );
    if (tab === "upcoming")
      return all.filter(
        (row) =>
          new Date(row.starts_at) > new Date() && ["pending", "confirmed"].includes(row.status),
      );
    return all;
  }, [bookings.data, setup.data?.settings.timezone, tab]);

  const act = async (booking: ServiceBooking, action: BookingStatus) => {
    if (!account) return;
    let note: string | undefined;
    if (action === "rejected" || action === "cancelled_by_provider") {
      const value = window.prompt(
        locale === "ar" ? "اكتب سببًا مختصرًا للعميل:" : "Add a short reason for the customer:",
      );
      if (value === null) return;
      note = value;
    }
    setBusyId(booking.id);
    try {
      await serviceBookingAction(booking.id, account.account_key, action, note);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mkt", "service-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "service-provider-setup"] }),
      ]);
      toast.success(locale === "ar" ? "تم تحديث الحجز." : "Booking updated.");
    } catch (error) {
      toast.error(serviceErrorMessage(error, locale));
    } finally {
      setBusyId(null);
    }
  };

  if (store.isLoading || setup.isLoading) {
    return (
      <DashboardShell title={locale === "ar" ? "مركز مقدم الخدمة" : "Provider center"}>
        <Skeleton className="h-80 rounded-3xl" />
      </DashboardShell>
    );
  }

  if (!store.data) {
    return (
      <DashboardShell title={locale === "ar" ? "مركز مقدم الخدمة" : "Provider center"}>
        <Card className="rounded-3xl">
          <CardContent className="space-y-3 p-6 text-center">
            <Store className="mx-auto size-10 text-primary" />
            <h2 className="text-lg font-black">
              {locale === "ar" ? "أنشئ متجر خدمات أولًا" : "Create a service store first"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "اختر «خدمات» عند إنشاء المتجر ليصبح هذا الحساب حساب مقدم خدمة."
                : "Choose Services while creating the store to turn this account into a provider account."}
            </p>
            <Button asChild>
              <Link to="/business/store/new">
                {locale === "ar" ? "إنشاء متجر خدمات" : "Create service store"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  if (!setup.data) {
    return (
      <DashboardShell title={locale === "ar" ? "مركز مقدم الخدمة" : "Provider center"}>
        <Card className="rounded-3xl">
          <CardContent className="space-y-3 p-6 text-center">
            <Wrench className="mx-auto size-10 text-primary" />
            <h2 className="text-lg font-black">
              {locale === "ar" ? "هذا الحساب متجر بيع" : "This is a seller store"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "يمكنك إدارة المنتجات والطلبات من مركز البائع، أو تعديل نوع المتجر إلى مختلط لإضافة خدمات."
                : "Manage products in the seller center, or change the store to Mixed to add services."}
            </p>
            <div className="flex justify-center gap-2">
              <Button asChild>
                <Link to="/business/store">
                  {locale === "ar" ? "مركز البائع" : "Seller center"}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/business/store/new">
                  {locale === "ar" ? "تعديل النوع" : "Edit type"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const stats = [
    [locale === "ar" ? "طلبات جديدة" : "New requests", setup.data.stats.pending],
    [locale === "ar" ? "مواعيد اليوم" : "Today", setup.data.stats.today],
    [locale === "ar" ? "قادمة" : "Upcoming", setup.data.stats.upcoming],
    [locale === "ar" ? "مكتملة" : "Completed", setup.data.stats.completed],
  ];

  return (
    <DashboardShell title={locale === "ar" ? "مركز مقدم الخدمة" : "Provider center"}>
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-market-navy via-primary-pressed to-primary-deep text-white shadow-xl">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary-foreground/75">
                  {locale === "ar" ? "حساب مقدم خدمة" : "Service provider account"}
                </p>
                <h2 className="mt-1 text-2xl font-black">{setup.data.store_name}</h2>
                <p className="mt-1 text-xs text-white/65">
                  {setup.data.settings.accepts_bookings
                    ? locale === "ar"
                      ? "يستقبل الحجوزات الآن"
                      : "Accepting bookings"
                    : locale === "ar"
                      ? "الحجوزات متوقفة"
                      : "Bookings paused"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/business/services/settings">
                    <Settings2 className="me-1 size-4" />
                    {locale === "ar" ? "الإعدادات" : "Settings"}
                  </Link>
                </Button>
                {setup.data.store_status === "published" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    asChild
                  >
                    <Link to="/stores/$slug" params={{ slug: setup.data.store_slug }}>
                      <ExternalLink className="me-1 size-4" />
                      {locale === "ar" ? "الصفحة" : "Page"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur"
                >
                  <p className="text-xs text-white/60">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="requests">{locale === "ar" ? "الطلبات" : "Requests"}</TabsTrigger>
              <TabsTrigger value="today">{locale === "ar" ? "اليوم" : "Today"}</TabsTrigger>
              <TabsTrigger value="upcoming">{locale === "ar" ? "القادمة" : "Upcoming"}</TabsTrigger>
              <TabsTrigger value="all">{locale === "ar" ? "الكل" : "All"}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" asChild>
            <Link to="/business/store/catalog">
              <Wrench className="me-1 size-4" />
              {locale === "ar" ? "إدارة الخدمات" : "Manage services"}
            </Link>
          </Button>
        </div>

        {bookings.isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card px-4 py-14 text-center">
            <CalendarClock className="mx-auto size-10 text-primary" />
            <h3 className="mt-3 font-black">
              {locale === "ar" ? "لا توجد حجوزات في هذا القسم" : "No bookings in this section"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "ستظهر الطلبات الجديدة هنا فور إرسالها."
                : "New requests will appear here immediately."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((booking) => (
              <Card key={booking.id} className="rounded-3xl">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-black">{booking.service_name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <UserRound className="size-3.5" />
                        {booking.customer_name || (locale === "ar" ? "عميل" : "Customer")}
                      </p>
                    </div>
                    <Badge variant={booking.status === "pending" ? "default" : "secondary"}>
                      {providerStatusLabel(booking.status, locale)}
                    </Badge>
                  </div>
                  <div className="grid gap-2 rounded-2xl bg-secondary/55 p-3 text-sm sm:grid-cols-2">
                    <p>
                      <CalendarClock className="me-1 inline size-4 text-primary" />
                      {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                        dateStyle: "medium",
                        timeZone: booking.timezone,
                      }).format(new Date(booking.starts_at))}
                    </p>
                    <p>
                      <Clock3 className="me-1 inline size-4 text-primary" />
                      {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: booking.timezone,
                      }).format(new Date(booking.starts_at))}
                    </p>
                    <p className="text-muted-foreground">
                      {providerModeLabel(booking.service_mode, locale)}
                    </p>
                    <p className="font-black text-primary">
                      {booking.total} {currencyLabel(booking.currency_code, locale)}
                    </p>
                  </div>
                  {booking.address_text ? (
                    <p className="text-xs text-muted-foreground">
                      <MapPin className="me-1 inline size-3.5" />
                      {booking.address_text}
                      {booking.district ? ` · ${booking.district}` : ""}
                    </p>
                  ) : null}
                  {booking.customer_notes ? (
                    <p className="rounded-xl border-s-4 border-primary bg-primary/5 p-3 text-xs leading-5">
                      {booking.customer_notes}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {busyId === booking.id ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : null}
                    {booking.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === booking.id}
                          onClick={() => void act(booking, "confirmed")}
                        >
                          <Check className="me-1 size-4" />
                          {locale === "ar" ? "تأكيد" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === booking.id}
                          onClick={() => void act(booking, "rejected")}
                        >
                          <X className="me-1 size-4" />
                          {locale === "ar" ? "رفض" : "Reject"}
                        </Button>
                      </>
                    ) : null}
                    {booking.status === "confirmed" && booking.service_mode === "at_customer" ? (
                      <Button
                        size="sm"
                        disabled={busyId === booking.id}
                        onClick={() => void act(booking, "en_route")}
                      >
                        <MapPin className="me-1 size-4" />
                        {locale === "ar" ? "في الطريق" : "En route"}
                      </Button>
                    ) : null}
                    {booking.status === "confirmed" || booking.status === "en_route" ? (
                      <Button
                        size="sm"
                        disabled={busyId === booking.id}
                        onClick={() => void act(booking, "in_progress")}
                      >
                        <Play className="me-1 size-4" />
                        {locale === "ar" ? "بدء الخدمة" : "Start"}
                      </Button>
                    ) : null}
                    {booking.status === "in_progress" ? (
                      <Button
                        size="sm"
                        disabled={busyId === booking.id}
                        onClick={() => void act(booking, "completed")}
                      >
                        <Check className="me-1 size-4" />
                        {locale === "ar" ? "إنهاء الخدمة" : "Complete"}
                      </Button>
                    ) : null}
                    {(["pending", "confirmed", "en_route"] as BookingStatus[]).includes(
                      booking.status,
                    ) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busyId === booking.id}
                        onClick={() => void act(booking, "cancelled_by_provider")}
                      >
                        {locale === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                    ) : null}
                    <span className="ms-auto font-mono text-[10px] text-muted-foreground" dir="ltr">
                      {booking.booking_number}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
