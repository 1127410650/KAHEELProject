import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
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
import { MarketDemoListings } from "@/components/marketplace/home/MarketDemoListings";
import kaheelLogo from "@/assets/kaheel-logo.png";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "گحيل — سوق العقارات والخدمات والموردين | Gohail";
const description =
  "منصة گحيل: سوق عام منظم للعقارات والخدمات والمنتجات والمعدات والموردين، بحسابات أفراد ومتاجر ورسائل واتصال داخلي وتوثيق.";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...canonicalMeta("/welcome"),
    ],
    links: canonicalLinks("/welcome"),
  }),
  component: WelcomePage,
});

const SECTIONS = [
  { key: "realestate", icon: Home, search: { category: "real-estate" } },
  { key: "service", icon: Sparkles, search: { type: "service" } },
  { key: "product", icon: Tag, search: { type: "product" } },
  { key: "equipment", icon: Truck, search: { type: "equipment_rent" } },
  { key: "business", icon: Store, search: { domain: "business" } },
] as const;

const FEATURES = ["accounts", "listings", "contact", "verify", "countries"] as const;

/** Public landing page. Real listing data is shown only when it exists. */
function WelcomePage() {
  const { t, locale, setLocale, dir } = useI18n();

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
    <div
      dir={dir}
      className="market-surface flex min-h-dvh flex-col overflow-x-clip bg-[radial-gradient(circle_at_50%_-12%,rgb(11_92_197/0.10),transparent_32%)]"
    >
      <header className="sticky top-0 z-40 border-b border-white/8 bg-market-void/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-2 px-3 py-2 sm:px-5 lg:px-8">
          <Link to="/welcome" className="flex shrink-0 items-center gap-2">
            <img
              src={kaheelLogo}
              alt=""
              width={1024}
              height={1024}
              className="size-9 shrink-0 rounded-xl shadow-[0_8px_24px_rgb(0_0_0/0.22)]"
              aria-hidden
            />
            <span className="text-base font-black tracking-tight">{t("market.brand")}</span>
          </Link>

          <div className="min-w-0 flex-1" />

          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden text-market-silver hover:bg-white/8 hover:text-white sm:inline-flex"
          >
            <Link to="/">{t("welcome.nav.browse")}</Link>
          </Button>
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            className="grid size-9 place-items-center rounded-lg border border-white/12 text-[11px] font-black text-market-silver transition hover:border-white/25 hover:text-white"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/8 hover:text-white"
          >
            <Link to="/auth">
              <LogIn className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("welcome.nav.signIn")}</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="shadow-[0_8px_24px_rgb(11_92_197/0.25)]">
            <Link to="/register">
              <UserPlus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("welcome.nav.signUp")}</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 pb-12 sm:px-5 lg:px-8">
        <section className="pt-4 sm:pt-7">
          <div className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/10 bg-market-void shadow-[0_28px_90px_rgb(0_0_0/0.34)] sm:rounded-[2.2rem]">
            <span
              className="absolute -start-24 -top-36 size-80 rounded-full bg-market-electric/16 blur-3xl"
              aria-hidden
            />
            <span
              className="absolute -bottom-48 -end-24 size-96 rounded-full bg-market-blue/10 blur-3xl"
              aria-hidden
            />
            <div className="relative grid gap-7 px-5 py-8 sm:px-8 sm:py-11 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-12 lg:py-14">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-[10px] font-black text-market-silver backdrop-blur">
                  <Sparkles className="size-3.5 text-market-electric-bright" aria-hidden />
                  {locale === "ar"
                    ? "منصة واحدة لكل ما تبحث عنه"
                    : "One platform for what you need"}
                </span>
                <h1 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.035em] text-white sm:text-5xl lg:text-[3.4rem]">
                  {t("welcome.hero.title")}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-market-silver-muted sm:text-base sm:leading-8">
                  {t("welcome.hero.subtitle")}
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Button asChild size="lg" className="min-h-11 rounded-xl px-5">
                    <Link to="/">
                      {t("welcome.hero.browse")}
                      <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="min-h-11 rounded-xl border-white/15 bg-white/[0.035] px-5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/register">{t("welcome.hero.signUp")}</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="min-h-11 rounded-xl text-market-silver hover:bg-white/8 hover:text-white"
                  >
                    <a href={addListingHref()}>
                      <Plus className="size-4" aria-hidden />
                      {t("welcome.hero.add")}
                    </a>
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-2.5 shadow-[0_18px_55px_rgb(0_0_0/0.30)] backdrop-blur-sm sm:p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                  <p className="text-[11px] font-black text-white">{t("welcome.sections.title")}</p>
                  <span className="text-[9px] font-bold text-market-silver-muted">
                    {locale === "ar" ? "ابدأ من مجالك" : "Start with your field"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map(({ key, icon: Icon, search }, index) => (
                    <Link
                      key={key}
                      to="/search"
                      search={search}
                      className={`group flex min-h-[72px] items-end justify-between gap-2 rounded-2xl border border-white/8 bg-market-panel-soft px-3 py-3 text-[11px] font-black text-market-silver transition hover:-translate-y-0.5 hover:border-market-electric/45 hover:text-white ${
                        index === SECTIONS.length - 1 ? "col-span-2" : ""
                      }`}
                    >
                      <span>{t(`welcome.sections.${key}`)}</span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-market-electric/12 text-market-electric-bright transition group-hover:bg-market-electric group-hover:text-white">
                        <Icon className="size-4" aria-hidden />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="-mx-3 mt-3 sm:-mx-5 lg:-mx-8">
          <MarketDemoListings />
        </div>

        <section className="mt-10 sm:mt-14">
          <div className="mb-4 max-w-xl">
            <p className="text-[10px] font-black text-market-electric-bright">
              {locale === "ar" ? "ببساطة ووضوح" : "Simple and clear"}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
              {t("welcome.features.title")}
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((key, index) => (
              <article
                key={key}
                className={`rounded-2xl border border-border/80 bg-card p-4 shadow-[0_8px_26px_rgb(0_0_0/0.10)] ${
                  index === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <span className="mb-3 grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="size-4" aria-hidden />
                </span>
                <h3 className="text-sm font-black text-foreground">
                  {t(`welcome.features.${key}.title`)}
                </h3>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  {t(`welcome.features.${key}.desc`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {items.length > 0 ? (
          <section className="mt-10 sm:mt-14">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {t("welcome.latest.title")}
              </h2>
              <Link to="/" className="text-xs font-black text-primary hover:underline">
                {t("welcome.latest.viewAll")}
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10 grid gap-3 sm:mt-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_10px_34px_rgb(0_0_0/0.12)] sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              {t("welcome.trust.title")}
            </h2>
            <ul className="mt-4 space-y-3">
              {trust.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"
                >
                  <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_10px_34px_rgb(0_0_0/0.12)] sm:p-6">
            <h2 className="text-lg font-black text-foreground">{t("welcome.faq.title")}</h2>
            <div className="mt-3 space-y-2">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-border/80 bg-secondary/25 px-4 py-3"
                >
                  <summary className="cursor-pointer text-sm font-bold text-foreground">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto bg-market-void text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-5 lg:px-8">
          <p className="text-base font-black tracking-tight">{t("market.brand")}</p>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-market-silver-muted">
            {t("market.tagline")}
          </p>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-market-silver">
            <Link to="/about" className="hover:text-white">
              {t("welcome.footer.about")}
            </Link>
            <Link to="/help" className="hover:text-white">
              {t("welcome.footer.help")}
            </Link>
            <Link to="/terms" className="hover:text-white">
              {t("welcome.footer.terms")}
            </Link>
            <Link to="/privacy" className="hover:text-white">
              {t("welcome.footer.privacy")}
            </Link>
            <Link to="/contact" className="hover:text-white">
              {t("welcome.footer.contact")}
            </Link>
          </nav>
        </div>
        <p className="border-t border-white/8 py-4 text-center text-xs text-market-silver-muted">
          {t("welcome.footer.rights")}
        </p>
      </footer>
    </div>
  );
}
