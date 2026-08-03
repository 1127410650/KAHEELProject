import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Send,
  Share2,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { priceLabel, type MktListing } from "@/lib/mkt";
import {
  LISTING_DURATIONS,
  MY_LISTING_COLUMNS,
  allowedOps,
  archiveListing,
  deleteListing,
  duplicateListing,
  pauseListing,
  remainingLabel,
  renewListing,
  restoreListing,
  resumeListing,
  submitListing,
  type ListingDuration,
} from "@/lib/mkt-listing-ops";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
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

type Filter = "all" | "draft" | "pending" | "published" | "paused" | "expired" | "rejected" | "archived";
const FILTERS: Filter[] = [
  "all",
  "published",
  "pending",
  "draft",
  "paused",
  "expired",
  "rejected",
  "archived",
];
type SortKey = "recent" | "views" | "expiring";

function MyAdsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "delete" | "archive" } | null>(null);

  const ads = useQuery({
    queryKey: ["mkt", "my-ads", account?.account_key],
    enabled: !!session && !!account,
    queryFn: async () => {
      // Ads belong to the account the user entered under: a business sees its
      // own ads only, the personal account sees the ones with no entity.
      let query = supabase.from("mkt_listings").select(MY_LISTING_COLUMNS);
      query =
        account!.kind === "business"
          ? query.eq("tenant_id", account!.tenant_id!)
          : query.is("tenant_id", null).eq("owner_user_id", session!.user.id);
      const { data, error } = await query
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MktListing[];
    },
  });

  const all = ads.data ?? [];

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: all.length };
    for (const ad of all) map[ad.status] = (map[ad.status] ?? 0) + 1;
    return map;
  }, [all]);

  const totals = useMemo(
    () =>
      all.reduce(
        (acc, ad) => ({
          views: acc.views + (ad.views_count ?? 0),
          shares: acc.shares + (ad.shares_count ?? 0),
          contacts: acc.contacts + (ad.contact_requests_count ?? 0),
        }),
        { views: 0, shares: 0, contacts: 0 },
      ),
    [all],
  );

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = all.filter((ad) => {
      if (filter !== "all" && ad.status !== filter) return false;
      if (!needle) return true;
      return `${ad.title} ${ad.city ?? ""}`.toLowerCase().includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sort === "views") return (b.views_count ?? 0) - (a.views_count ?? 0);
      if (sort === "expiring") {
        const av = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
        const bv = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
        return av - bv;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      toast.error(
        code === "invalid_state"
          ? t("market.ops.invalidState")
          : code === "forbidden"
            ? t("market.ops.forbidden")
            : code === "license_required"
              ? t("market.ops.licenseRequired")
              : t("market.actions.failed"),
      );
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

  async function onShare(ad: MktListing) {
    if (!ad.slug) return;
    const url = `${window.location.origin}/ads/${ad.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: ad.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("market.ops.linkCopied"));
      }
    } catch {
      /* the user cancelled the share sheet */
    }
  }

  return (
    <DashboardShell title={t("market.dash.myAds")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link to="/dashboard/ads/new">{t("market.addListing")}</Link>
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
          <option value="recent">{t("market.ops.sortRecent")}</option>
          <option value="views">{t("market.ops.sortViews")}</option>
          <option value="expiring">{t("market.ops.sortExpiring")}</option>
        </select>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ["market.ops.totalViews", totals.views],
            ["market.ops.totalContacts", totals.contacts],
            ["market.ops.totalShares", totals.shares],
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

      <ul className="space-y-3">
        {rows.map((ad) => {
          const ops = allowedOps(ad.status);
          const remaining = remainingLabel(ad.expires_at, {
            days: (n) => t("market.ops.daysLeft").replace("{n}", String(n)),
            hours: (n) => t("market.ops.hoursLeft").replace("{n}", String(n)),
            ended: t("market.dash.status.expired"),
          });
          return (
            <li key={ad.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {priceLabel(ad, t("market.priceOnRequest"))} · {ad.city ?? "—"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>
                      {ad.views_count ?? 0} {t("market.dash.views")}
                    </span>
                    <span>
                      {ad.contact_requests_count ?? 0} {t("market.ops.contacts")}
                    </span>
                    <span>
                      {ad.shares_count ?? 0} {t("market.ops.shares")}
                    </span>
                    {remaining && ad.status === "published" && <span>{remaining}</span>}
                  </p>
                  {ad.rejection_reason && (
                    <p className="mt-1 text-xs text-destructive">{ad.rejection_reason}</p>
                  )}
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {t(`market.dash.status.${ad.status}`)}
                </span>
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
                    {ops.renew &&
                      LISTING_DURATIONS.map((days) => (
                        <DropdownMenuItem
                          key={days}
                          onSelect={() =>
                            void run(
                              ad.id,
                              () => renewListing(ad.id, days as ListingDuration),
                              "market.ops.renewed",
                            )
                          }
                        >
                          <RefreshCw className="me-2 size-4" aria-hidden />
                          {t("market.ops.renewFor").replace("{n}", String(days))}
                        </DropdownMenuItem>
                      ))}
                    {ad.slug && ad.status === "published" && (
                      <DropdownMenuItem onSelect={() => void onShare(ad)}>
                        <Share2 className="me-2 size-4" aria-hidden />
                        {t("market.ops.share")}
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
                      <DropdownMenuItem
                        onSelect={() => setConfirm({ id: ad.id, kind: "archive" })}
                      >
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
