import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Pencil, Share2, User } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref, resolveMedia } from "@/lib/mkt";
import {
  activeListingsKey,
  loadPersonCategories,
  loadPersonListings,
  loadPublicPerson,
  personInitials,
  sanitizeAbout,
  PERSON_PAGE_SIZE,
} from "@/lib/mkt-person";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { canonicalUrl } from "@/lib/share-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/u/$username")({
  ssr: false,
  head: ({ params }) => {
    const title = `${params.username} — معلن فرد في كحلي`;
    const description =
      "الملف العام للمعلن الفرد في كحلي: النبذة، المدينة، تاريخ الانضمام، وإعلاناته المنشورة.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `https://check-your-name-ai.lovable.app/u/${params.username}` }],
    };
  },
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Field-limited public read: the RPC decides whether the profile exists for
  // the public at all, so a direct link cannot bypass the policy.
  const person = useQuery({
    queryKey: ["mkt", "public-person", username, session?.user.id ?? null],
    queryFn: () => loadPublicPerson(username),
  });

  const avatar = useQuery({
    queryKey: ["mkt", "person-avatar", person.data?.avatar_url],
    enabled: !!person.data?.avatar_url,
    queryFn: async () => {
      const media = await resolveMedia([person.data!.avatar_url]);
      return media[person.data!.avatar_url!] ?? null;
    },
  });

  const categories = useQuery({
    queryKey: ["mkt", "person-categories", username],
    enabled: !!person.data,
    queryFn: () => loadPersonCategories(username),
  });

  const listings = useInfiniteQuery({
    queryKey: ["mkt", "person-listings", username, categoryId, locale],
    enabled: !!person.data,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadPersonListings({ username, categoryId, page: pageParam as number, locale }),
    getNextPageParam: (last, all) =>
      (last as unknown[]).length < PERSON_PAGE_SIZE ? undefined : all.length,
  });

  const rows = useMemo(() => (listings.data?.pages ?? []).flat(), [listings.data]);

  if (person.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </MarketShell>
    );
  }

  const me = person.data;
  if (!me) {
    // Neutral screen for missing, hidden, suspended and deleted accounts alike —
    // the reason is never disclosed.
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-lg font-bold text-foreground">{t("market.person.unavailable")}</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  const name = me.display_name || t("market.person.fallbackName");
  const city = locale === "ar" ? me.city_ar : me.city_en || me.city_ar;
  const about = sanitizeAbout(me.about);
  const aboutLong = about.length > 320;
  const contacts = [me.public_phone, me.public_whatsapp, me.public_email].filter(
    (v): v is string => !!v,
  );
  const cats = categories.data ?? [];


  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <header className="rounded-xl border border-border bg-card p-3.5 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-bold text-muted-foreground">
              {avatar.data ? (
                <img
                  src={avatar.data}
                  alt={name}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                personInitials(name) || <User className="size-6" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-lg font-bold leading-tight text-foreground sm:text-2xl">
                {name}
              </h1>
              {/* The trust check mark lives under the name only. */}
              <VerifiedBadge status={me.verification_status} />
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{t("market.person.kindIndividual")}</span>
                {city && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{city}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {t("market.business.joined")}{" "}
                  {new Date(me.joined_at).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Riyadh",
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  {me.active_listings > 0 && (
                    <span className="num" dir="ltr">
                      {me.active_listings}
                    </span>
                  )}
                  <span>{t(activeListingsKey(me.active_listings))}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {me.is_owner ? (
              <Button asChild variant="outline" size="sm" className="min-h-11 flex-1 sm:flex-none">
                <Link to="/dashboard/profile">
                  <Pencil className="size-4" aria-hidden />
                  {t("market.person.editProfile")}
                </Link>
              </Button>
            ) : session ? null : (
              <Button asChild size="sm" className="min-h-11 flex-1 sm:flex-none">
                <a href={loginHref(currentPath().split("?")[0] ?? "/", "contact")}>
                  {t("market.ad.signInToContact")}
                </a>
              </Button>
            )}
            <ShareSheet title={name} url={canonicalUrl(`/u/${me.username}`)}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 flex-1 sm:flex-none"
                aria-label={t("market.person.shareProfile")}
                title={t("market.person.shareProfile")}
              >
                <Share2 className="size-4" aria-hidden />
                {t("market.ad.share")}
              </Button>
            </ShareSheet>
          </div>

          {!me.is_owner && session && contacts.length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-foreground" dir="ltr">
              {contacts.map((c) => (
                <p key={c}>{c}</p>
              ))}
            </div>
          )}

          {about && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-foreground">{t("market.business.about")}</h2>
              <p
                className={`mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground ${
                  aboutLong && !aboutOpen ? "line-clamp-4" : ""
                }`}
              >
                {about}
              </p>
              {aboutLong && (
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-primary"
                  onClick={() => setAboutOpen((v) => !v)}
                >
                  {t(aboutOpen ? "market.ad.showLess" : "market.ad.showMore")}
                </button>
              )}
            </div>
          )}
        </header>

        <h2 className="mt-5 text-base font-bold text-foreground">{t("market.person.listings")}</h2>

        {cats.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[{ id: null, label: t("market.person.allCategories") }, ...cats.map((c) => ({
              id: c.category_id,
              label: locale === "ar" ? c.name_ar : c.name_en || c.name_ar,
            }))].map((chip) => {
              const active = categoryId === chip.id;
              return (
                <button
                  key={chip.id ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryId(chip.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t("market.person.noListings")}
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-2.5 sm:hidden">
              {rows.map((l) => (
                <ListingCard key={l.id} listing={l} view="row" />
              ))}
            </div>
            <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {rows.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {listings.hasNextPage && (
              <div className="mt-4 text-center">
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
      </div>
    </MarketShell>
  );
}
