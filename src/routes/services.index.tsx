import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType } from "react";
import {
  BriefcaseBusiness,
  CarFront,
  Clock3,
  GraduationCap,
  Grid2X2,
  HeartPulse,
  Laptop,
  MapPin,
  PartyPopper,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Wrench,
} from "lucide-react";

import { PageStack, PageNoticeBar } from "@/components/marketplace/layout/PageStack";
import { useKaheelProgressSteps } from "@/lib/mkt-progress";
import { HomeAdStrip } from "@/components/marketplace/home/HomeAdStrip";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { currencyLabel } from "@/lib/mkt";
import {
  useServiceCategories,
  useServiceDirectory,
  type ServiceCategory,
} from "@/lib/mkt-services";

import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/services/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "حجز الخدمات والمواعيد — كَحيل" },
      {
        name: "description",
        content: "اكتشف مقدمي الخدمات واحجز الموعد والمختص المناسب من سوق كَحيل.",
      },
      { property: "og:title", content: "خدمات كَحيل — احجز موعدك" },
      { name: "robots", content: "index, follow" },
      ...canonicalMeta("/services"),
    ],
    links: canonicalLinks("/services"),
  }),
  component: ServicesMarketplacePage,
});

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  wrench: Wrench,
  heart: HeartPulse,
  stethoscope: Stethoscope,
  "graduation-cap": GraduationCap,
  car: CarFront,
  briefcase: BriefcaseBusiness,
  "party-popper": PartyPopper,
  laptop: Laptop,
  "grid-2x2": Grid2X2,
};

// نغمات التصنيفات كلها من هوية كَحيل: بنفسجي بدرجاته + الذهبي للتمييز.
// لا ألوان دخيلة — كل نغمة تشير إلى design tokens.
const TONE_BRAND = "from-primary/20 to-secondary text-primary ring-primary/25";
const TONE_DEEP = "from-primary-pressed/25 to-secondary text-primary-pressed ring-primary/30";
const TONE_SOFT = "from-primary/12 to-accent text-primary-dark ring-primary/20";
const TONE_GOLD = "from-gold/25 to-gold-soft text-gold-foreground ring-gold/35";

const COLORS: Record<string, string> = {
  teal: TONE_BRAND,
  navy: TONE_DEEP,
  rose: TONE_SOFT,
  emerald: TONE_BRAND,
  violet: TONE_BRAND,
  amber: TONE_GOLD,
  sky: TONE_SOFT,
  fuchsia: TONE_BRAND,
  indigo: TONE_DEEP,
  slate: TONE_SOFT,
};

function CategoryButton({
  category,
  selected,
  onSelect,
  locale,
}: {
  category: ServiceCategory;
  selected: boolean;
  onSelect: () => void;
  locale: "ar" | "en";
}) {
  const Icon = ICONS[category.icon] ?? Grid2X2;
  const label = locale === "ar" ? category.name_ar : category.name_en;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="group flex w-[74px] shrink-0 flex-col items-center gap-2 text-center sm:w-[88px]"
    >
      <span
        className={`grid size-14 place-items-center rounded-full bg-gradient-to-br ring-1 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg sm:size-16 ${
          COLORS[category.color] ?? COLORS["slate"]
        } ${selected ? "scale-105 shadow-lg ring-2 ring-market-navy" : ""}`}
      >
        <Icon className="size-6 sm:size-7" />
      </span>
      <span
        className={`line-clamp-2 text-[11px] leading-4 ${selected ? "font-black" : "font-semibold"}`}
      >
        {label}
      </span>
    </button>
  );
}

function ServicesMarketplacePage() {
  const { locale } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useServiceCategories();
  const directory = useServiceDirectory({ q: query, categoryCode: category });

  const selectedLabel = useMemo(() => {
    const selected = categories.data?.find((row) => row.code === category);
    return selected ? (locale === "ar" ? selected.name_ar : selected.name_en) : null;
  }, [categories.data, category, locale]);

  const progressSteps = useKaheelProgressSteps();

  return (
    <MarketShell>
      <main className="pb-10">
        {/* البنية الموحّدة: تنبيه رفيع ← بانر ← شريط تقدّم، قبل محتوى الصفحة. */}
        <PageStack
          search={false}
          notice={
            <PageNoticeBar id="services-booking">
              {locale === "ar"
                ? "تأكيد الموعد يوصلك بالإشعارات — فعّل الجرس"
                : "Booking confirmations arrive in notifications"}
            </PageNoticeBar>
          }
          banner={<HomeAdStrip addHref="/my/listings/new" />}
          progress={progressSteps}
        />
        <section className="relative overflow-hidden border-b border-border bg-background text-foreground">
          <div className="market-hero-band relative mx-auto w-full max-w-7xl px-4">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-bold text-primary">
                <ShieldCheck className="size-4" />
                {locale === "ar"
                  ? "مواعيد واضحة ومقدمو خدمات موثوقون"
                  : "Clear appointments, trusted providers"}
              </div>
              <h1 className="font-black tracking-tight">
                {locale === "ar" ? "خدمتك، في الوقت الذي يناسبك" : "Your service, at your time"}
              </h1>
              <p className="mt-1.5 max-w-xl text-muted-foreground">
                {locale === "ar"
                  ? "اختر الخدمة والمختص والموعد، ثم تابع حالة الحجز من حسابك خطوة بخطوة."
                  : "Choose a service, professional and time, then track every booking step from your account."}
              </p>
            </div>
            <div className="relative mt-3.5 max-w-2xl">
              <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  locale === "ar"
                    ? "ابحث عن تنظيف، صيانة، تدريب…"
                    : "Search cleaning, maintenance, training…"
                }
                className="h-14 rounded-2xl border-border bg-card ps-12 text-base text-foreground shadow-panel placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </section>


        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-7">
          <section aria-labelledby="service-categories-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary">
                  {locale === "ar" ? "استكشف بسرعة" : "Explore quickly"}
                </p>
                <h2 id="service-categories-title" className="mt-0.5 text-xl font-black">
                  {locale === "ar" ? "اختر نوع الخدمة" : "Choose a service category"}
                </h2>
              </div>
              {category ? (
                <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>
                  {locale === "ar" ? "عرض الكل" : "View all"}
                </Button>
              ) : null}
            </div>
            {categories.isLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 7 }, (_, index) => (
                  <Skeleton key={index} className="size-16 shrink-0 rounded-full" />
                ))}
              </div>
            ) : (
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5">
                {(categories.data ?? []).map((row) => (
                  <CategoryButton
                    key={row.code}
                    category={row}
                    selected={category === row.code}
                    onSelect={() =>
                      setCategory((current) => (current === row.code ? null : row.code))
                    }
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="service-results-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-primary">
                  {selectedLabel ?? (locale === "ar" ? "خدمات قابلة للحجز" : "Bookable services")}
                </p>
                <h2 id="service-results-title" className="mt-0.5 text-xl font-black">
                  {locale === "ar" ? "مقدمو الخدمة المتاحون" : "Available providers"}
                </h2>
              </div>
              {!directory.isLoading ? (
                <span className="text-xs text-muted-foreground">
                  {directory.data?.length ?? 0} {locale === "ar" ? "خدمة" : "services"}
                </span>
              ) : null}
            </div>

            {directory.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-72 rounded-3xl" />
                ))}
              </div>
            ) : (directory.data ?? []).length === 0 ? (
              <div className="rounded-3xl border border-dashed bg-card px-5 py-14 text-center">
                <Sparkles className="mx-auto size-9 text-primary" />
                <h3 className="mt-3 font-black">
                  {locale === "ar" ? "لا توجد خدمات مطابقة حاليًا" : "No matching services yet"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locale === "ar"
                    ? "غيّر البحث أو التصنيف، وستظهر الخدمات المنشورة فقط."
                    : "Try another search or category. Only published services appear here."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(directory.data ?? []).map((item) => {
                  const name = locale === "ar" ? item.name_ar : item.name_en || item.name_ar;
                  const storeName =
                    locale === "ar" ? item.store_name_ar : item.store_name_en || item.store_name_ar;
                  const city =
                    locale === "ar" ? item.city_name_ar : item.city_name_en || item.city_name_ar;
                  const image = item.image_path ? item.media[item.image_path] : undefined;
                  return (
                    <article
                      key={`${item.storefront_id}:${item.item_id}`}
                      className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-market-navy via-primary-pressed to-primary-deep">
                        {image ? (
                          <img
                            src={image}
                            alt={name}
                            loading="lazy"
                            className="size-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid size-full place-items-center">
                            <Sparkles className="size-10 text-primary-foreground/70" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent" />
                        <span className="absolute start-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-foreground shadow">
                          {item.confirmation_mode === "instant"
                            ? locale === "ar"
                              ? "تأكيد فوري"
                              : "Instant confirmation"
                            : locale === "ar"
                              ? "يراجعه مقدم الخدمة"
                              : "Provider confirms"}
                        </span>
                        <div className="absolute bottom-3 start-3 flex items-center gap-1 text-xs font-bold text-white">
                          <Star className="size-4 fill-gold text-gold" />
                          {item.rating > 0
                            ? item.rating.toFixed(1)
                            : locale === "ar"
                              ? "جديد"
                              : "New"}
                          {item.reviews_count > 0 ? (
                            <span className="text-white/70">({item.reviews_count})</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className="line-clamp-1 text-base font-black">{name}</h3>
                          <Link
                            to="/stores/$slug"
                            params={{ slug: item.slug }}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
                          >
                            {storeName}
                            <VerifiedBadge status={item.verification_status} />
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            <Clock3 className="me-1 inline size-3.5" />
                            {item.duration_minutes} {locale === "ar" ? "دقيقة" : "min"}
                          </span>
                          {city ? (
                            <span>
                              <MapPin className="me-1 inline size-3.5" />
                              {city}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3">
                          <p className="font-black text-primary">
                            {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
                              item.base_price,
                            )}{" "}
                            {currencyLabel(item.currency_code, locale)}
                          </p>
                          <Button asChild size="sm" className="rounded-full px-5">
                            <Link
                              to="/services/$slug/$itemId/book"
                              params={{ slug: item.slug, itemId: item.item_id }}
                            >
                              {locale === "ar" ? "احجز" : "Book"}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </MarketShell>
  );
}
