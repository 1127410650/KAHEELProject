import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, Check, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  saveProviderSetup,
  serviceErrorMessage,
  useProviderSetup,
  useServiceCategories,
  type ServiceMode,
} from "@/lib/mkt-services";

export const Route = createFileRoute("/dashboard/service/settings")({
  ssr: false,
  head: () => ({
    meta: [{ title: "إعدادات مقدم الخدمة — كحلي" }, { name: "robots", content: "noindex" }],
  }),
  component: ProviderSettingsPage,
});

type DayRow = { weekday: number; starts_at: string; ends_at: string; is_active: boolean };

const DEFAULT_DAYS: DayRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  starts_at: "09:00",
  ends_at: "17:00",
  is_active: weekday <= 4,
}));

function ProviderSettingsPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const setup = useProviderSetup(accountKey);
  const categories = useServiceCategories();
  const hydrated = useRef(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("other");
  const [confirmation, setConfirmation] = useState<"instant" | "manual">("manual");
  const [modes, setModes] = useState<ServiceMode[]>(["at_provider"]);
  const [accepts, setAccepts] = useState(true);
  const [notice, setNotice] = useState("120");
  const [advance, setAdvance] = useState("60");
  const [interval, setInterval] = useState("30");
  const [buffer, setBuffer] = useState("0");
  const [cancelWindow, setCancelWindow] = useState("6");
  const [visitFee, setVisitFee] = useState("0");
  const [professionalName, setProfessionalName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [professionalBio, setProfessionalBio] = useState("");
  const [days, setDays] = useState<DayRow[]>(DEFAULT_DAYS);

  useEffect(() => {
    if (hydrated.current || !setup.data) return;
    hydrated.current = true;
    const data = setup.data;
    const primary = data.professionals.find((row) => row.is_primary) ?? data.professionals[0];
    setCategory(data.settings.category_code);
    setConfirmation(data.settings.confirmation_mode);
    setModes(data.settings.service_modes);
    setAccepts(data.settings.accepts_bookings);
    setNotice(String(data.settings.min_notice_minutes));
    setAdvance(String(data.settings.max_advance_days));
    setInterval(String(data.settings.slot_interval_minutes));
    setBuffer(String(data.settings.buffer_minutes));
    setCancelWindow(String(data.settings.cancellation_window_hours));
    setVisitFee(String(data.settings.visit_fee));
    setProfessionalName(primary?.display_name ?? data.store_name);
    setProfessionalTitle(primary?.title ?? "");
    setProfessionalBio(primary?.bio ?? "");
    setDays(
      DEFAULT_DAYS.map((day) => {
        const saved = data.availability.find(
          (row) => row.professional_id === primary?.id && row.weekday === day.weekday,
        );
        return saved
          ? {
              weekday: day.weekday,
              starts_at: saved.starts_at.slice(0, 5),
              ends_at: saved.ends_at.slice(0, 5),
              is_active: saved.is_active,
            }
          : { ...day, is_active: false };
      }),
    );
  }, [setup.data]);

  const toggleMode = (mode: ServiceMode) => {
    setModes((current) =>
      current.includes(mode)
        ? current.length === 1
          ? current
          : current.filter((value) => value !== mode)
        : [...current, mode],
    );
  };

  const updateDay = (weekday: number, patch: Partial<DayRow>) => {
    setDays((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    );
  };

  const save = async () => {
    if (!accountKey) return;
    if (!professionalName.trim()) {
      toast.error(locale === "ar" ? "أدخل اسم مقدم الخدمة." : "Enter the provider name.");
      return;
    }
    if (days.every((row) => !row.is_active)) {
      toast.error(
        locale === "ar" ? "فعّل يوم عمل واحدًا على الأقل." : "Enable at least one working day.",
      );
      return;
    }
    if (days.some((row) => row.is_active && row.starts_at >= row.ends_at)) {
      toast.error(
        locale === "ar"
          ? "تحقق من بداية ونهاية ساعات العمل."
          : "Check working-hour start and end times.",
      );
      return;
    }
    setSaving(true);
    try {
      await saveProviderSetup(
        accountKey,
        {
          category_code: category,
          confirmation_mode: confirmation,
          service_modes: modes,
          accepts_bookings: accepts,
          min_notice_minutes: Number(notice),
          max_advance_days: Number(advance),
          slot_interval_minutes: Number(interval),
          buffer_minutes: Number(buffer),
          cancellation_window_hours: Number(cancelWindow),
          visit_fee: Number(visitFee),
          professional_name: professionalName.trim(),
          professional_title: professionalTitle.trim() || null,
          professional_bio: professionalBio.trim() || null,
        },
        days,
      );
      await queryClient.invalidateQueries({ queryKey: ["mkt", "service-provider-setup"] });
      toast.success(locale === "ar" ? "حُفظت إعدادات المواعيد." : "Booking settings saved.");
    } catch (error) {
      toast.error(serviceErrorMessage(error, locale));
    } finally {
      setSaving(false);
    }
  };

  if (setup.isLoading || categories.isLoading) {
    return (
      <DashboardShell title={locale === "ar" ? "إعدادات مقدم الخدمة" : "Provider settings"}>
        <Skeleton className="h-[560px] rounded-3xl" />
      </DashboardShell>
    );
  }

  if (!setup.data) {
    return (
      <DashboardShell title={locale === "ar" ? "إعدادات مقدم الخدمة" : "Provider settings"}>
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <Settings2 className="mx-auto size-9 text-primary" />
            <p className="font-black">
              {locale === "ar"
                ? "هذه الإعدادات مخصصة لمتجر الخدمات."
                : "These settings require a service store."}
            </p>
            <Button asChild>
              <Link to="/dashboard/store/new">
                {locale === "ar" ? "إعداد المتجر" : "Set up store"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const dayNames =
    locale === "ar"
      ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const modeLabels: Record<ServiceMode, [string, string]> = {
    at_provider: ["في مقر مقدم الخدمة", "At provider"],
    at_customer: ["زيارة موقع العميل", "At customer"],
    remote: ["عن بُعد", "Remote"],
  };

  return (
    <DashboardShell title={locale === "ar" ? "إعدادات مقدم الخدمة" : "Provider settings"} narrow>
      <div className="space-y-5">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/service">
            <ArrowLeft className="me-1 size-4 rtl:rotate-180" />
            {locale === "ar" ? "العودة إلى مركز الخدمة" : "Back to provider center"}
          </Link>
        </Button>

        <Card className="rounded-3xl">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-black">
                {locale === "ar" ? "هوية الخدمة والحجز" : "Service and booking profile"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "هذه البيانات تتحكم فيما يراه العميل وطريقة وصول الطلب إليك."
                  : "These settings control what customers see and how requests reach you."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-category">
                {locale === "ar" ? "تصنيف الخدمات" : "Service category"}
              </Label>
              <select
                id="service-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(categories.data ?? []).map((row) => (
                  <option key={row.code} value={row.code}>
                    {locale === "ar" ? row.name_ar : row.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="professional-name">
                  {locale === "ar" ? "اسم مقدم الخدمة" : "Provider name"}
                </Label>
                <Input
                  id="professional-name"
                  value={professionalName}
                  onChange={(event) => setProfessionalName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="professional-title">
                  {locale === "ar" ? "المسمى أو التخصص" : "Title or specialty"}
                </Label>
                <Input
                  id="professional-title"
                  value={professionalTitle}
                  onChange={(event) => setProfessionalTitle(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professional-bio">
                {locale === "ar" ? "نبذة مختصرة" : "Short bio"}
              </Label>
              <Textarea
                id="professional-bio"
                rows={3}
                maxLength={500}
                value={professionalBio}
                onChange={(event) => setProfessionalBio(event.target.value)}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-2xl border p-4">
              <span>
                <span className="block text-sm font-black">
                  {locale === "ar" ? "استقبال الحجوزات" : "Accept bookings"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "يمكن إيقاف المواعيد مؤقتًا دون إخفاء المتجر."
                    : "Pause appointments without hiding the store."}
                </span>
              </span>
              <Switch checked={accepts} onCheckedChange={setAccepts} />
            </label>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-black">
                {locale === "ar" ? "طريقة تقديم الخدمة" : "Service modes"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "اختر طريقة واحدة أو أكثر. لا يمكن تعطيل جميع الطرق."
                  : "Choose one or more modes. At least one must stay enabled."}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["at_provider", "at_customer", "remote"] as ServiceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={modes.includes(mode)}
                  onClick={() => toggleMode(mode)}
                  className={`rounded-2xl border p-4 text-start text-sm font-black ${modes.includes(mode) ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}
                >
                  {modes.includes(mode) ? (
                    <Check className="mb-2 size-4" />
                  ) : (
                    <span className="mb-2 block size-4 rounded-full border" />
                  )}
                  {modeLabels[mode][locale === "ar" ? 0 : 1]}
                </button>
              ))}
            </div>
            {modes.includes("at_customer") ? (
              <div className="space-y-1.5">
                <Label htmlFor="visit-fee">{locale === "ar" ? "رسوم الزيارة" : "Visit fee"}</Label>
                <Input
                  id="visit-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={visitFee}
                  onChange={(event) => setVisitFee(event.target.value)}
                  className="max-w-xs"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-black">
                {locale === "ar" ? "قواعد المواعيد" : "Booking rules"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "تُطبق القواعد على الخادم، لذلك لا يستطيع العميل تجاوزها."
                  : "Rules are enforced on the server and cannot be bypassed by the customer."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmation">
                {locale === "ar" ? "تأكيد الحجز" : "Booking confirmation"}
              </Label>
              <select
                id="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value as "instant" | "manual")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="manual">
                  {locale === "ar" ? "مراجعة يدوية قبل التأكيد" : "Manual confirmation"}
                </option>
                <option value="instant">
                  {locale === "ar" ? "تأكيد فوري" : "Instant confirmation"}
                </option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                id="notice"
                label={locale === "ar" ? "أقل إشعار (دقيقة)" : "Minimum notice (min)"}
                value={notice}
                setValue={setNotice}
                min={0}
              />
              <NumberField
                id="advance"
                label={locale === "ar" ? "الحجز مقدمًا (يوم)" : "Advance window (days)"}
                value={advance}
                setValue={setAdvance}
                min={1}
              />
              <SelectNumber
                id="interval"
                label={locale === "ar" ? "فاصل المواعيد" : "Slot interval"}
                value={interval}
                setValue={setInterval}
                values={[10, 15, 20, 30, 45, 60]}
              />
              <NumberField
                id="buffer"
                label={locale === "ar" ? "فاصل الراحة (دقيقة)" : "Buffer (min)"}
                value={buffer}
                setValue={setBuffer}
                min={0}
              />
              <NumberField
                id="cancel-window"
                label={locale === "ar" ? "نافذة الإلغاء (ساعة)" : "Cancellation window (hours)"}
                value={cancelWindow}
                setValue={setCancelWindow}
                min={0}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <CalendarRange className="size-5 text-primary" />
              <div>
                <h2 className="text-lg font-black">
                  {locale === "ar" ? "جدول العمل الأسبوعي" : "Weekly availability"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locale === "ar"
                    ? "المواعيد المحجوزة والإجازات تُستبعد تلقائيًا."
                    : "Booked times and time off are excluded automatically."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {days.map((day) => (
                <div
                  key={day.weekday}
                  className="grid grid-cols-[minmax(88px,1fr)_auto] items-center gap-3 rounded-2xl border p-3 sm:grid-cols-[140px_1fr_1fr_auto]"
                >
                  <span className="text-sm font-black">{dayNames[day.weekday]}</span>
                  <Input
                    type="time"
                    dir="ltr"
                    disabled={!day.is_active}
                    value={day.starts_at}
                    onChange={(event) => updateDay(day.weekday, { starts_at: event.target.value })}
                  />
                  <Input
                    type="time"
                    dir="ltr"
                    disabled={!day.is_active}
                    value={day.ends_at}
                    onChange={(event) => updateDay(day.weekday, { ends_at: event.target.value })}
                  />
                  <Switch
                    checked={day.is_active}
                    onCheckedChange={(value) => updateDay(day.weekday, { is_active: value })}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border bg-background/90 p-3 shadow-xl backdrop-blur">
          <Button size="lg" disabled={saving} onClick={() => void save()}>
            {saving ? (
              <Loader2 className="me-2 size-4 animate-spin" />
            ) : (
              <Check className="me-2 size-4" />
            )}
            {locale === "ar" ? "حفظ إعدادات المواعيد" : "Save booking settings"}
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}

function NumberField({
  id,
  label,
  value,
  setValue,
  min,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  min: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        dir="ltr"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

function SelectNumber({
  id,
  label,
  value,
  setValue,
  values,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  values: number[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        dir="ltr"
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {option} min
          </option>
        ))}
      </select>
    </div>
  );
}
