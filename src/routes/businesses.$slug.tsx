import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  Globe,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Share2,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { currentPath, loginHref, resolveMedia } from "@/lib/mkt";
import { locationLink } from "@/lib/mkt-location-link";
import {
  activeListingsKey,
  activityChips,
  businessInitials,
  loadBusinessCategories,
  loadBusinessListings,
  loadPublicBusiness,
  safeWebsite,
  sanitizeAbout,
  BUSINESS_PAGE_SIZE,
} from "@/lib/mkt-business-public";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { canonicalUrl } from "@/lib/share-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/businesses/$slug")({
  ssr: "data-only",
  head: ({ params }) => {
    const title = `${params.slug} — متجر في كَحيل`;
    const description =
      "الملف العام للمتجر في كَحيل: النشاط، المدينة، تاريخ الانضمام، والإعلانات المنشورة.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [
        {
          rel: "canonical",
          href: canonicalUrl(`/businesses/${params.slug}`),
        },
      ],
    };
  },
  component: BusinessPage,
});

const ACTIVITY_LIMIT = 8;

function BusinessPage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const {
    account: activeAccount,
    accounts,
    loading: accountsLoading,
    select: selectAccount,
  } = useActiveAccount();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [allActivities, setAllActivities] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  // Field-limited public read: the RPC decides whether the profile exists for
  // the public at all, so a direct link cannot bypass the policy.
  const business = useQuery({
    queryKey: ["mkt", "public-business", slug, session?.user.id ?? null],
    queryFn: () => loadPublicBusiness(slug),
  });

  const logo = useQuery({
    queryKey: ["mkt", "business-logo", business.data?.logo_url],
    enabled: !!business.data?.logo_url,
    queryFn: async () =>
      (await resolveMedia([business.data!.logo_url]))[business.data!.logo_url!] ?? null,
  });

  const categories = useQuery({
    queryKey: ["mkt", "business-categories", slug],
    enabled: !!business.data,
    queryFn: () => loadBusinessCategories(slug),
  });

  const listings = useInfiniteQuery({
    queryKey: ["mkt", "public-business-listings", slug, categoryId, locale],
    enabled: !!business.data,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadBusinessListings({ slug, categoryId, page: pageParam as number, locale }),
    getNextPageParam: (last, all) =>
      (last as unknown[]).length < BUSINESS_PAGE_SIZE ? undefined : all.length,
  });

  const rows = useMemo(() => (listings.data?.pages ?? []).flat(), [listings.data]);

  if (business.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </MarketShell>
    );
  }

  const biz = business.data;
  if (!biz) {
    // Neutral screen for missing, unpublished, suspended and deleted businesses
    // alike — the reason is never disclosed.
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-page font-bold text-foreground">{t("market.business.unavailable")}</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  const businessSlug = biz.slug;

  async function openBusinessDashboard() {
    if (openingDashboard) return;

    // `can_edit` proves membership server-side, but the dashboard is deliberately
    // scoped to the ACTIVE marketplace account. A platform administrator may also
    // own this business while their personal account is active; opening the route
    // directly would therefore be denied correctly. Resolve the matching account
    // from the server-provided list, activate it (which also aligns
    // `active_tenant_id`), then navigate. No admin bypass or tenant id is exposed.
    const target = accounts.find(
      (candidate) => candidate.kind === "business" && candidate.slug === businessSlug,
    );
    if (!target) {
      toast.error(t("market.entry.switchFailed"));
      return;
    }

    setOpeningDashboard(true);
    try {
      if (activeAccount?.account_key !== target.account_key) {
        const selected = await selectAccount(target.account_key);
        if (!selected) {
          toast.error(t("market.entry.switchFailed"));
          return;
        }
      }
      await navigate({ to: "/business/profile" });
    } finally {
      setOpeningDashboard(false);
    }
  }

  const name =
    (locale === "ar" ? biz.display_name_ar : biz.display_name_en || biz.display_name_ar) ||
    t("market.business.fallbackName");
  const city = locale === "ar" ? biz.city_ar : biz.city_en || biz.city_ar;
  const about = sanitizeAbout(biz.about);
  const aboutLong = about.length > 320;
  const chips = activityChips(biz);
  const shownChips = allActivities ? chips : chips.slice(0, ACTIVITY_LIMIT);
  const website = safeWebsite(biz.public_website);
  const contacts = [biz.public_phone, biz.public_whatsapp, biz.public_email].filter(
    (v): v is string => !!v,
  );
  const cats = categories.data ?? [];
  const entityLabel = biz.entity_type ? t(`market.entity.${biz.entity_type}`) : null;
  const activitySummary = biz.headline ?? biz.main_activity ?? entityLabel;
  // City / region text only: the business keeps no published coordinates, so no
  // precise point can leak through this link.
  const place = locationLink({
    latitude: null,
    longitude: null,
    visibility: null,
    city: city ?? null,
    district: null,
    country: biz.region,
  });
  const hasDetails = !!entityLabel;

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-5">
          <header className="rounded-xl border border-border bg-card p-3.5 sm:p-5 lg:sticky lg:top-20">
            <div className="flex items-start gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-sm font-bold text-muted-foreground">
                {logo.data ? (
                  <img
                    src={logo.data}
                    alt={name}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  businessInitials(name) || <Store className="size-6" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-page font-bold leading-tight text-foreground">
                  {name}
                </h1>
                {/* The trust check mark lives under the name only. */}
                <VerifiedBadge status={biz.verification_status} />
              </div>
            </div>

            <div className="mt-[var(--sp-3)] flex flex-wrap items-center gap-x-3 gap-y-1 text-desc text-muted-foreground">
              {activitySummary && <span>{activitySummary}</span>}
              {city && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{city}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden />
                {t("market.business.joined")}{" "}
                {new Date(biz.joined_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
              </span>
              <span className="inline-flex items-center gap-1">
                {biz.active_listings > 0 && (
                  <span className="num" dir="ltr">
                    {biz.active_listings}
                  </span>
                )}
                <span>{t(activeListingsKey(biz.active_listings))}</span>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {biz.can_edit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accountsLoading || openingDashboard}
                  onClick={() => void openBusinessDashboard()}
                  className="min-h-11 flex-1 sm:flex-none"
                >
                  {openingDashboard ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Pencil className="size-4" aria-hidden />
                  )}
                  {t("market.business.manage")}
                </Button>
              ) : biz.is_member ? null : session ? null : (
                <Button asChild size="sm" className="min-h-11 flex-1 sm:flex-none">
                  <a href={loginHref(currentPath().split("?")[0] ?? "/", "contact")}>
                    {t("market.ad.signInToContact")}
                  </a>
                </Button>
              )}
              <ShareSheet title={name} url={canonicalUrl(`/businesses/${biz.slug}`)}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 flex-1 sm:flex-none"
                  aria-label={t("market.business.shareProfile")}
                  title={t("market.business.shareProfile")}
                >
                  <Share2 className="size-4" aria-hidden />
                  {t("market.ad.share")}
                </Button>
              </ShareSheet>
              {place && (
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 rounded-full"
                >
                  <a
                    href={place.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t("market.business.goToLocation")}
                    title={t("market.business.goToLocation")}
                  >
                    <Navigation className="size-4" aria-hidden />
                  </a>
                </Button>
              )}
            </div>

            {!biz.is_member && session && contacts.length > 0 && (
              <div className="mt-3 space-y-1 text-sm text-foreground" dir="ltr">
                {contacts.map((c) => (
                  <p key={c}>{c}</p>
                ))}
              </div>
            )}

            {website && (
              <a
                href={website}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="mt-3 inline-flex min-w-0 items-center gap-1 text-sm font-medium text-primary"
                dir="ltr"
              >
                <Globe className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{website.replace(/^https?:\/\//i, "")}</span>
              </a>
            )}

            {about && (
              <div className="mt-4">
                <h2 className="text-section font-bold text-foreground">{t("market.business.about")}</h2>
                <p
                  className={`mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground ${
                    aboutLong && !aboutOpen ? "line-clamp-4" : ""
                  }`}
                >
                  {about}
                </p>
                {aboutLong && (
                  <button
                    type="button"
                    className="mt-1 text-desc font-semibold text-primary"
                    onClick={() => setAboutOpen((v) => !v)}
                  >
                    {t(aboutOpen ? "market.ad.showLess" : "market.ad.showMore")}
                  </button>
                )}
              </div>
            )}

            {chips.length > 0 && (
              <div className="mt-4">
                <h2 className="text-section font-bold text-foreground">
                  {t("market.business.activities")}
                </h2>
                <div className="mt-2 flex flex-wrap gap-[var(--sp-2)]">
                  {shownChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-border bg-secondary/50 px-[var(--sp-3)] py-1 text-desc text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                {chips.length > ACTIVITY_LIMIT && (
                  <button
                    type="button"
                    className="mt-1.5 text-desc font-semibold text-primary"
                    onClick={() => setAllActivities((v) => !v)}
                  >
                    {t(allActivities ? "market.ad.showLess" : "market.business.showAllActivities")}
                  </button>
                )}
              </div>
            )}

            {hasDetails && (
              <div className="mt-4 border-t border-border pt-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-sm font-bold text-foreground"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  {t("market.business.details")}
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {detailsOpen && (
                  <dl className="mt-2 space-y-1 text-desc">
                    {entityLabel && (
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-muted-foreground">{t("market.business.entityType")}</dt>
                        <dd className="font-medium text-foreground">{entityLabel}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            )}
          </header>

          <section className="mt-5 lg:mt-0">
            <h2 className="text-section font-bold text-foreground">{t("market.business.listings")}</h2>

            {cats.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-[var(--sp-2)]">
                {[
                  { id: null as string | null, label: t("market.person.allCategories") },
                  ...cats.map((c) => ({
                    id: c.category_id as string | null,
                    label: locale === "ar" ? c.name_ar : c.name_en || c.name_ar,
                  })),
                ].map((chip) => {
                  const active = categoryId === chip.id;
                  return (
                    <button
                      key={chip.id ?? "all"}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategoryId(chip.id)}
                      className={`rounded-full border px-3 py-[var(--sp-2)] text-desc font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            {listings.isPending ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("market.business.noListings")}
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {rows.map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
                {listings.hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      disabled={listings.isFetchingNextPage}
                      onClick={() => void listings.fetchNextPage()}
                    >
                      {t("market.person.loadMore")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </MarketShell>
  );
}
