import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Home,
  LogIn,
  Plus,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Truck,
  UserPlus,
} from "lucide-react";

import { addListingHref } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { loadListings } from "@/lib/mkt-queries";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/marketplace/ListingCard";

const title = "تحقّق — سوق العقارات والخدمات والموردين | Tahqaq";
const description =
  "منصة تحقّق: سوق عام منظم للعقارات والخدمات والمنتجات والمعدات والموردين، بحسابات أفراد ومنشآت ورسائل واتصال داخلي وتوثيق.";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

/** Broad fields only — they mirror the marketplace home rail, no invented data. */
const SECTIONS = [
  { key: "realestate", icon: Home, search: { category: "real-estate" } },
  { key: "service", icon: Sparkles, search: { type: "service" } },
  { key: "product", icon: Tag, search: { type: "product" } },
  { key: "equipment", icon: Truck, search: { type: "equipment_rent" } },
  { key: "business", icon: Building2, search: { domain: "business" } },
] as const;

const FEATURES = ["accounts", "listings", "contact", "verify", "countries"] as const;

/**
 * Public landing page. It never gates on a session, never invents statistics,
 * and hides any section (listings) whose real data is empty.
 */
function WelcomePage() {
  const { t, locale, setLocale, dir } = useI18n();

  // Real published listings only; the section disappears when there are none.
  const latest = useQuery({
    queryKey: ["welcome", "latest", locale],
    queryFn: () => loadListings({ limit: 4 }, locale),
  });
  const items = (latest.data ?? []).slice(0, 4);

  const trust = [0, 1, 2, 3].map((i) => t(`welcome.trust.items.${i}`));
  const faq = [
    { q: t("welcome.faq.q1"), a: t("welcome.faq.a1") },
    { q: t("welcome.faq.q2"), a: t("welcome.faq.a2") },
    { q: t("welcome.faq.q3"), a: t("welcome.faq.a3") },
  ];

  return (
    <div dir={dir} className="market-surface flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/welcome" className="flex shrink-0 items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Store className="size-4" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              {t("market.brand")}
            </span>
          </Link>

          <div className="min-w-0 flex-1" />

          <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
            <Link to="/">{t("welcome.nav.browse")}</Link>
          </Button>
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            className="rounded-md border border-input px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">
              <LogIn className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("welcome.nav.signIn")}</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">
              <UserPlus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("welcome.nav.signUp")}</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10">
        {/* Hero */}
        <section className="pt-10 sm:pt-14">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-10">
            <h1 className="max-w-2xl text-2xl font-bold leading-snug text-foreground sm:text-4xl">
              {t("welcome.hero.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("welcome.hero.subtitle")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg" className="min-h-11">
                <Link to="/">{t("welcome.hero.browse")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-11">
                <Link to="/register">{t("welcome.hero.signUp")}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="min-h-11">
                <a href={addListingHref()}>
                  <Plus className="size-4" aria-hidden />
                  {t("welcome.hero.add")}
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Sections */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">{t("welcome.sections.title")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SECTIONS.map(({ key, icon: Icon, search }) => (
              <Link
                key={key}
                to="/search"
                search={search}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground shadow-panel transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 truncate">{t(`welcome.sections.${key}`)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">{t("welcome.features.title")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((key) => (
              <article key={key} className="rounded-xl border border-border bg-card p-4 shadow-panel">
                <h3 className="text-sm font-bold text-foreground">
                  {t(`welcome.features.${key}.title`)}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`welcome.features.${key}.desc`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Real listings only */}
        {items.length > 0 ? (
          <section className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">{t("welcome.latest.title")}</h2>
              <Link to="/" className="text-xs font-semibold text-primary hover:underline">
                {t("welcome.latest.viewAll")}
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,340px))] justify-start gap-3">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Trust */}
        <section className="mt-10">
          <div className="rounded-2xl border border-border bg-secondary/30 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              {t("welcome.trust.title")}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {trust.map((line) => (
                <li key={line} className="text-xs leading-relaxed text-muted-foreground">
                  • {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">{t("welcome.faq.title")}</h2>
          <div className="mt-3 space-y-2">
            {faq.map((item) => (
              <details
                key={item.q}
                className="rounded-xl border border-border bg-card p-4 shadow-panel"
              >
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  {item.q}
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-auto bg-market-navy text-market-navy-foreground">
        <div className="mx-auto w-full max-w-6xl px-4 py-7">
          <p className="text-base font-bold tracking-tight">{t("market.brand")}</p>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-market-silver">
            {t("market.tagline")}
          </p>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-market-silver">
            <Link to="/about" className="hover:text-market-navy-foreground">
              {t("welcome.footer.about")}
            </Link>
            <Link to="/help" className="hover:text-market-navy-foreground">
              {t("welcome.footer.help")}
            </Link>
            <Link to="/terms" className="hover:text-market-navy-foreground">
              {t("welcome.footer.terms")}
            </Link>
            <Link to="/privacy" className="hover:text-market-navy-foreground">
              {t("welcome.footer.privacy")}
            </Link>
            <Link to="/contact" className="hover:text-market-navy-foreground">
              {t("welcome.footer.contact")}
            </Link>
          </nav>
        </div>
        <p className="border-t border-market-navy-soft py-4 text-center text-xs text-market-silver-muted">
          {t("welcome.footer.rights")}
        </p>
      </footer>
    </div>
  );
}
