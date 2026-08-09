import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  Home,
  Laptop,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  Store,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { currentPath, currencyLabel, loginHref } from "@/lib/mkt";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  createServiceBooking,
  serviceErrorMessage,
  useServiceBookingContext,
  useServiceSlots,
  type ServiceMode,
} from "@/lib/mkt-services";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/services/$slug/$itemId/book")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "اختيار موعد الخدمة — كَحيل" },
      { name: "description", content: "اختر مقدم الخدمة والتاريخ والوقت ثم أكد حجزك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ServiceBookingPage,
});

function localDate(timezone = "Asia/Riyadh") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const MODE_ICON = { at_provider: Store, at_customer: Home, remote: Laptop } satisfies Record<
  ServiceMode,
  typeof Store
>;

function ServiceBookingPage() {
  const { slug, itemId } = Route.useParams();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const context = useServiceBookingContext(slug, itemId);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(localDate());
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [mode, setMode] = useState<ServiceMode>("at_provider");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotency = useRef(crypto.randomUUID());
  const slots = useServiceSlots(itemId, date, professionalId);

  useEffect(() => {
    const data = context.data;
    if (!data) return;
    setDate((current) => current || localDate(data.settings.timezone));
    setMode((current) =>
      data.settings.service_modes.includes(current) ? current : data.settings.service_modes[0]!,
    );
  }, [context.data]);

  useEffect(() => setSlotStart(null), [date, professionalId]);

  const selectedSlot = useMemo(
    () => slots.data?.find((slot) => slot.starts_at === slotStart) ?? null,
    [slotStart, slots.data],
  );

  if (context.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </MarketShell>
    );
  }

  const data = context.data;
  if (!data) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <CalendarDays className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-black">
            {locale === "ar" ? "الخدمة غير متاحة للحجز" : "Service unavailable"}
          </h1>
          <Button asChild className="mt-5">
            <Link to="/services">{locale === "ar" ? "تصفح الخدمات" : "Browse services"}</Link>
          </Button>
        </div>
      </MarketShell>
    );
  }

  const serviceName =
    locale === "ar" ? data.service.name_ar : data.service.name_en || data.service.name_ar;
  const storeName = locale === "ar" ? data.store.name_ar : data.store.name_en || data.store.name_ar;
  const image = data.service.image_path ? data.media[data.service.image_path] : undefined;
  const total = data.service.base_price + (mode === "at_customer" ? data.settings.visit_fee : 0);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + data.settings.max_advance_days);
  const maxDateValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maxDate);

  const goNext = () => {
    if (step === 1 && !slotStart) {
      toast.error(
        locale === "ar" ? "اختر موعدًا متاحًا أولًا." : "Choose an available time first.",
      );
      return;
    }
    if (step === 2 && mode === "at_customer" && !address.trim()) {
      toast.error(locale === "ar" ? "أدخل عنوان تنفيذ الخدمة." : "Enter the service address.");
      return;
    }
    setStep((value) => Math.min(3, value + 1));
  };

  const submit = async () => {
    if (!session || !account || !slotStart) return;
    setSubmitting(true);
    try {
      await createServiceBooking({
        accountKey: account.account_key,
        serviceItemId: itemId,
        startsAt: slotStart,
        professionalId: selectedSlot?.professional_id ?? professionalId,
        serviceMode: mode,
        customerPhone: phone,
        addressText: address,
        district,
        notes,
        idempotencyKey: idempotency.current,
      });
      toast.success(
        data.settings.confirmation_mode === "instant"
          ? locale === "ar"
            ? "تم تأكيد موعدك."
            : "Your appointment is confirmed."
          : locale === "ar"
            ? "أُرسل طلب الحجز إلى مقدم الخدمة."
            : "Booking request sent to the provider.",
      );
      void navigate({ to: "/my/bookings" });
    } catch (error) {
      toast.error(serviceErrorMessage(error, locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:py-8">
        <Link
          to="/stores/$slug"
          params={{ slug }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {locale === "ar" ? "العودة إلى مقدم الخدمة" : "Back to provider"}
        </Link>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-3xl">
              <CardContent className="flex gap-4 p-4 sm:p-5">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-market-navy to-cyan-800 sm:size-28">
                  {image ? (
                    <img src={image} alt={serviceName} className="size-full object-cover" />
                  ) : (
                    <CalendarDays className="size-9 text-white/80" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-black sm:text-xl">{serviceName}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                    {storeName}
                    <VerifiedBadge status={data.store.verification_status} />
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">
                      <Clock3 className="me-1 size-3.5" />
                      {data.service.duration_minutes} {locale === "ar" ? "دقيقة" : "min"}
                    </Badge>
                    <Badge variant="secondary">
                      <Star className="me-1 size-3.5 fill-amber-400 text-amber-400" />
                      {data.rating || (locale === "ar" ? "جديد" : "New")}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div
              className="flex items-center gap-2"
              aria-label={locale === "ar" ? "خطوات الحجز" : "Booking steps"}
            >
              {[1, 2, 3].map((value) => (
                <div key={value} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${value <= step ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground"}`}
                  >
                    {value < step ? <Check className="size-4" /> : value}
                  </span>
                  {value < 3 ? (
                    <span className={`h-0.5 flex-1 ${value < step ? "bg-primary" : "bg-border"}`} />
                  ) : null}
                </div>
              ))}
            </div>

            {step === 1 ? (
              <Card className="rounded-3xl">
                <CardContent className="space-y-5 p-4 sm:p-6">
                  <div>
                    <h2 className="text-lg font-black">
                      {locale === "ar" ? "اختر المختص والموعد" : "Choose a professional and time"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {locale === "ar"
                        ? "لا نعرض إلا الأوقات المتاحة فعليًا."
                        : "Only genuinely available slots are shown."}
                    </p>
                  </div>
                  {data.professionals.length > 1 ? (
                    <div className="space-y-2">
                      <Label>{locale === "ar" ? "مقدم الخدمة" : "Professional"}</Label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          onClick={() => setProfessionalId(null)}
                          className={`min-w-28 rounded-2xl border p-3 text-sm font-bold ${professionalId === null ? "border-primary bg-primary/5" : ""}`}
                        >
                          {locale === "ar" ? "أي مختص متاح" : "Any available"}
                        </button>
                        {data.professionals.map((professional) => (
                          <button
                            key={professional.id}
                            type="button"
                            onClick={() => setProfessionalId(professional.id)}
                            className={`min-w-28 rounded-2xl border p-3 text-sm font-bold ${professionalId === professional.id ? "border-primary bg-primary/5" : ""}`}
                          >
                            <UserRound className="mx-auto mb-1 size-5 text-primary" />
                            {professional.display_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="booking-date">{locale === "ar" ? "التاريخ" : "Date"}</Label>
                    <Input
                      id="booking-date"
                      type="date"
                      dir="ltr"
                      min={localDate(data.settings.timezone)}
                      max={maxDateValue}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الأوقات المتاحة" : "Available times"}</Label>
                    {slots.isLoading ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {Array.from({ length: 8 }, (_, i) => (
                          <Skeleton key={i} className="h-11 rounded-xl" />
                        ))}
                      </div>
                    ) : (slots.data ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                        {locale === "ar"
                          ? "لا توجد مواعيد في هذا اليوم. جرّب يومًا آخر."
                          : "No slots on this day. Try another date."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {(slots.data ?? []).map((slot) => (
                          <button
                            key={`${slot.professional_id}:${slot.starts_at}`}
                            type="button"
                            onClick={() => setSlotStart(slot.starts_at)}
                            className={`rounded-xl border px-2 py-2.5 text-sm font-black transition ${slotStart === slot.starts_at ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
                          >
                            {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: slot.timezone,
                            }).format(new Date(slot.starts_at))}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 2 ? (
              <Card className="rounded-3xl">
                <CardContent className="space-y-5 p-4 sm:p-6">
                  <div>
                    <h2 className="text-lg font-black">
                      {locale === "ar" ? "تفاصيل تقديم الخدمة" : "Service details"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {locale === "ar"
                        ? "اختر المكان وأضف ما يساعد مقدم الخدمة."
                        : "Choose the location and add useful details."}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {data.settings.service_modes.map((value) => {
                      const Icon = MODE_ICON[value];
                      const labels: Record<ServiceMode, [string, string]> = {
                        at_provider: ["لدى مقدم الخدمة", "At provider"],
                        at_customer: ["في موقعي", "At my location"],
                        remote: ["عن بُعد", "Remote"],
                      };
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setMode(value)}
                          className={`rounded-2xl border p-4 text-start ${mode === value ? "border-primary bg-primary/5" : ""}`}
                        >
                          <Icon className="mb-2 size-5 text-primary" />
                          <span className="text-sm font-black">
                            {labels[value][locale === "ar" ? 0 : 1]}
                          </span>
                          {value === "at_customer" && data.settings.visit_fee > 0 ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              +{data.settings.visit_fee}{" "}
                              {currencyLabel(data.service.currency_code, locale)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">
                      {locale === "ar" ? "رقم التواصل (اختياري)" : "Contact number (optional)"}
                    </Label>
                    <Input
                      id="phone"
                      dir="ltr"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                  {mode === "at_customer" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="district">{locale === "ar" ? "الحي" : "District"}</Label>
                        <Input
                          id="district"
                          value={district}
                          onChange={(event) => setDistrict(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="address">
                          {locale === "ar" ? "العنوان التفصيلي" : "Full address"}
                        </Label>
                        <Textarea
                          id="address"
                          rows={2}
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">
                      {locale === "ar" ? "ملاحظات لمقدم الخدمة" : "Notes for the provider"}
                    </Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      maxLength={500}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 3 ? (
              <Card className="rounded-3xl">
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div>
                    <h2 className="text-lg font-black">
                      {locale === "ar" ? "راجع وأكد الحجز" : "Review and confirm"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.settings.confirmation_mode === "instant"
                        ? locale === "ar"
                          ? "سيُثبت الموعد فور التأكيد."
                          : "The appointment will be confirmed instantly."
                        : locale === "ar"
                          ? "سيراجع مقدم الخدمة الطلب ويؤكده."
                          : "The provider will review and confirm the request."}
                    </p>
                  </div>
                  <dl className="divide-y rounded-2xl border px-4 text-sm">
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">
                        {locale === "ar" ? "الخدمة" : "Service"}
                      </dt>
                      <dd className="font-bold">{serviceName}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">
                        {locale === "ar" ? "الموعد" : "Appointment"}
                      </dt>
                      <dd className="text-end font-bold">
                        {selectedSlot
                          ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: data.settings.timezone,
                            }).format(new Date(selectedSlot.starts_at))
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">
                        {locale === "ar" ? "المختص" : "Professional"}
                      </dt>
                      <dd className="font-bold">{selectedSlot?.professional_name ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">
                        {locale === "ar" ? "الإجمالي" : "Total"}
                      </dt>
                      <dd className="text-lg font-black text-primary">
                        {total} {currencyLabel(data.service.currency_code, locale)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-start gap-2 rounded-2xl bg-secondary/60 p-3 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    {locale === "ar"
                      ? `يمكنك الإلغاء قبل الموعد، وتظهر سياسة الإلغاء (${data.settings.cancellation_window_hours} ساعات) بوضوح في حجوزاتك.`
                      : `You can cancel before the appointment. The ${data.settings.cancellation_window_hours}-hour cancellation policy stays visible in your bookings.`}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={step === 1 || submitting}
                onClick={() => setStep((value) => Math.max(1, value - 1))}
              >
                {locale === "ar" ? "السابق" : "Back"}
              </Button>
              {step < 3 ? (
                <Button onClick={goNext}>{locale === "ar" ? "متابعة" : "Continue"}</Button>
              ) : !session ? (
                <Button asChild>
                  <a href={loginHref(currentPath())}>
                    {locale === "ar" ? "سجّل الدخول لإكمال الحجز" : "Sign in to book"}
                  </a>
                </Button>
              ) : (
                <Button disabled={!account || submitting} onClick={() => void submit()}>
                  {submitting ? (
                    <Loader2 className="me-2 size-4 animate-spin" />
                  ) : (
                    <Check className="me-2 size-4" />
                  )}
                  {locale === "ar" ? "تأكيد الحجز" : "Confirm booking"}
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden lg:block">
            <Card className="sticky top-28 rounded-3xl">
              <CardContent className="space-y-4 p-5">
                <p className="text-xs font-bold text-primary">
                  {locale === "ar" ? "ملخص السعر" : "Price summary"}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{serviceName}</span>
                  <span className="font-bold">
                    {data.service.base_price} {currencyLabel(data.service.currency_code, locale)}
                  </span>
                </div>
                {mode === "at_customer" && data.settings.visit_fee > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "رسوم الزيارة" : "Visit fee"}
                    </span>
                    <span className="font-bold">
                      {data.settings.visit_fee} {currencyLabel(data.service.currency_code, locale)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-3">
                  <span className="font-black">{locale === "ar" ? "الإجمالي" : "Total"}</span>
                  <span className="text-lg font-black text-primary">
                    {total} {currencyLabel(data.service.currency_code, locale)}
                  </span>
                </div>
                <div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
                  <p>
                    <Clock3 className="me-1 inline size-3.5" />
                    {data.service.duration_minutes} {locale === "ar" ? "دقيقة" : "minutes"}
                  </p>
                  {data.store.district ? (
                    <p>
                      <MapPin className="me-1 inline size-3.5" />
                      {data.store.district}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </MarketShell>
  );
}
