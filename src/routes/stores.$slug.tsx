import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { currencyLabel, priceLabel } from "@/lib/mkt";
import { locationLink } from "@/lib/mkt-location-link";
import { usePublicStoreTheme } from "@/lib/mkt-store-theme";
import { usePublicStore, type PublicStoreItem } from "@/lib/mkt-store-catalog";
import { storeThemeAppearance } from "@/lib/store-theme";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/stores/$slug")({
  ssr: "data-only",
  head: ({ params }) => {
    const title = `متجر ${params.slug} — سوق گحيل`;
    const description =
      "صفحة المتجر: الأقسام والمنتجات والأسعار وأوقات العمل والموقع وطرق التواصل داخل سوق گحيل.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
        ...canonicalMeta(`/stores/${params.slug}`),
      ],
      links: canonicalLinks(`/stores/${params.slug}`),
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
  const themeQuery = usePublicStoreTheme(slug);
  const theme = storeThemeAppearance(themeQuery.data);
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
          <Skeleton className="h-44 w-full rounded-3xl" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full rounded-2xl" />
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
    locale === "ar"
      ? store.short_description_ar
      : store.short_description_en || store.short_description_ar;
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
  const map = locationLink({
    latitude: store.latitude,
    longitude: store.longitude,
    visibility: store.location_precision === "exact" ? "exact" : "approximate",
    district: store.district,
    city,
    country: null,
  });
  const serviceStore = store.store_type === "services" || store.store_type === "mixed";

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5">
        <div
          className={`overflow-hidden rounded-[1.75rem] border bg-card shadow-panel ring-1 ${theme.ring}`}
        >
          <div
            className={`relative h-40 w-full overflow-hidden bg-gradient-to-br ${theme.gradient} sm:h-52`}
          >
            {cover ? <img src={cover} alt={name} className="size-full object-cover" /> : null}
            <div
              className={`absolute inset-0 bg-gradient-to-t ${theme.softGradient}`}
              aria-hidden
            />
            <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/20 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
              <Sparkles className="size-3.5" aria-hidden />
              هوية متجر گحيل
            </span>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-background shadow-lg ring-2 ${theme.ring}`}
              >
                {logo ? (
                  <img src={logo} alt={name} className="size-full object-cover" />
                ) : (
                  <Store className={`size-7 ${theme.accent}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="flex items-center gap-2 text-xl font-black">
                  <span className="truncate">{name}</span>
                  <VerifiedBadge status={store.verification_status} />
                </h1>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {t(`market.store.type.${store.store_type}`)}
                  {store.cuisine
                    ? ` · ${locale === "ar" ? store.cuisine.name_ar : store.cuisine.name_en || store.cuisine.name_ar}`
                    : ""}
                  {city ? ` · ${city}` : ""}
                </p>
              </div>
              {store.open_state ? (
                <Badge variant={store.open_state.open ? "default" : "outline"}>
                  {store.open_state.open ? t("market.store.open") : t("market.store.closed")}
                </Badge>
              ) : null}
            </div>

            {description ? <p className="max-w-3xl text-sm leading-7">{description}</p> : null}

            <div className="flex flex-wrap gap-2">
              {!serviceStore && store.pickup_enabled ? (
                <Badge variant="secondary">{t("market.store.pickup")}</Badge>
              ) : null}
              {!serviceStore && store.delivery_enabled ? (
                <Badge variant="secondary">{t("market.store.merchantDelivery")}</Badge>
              ) : null}
              {!serviceStore && store.delivery_enabled && store.delivery_fee != null ? (
                <Badge variant="outline">
                  {t("market.store.deliveryFee")}:{" "}
                  {money(store.delivery_fee, store.currency_code, locale)}
                </Badge>
              ) : null}
              {!serviceStore && store.minimum_order_amount ? (
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
                  <Link to="/my/messages">
                    <MessageCircle className="me-1 h-4 w-4" />
                    {t("market.store.publicPage.chat")}
                  </Link>
                </Button>
              ) : null}
              {map ? (
                <Button asChild variant="outline" size="sm">
                  <a href={map.href} target="_blank" rel="noreferrer noopener">
                    <MapPin className="me-1 h-4 w-4" />
                    {map.precision === "exact"
                      ? t("market.ad.openLocation")
                      : t("market.ad.approximate")}
                  </a>
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {serviceStore ? (
                <CalendarDays className="me-1 inline h-3.5 w-3.5" />
              ) : (
                <ShoppingBag className="me-1 inline h-3.5 w-3.5" />
              )}
              {serviceStore
                ? locale === "ar"
                  ? "اختر الخدمة والمختص والموعد المتاح، ثم تابع الحجز من حسابك."
                  : "Choose a service, professional and available time, then track the booking in your account."
                : t("market.store.publicPage.ordersSoon")}
            </p>
          </div>
        </div>

        {sections.length === 0 ? (
          <Card className={theme.surface}>
            <CardContent className="pt-5 text-sm text-muted-foreground">
              {t("market.store.publicPage.emptyCatalog")}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  size="sm"
                  variant={current === section.id ? "default" : "outline"}
                  className="shrink-0 rounded-full"
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
                  locale === "ar"
                    ? item.description_ar
                    : item.description_en || item.description_ar;
                const bookable = serviceStore && ["service", "package"].includes(item.item_type);
                return (
                  <div
                    key={item.id}
                    className={`flex gap-3 rounded-2xl border p-3 shadow-sm ${theme.surface}`}
                  >
                    <div
                      className={`grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${theme.gradient}`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={itemName}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="size-6 text-white/85" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-bold">{itemName}</span>
                        {!item.is_available ? (
                          <Badge variant="outline">{t("market.store.catalog.unavailable")}</Badge>
                        ) : null}
                      </div>
                      {itemDesc ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{itemDesc}</p>
                      ) : null}
                      <p className={`text-sm font-black ${theme.accent}`}>
                        {money(item.base_price, item.currency_code || store.currency_code, locale)}
                      </p>
                      {item.addon_groups.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("market.store.catalog.options")}:{" "}
                          {item.addon_groups
                            .map((group) =>
                              locale === "ar" ? group.name_ar : group.name_en || group.name_ar,
                            )
                            .join(" · ")}
                        </p>
                      ) : null}
                      {(bookable ? item.duration_minutes : item.preparation_minutes) ? (
                        <p className="text-xs text-muted-foreground">
                          <Clock className="me-1 inline h-3.5 w-3.5" />
                          {bookable ? item.duration_minutes : item.preparation_minutes}{" "}
                          {t("market.store.publicPage.minutes")}
                        </p>
                      ) : null}
                      {bookable && item.is_available ? (
                        <Button asChild size="sm" className="mt-2 h-8 rounded-full px-4">
                          <Link
                            to="/services/$slug/$itemId/book"
                            params={{ slug: store.slug, itemId: item.id }}
                          >
                            <CalendarDays className="me-1 size-3.5" />
                            {locale === "ar" ? "احجز موعدًا" : "Book appointment"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

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

        {store.listings.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-semibold">{t("market.store.publicPage.adsTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {store.listings.map((listing) => (
                <Link
                  key={listing.id}
                  to="/ads/$slug"
                  params={{ slug: listing.slug }}
                  className="rounded-2xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel"
                >
                  <div
                    className={`mb-2 grid h-28 w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${theme.gradient}`}
                  >
                    {listing.cover_image_url && store.media[listing.cover_image_url] ? (
                      <img
                        src={store.media[listing.cover_image_url]}
                        alt={listing.title}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="size-6 text-white/80" aria-hidden />
                    )}
                  </div>
                  <p className="truncate text-sm font-bold">{listing.title}</p>
                  <p className={`text-sm font-semibold ${theme.accent}`}>
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
