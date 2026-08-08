import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { AppointmentService, PublicProvider } from "./api";
import { MARKET_URL } from "./copy";
import {
  getNearbyDirectory,
  marketProfileUrl,
  providerTypeLabel,
  providerTypes,
  type DirectoryProvider,
  type ProviderType,
} from "./directory-api";
import { Card, Empty, Pill, cx, money } from "./ui";

interface BrowserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function NearbyDirectory({
  locale,
  query,
  onChoose,
}: {
  locale: "ar" | "en";
  query: string;
  onChoose: (provider: PublicProvider, service: AppointmentService) => void;
}) {
  const isAr = locale === "ar";
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [results, setResults] = useState<DirectoryProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const text = useMemo(
    () =>
      isAr
        ? {
            eyebrow: "كَحيل دليل",
            title: "ابحث عن الأماكن والخدمات القريبة منك",
            body: "اعرض المراكز الطبية والعيادات والصيدليات والخدمات القريبة، ثم احجز الموعد من كَحيل مواعيد أو انتقل إلى ملف الجهة في سوق كَحيل عند توفره.",
            useLocation: "استخدم موقعي",
            refresh: "تحديث النتائج",
            privacy: "لن نحفظ موقعك في حسابك أو في جداول المواعيد؛ يُستخدم مؤقتًا لترتيب النتائج القريبة فقط.",
            all: "الكل",
            within: "نطاق البحث",
            km: "كم",
            nearby: "الأقرب إليك",
            empty: "لا توجد نتائج قريبة",
            emptyBody: "وسّع نطاق البحث أو اختر فئة أخرى. لا تظهر إلا الجهات التي أكدت موقعها.",
            distance: "يبعد",
            directions: "الاتجاهات",
            market: "عرض في سوق كَحيل",
            choose: "حجز خدمة",
            locationUnsupported: "تحديد الموقع غير مدعوم في هذا المتصفح.",
            locationDenied: "لم يتم السماح بالوصول إلى الموقع. يمكنك تفعيله من إعدادات المتصفح.",
            locationUnavailable: "تعذر تحديد موقعك الآن. حاول مرة أخرى.",
          }
        : {
            eyebrow: "KAHEEL Directory",
            title: "Find nearby places and services",
            body: "Discover nearby medical centers, clinics, pharmacies and services, then book through KAHEEL Appointments or open the provider's KAHEEL Market profile when available.",
            useLocation: "Use my location",
            refresh: "Refresh results",
            privacy: "Your location is not saved to your account or appointment tables. It is used temporarily to rank nearby results.",
            all: "All",
            within: "Search radius",
            km: "km",
            nearby: "Nearest to you",
            empty: "No nearby results",
            emptyBody: "Increase the radius or select another category. Only providers that confirmed their location are shown.",
            distance: "Away",
            directions: "Directions",
            market: "View in KAHEEL Market",
            choose: "Book a service",
            locationUnsupported: "Location is not supported by this browser.",
            locationDenied: "Location permission was not granted. You can enable it in browser settings.",
            locationUnavailable: "Your location could not be determined. Please try again.",
          },
    [isAr],
  );

  async function searchNear(nextLocation = location) {
    if (!nextLocation) return;
    setBusy(true);
    try {
      const data = await getNearbyDirectory({
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        radiusKm,
        providerType,
        query,
        limit: 40,
      });
      setResults(data);
      setSearched(true);
    } catch {
      toast.error(text.locationUnavailable);
    } finally {
      setBusy(false);
    }
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      toast.error(text.locationUnsupported);
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(nextLocation);
        void searchNear(nextLocation);
      },
      (error) => {
        setBusy(false);
        toast.error(error.code === error.PERMISSION_DENIED ? text.locationDenied : text.locationUnavailable);
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 300000,
      },
    );
  }

  function directionsUrl(provider: DirectoryProvider) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${provider.latitude},${provider.longitude}`,
    )}`;
  }

  return (
    <section className="border-b border-border bg-secondary/25">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <Pill tone="green">
              <Navigation className="me-1.5 size-3.5" />
              {text.eyebrow}
            </Pill>
            <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">{text.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{text.body}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={requestLocation} disabled={busy} className="min-h-11 rounded-xl">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                {location ? text.refresh : text.useLocation}
              </Button>
              {location ? (
                <Button variant="outline" onClick={() => void searchNear()} disabled={busy} className="min-h-11 rounded-xl">
                  <RefreshCw className={cx("size-4", busy && "animate-spin")} />
                  {text.refresh}
                </Button>
              ) : null}
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-xs leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {text.privacy}
            </p>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-black text-muted-foreground">{text.within}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 25, 50].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRadiusKm(value)}
                      className={cx(
                        "min-h-9 rounded-xl border px-3 text-xs font-bold transition",
                        radiusKm === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-secondary",
                      )}
                    >
                      {value} {text.km}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-black text-muted-foreground">{isAr ? "نوع الجهة" : "Provider type"}</span>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setProviderType(null)}
                    className={cx(
                      "min-h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition",
                      providerType === null
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-secondary",
                    )}
                  >
                    {text.all}
                  </button>
                  {providerTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProviderType(type)}
                      className={cx(
                        "min-h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition",
                        providerType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-secondary",
                      )}
                    >
                      {providerTypeLabel(type, locale)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {busy && !searched ? (
          <div className="mt-8 flex min-h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : searched ? (
          <div className="mt-9">
            <h3 className="text-xl font-black">{text.nearby}</h3>
            {results.length === 0 ? (
              <div className="mt-4">
                <Empty title={text.empty} body={text.emptyBody} />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {results.map((provider) => (
                  <Card key={provider.id} className="overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                          {provider.name_ar.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-lg font-black">
                              {isAr ? provider.name_ar : provider.name_en || provider.name_ar}
                            </h4>
                            <Pill tone="green">{providerTypeLabel(provider.provider_type, locale)}</Pill>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3.5" />
                            {provider.city || provider.address_text || (isAr ? "موقع مؤكد" : "Confirmed location")}
                            {provider.distance_km != null ? (
                              <strong className="text-foreground">
                                · {text.distance} {provider.distance_km} {text.km}
                              </strong>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {provider.latitude != null && provider.longitude != null ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={directionsUrl(provider)} target="_blank" rel="noreferrer">
                              <Navigation className="size-4" />
                              {text.directions}
                            </a>
                          </Button>
                        ) : null}
                        {provider.market_profile_path ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={marketProfileUrl(MARKET_URL, provider.market_profile_path)}>
                              <Store className="size-4" />
                              {text.market}
                              <ExternalLink className="size-3.5" />
                            </a>
                          </Button>
                        ) : null}
                      </div>

                      {provider.accepts_bookings && provider.services.length > 0 ? (
                        <div className="mt-5 space-y-2">
                          <p className="text-xs font-black text-muted-foreground">{text.choose}</p>
                          {provider.services.slice(0, 4).map((service) => (
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
                                <strong className="block truncate text-sm">
                                  {isAr ? service.name_ar : service.name_en || service.name_ar}
                                </strong>
                                <span className="text-[11px] text-muted-foreground">
                                  {service.duration_minutes} {isAr ? "دقيقة" : "min"}
                                </span>
                              </span>
                              <span className="text-xs font-black">
                                {money(service.price, service.currency_code, locale)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl bg-secondary p-4 text-xs leading-6 text-muted-foreground">
                          {isAr
                            ? "لا يوجد حجز مباشر لهذه الجهة حاليًا. استخدم الاتجاهات أو افتح ملفها في سوق كَحيل عند توفره."
                            : "Direct booking is not available for this provider. Use directions or open its KAHEEL Market profile when available."}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
