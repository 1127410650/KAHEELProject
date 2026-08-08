import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { AppointmentService, PublicProvider } from "./api";
import { MARKET_URL, getCopy } from "./copy";
import {
  marketProfileUrl,
  providerTypeLabel,
  type DirectoryProvider,
} from "./directory-api";
import { NearbyDirectory } from "./NearbyDirectory";
import { Card, Empty, Pill, Spinner, cx, money } from "./ui";

export function DiscoverArea({
  copy,
  locale,
  isAr,
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
  directory: PublicProvider[];
  query: string;
  city: string;
  loading: boolean;
  setQuery: (value: string) => void;
  setCity: (value: string) => void;
  onSearch: () => void;
  onChoose: (provider: PublicProvider, service: AppointmentService) => void;
}) {
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <section>
      <div className="border-b border-border bg-[radial-gradient(circle_at_50%_0%,var(--color-secondary),transparent_70%)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Pill tone="green">
              <Sparkles className="me-1.5 size-3.5" />
              {copy.subBrand}
            </Pill>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {copy.hero}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              {copy.heroBody}
            </p>
          </div>

          <form
            className="mt-8 grid max-w-4xl gap-3 rounded-3xl border border-border bg-card p-3 shadow-raised sm:grid-cols-[1fr_14rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="h-12 ps-10"
              />
            </div>
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={copy.city}
              className="h-12"
            />
            <Button type="submit" className="h-12 rounded-xl" disabled={loading}>
              <Search className="size-4" />
              {copy.searchAction}
            </Button>
          </form>
        </div>
      </div>

      <NearbyDirectory locale={locale} query={query} onChoose={onChoose} />

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{copy.providers}</h2>
          <Button variant="ghost" size="sm" onClick={onSearch} disabled={loading}>
            <RefreshCw className={cx("size-4", loading && "animate-spin")} />
            {copy.refresh}
          </Button>
        </div>

        {loading ? (
          <Spinner label={copy.searchAction} />
        ) : directory.length === 0 ? (
          <Empty title={copy.noProviders} body={copy.noProvidersBody} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {directory.map((provider) => {
              const directoryProvider = provider as DirectoryProvider;
              return (
                <Card key={provider.id} className="overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-secondary via-secondary/60 to-background" />
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                        {provider.name_ar.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black">
                            {isAr ? provider.name_ar : provider.name_en || provider.name_ar}
                          </h3>
                          {directoryProvider.provider_type ? (
                            <Pill tone="green">
                              {providerTypeLabel(directoryProvider.provider_type, locale)}
                            </Pill>
                          ) : null}
                        </div>
                        {provider.city ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3.5" />
                            {provider.city}
                            {provider.district ? ` · ${provider.district}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {(isAr ? provider.bio_ar : provider.bio_en || provider.bio_ar) ? (
                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {isAr ? provider.bio_ar : provider.bio_en || provider.bio_ar}
                      </p>
                    ) : null}

                    {directoryProvider.market_profile_path ? (
                      <Button asChild size="sm" variant="ghost" className="mt-3 px-0 text-primary">
                        <a href={marketProfileUrl(MARKET_URL, directoryProvider.market_profile_path)}>
                          <Store className="size-4" />
                          {isAr ? "ملف الجهة في سوق كَحيل" : "Provider profile in KAHEEL Market"}
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
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
                            <strong className="block truncate text-sm">
                              {isAr ? service.name_ar : service.name_en || service.name_ar}
                            </strong>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {service.duration_minutes} {copy.minutes}
                            </span>
                          </span>
                          <span className="text-xs font-black">
                            {money(service.price, service.currency_code, locale)}
                          </span>
                          <Arrow className="size-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
