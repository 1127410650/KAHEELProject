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
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "مراجعة الإعلانات — إدارة سوق تحقّق" },
      {
        name: "description",
        content: "مراجعة إعلانات السوق: اعتماد، رفض بسبب، إيقاف، أو إعادة الإعلان لصاحبه للتعديل.",
      },
      { property: "og:title", content: "مراجعة الإعلانات — إدارة سوق تحقّق" },
      { property: "og:description", content: "لوحة مراجعة إعلانات سوق تحقّق." },
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


  const history = useQuery({
    queryKey: ["mkt", "admin-listing-history", open?.id],
    enabled: !!open,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listing_status_history")
        .select("id, from_status, to_status, reason, created_at")
        .eq("listing_id", open!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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
      setOpen(null);
      await listings.refetch();
    } catch {
      toast.error(t("market.actions.failed"));
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {listings.isLoading ? "…" : (listings.data ?? []).length}
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
            {t("market.filters.all")}
          </Button>
        )}
      </div>



      <ul className="mt-5 space-y-3">
        {listings.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : (listings.data ?? []).map((ad) => (
              <li key={ad.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <AdminListingLink
                      id={ad.id}
                      name={ad.title}
                      truncate
                      className="min-h-11 py-2.5 text-sm font-semibold"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ad.tenant_id ? (
                        <AdminBusinessLink
                          id={ad.tenant_id}
                          name={bizName(ad.tenant_id)}
                          className="text-xs"
                        />
                      ) : (
                        <AdminUserLink
                          id={ad.owner_user_id}
                          name={t("market.ad.individualAdvertiser")}
                          className="text-xs"
                        />
                      )}{" "}
                      · {ad.city ?? "—"} · {priceLabel(ad, "—")}
                    </p>
                    {ad.rejection_reason && (
                      <p className="mt-1 text-xs text-destructive">{ad.rejection_reason}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {t(`market.dash.status.${ad.status}`)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/listings/$id" params={{ id: ad.id }}>
                      {t("market.admin.fullView")}
                    </Link>
                  </Button>

                  <Button size="sm" onClick={() => setDecision({ listing: ad, action: "approve" })}>
                    {t("market.admin.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDecision({ listing: ad, action: "reject" })}
                  >
                    {t("market.admin.reject")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDecision({ listing: ad, action: "suspend" })}
                  >
                    {t("market.admin.suspend")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDecision({ listing: ad, action: "return" })}
                  >
                    {t("market.admin.returnToOwner")}
                  </Button>
                </div>
              </li>
            ))}
      </ul>
      {!listings.isLoading && (listings.data ?? []).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("market.noResults")}</p>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>
              {open ? `${bizName(open.tenant_id)} · ${open.city ?? "—"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <p className="whitespace-pre-line text-muted-foreground">{open.description ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {t("market.admin.owner")}:{" "}
                <AdminUserLink id={open.owner_user_id} name={t("admin.detail.userFile")} />
              </p>

              <div className="grid grid-cols-3 gap-2">
                {(images.data ?? []).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt={open.title}
                    className="h-24 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
              <h3 className="text-xs font-bold text-foreground">{t("market.admin.timeline")}</h3>
              <ol className="space-y-1.5">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="rounded-lg border border-border p-2 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {t(`market.dash.status.${h.to_status}`)}
                      </span>
                      <span className="text-muted-foreground" dir="ltr">
                        {new Date(h.created_at).toLocaleString("en-GB", {
                          timeZone: "Asia/Riyadh",
                          hour12: false,
                        })}
                      </span>
                    </div>
                    {h.reason && <p className="mt-1 text-muted-foreground">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
