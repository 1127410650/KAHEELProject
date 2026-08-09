import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import {
  BUSINESS_COLUMNS,
  LISTING_STATUSES,
  SA_CITIES,
  resolveMedia,
  type MktBusiness,
  type MktListing,
} from "@/lib/mkt";
import { MY_LISTING_COLUMNS } from "@/lib/mkt-listing-ops";
import { loadCategories } from "@/lib/mkt-queries";
import { reviewListing, type ListingReviewAction } from "@/lib/mkt-admin";
import { adminCan } from "@/lib/mkt-admin-perms";
import { adminErrorMessage, usePlatformIdentity } from "@/lib/mkt-platform";
import {
  loadAdvertiserSafetyMap,
  RISK_ORDER,
  safetyKey,
} from "@/lib/mkt-admin-safety";
import { AdminListingCard } from "@/components/marketplace/AdminListingCard";
import { readAdminListState, useAdminListMemory } from "@/lib/use-admin-list-memory";
import { AdminShell } from "@/components/marketplace/AdminShell";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/listings")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "مراجعة الإعلانات — إدارة كَحيل" },
      {
        name: "description",
        content: "مراجعة إعلانات السوق: اعتماد، رفض بسبب، إيقاف، أو إعادة الإعلان لصاحبه للتعديل.",
      },
      { property: "og:title", content: "مراجعة الإعلانات — إدارة كَحيل" },
      { property: "og:description", content: "لوحة مراجعة إعلانات كَحيل." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminListingsPage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

const SORTS = [
  { value: "newest", labelKey: "market.sort.newest" },
  { value: "oldest", labelKey: "market.sort.oldest" },
  { value: "risk", labelKey: "market.admin.sortRisk" },
  { value: "reports", labelKey: "market.admin.sortReports" },
  { value: "views", labelKey: "market.sort.views" },
  { value: "expiring", labelKey: "market.admin.sortExpiring" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

interface Decision {
  listing: MktListing;
  action: ListingReviewAction;
}

function AdminListingsPage() {
  const { t, locale } = useI18n();
  const { status: statusParam } = Route.useSearch();
  const { identity } = usePlatformIdentity();
  const canReview = adminCan(identity, "listings.review");
  const remembered = readAdminListState("listings", {
    status: "",
    city: "",
    categoryId: "",
    tenantId: "",
    q: "",
    sort: "newest" as string,
  });
  const [status, setStatus] = useState(statusParam ?? remembered.status);
  const [city, setCity] = useState(remembered.city);
  const [categoryId, setCategoryId] = useState(remembered.categoryId);
  const [tenantId, setTenantId] = useState(remembered.tenantId);
  const [q, setQ] = useState(remembered.q);
  const [sort, setSort] = useState<SortKey>(
    (SORTS.some((s) => s.value === remembered.sort) ? remembered.sort : "newest") as SortKey,
  );
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const businesses = useQuery({
    queryKey: ["mkt", "admin-businesses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_business_profiles")
        .select(BUSINESS_COLUMNS)
        .order("display_name_ar");
      return (data ?? []) as MktBusiness[];
    },
  });

  const listings = useQuery({
    queryKey: ["mkt", "admin-listings", status, city, categoryId, tenantId, q],
    queryFn: async () => {
      let query = supabase
        .from("mkt_listings")
        .select(MY_LISTING_COLUMNS)
        .order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      if (city) query = query.eq("city", city);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as MktListing[];
    },
  });

  useAdminListMemory(
    "listings",
    { status, city, categoryId, tenantId, q, sort },
    !listings.isLoading,
  );

  const rows = listings.data ?? [];

  const covers = useQuery({
    queryKey: ["mkt", "admin-listing-covers", rows.map((r) => r.cover_image_url ?? "").join("|")],
    enabled: rows.length > 0,
    queryFn: () => resolveMedia(rows.map((r) => r.cover_image_url)),
  });

  const safety = useQuery({
    queryKey: [
      "mkt",
      "admin-listing-safety",
      rows.map((r) => safetyKey(r.owner_user_id, r.tenant_id)).join("|"),
    ],
    enabled: rows.length > 0,
    staleTime: 60_000,
    queryFn: () =>
      loadAdvertiserSafetyMap(
        rows.map((r) => ({ userId: r.owner_user_id, tenantId: r.tenant_id })),
      ),
  });

  const catName = (id: string | null) => {
    if (!id) return "—";
    const cat = (categories.data ?? []).find((c) => c.id === id);
    if (!cat) return "—";
    return locale === "ar" ? cat.name_ar : cat.name_en || cat.name_ar;
  };

  const sorted = useMemo(() => {
    const map = safety.data ?? {};
    const list = [...rows];
    const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
    switch (sort) {
      case "oldest":
        return list.sort((a, b) => time(a.created_at) - time(b.created_at));
      case "reports":
        return list.sort((a, b) => Number(b.reports_count ?? 0) - Number(a.reports_count ?? 0));
      case "views":
        return list.sort((a, b) => Number(b.views_count ?? 0) - Number(a.views_count ?? 0));
      case "expiring":
        return list.sort(
          (a, b) =>
            (time(a.expires_at) || Number.MAX_SAFE_INTEGER) -
            (time(b.expires_at) || Number.MAX_SAFE_INTEGER),
        );
      case "risk":
        return list.sort((a, b) => {
          const ra = map[safetyKey(a.owner_user_id, a.tenant_id)];
          const rb = map[safetyKey(b.owner_user_id, b.tenant_id)];
          const wa = ra ? RISK_ORDER[ra.risk_level] * 1000 + ra.risk_score : 0;
          const wb = rb ? RISK_ORDER[rb.risk_level] * 1000 + rb.risk_score : 0;
          return wb - wa;
        });
      default:
        return list.sort((a, b) => time(b.created_at) - time(a.created_at));
    }
  }, [rows, sort, safety.data]);
  const bizName = (id: string | null) => {
    if (!id) return t("market.ad.individualAdvertiser");
    const biz = businesses.data?.find((b) => b.tenant_id === id);
    if (!biz) return "—";
    return locale === "ar" ? biz.display_name_ar : biz.display_name_en || biz.display_name_ar;
  };

  async function submitDecision(reason: string) {
    if (!decision) return;
    if (decision.action !== "approve" && !reason.trim()) {
      toast.error(t("market.admin.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await reviewListing(decision.listing.id, decision.action, reason.trim() || undefined);
      toast.success(t("market.admin.decisionSaved"));
      setDecision(null);
      await listings.refetch();
    } catch (error) {
      toast.error(adminErrorMessage(error, t("market.actions.failed")));
    } finally {
      setBusy(false);
    }
  }


  return (
    <AdminShell title={t("market.admin.listings")}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="f-status">{t("market.admin.status")}</Label>
          <select
            id="f-status"
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("market.filters.all")}</option>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`market.dash.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-biz">{t("market.admin.business")}</Label>
          <select
            id="f-biz"
            className={selectClass}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            <option value="">{t("market.filters.all")}</option>
            {(businesses.data ?? []).map((b) => (
              <option key={b.tenant_id} value={b.tenant_id}>
                {locale === "ar" ? b.display_name_ar : b.display_name_en || b.display_name_ar}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-cat">{t("market.filters.category")}</Label>
          <select
            id="f-cat"
            className={selectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("market.filters.all")}</option>
            {(categories.data ?? [])
              .filter((c) => !c.parent_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.name_ar : c.name_en || c.name_ar}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-city">{t("market.filters.city")}</Label>
          <select
            id="f-city"
            className={selectClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">{t("market.filters.allCities")}</option>
            {SA_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-q">{t("market.admin.search")}</Label>
          <Input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="f-sort">{t("market.filters.sort")}</Label>
          <select
            id="f-sort"
            className={selectClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground tabular-nums">
          {t("market.admin.results")}: {listings.isLoading ? "…" : sorted.length}
        </p>
        {(status || city || categoryId || tenantId || q) && (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setStatus("");
              setCity("");
              setCategoryId("");
              setTenantId("");
              setQ("");
            }}
          >
            {t("market.filters.reset")}
          </Button>
        )}
      </div>

      {listings.isError ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-foreground">{t("market.admin.loadFailed")}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => void listings.refetch()}
          >
            {t("market.admin.retry")}
          </Button>
        </div>
      ) : listings.isLoading ? (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-9 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("market.noResults")}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((ad) => (
            <AdminListingCard
              key={ad.id}
              listing={ad}
              coverUrl={(covers.data ?? {})[ad.cover_image_url ?? ""]}
              advertiserName={bizName(ad.tenant_id)}
              categoryName={catName(ad.category_id)}
              safety={(safety.data ?? {})[safetyKey(ad.owner_user_id, ad.tenant_id)]}
              safetyLoading={safety.isLoading}
              canReview={canReview}
              busyAction={busy && decision?.listing.id === ad.id ? decision.action : null}
              onAction={(action) => setDecision({ listing: ad, action })}
            />
          ))}
        </ul>
      )}


      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision
                ? t(
                    `market.admin.${decision.action === "return" ? "returnToOwner" : decision.action}`,
                  )
                : ""}
            </DialogTitle>
            <DialogDescription>{decision?.listing.title}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void submitDecision(String(fd.get("reason") ?? ""));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="reason">
                {decision?.action === "approve"
                  ? t("market.admin.noteOptional")
                  : t("market.admin.reason")}
              </Label>
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                required={decision?.action !== "approve"}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t("market.admin.confirm")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
