import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Search, Store, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
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
import { BookingPanel } from "./BookingPanel";
import { CustomerArea, type Busy } from "./CustomerArea";
import { DiscoverArea } from "./DiscoverArea";
import { ProviderArea } from "./ProviderArea";
import { ProviderLocationCard } from "./ProviderLocationCard";
import { ProviderMarketAccess } from "./ProviderMarketAccess";
import { AUTH_URL, MARKET_URL, getCopy, today } from "./copy";
import { cx } from "./ui";

type View = "discover" | "mine" | "provider";

function linkedProviderSlug() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("provider")?.trim() ?? "";
}

export function AppointmentsApp() {
  const { locale, dir } = useI18n();
  const session = useSession();
  const isAr = locale === "ar";
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
      setActiveProviderId("");
      return;
    }

    setContextLoading(true);
    try {
      const next = await getMyContext();
      setContext(next);
      setActiveProviderId((current) =>
        next.providers.some((provider) => provider.id === current)
          ? current
          : next.providers[0]?.id ?? "",
      );
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
      setDashboard(null);
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setDashboardLoading(false);
    }
  }, [activeProviderId, locale, providerDate, session.status]);

  const refreshProvider = useCallback(async () => {
    await loadContext();
    await loadDashboard();
  }, [loadContext, loadDashboard]);

  useEffect(() => {
    void loadDirectory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadContext();
  }, [session.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === "provider") void loadDashboard();
  }, [view, activeProviderId, providerDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const appointmentName = context?.profile?.display_name;
    const appointmentPhone = context?.profile?.phone_e164;
    if (appointmentName) setCustomerName(appointmentName);
    else if (session.profile?.full_name) setCustomerName(session.profile.full_name);
    if (appointmentPhone) setCustomerPhone(appointmentPhone);
    else if (session.profile?.phone) setCustomerPhone(session.profile.phone);
  }, [context?.profile, session.profile]);

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
    if (service.booking_mode !== "queue") {
      await loadSlots(provider.id, service.id, bookingDate);
    }
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
    if (!selectedProvider || !selectedService || !selectedSlot || !context?.profile) return;

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
    if (!selectedProvider || !selectedService || !context?.profile) return;

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

  const providerAccessRequired =
    session.status !== "authenticated" ||
    (!contextLoading && !context?.provider_eligible && !(context?.providers.length ?? 0));

  return (
    <main dir={dir} className="min-h-dvh bg-background pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setView("discover")} className="min-w-0 text-start">
            <strong className="block truncate text-base font-black sm:text-lg">{copy.brand}</strong>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {copy.subBrand}
            </span>
          </button>

          <nav className="ms-5 hidden items-center gap-1 md:flex">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
                  view === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle compact />
            {session.status === "unauthenticated" ? (
              <a
                href={AUTH_URL}
                className="hidden rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary sm:block"
              >
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
        session.status === "loading" ||
        (session.status === "authenticated" && contextLoading) ? (
          <ProviderMarketAccess copy={copy} locale={locale} loading />
        ) : providerAccessRequired ? (
          <ProviderMarketAccess copy={copy} locale={locale} />
        ) : (
          <>
            {dashboard ? (
              <ProviderLocationCard
                locale={locale}
                dashboard={dashboard}
                onRefresh={refreshProvider}
              />
            ) : null}
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
              onRefresh={refreshProvider}
            />
          </>
        )
      ) : null}

      {selectedProvider && selectedService ? (
        <BookingPanel
          copy={copy}
          locale={locale}
          isAr={isAr}
          status={session.status}
          profileReady={Boolean(context?.profile?.display_name && context?.profile?.phone_e164)}
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
            <Icon className="size-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
