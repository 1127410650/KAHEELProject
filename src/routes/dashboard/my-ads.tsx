import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  Flag,
  Heart,
  MessageSquareQuote,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  QrCode,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ADD_LISTING_PATH } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { formatDate, formatDateTime } from "@/lib/format";
import { priceLabel, resolveMedia, type MktListing } from "@/lib/mkt";
import {
  MY_LISTING_COLUMNS,
  MY_LISTING_STATUSES,
  allowedOps,
  archiveListing,
  deleteListing,
  duplicateListing,
  pauseListing,
  reactivateListing,
  remainingLabel,
  restoreListing,
  resumeListing,
  submitListing,
  trackListingEvent,
} from "@/lib/mkt-listing-ops";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { PromoteDialog } from "@/components/marketplace/PromoteDialog";
import { canonicalUrl } from "@/lib/share-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard/my-ads")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعلاناتي — سوق تحقّق" },
      {
        name: "description",
        content:
          "لوحة إدارة إعلاناتك في سوق تحقّق: المسودات وقيد المراجعة والمنشورة والمنتهية، مع الإيقاف والتجديد والنسخ والأرشفة.",
      },
      { property: "og:title", content: "إعلاناتي — سوق تحقّق" },
      {
        property: "og:description",
        content: "إدارة إعلانات الخدمات والمنتجات والمعدات الخاصة بك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyAdsPage,
});

/** Tab keys: every lifecycle status the owner can see, plus "all" and "featured". */
const FILTERS = ["all", ...MY_LISTING_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const SORTS = [
  "recent",
  "oldest",
  "views",
  "priceHigh",
  "priceLow",
  "expiring",
  "favorites",
] as const;
type SortKey = (typeof SORTS)[number];

/** Status chip colouring — semantic tokens only, so both themes stay readable. */
function statusClass(status: string, featured: boolean): string {
  if (featured) return "bg-primary/15 text-primary";
  switch (status) {
    case "published":
      return "bg-primary/10 text-primary";
    case "pending":
      return "bg-secondary text-secondary-foreground";
    case "needs_changes":
    case "rejected":
    case "suspended":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/** Op error code → user-facing message key. */
const OP_ERROR_KEYS: Record<string, string> = {
  invalid_state: "market.ops.invalidState",
  forbidden: "market.ops.forbidden",
  license_required: "market.ops.licenseRequired",
  admin_suspended: "market.ops.adminSuspended",
  account_restricted: "market.ops.accountRestricted",
  category_inactive: "market.ops.categoryInactive",
  already_promoted: "market.promote.alreadyPromoted",
  insufficient_points: "market.promote.insufficientPoints",
  image_required: "market.ops.imageRequired",
  images_incomplete: "market.ops.imagesIncomplete",
  images_too_many: "market.ops.imagesTooMany",
  business_incomplete: "market.ops.businessIncomplete",
  geo_required: "market.ops.geoRequired",
  price_required: "market.ops.priceRequired",
  price_invalid: "market.ops.priceInvalid",
  not_found: "market.ops.notFound",

};

/** Moderation hint shown to the advertiser — never an accusation, just status. */
function moderationHint(state: string | null | undefined): { key: string; tone: string } | null {
  switch (state) {
    case "review":
      return { key: "market.moderation.owner.review", tone: "text-muted-foreground" };
    case "blocked_suspected":
      return { key: "market.moderation.owner.suspected", tone: "text-destructive" };
    case "cleared":
      return { key: "market.moderation.owner.cleared", tone: "text-primary" };
    default:
      return null;
  }
}

function MyAdsPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "delete" | "archive" } | null>(null);
  const [promoteFor, setPromoteFor] = useState<{ id: string; title: string } | null>(null);
  const [, setTick] = useState(0);

  // Remaining-time labels are computed from wall-clock time, so a live tick
  // every minute keeps "ends in X" / "ended X ago" accurate without a refetch.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ads = useQuery({
    queryKey: ["mkt", "my-ads", account?.account_key, locale],
    enabled: !!session && !!account,
    queryFn: async () => {
      // Ads belong to the account the user entered under: a business sees its
      // own ads only, the personal account sees the ones with no entity.
      let query = supabase
        .from("mkt_listings")
        .select(
          `${MY_LISTING_COLUMNS}, moderation_state, moderation_score, last_scan_at, promoted_until`,
        );
      query =
        account!.kind === "business"
          ? query.eq("tenant_id", account!.tenant_id!)
          : query.is("tenant_id", null).eq("owner_user_id", session!.user.id);
      const { data, error } = await query
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as MktListing[];

      // Activity labels and cover thumbnails, resolved once for the whole list.
      const catIds = Array.from(
        new Set(rows.flatMap((r) => [r.category_id, r.subcategory_id].filter(Boolean) as string[])),
      );
      const [{ data: cats }, media] = await Promise.all([
        catIds.length > 0
          ? supabase.from("mkt_categories").select("id, name_ar, name_en").in("id", catIds)
          : Promise.resolve({ data: [] as { id: string; name_ar: string; name_en: string }[] }),
        resolveMedia(rows.map((r) => r.cover_image_url)),
      ]);
      const catMap = new Map((cats ?? []).map((c) => [c.id, locale === "ar" ? c.name_ar : c.name_en]));

      return rows.map((row) => ({
        ...row,
        activityLabel:
          (row.subcategory_id ? catMap.get(row.subcategory_id) : undefined) ??
          catMap.get(row.category_id) ??
          null,
        thumbUrl: row.cover_image_url ? (media[row.cover_image_url] ?? null) : null,
      }));
    },
  });

  const all = useMemo(() => ads.data ?? [], [ads.data]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: all.length };
    for (const ad of all) {
      map[ad.status] = (map[ad.status] ?? 0) + 1;
      if (ad.is_featured) map["featured"] = (map["featured"] ?? 0) + 1;
    }
    return map;
  }, [all]);

  const totals = useMemo(
    () =>
      all.reduce(
        (acc, ad) => ({
          views: acc.views + (ad.views_count ?? 0),
          contacts: acc.contacts + (ad.contact_requests_count ?? 0),
          favorites: acc.favorites + (ad.favorites_count ?? 0),
          quotes: acc.quotes + (ad.quote_requests_count ?? 0),
          shares: acc.shares + (ad.shares_count ?? 0),
          links: acc.links + (ad.link_copies_count ?? 0),
          qr: acc.qr + (ad.qr_opens_count ?? 0),
          reports: acc.reports + (ad.reports_count ?? 0),
          ratings: acc.ratings + (ad.ratings_count ?? 0),
        }),
        {
          views: 0,
          contacts: 0,
          favorites: 0,
          quotes: 0,
          shares: 0,
          links: 0,
          qr: 0,
          reports: 0,
          ratings: 0,
        },
      ),
    [all],
  );

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = all.filter((ad) => {
      if (filter === "featured" ? !ad.is_featured : filter !== "all" && ad.status !== filter)
        return false;
      if (!needle) return true;
      const haystack = [
        ad.title,
        ad.city ?? "",
        ad.activityLabel ?? "",
        ad.ref_no ? String(ad.ref_no) : "",
        (ad.keywords ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return time(a.created_at) - time(b.created_at);
        case "views":
          return (b.views_count ?? 0) - (a.views_count ?? 0);
        case "favorites":
          return (b.favorites_count ?? 0) - (a.favorites_count ?? 0);
        case "priceHigh":
          return (b.price ?? -1) - (a.price ?? -1);
        case "priceLow":
          return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
        case "expiring": {
          const av = a.expires_at ? time(a.expires_at) : Number.POSITIVE_INFINITY;
          const bv = b.expires_at ? time(b.expires_at) : Number.POSITIVE_INFINITY;
          return av - bv;
        }
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
  }, [all, filter, term, sort]);

  async function run(id: string, action: () => Promise<unknown>, successKey: string) {
    setBusyId(id);
    try {
      await action();
      toast.success(t(successKey));
      await ads.refetch();
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      toast.error(t(OP_ERROR_KEYS[code] ?? "market.actions.failed"));
    } finally {
      setBusyId(null);
    }
  }

  /** Reactivation is re-scanned server-side, so the toast follows the outcome. */
  async function onReactivate(id: string) {
    setBusyId(id);
    try {
      const outcome = await reactivateListing(id);
      toast.success(
        outcome === "published" ? t("market.ops.reactivated") : t("market.ops.reactivateReview"),
      );
      await ads.refetch();
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      toast.error(t(OP_ERROR_KEYS[code] ?? "market.actions.failed"));
    } finally {
      setBusyId(null);
    }
  }


  async function onDuplicate(id: string) {
    setBusyId(id);
    try {
      const newId = (await duplicateListing(id)) as unknown as string;
      toast.success(t("market.ops.duplicated"));
      await ads.refetch();
      if (typeof newId === "string") {
        void navigate({ to: "/dashboard/ads/$id/edit", params: { id: newId } });
      }
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell title={t("market.dash.myAds")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link to={ADD_LISTING_PATH}>{t("market.addListing")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/points">{t("market.points.title")}</Link>
        </Button>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute inset-y-0 my-auto size-4 text-muted-foreground start-2.5"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("market.ops.searchMyAds")}
            aria-label={t("market.ops.searchMyAds")}
            className="h-9 ps-8"
          />
        </div>
        <select
          aria-label={t("market.ops.sort")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          {SORTS.map((key) => (
            <option key={key} value={key}>
              {t(`market.ops.sort_${key}`)}
            </option>
          ))}
        </select>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {(
          [
            ["market.ops.totalViews", totals.views],
            ["market.ops.totalFavorites", totals.favorites],
            ["market.ops.totalQuotes", totals.quotes],
            ["market.ops.totalContacts", totals.contacts],
            ["market.ops.totalShares", totals.shares],
            ["market.ops.totalLinkCopies", totals.links],
            ["market.ops.totalQr", totals.qr],
            ["market.ops.totalRatings", totals.ratings],
            ["market.ops.totalReports", totals.reports],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-3 text-center">
            <dt className="text-[11px] text-muted-foreground">{t(key)}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground" dir="ltr">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {key === "all" ? t("market.filters.all") : t(`market.dash.status.${key}`)}{" "}
            <span className="opacity-70" dir="ltr">
              {counts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {ads.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

        {rows.map((ad) => {
          const ops = allowedOps(ad.status);
          const remaining = remainingLabel(ad.expires_at, {
            days: (n) => t("market.ops.endsIn").replace("{n}", String(n)),
            hours: (n) => t("market.ops.endsInHours").replace("{n}", String(n)),
            ended: t("market.dash.status.expired"),
            endedDays: (n) => t("market.ops.endedAgo").replace("{n}", String(n)),
            endedHours: (n) => t("market.ops.endedAgoHours").replace("{n}", String(n)),
          });
          const shareUrl = ad.slug ? canonicalUrl(`/ads/${ad.slug}`) : undefined;
          return (
            <li key={ad.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex gap-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
                  {ad.thumbUrl ? (
                    <img
                      src={ad.thumbUrl}
                      alt={ad.title}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground">
                      {t("market.noImage")}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                        #{ad.ref_no ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(ad.status, !!ad.is_featured)}`}
                    >
                      {ad.is_featured && <Sparkles className="me-1 inline size-3" aria-hidden />}
                      {t(`market.dash.status.${ad.status}`)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-semibold text-primary">
                    {priceLabel(ad, "—", locale)}
                  </p>

                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {ad.activityLabel && <span>{ad.activityLabel}</span>}
                    <span>{ad.city ?? "—"}</span>
                    <span dir="ltr">{formatDate(ad.published_at ?? ad.created_at)}</span>
                    <span>
                      {t("market.ops.duration")}: <span dir="ltr">{ad.duration_days ?? "—"}</span>
                    </span>
                    {remaining && <span className="text-foreground">{remaining}</span>}
                    {ad.promoted_until && new Date(ad.promoted_until).getTime() > Date.now() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 text-primary">
                        <Sparkles className="size-3" aria-hidden />
                        {t("market.promote.activeUntil", {
                          date: formatDateTime(ad.promoted_until),
                        })}
                      </span>
                    )}
                  </p>


                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3" aria-hidden />
                      <span dir="ltr">{ad.views_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3" aria-hidden />
                      <span dir="ltr">{ad.favorites_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquareQuote className="size-3" aria-hidden />
                      <span dir="ltr">{ad.quote_requests_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="size-3" aria-hidden />
                      <span dir="ltr">{ad.shares_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Copy className="size-3" aria-hidden />
                      <span dir="ltr">{ad.link_copies_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <QrCode className="size-3" aria-hidden />
                      <span dir="ltr">{ad.qr_opens_count ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3" aria-hidden />
                      <span dir="ltr">
                        {ad.ratings_count ?? 0}
                        {ad.ratings_avg ? ` · ${Number(ad.ratings_avg).toFixed(1)}` : ""}
                      </span>
                    </span>
                    {!!ad.reports_count && (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <Flag className="size-3" aria-hidden />
                        <span dir="ltr">{ad.reports_count}</span>
                      </span>
                    )}
                  </p>

                  {(() => {
                    const hint = moderationHint(ad.moderation_state);
                    if (!hint) return null;
                    return (
                      <p className={`mt-1 flex items-start gap-1 text-xs ${hint.tone}`}>
                        <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span>
                          {t(hint.key)}
                          {ad.last_scan_at && (
                            <span className="ms-1 text-muted-foreground" dir="ltr">
                              {formatDateTime(ad.last_scan_at)}
                            </span>
                          )}
                        </span>
                      </p>
                    );
                  })()}

                  {ad.rejection_reason && (
                    <p className="mt-1 text-xs text-destructive">{ad.rejection_reason}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {ad.status === "published" && ad.slug && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/ads/$slug" params={{ slug: ad.slug }}>
                      <Eye className="me-1 size-3.5" aria-hidden />
                      {t("market.dash.view")}
                    </Link>
                  </Button>
                )}
                {ops.edit && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/dashboard/ads/$id/edit" params={{ id: ad.id }}>
                      <Pencil className="me-1 size-3.5" aria-hidden />
                      {t("market.dash.edit")}
                    </Link>
                  </Button>
                )}
                {ops.submit && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === ad.id}
                    onClick={() =>
                      void run(ad.id, () => submitListing(ad.id), "market.dash.submitted")
                    }
                  >
                    <Send className="me-1 size-3.5" aria-hidden />
                    {t("market.dash.submitForReview")}
                  </Button>
                )}
                {shareUrl && ad.status === "published" && (
                  <ShareSheet title={ad.title} url={shareUrl} listingId={ad.id}>
                    <Button size="sm" variant="ghost" aria-label={t("market.ops.share")}>
                      <Share2 className="size-4" aria-hidden />
                    </Button>
                  </ShareSheet>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === ad.id}
                      aria-label={t("market.dash.more")}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {ops.pause && (
                      <DropdownMenuItem
                        onSelect={() =>
                          void run(ad.id, () => pauseListing(ad.id), "market.ops.paused")
                        }
                      >
                        <Pause className="me-2 size-4" aria-hidden />
                        {t("market.ops.pause")}
                      </DropdownMenuItem>
                    )}
                    {ops.resume && (
                      <DropdownMenuItem
                        onSelect={() =>
                          void run(ad.id, () => resumeListing(ad.id), "market.ops.resumed")
                        }
                      >
                        <Play className="me-2 size-4" aria-hidden />
                        {t("market.ops.resume")}
                      </DropdownMenuItem>
                    )}
                    {ops.renew && (
                      <DropdownMenuItem onSelect={() => void onReactivate(ad.id)}>
                        <RotateCcw className="me-2 size-4" aria-hidden />
                        {t("market.ops.reactivate")}
                      </DropdownMenuItem>
                    )}
                    {ad.status === "published" &&
                      !(ad.promoted_until && new Date(ad.promoted_until).getTime() > Date.now()) && (
                        <DropdownMenuItem
                          onSelect={() => setPromoteFor({ id: ad.id, title: ad.title })}
                        >
                          <Sparkles className="me-2 size-4" aria-hidden />
                          {t("market.promote.action")}
                        </DropdownMenuItem>
                      )}
                    {ops.duplicate && (
                      <DropdownMenuItem onSelect={() => void onDuplicate(ad.id)}>
                        <Copy className="me-2 size-4" aria-hidden />
                        {t("market.ops.duplicate")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {ops.restore && (
                      <DropdownMenuItem
                        onSelect={() =>
                          void run(ad.id, () => restoreListing(ad.id), "market.ops.restored")
                        }
                      >
                        <ArchiveRestore className="me-2 size-4" aria-hidden />
                        {t("market.ops.restore")}
                      </DropdownMenuItem>
                    )}
                    {ops.archive && (
                      <DropdownMenuItem onSelect={() => setConfirm({ id: ad.id, kind: "archive" })}>
                        <Archive className="me-2 size-4" aria-hidden />
                        {t("market.dash.archive")}
                      </DropdownMenuItem>
                    )}
                    {ops.remove && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setConfirm({ id: ad.id, kind: "delete" })}
                      >
                        <Trash2 className="me-2 size-4" aria-hidden />
                        {t("market.ops.delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {!ads.isLoading && rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {all.length === 0 ? t("market.dash.noAds") : t("market.ops.noMatches")}
        </p>
      )}

      {promoteFor && (
        <PromoteDialog
          listingId={promoteFor.id}
          title={promoteFor.title}
          open={!!promoteFor}
          onOpenChange={(open) => !open && setPromoteFor(null)}
          onDone={() => void ads.refetch()}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? t("market.ops.delete") : t("market.dash.archive")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? t("market.ops.deleteWarning")
                : t("market.ops.archiveWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                const { id, kind } = confirm;
                setConfirm(null);
                void run(
                  id,
                  () => (kind === "delete" ? deleteListing(id) : archiveListing(id)),
                  kind === "delete" ? "market.ops.deleted" : "market.dash.archived",
                );
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
