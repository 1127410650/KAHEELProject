import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";

import {
  appointmentAction,
  appointmentErrorMessage,
  createAppointment,
  getAvailableSlots,
  getMyContext,
  getProviderDashboard,
  getPublicDirectory,
  getPublicProvider,
  joinQueue,
  queueAction,
  type AppointmentService,
  type CustomerAppointment,
  type CustomerQueue,
  type MyContext,
  type ProviderDashboard,
  type PublicProvider,
  type Slot,
} from "./api";
import { CustomerArea, type Busy } from "./CustomerArea";
import { ProviderArea } from "./ProviderArea";
import { AUTH_URL, MARKET_URL, REGISTER_URL, getCopy, today } from "./copy";
import { Card, Empty, Pill, Spinner, cx, money } from "./ui";

type View = "discover" | "mine" | "provider";

function linkedProviderSlug() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("provider")?.trim() ?? "";
}

export function AppointmentsApp() {
  const { locale, dir } = useI18n();
  const session = useSession();
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const copy = useMemo(() => getCopy(isAr), [isAr]);

  const [view, setView] = useState<View>("discover");
  const [directory, setDirectory] = useState<PublicProvider[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [context, setContext] = useState<MyContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const [selectedProvider, setSelectedProvider] = useState<PublicProvider | null>(null);
  const [selectedService, setSelectedService] = useState<AppointmentService | null>(null);
  const [bookingDate, setBookingDate] = useState(today());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [customerName, setCustomerName] = useState(session.profile?.full_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(session.profile?.phone ?? "");
  const [customerNotes, setCustomerNotes] = useState("");

  const [activeProviderId, setActiveProviderId] = useState("");
  const [providerDate, setProviderDate] = useState(today());
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const slug = linkedProviderSlug();
      if (slug && !query.trim() && !city.trim()) {
        const provider = await getPublicProvider(slug);
        setDirectory(provider ? [provider] : []);
      } else {
        setDirectory(await getPublicDirectory({ q: query, city, limit: 40 }));
      }
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setDirectoryLoading(false);
    }
  }, [city, locale, query]);

  const loadContext = useCallback(async () => {
    if (session.status !== "authenticated") {
      setContext(null);
      return;
    }
    setContextLoading(true);
    try {
      const next = await getMyContext();
      setContext(next);
      setActiveProviderId((current) => current || next.providers[0]?.id || "");
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setContextLoading(false);
    }
  }, [locale, session.status]);

  const loadDashboard = useCallback(async () => {
    if (!activeProviderId || session.status !== "authenticated") {
      setDashboard(null);
      return;
    }
    setDashboardLoading(true);
    try {
      setDashboard(await getProviderDashboard(activeProviderId, providerDate));
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setDashboardLoading(false);
    }
  }, [activeProviderId, locale, providerDate, session.status]);

  useEffect(() => { void loadDirectory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadContext(); }, [session.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (view === "provider") void loadDashboard();
  }, [view, activeProviderId, providerDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (session.profile?.full_name) setCustomerName(session.profile.full_name);
    if (session.profile?.phone) setCustomerPhone(session.profile.phone);
  }, [session.profile]);
  useEffect(() => {
    if (view === "discover" || session.status !== "authenticated") return;
    const timer = window.setInterval(() => {
      if (view === "mine") void loadContext();
      if (view === "provider") void loadDashboard();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadContext, loadDashboard, session.status, view]);

  async function chooseService(provider: PublicProvider, service: AppointmentService) {
    setSelectedProvider(provider);
    setSelectedService(service);
    setSelectedSlot("");
    setSlots([]);
    if (service.booking_mode !== "queue") await loadSlots(provider.id, service.id, bookingDate);
  }

  async function loadSlots(providerId: string, serviceId: string, date: string) {
    setSlotsLoading(true);
    try {
      setSlots(await getAvailableSlots(providerId, serviceId, date));
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setSlotsLoading(false);
    }
  }

  async function changeBookingDate(value: string) {
    setBookingDate(value);
    setSelectedSlot("");
    if (selectedProvider && selectedService && selectedService.booking_mode !== "queue") {
      await loadSlots(selectedProvider.id, selectedService.id, value);
    }
  }

  async function submitAppointment(event: FormEvent) {
    event.preventDefault();
    if (!selectedProvider || !selectedService || !selectedSlot) return;
    setBusy("book");
    try {
      await createAppointment({
        providerId: selectedProvider.id,
        serviceId: selectedService.id,
        startsAt: selectedSlot,
        customerName,
        customerPhone,
        notes: customerNotes,
        source: "web",
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(copy.saved);
      closeBooking();
      await loadContext();
      setView("mine");
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function submitQueue() {
    if (!selectedProvider || !selectedService) return;
    setBusy("queue");
    try {
      await joinQueue({
        providerId: selectedProvider.id,
        serviceId: selectedService.id,
        customerName,
        customerPhone,
        notes: customerNotes,
      });
      toast.success(copy.saved);
      closeBooking();
      await loadContext();
      setView("mine");
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  function closeBooking() {
    setSelectedProvider(null);
    setSelectedService(null);
    setSelectedSlot("");
    setCustomerNotes("");
  }

  async function customerCancel(appointment: CustomerAppointment) {
    setBusy(appointment.id);
    try {
      await appointmentAction(appointment.id, "cancelled_by_customer");
      toast.success(copy.saved);
      await loadContext();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function cancelQueue(entry: CustomerQueue) {
    setBusy(entry.id);
    try {
      await queueAction(entry.id, "cancelled");
      toast.success(copy.saved);
      await loadContext();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setBusy(null);
    }
  }

  const nav = [
    { id: "discover" as const, label: copy.discover, icon: Search },
    { id: "mine" as const, label: copy.mine, icon: CalendarCheck2 },
    { id: "provider" as const, label: copy.provider, icon: UsersRound },
  ];

  return (
    <main dir={dir} className="min-h-dvh bg-background pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setView("discover")} className="min-w-0 text-start">
            <strong className="block truncate text-base font-black sm:text-lg">{copy.brand}</strong>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{copy.subBrand}</span>
          </button>
          <nav className="ms-5 hidden items-center gap-1 md:flex">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
                  view === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />{label}
              </button>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle compact />
            {session.status === "unauthenticated" ? (
              <a href={AUTH_URL} className="hidden rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary sm:block">
                {copy.signIn}
              </a>
            ) : null}
            <Button asChild size="sm" variant="outline" className="h-10 rounded-xl">
              <a href={MARKET_URL}>
                <Store className="size-4" />
                <span className="hidden sm:inline">{copy.market}</span>
                <span className="sm:hidden">كَحيل</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      {view === "discover" ? (
        <DiscoverArea
          copy={copy}
          locale={locale}
          isAr={isAr}
          Arrow={Arrow}
          directory={directory}
          query={query}
          city={city}
          loading={directoryLoading}
          setQuery={setQuery}
          setCity={setCity}
          onSearch={() => void loadDirectory()}
          onChoose={(provider, service) => void chooseService(provider, service)}
        />
      ) : null}

      {view === "mine" ? (
        <CustomerArea
          copy={copy}
          locale={locale}
          status={session.status}
          context={context}
          loading={contextLoading}
          busy={busy}
          onRefresh={() => void loadContext()}
          onCancel={(item) => void customerCancel(item)}
          onCancelQueue={(item) => void cancelQueue(item)}
          onBook={() => setView("discover")}
        />
      ) : null}

      {view === "provider" ? (
        <ProviderArea
          copy={copy}
          locale={locale}
          status={session.status}
          context={context}
          contextLoading={contextLoading}
          providerId={activeProviderId}
          onProviderId={setActiveProviderId}
          date={providerDate}
          onDate={setProviderDate}
          dashboard={dashboard}
          loading={dashboardLoading}
          busy={busy}
          setBusy={setBusy}
          onRefresh={async () => { await loadContext(); await loadDashboard(); }}
        />
      ) : null}

      {selectedProvider && selectedService ? (
        <BookingPanel
          copy={copy}
          locale={locale}
          isAr={isAr}
          status={session.status}
          provider={selectedProvider}
          service={selectedService}
          date={bookingDate}
          slots={slots}
          slot={selectedSlot}
          slotsLoading={slotsLoading}
          name={customerName}
          phone={customerPhone}
          notes={customerNotes}
          busy={busy}
          setDate={(value) => void changeBookingDate(value)}
          setSlot={setSelectedSlot}
          setName={setCustomerName}
          setPhone={setCustomerPhone}
          setNotes={setCustomerNotes}
          onClose={closeBooking}
          onSubmit={submitAppointment}
          onQueue={() => void submitQueue()}
        />
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cx(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold",
              view === id ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" /><span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function DiscoverArea({
  copy,
  locale,
  isAr,
  Arrow,
  directory,
  query,
  city,
  loading,
  setQuery,
  setCity,
  onSearch,
  onChoose,
}: {
  copy: ReturnType<typeof getCopy>;
  locale: "ar" | "en";
  isAr: boolean;
  Arrow: typeof ArrowLeft;
  directory: PublicProvider[];
  query: string;
  city: string;
  loading: boolean;
  setQuery: (value: string) => void;
  setCity: (value: string) => void;
  onSearch: () => void;
  onChoose: (provider: PublicProvider, service: AppointmentService) => void;
}) {
  return (
    <section>
      <div className="border-b border-border bg-[radial-gradient(circle_at_50%_0%,var(--color-secondary),transparent_70%)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Pill tone="green"><Sparkles className="me-1.5 size-3.5" />{copy.subBrand}</Pill>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">{copy.hero}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">{copy.heroBody}</p>
          </div>
          <form
            className="mt-8 grid max-w-4xl gap-3 rounded-3xl border border-border bg-card p-3 shadow-raised sm:grid-cols-[1fr_14rem_auto]"
            onSubmit={(event) => { event.preventDefault(); onSearch(); }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="h-12 ps-10" />
            </div>
            <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder={copy.city} className="h-12" />
            <Button type="submit" className="h-12 rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {copy.searchAction}
            </Button>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{copy.providers}</h2>
          <Button variant="ghost" size="sm" onClick={onSearch} disabled={loading}>
            <RefreshCw className={cx("size-4", loading && "animate-spin")} />{copy.refresh}
          </Button>
        </div>
        {loading ? (
          <Spinner label={copy.searchAction} />
        ) : directory.length === 0 ? (
          <Empty title={copy.noProviders} body={copy.noProvidersBody} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {directory.map((provider) => (
              <Card key={provider.id} className="overflow-hidden">
                <div className="h-24 bg-gradient-to-br from-secondary via-secondary/60 to-background" />
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                      {provider.name_ar.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black">{isAr ? provider.name_ar : provider.name_en || provider.name_ar}</h3>
                      {provider.city ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3.5" />{provider.city}{provider.district ? ` · ${provider.district}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {(isAr ? provider.bio_ar : provider.bio_en || provider.bio_ar) ? (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {isAr ? provider.bio_ar : provider.bio_en || provider.bio_ar}
                    </p>
                  ) : null}
                  <p className="mt-5 text-xs font-black text-muted-foreground">{copy.chooseService}</p>
                  <div className="mt-2 space-y-2">
                    {provider.services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => onChoose(provider, service)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-start transition hover:border-primary/50 hover:bg-secondary/50"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                          <CalendarCheck2 className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{isAr ? service.name_ar : service.name_en || service.name_ar}</strong>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{service.duration_minutes} {copy.minutes}</span>
                        </span>
                        <span className="text-xs font-black">{money(service.price, service.currency_code, locale)}</span>
                        <Arrow className="size-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BookingPanel({
  copy,
  locale,
  isAr,
  status,
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
  setName,
  setPhone,
  setNotes,
  onClose,
  onSubmit,
  onQueue,
}: {
  copy: ReturnType<typeof getCopy>;
  locale: "ar" | "en";
  isAr: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
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
  setName: (value: string) => void;
  setPhone: (value: string) => void;
  setNotes: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onQueue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true">
      <Card className="max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">{provider.name_ar}</p>
            <h2 className="mt-1 text-xl font-black">{isAr ? service.name_ar : service.name_en || service.name_ar}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {service.duration_minutes} {copy.minutes} · {money(service.price, service.currency_code, locale)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>

        {status !== "authenticated" ? (
          <div className="mt-6 rounded-2xl bg-secondary p-5 text-center">
            <ShieldCheck className="mx-auto size-7 text-primary" />
            <p className="mt-3 text-sm font-bold">{copy.loginFirst}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild><a href={AUTH_URL}>{copy.signIn}</a></Button>
              <Button asChild variant="outline"><a href={REGISTER_URL}>{copy.register}</a></Button>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={(event) => void onSubmit(event)}>
            {service.booking_mode !== "queue" ? (
              <>
                <div>
                  <Label htmlFor="appt-date">{copy.date}</Label>
                  <Input id="appt-date" type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 h-11" />
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
                            slot === item.starts_at ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="customer-name">{copy.name}</Label>
                <Input id="customer-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="customer-phone">{copy.phone}</Label>
                <Input id="customer-phone" className="mt-2" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="customer-notes">{copy.notes}</Label>
              <Textarea id="customer-notes" className="mt-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
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
