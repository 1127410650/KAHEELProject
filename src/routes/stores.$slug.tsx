import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, MapPin, MessageCircle, Phone, ShoppingBag, Store } from "lucide-react";

import { useI18n } from "@/i18n";
import { currencyLabel, priceLabel } from "@/lib/mkt";
import { locationLink } from "@/lib/mkt-location-link";
import { usePublicStore, type PublicStoreItem } from "@/lib/mkt-store-catalog";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/stores/$slug")({
  ssr: false,
  head: ({ params }) => {
    const title = `متجر ${params.slug} — سوق كحلي`;
    const description =
      "صفحة المتجر: الأقسام والمنتجات والأسعار وأوقات العمل والموقع وطرق التواصل داخل سوق كحلي.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
      ],
    };
  },
  component: PublicStorePage,
});

function money(amount: number, currency: string, locale: "ar" | "en"): string {
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  const label = currencyLabel(currency, locale);
  return locale === "ar" ? `${value} ${label}` : `${label} ${value}`;
}

function PublicStorePage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const query = usePublicStore(slug);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const store = query.data && !("unavailable" in query.data) ? query.data : null;

  const itemsBySection = useMemo(() => {
    const map = new Map<string, PublicStoreItem[]>();
    if (!store) return map;
    for (const section of store.sections) map.set(section.id, []);
    map.set("__none", []);
    for (const item of store.items) {
      const key = item.section_id && map.has(item.section_id) ? item.section_id : "__none";
      map.get(key)!.push(item);
    }
    return map;
  }, [store]);

  if (query.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MarketShell>
    );
  }

  if (!store) {
    return (
      <MarketShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("market.store.publicPage.notFound")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("market.store.publicPage.notFoundHint")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/">{t("market.nav.home")}</Link>
          </Button>
        </div>
      </MarketShell>
    );
  }

  const name = locale === "ar" ? store.name_ar : store.name_en || store.name_ar;
  const description =
    locale === "ar" ? store.short_description_ar : store.short_description_en || store.short_description_ar;
  const city = locale === "ar" ? store.city_name_ar : store.city_name_en || store.city_name_ar;
  const cover = store.cover_path ? store.media[store.cover_path] : undefined;
  const logo = store.logo_path ? store.media[store.logo_path] : undefined;
  const sections = [
    ...store.sections,
    ...((itemsBySection.get("__none") ?? []).length > 0
      ? [
          {
            id: "__none",
            name_ar: t("market.store.catalog.noSection"),
            name_en: t("market.store.catalog.noSection"),
            description_ar: null,
            description_en: null,
            sort_order: 999,
          },
        ]
      : []),
  ];
  const current = activeSection ?? sections[0]?.id ?? null;
  const mapHref = locationLink(store.latitude, store.longitude);

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5">
        {/* ── header ── */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="h-36 w-full bg-muted sm:h-48">
            {cover ? (
              <img src={cover} alt={name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-background">
                {logo ? (
                  <img src={logo} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <Store className="m-auto h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="truncate">{name}</span>
                  {store.verification_status === "verified" ? <VerifiedBadge /> : null}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t(`market.store.type.${store.store_type}`)}
                  {store.cuisine
                    ? ` · ${locale === "ar" ? store.cuisine.name_ar : store.cuisine.name_en || store.cuisine.name_ar}`
                    : ""}
                  {city ? ` · ${city}` : ""}
                </p>
              </div>
              <div className="ms-auto">
                {store.open_state ? (
                  <Badge variant={store.open_state.open ? "default" : "outline"}>
                    {store.open_state.open ? t("market.store.open") : t("market.store.closed")}
                  </Badge>
                ) : null}
              </div>
            </div>

            {description ? <p className="text-sm">{description}</p> : null}

            <div className="flex flex-wrap gap-2">
              {store.pickup_enabled ? (
                <Badge variant="secondary">{t("market.store.pickup")}</Badge>
              ) : null}
              {store.delivery_enabled ? (
                <Badge variant="secondary">{t("market.store.merchantDelivery")}</Badge>
              ) : null}
              {store.delivery_enabled && store.delivery_fee != null ? (
                <Badge variant="outline">
                  {t("market.store.deliveryFee")}: {money(store.delivery_fee, store.currency_code, locale)}
                </Badge>
              ) : null}
              {store.minimum_order_amount ? (
                <Badge variant="outline">
                  {t("market.store.minOrder")}:{" "}
                  {money(store.minimum_order_amount, store.currency_code, locale)}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {store.public_phone ? (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${store.public_phone}`}>
                    <Phone className="me-1 h-4 w-4" />
                    {store.public_phone}
                  </a>
                </Button>
              ) : null}
              {store.chat_enabled ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard/messages">
                    <MessageCircle className="me-1 h-4 w-4" />
                    {t("market.store.publicPage.chat")}
                  </Link>
                </Button>
              ) : null}
              {mapHref ? (
                <Button asChild variant="outline" size="sm">
                  <a href={mapHref} target="_blank" rel="noreferrer noopener">
                    <MapPin className="me-1 h-4 w-4" />
                    {store.location_precision === "exact"
                      ? t("market.ad.openLocation")
                      : t("market.ad.approximate")}
                  </a>
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              <ShoppingBag className="me-1 inline h-3.5 w-3.5" />
              {t("market.store.publicPage.ordersSoon")}
            </p>
          </div>
        </div>

        {/* ── catalog ── */}
        {sections.length === 0 ? (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">
              {t("market.store.publicPage.emptyCatalog")}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  size="sm"
                  variant={current === section.id ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => setActiveSection(section.id)}
                >
                  {locale === "ar" ? section.name_ar : section.name_en || section.name_ar}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(itemsBySection.get(current ?? "") ?? []).map((item) => {
                const url = item.image_path ? store.media[item.image_path] : undefined;
                const itemName = locale === "ar" ? item.name_ar : item.name_en || item.name_ar;
                const itemDesc =
                  locale === "ar" ? item.description_ar : item.description_en || item.description_ar;
                return (
                  <div key={item.id} className="flex gap-3 rounded-xl border bg-card p-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {url ? (
                        <img
                          src={url}
                          alt={itemName}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{itemName}</span>
                        {!item.is_available ? (
                          <Badge variant="outline">{t("market.store.catalog.unavailable")}</Badge>
                        ) : null}
                      </div>
                      {itemDesc ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{itemDesc}</p>
                      ) : null}
                      <p className="text-sm font-semibold">
                        {money(item.base_price, item.currency_code || store.currency_code, locale)}
                      </p>
                      {item.addon_groups.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("market.store.catalog.options")}:{" "}
                          {item.addon_groups
                            .map((g) => (locale === "ar" ? g.name_ar : g.name_en || g.name_ar))
                            .join(" · ")}
                        </p>
                      ) : null}
                      {item.preparation_minutes ? (
                        <p className="text-xs text-muted-foreground">
                          <Clock className="me-1 inline h-3.5 w-3.5" />
                          {item.preparation_minutes} {t("market.store.publicPage.minutes")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── hours ── */}
        {store.hours.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 pt-5">
              <p className="font-semibold">{t("market.store.workingDays")}</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {store.hours.map((row) => (
                  <li key={row.weekday} className="flex justify-between gap-2">
                    <span>{t(`market.store.weekday.${row.weekday}`)}</span>
                    <span className="text-muted-foreground">
                      {row.is_closed
                        ? t("market.store.closed")
                        : `${row.opens_at?.slice(0, 5) ?? "--"} – ${row.closes_at?.slice(0, 5) ?? "--"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* ── linked ads ── */}
        {store.listings.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-semibold">{t("market.store.publicPage.adsTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {store.listings.map((listing) => (
                <Link
                  key={listing.id}
                  to="/ads/$slug"
                  params={{ slug: listing.slug }}
                  className="rounded-xl border bg-card p-3 transition hover:shadow-sm"
                >
                  <div className="mb-2 h-28 w-full overflow-hidden rounded-lg bg-muted">
                    {listing.cover_image_url && store.media[listing.cover_image_url] ? (
                      <img
                        src={store.media[listing.cover_image_url]}
                        alt={listing.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="truncate text-sm font-medium">{listing.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {listing.price_on_request
                      ? t("market.priceOnRequest")
                      : priceLabel(
                          {
                            price: listing.price,
                            price_unit: listing.price_unit,
                            currency: listing.currency,
                          } as never,
                          "—",
                          locale,
                        )}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </MarketShell>
  );
}
