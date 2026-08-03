import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  LISTING_STATUSES,
  SA_CITIES,
  priceLabel,
  resolveMedia,
  type MktBusiness,
  type MktListing,
} from "@/lib/mkt";
import { loadCategories } from "@/lib/mkt-queries";
import { reviewListing, type ListingReviewAction } from "@/lib/mkt-admin";
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

interface Decision {
  listing: MktListing;
  action: ListingReviewAction;
}

function AdminListingsPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState("pending");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<MktListing | null>(null);
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
        .select(LISTING_COLUMNS)
        .order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      if (city) query = query.eq("city", city);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data } = await query.limit(100);
      return (data ?? []) as unknown as MktListing[];
    },
  });

  const images = useQuery({
    queryKey: ["mkt", "admin-listing-images", open?.id],
    enabled: !!open,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listing_images")
        .select("id, url, sort_order")
        .eq("listing_id", open!.id)
        .order("sort_order");
      const paths = (data ?? []).map((r) => r.url);
      const media = await resolveMedia(paths);
      return paths.map((p) => media[p]).filter((u): u is string => !!u);
    },
  });

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

      <ul className="mt-5 space-y-3">
        {listings.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : (listings.data ?? []).map((ad) => (
              <li key={ad.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {bizName(ad.tenant_id)} · {ad.city ?? "—"} ·{" "}
                      {priceLabel(ad, t("market.priceOnRequest"))}
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
                    <Link to={`/admin/listings/${ad.id}`}>{t("market.admin.fullView")}</Link>
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
              <p className="text-xs text-muted-foreground" dir="ltr">
                owner: {open.owner_user_id}
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
