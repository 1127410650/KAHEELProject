import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  appointmentAction,
  appointmentErrorMessage,
  createProvider,
  queueAction,
  replaceAvailability,
  saveMarketLink,
  saveProvider,
  saveService,
  type AppointmentService,
  type AppointmentStatus,
  type AvailabilityRow,
  type MyContext,
  type ProviderAppointment,
  type ProviderDashboard,
  type ProviderQueue,
  type ProviderSettings as ProviderSettingsData,
  type QueueStatus,
} from "./api";
import { AuthRequired, type Busy } from "./CustomerArea";
import { statusAr, statusEn, weekdaysAr, weekdaysEn, type Copy as CopyText } from "./copy";
import { Card, Pill, Spinner, cx, dateTime, money } from "./ui";

export function ProviderArea({
  copy,
  locale,
  status,
  context,
  contextLoading,
  providerId,
  onProviderId,
  date,
  onDate,
  dashboard,
  loading,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  status: "loading" | "authenticated" | "unauthenticated";
  context: MyContext | null;
  contextLoading: boolean;
  providerId: string;
  onProviderId: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  dashboard: ProviderDashboard | null;
  loading: boolean;
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  if (status === "loading" || contextLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-12"><Spinner label={copy.providerMode} /></div>;
  }
  if (status === "unauthenticated") return <AuthRequired copy={copy} />;
  if (!context?.providers.length) {
    return <ProviderOnboarding copy={copy} locale={locale} onCreated={onRefresh} />;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary">{copy.providerMode}</p>
          <h1 className="mt-1 truncate text-3xl font-black">
            {dashboard?.provider.name_ar ?? copy.providerMode}
          </h1>
        </div>
        <select
          value={providerId}
          onChange={(event) => onProviderId(event.target.value)}
          className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold"
        >
          {context.providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name_ar}</option>
          ))}
        </select>
        <Input type="date" value={date} onChange={(event) => onDate(event.target.value)} className="h-11 w-auto" />
        <Button variant="outline" onClick={() => void onRefresh()}>
          <RefreshCw className="size-4" />{copy.refresh}
        </Button>
      </div>

      {loading || !dashboard ? (
        <Spinner label={copy.providerMode} />
      ) : (
        <ProviderDashboardView
          copy={copy}
          locale={locale}
          dashboard={dashboard}
          busy={busy}
          setBusy={setBusy}
          onRefresh={onRefresh}
        />
      )}
    </section>
  );
}

function ProviderOnboarding({
  copy,
  locale,
  onCreated,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  onCreated: () => Promise<void>;
}) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createProvider({ nameAr, nameEn, city });
      toast.success(copy.saved);
      await onCreated();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14">
      <Card className="p-6 sm:p-8">
        <UsersRound className="size-9 text-primary" />
        <h1 className="mt-4 text-2xl font-black">{copy.providerEmpty}</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{copy.providerEmptyBody}</p>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <div>
            <Label htmlFor="provider-name-ar">{copy.providerName}</Label>
            <Input id="provider-name-ar" className="mt-2" required value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="provider-name-en">{copy.englishName}</Label>
            <Input id="provider-name-en" className="mt-2" value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="provider-city">{copy.city}</Label>
            <Input id="provider-city" className="mt-2" value={city} onChange={(event) => setCity(event.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !nameAr.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {copy.createProvider}
          </Button>
        </form>
      </Card>
    </section>
  );
}

function ProviderDashboardView({
  copy,
  locale,
  dashboard,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  dashboard: ProviderDashboard;
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const stats = [
    [copy.todayAppointments, dashboard.stats.today_total, CalendarDays],
    [copy.pending, dashboard.stats.pending, Clock3],
    [copy.liveQueue, dashboard.stats.active_queue, UsersRound],
    [copy.completed, dashboard.stats.completed, Check],
  ] as const;

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label} className="p-5">
            <Icon className="size-5 text-primary" />
            <strong className="mt-3 block text-3xl font-black">{value}</strong>
            <span className="text-xs text-muted-foreground">{label}</span>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <ProviderAppointments copy={copy} locale={locale} items={dashboard.appointments} busy={busy} setBusy={setBusy} onRefresh={onRefresh} />
          <ProviderQueueList copy={copy} locale={locale} items={dashboard.queue} busy={busy} setBusy={setBusy} onRefresh={onRefresh} />
        </div>
        <div className="space-y-6">
          <ServiceManager copy={copy} locale={locale} dashboard={dashboard} busy={busy} setBusy={setBusy} onRefresh={onRefresh} />
          <ScheduleManager copy={copy} locale={locale} dashboard={dashboard} busy={busy} setBusy={setBusy} onRefresh={onRefresh} />
          <ProviderSettingsPanel copy={copy} locale={locale} dashboard={dashboard} busy={busy} setBusy={setBusy} onRefresh={onRefresh} />
        </div>
      </div>
    </>
  );
}

function ProviderAppointments({
  copy,
  locale,
  items,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  items: ProviderAppointment[];
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const labels = locale === "ar" ? statusAr : statusEn;
  const transitions: Partial<Record<AppointmentStatus, Array<[AppointmentStatus, string]>>> = {
    requested: [
      ["confirmed", locale === "ar" ? "تأكيد" : "Confirm"],
      ["rejected", locale === "ar" ? "رفض" : "Reject"],
    ],
    confirmed: [
      ["checked_in", locale === "ar" ? "وصل" : "Check in"],
      ["in_service", locale === "ar" ? "بدء" : "Start"],
    ],
    checked_in: [
      ["in_service", locale === "ar" ? "بدء الخدمة" : "Start service"],
      ["no_show", locale === "ar" ? "لم يحضر" : "No show"],
    ],
    in_service: [["completed", locale === "ar" ? "إنهاء" : "Complete"]],
  };

  async function act(item: ProviderAppointment, action: AppointmentStatus) {
    setBusy(item.id);
    try {
      await appointmentAction(item.id, action);
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-xl font-black">{copy.providerAppointments}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{copy.noToday}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="block">{item.customer_name || item.customer_phone || item.appointment_number}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.service_name} · {dateTime(item.starts_at, locale, item.timezone)}
                  </span>
                </div>
                <Pill tone={item.status === "confirmed" || item.status === "completed" ? "green" : "amber"}>
                  {labels[item.status] ?? item.status}
                </Pill>
              </div>
              {transitions[item.status]?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {transitions[item.status]?.map(([action, label]) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={action === "rejected" || action === "no_show" ? "outline" : "default"}
                      disabled={busy === item.id}
                      onClick={() => void act(item, action)}
                    >
                      {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : null}
                      {label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProviderQueueList({
  copy,
  locale,
  items,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  items: ProviderQueue[];
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const labels = locale === "ar" ? statusAr : statusEn;
  const transitions: Record<string, [QueueStatus, string]> = {
    waiting: ["called", locale === "ar" ? "نداء" : "Call"],
    called: ["serving", locale === "ar" ? "بدء الخدمة" : "Start"],
    serving: ["done", locale === "ar" ? "إنهاء" : "Complete"],
  };

  async function act(item: ProviderQueue) {
    const transition = transitions[item.status];
    if (!transition) return;
    setBusy(item.id);
    try {
      await queueAction(item.id, transition[0]);
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-xl font-black">{copy.providerQueue}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{copy.noQueue}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const transition = transitions[item.status];
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary font-black text-primary-foreground">
                  {item.queue_number}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{item.customer_name || item.customer_phone || `#${item.queue_number}`}</strong>
                  <span className="text-xs text-muted-foreground">{item.service_name}</span>
                </div>
                <Pill tone={item.status === "waiting" ? "amber" : "green"}>{labels[item.status] ?? item.status}</Pill>
                {transition ? (
                  <Button size="sm" disabled={busy === item.id} onClick={() => void act(item)}>
                    {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {transition[1]}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ServiceManager({
  copy,
  locale,
  dashboard,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  dashboard: ProviderDashboard;
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("0");
  const [mode, setMode] = useState("scheduled");

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy("service-new");
    try {
      await saveService(dashboard.provider.id, null, {
        name_ar: name,
        duration_minutes: Number(duration),
        price: Number(price),
        currency_code: "SAR",
        booking_mode: mode,
        is_active: true,
      });
      setName("");
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(service: AppointmentService) {
    setBusy(service.id);
    try {
      await saveService(dashboard.provider.id, service.id, {
        is_active: !service.is_active,
        name_ar: service.name_ar,
        booking_mode: service.booking_mode,
      });
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-black">{copy.services}</h2>
      <div className="mt-4 space-y-2">
        {dashboard.services.map((service) => (
          <div key={service.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3">
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{service.name_ar}</strong>
              <span className="text-[11px] text-muted-foreground">
                {service.duration_minutes} {copy.minutes} · {money(service.price, service.currency_code, locale)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void toggle(service)}
              className="text-xs font-bold text-primary"
              disabled={busy === service.id}
            >
              {service.is_active ? copy.active : copy.inactive}
            </button>
          </div>
        ))}
      </div>
      <form className="mt-5 space-y-3 border-t border-border pt-5" onSubmit={add}>
        <h3 className="text-sm font-black">{copy.addService}</h3>
        <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.serviceName} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="5" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder={copy.duration} />
          <Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder={copy.price} />
        </div>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="scheduled">{copy.scheduled}</option>
          <option value="both">{copy.both}</option>
          <option value="queue">{copy.queueOnly}</option>
        </select>
        <Button type="submit" size="sm" disabled={busy === "service-new" || !name.trim()}>
          {busy === "service-new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {copy.addService}
        </Button>
      </form>
    </Card>
  );
}

function ScheduleManager({
  copy,
  locale,
  dashboard,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  dashboard: ProviderDashboard;
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const names = locale === "ar" ? weekdaysAr : weekdaysEn;
  const initial = useMemo<AvailabilityRow[]>(
    () => Array.from({ length: 7 }, (_, weekday) => {
      const row = dashboard.availability.find((item) => item.weekday === weekday && item.service_id === null);
      return {
        weekday,
        is_active: Boolean(row?.is_active),
        starts_at: (row?.starts_at ?? "09:00").slice(0, 5),
        ends_at: (row?.ends_at ?? "17:00").slice(0, 5),
        slot_interval_minutes: row?.slot_interval_minutes ?? 30,
        service_id: null,
      };
    }),
    [dashboard.availability],
  );
  const [rows, setRows] = useState(initial);
  useEffect(() => setRows(initial), [initial]);

  async function save() {
    setBusy("schedule");
    try {
      await replaceAvailability(dashboard.provider.id, rows);
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-black">{copy.schedule}</h2>
      <div className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <div key={row.weekday} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-secondary/60 p-2">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={row.is_active}
                onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_active: event.target.checked } : item))}
              />
              {names[row.weekday] ?? String(row.weekday)}
            </label>
            <Input
              type="time"
              className="h-9 w-24 px-2 text-xs"
              disabled={!row.is_active}
              value={row.starts_at}
              onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, starts_at: event.target.value } : item))}
            />
            <Input
              type="time"
              className="h-9 w-24 px-2 text-xs"
              disabled={!row.is_active}
              value={row.ends_at}
              onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ends_at: event.target.value } : item))}
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" size="sm" disabled={busy === "schedule"} onClick={() => void save()}>
        {busy === "schedule" ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
        {copy.saveSchedule}
      </Button>
    </Card>
  );
}

function ProviderSettingsPanel({
  copy,
  locale,
  dashboard,
  busy,
  setBusy,
  onRefresh,
}: {
  copy: CopyText;
  locale: "ar" | "en";
  dashboard: ProviderDashboard;
  busy: Busy;
  setBusy: (value: Busy) => void;
  onRefresh: () => Promise<void>;
}) {
  const [marketUrl, setMarketUrl] = useState(dashboard.market_link?.market_url ?? "");
  useEffect(() => setMarketUrl(dashboard.market_link?.market_url ?? ""), [dashboard.market_link?.market_url]);

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/appointments?provider=${encodeURIComponent(dashboard.provider.slug)}`
    : `/appointments?provider=${dashboard.provider.slug}`;
  const published = dashboard.provider.status === "published";

  async function update(patch: Record<string, unknown>, settings?: Partial<ProviderSettingsData>) {
    setBusy("provider-settings");
    try {
      await saveProvider(dashboard.provider.id, patch, settings);
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function link() {
    setBusy("market-link");
    try {
      await saveMarketLink({
        providerId: dashboard.provider.id,
        marketUrl,
        status: marketUrl.trim() ? "linked" : "disconnected",
      });
      toast.success(copy.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(bookingUrl);
    toast.success(copy.copied);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Settings2 className="size-5 text-primary" />{copy.settings}
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3">
          <div>
            <strong className="block text-sm">{copy.accepting}</strong>
            <span className="text-[11px] text-muted-foreground">
              {dashboard.provider.accepts_bookings ? copy.active : copy.inactive}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void update({ accepts_bookings: !dashboard.provider.accepts_bookings })}
            className={cx("relative h-6 w-11 rounded-full transition", dashboard.provider.accepts_bookings ? "bg-primary" : "bg-muted")}
          >
            <span className={cx("absolute top-0.5 size-5 rounded-full bg-white transition", dashboard.provider.accepts_bookings ? "end-0.5" : "start-0.5")} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={dashboard.settings.confirmation_mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => void update({}, { confirmation_mode: "manual" })}
          >
            {copy.manual}
          </Button>
          <Button
            variant={dashboard.settings.confirmation_mode === "instant" ? "default" : "outline"}
            size="sm"
            onClick={() => void update({}, { confirmation_mode: "instant" })}
          >
            {copy.instant}
          </Button>
        </div>
        <Button
          className="w-full"
          variant={published ? "outline" : "default"}
          disabled={busy === "provider-settings"}
          onClick={() => void update({ status: published ? "paused" : "published" })}
        >
          {published ? copy.pause : copy.publish}
        </Button>
        <div className="border-t border-border pt-4">
          <Label>{copy.bookingLink}</Label>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={bookingUrl} />
            <Button variant="outline" size="icon" onClick={() => void copyLink()} aria-label={copy.copy}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>{copy.marketLink}</Label>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{copy.marketLinkHelp}</p>
          <div className="mt-2 flex gap-2">
            <Input value={marketUrl} onChange={(event) => setMarketUrl(event.target.value)} placeholder="https://..." />
            <Button variant="outline" disabled={busy === "market-link"} onClick={() => void link()}>
              {busy === "market-link" ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              {copy.save}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
