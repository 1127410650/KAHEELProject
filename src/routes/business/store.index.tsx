import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  Megaphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { FormRouteError, FormRoutePending } from "@/components/marketplace/FormRouteFallback";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyStorefront } from "@/lib/mkt-store";
import {
  catalogErrorKey,
  setListingStore,
  useLinkableListings,
  useStoreOverview,
} from "@/lib/mkt-store-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/business/store/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "متجري — سوق گحيل" },
      {
        name: "description",
        content: "أدر متجرك المصغّر في السوق: الحالة، الأقسام والمنتجات، والإعلانات المرتبطة.",
      },
      { property: "og:title", content: "متجري — سوق گحيل" },
      { property: "og:description", content: "إدارة المتجر المصغّر وأقسامه ومنتجاته." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHubPage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function StoreHubPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const store = useMyStorefront(accountKey);
  const overview = useStoreOverview(accountKey);
  const [busy, setBusy] = useState(false);

  const data = overview.data;

  async function toggleOpen(next: boolean) {
    if (!data) return;
    setBusy(true);
    const { error } = await supabase
      .from("mkt_storefronts")
      .update({ is_open_manually: next })
      .eq("id", data.storefront_id);
    setBusy(false);
    if (error) {
      toast.error(t(catalogErrorKey(error)));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["mkt", "store-overview", accountKey] });
  }

  if (store.isLoading || overview.isLoading) {
    return (
      <DashboardShell title={t("market.store.hubTitle")}>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (!store.data || !data) {
    return (
      <DashboardShell title={t("market.store.hubTitle")}>
        <Card>
          <CardContent className="space-y-3 pt-5 text-sm">
            <p className="font-medium">{t("market.store.emptyTitle")}</p>
            <p className="text-muted-foreground">{t("market.store.emptyHint")}</p>
            <Button asChild>
              <Link to="/business/store/new">{t("market.store.createTitle")}</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const stats = [
    { label: t("market.store.hub.sections"), value: data.sections_count },
    { label: t("market.store.hub.itemsPublished"), value: data.items_published },
    { label: t("market.store.hub.itemsHidden"), value: data.items_hidden },
    { label: t("market.store.hub.linkedAds"), value: data.linked_listings },
  ];
  const serviceStore = data.store_type === "services" || data.store_type === "mixed";

  return (
    <DashboardShell title={t("market.store.hubTitle")}>
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <span className="font-semibold">{data.name_ar}</span>
              <Badge variant="secondary">{t(`market.store.status.${data.status}`)}</Badge>
              <Badge variant="outline">{t(`market.store.type.${data.store_type}`)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(`market.store.statusHint.${data.status}`)}
            </p>

            {data.status === "published" ? (
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span>{t("market.store.hub.openNow")}</span>
                <Switch
                  checked={data.is_open_manually}
                  disabled={busy}
                  onCheckedChange={(v) => void toggleOpen(v)}
                />
              </label>
            ) : null}

            {!data.complete ? (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <p className="font-medium">{t("market.store.hub.missingTitle")}</p>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted-foreground">
                  {data.missing.map((key) => (
                    <li key={key}>{t(`market.store.hub.missing.${key}`)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/business/store/catalog">
                  <UtensilsCrossed className="me-1 h-4 w-4" />
                  {data.store_type === "restaurant"
                    ? t("market.store.hub.manageMenu")
                    : serviceStore
                      ? t("market.services.manageServices")
                      : t("market.store.hub.manageProducts")}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/business/store/new">{t("market.store.hub.editData")}</Link>
              </Button>
              {data.status === "published" ? (
                <Button variant="outline" asChild>
                  <Link to="/stores/$slug" params={{ slug: data.slug }}>
                    <ExternalLink className="me-1 h-4 w-4" />
                    {t("market.store.hub.viewPublic")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {serviceStore ? (
          <Card className="overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-market-navy to-cyan-950 text-white shadow-xl">
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
                <CalendarClock className="size-6 text-cyan-200" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black">{t("market.services.providerCenter")}</p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  {t("market.services.providerCenterHint")}
                </p>
              </div>
              <Button variant="secondary" asChild>
                <Link to="/business/services">{t("market.services.openProviderCenter")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <LinkedAdsCard accountKey={accountKey} storefrontId={data.storefront_id} />
      </div>
    </DashboardShell>
  );
}

/** Ads of the same account only; the database refuses any other store. */
function LinkedAdsCard({
  accountKey,
  storefrontId,
}: {
  accountKey: string | null;
  storefrontId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const listings = useLinkableListings(accountKey);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(listingId: string, linked: boolean) {
    setBusyId(listingId);
    try {
      await setListingStore(listingId, linked ? null : storefrontId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mkt", "store-linkable-ads", accountKey] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "store-overview", accountKey] }),
      ]);
    } catch (error) {
      toast.error(t(catalogErrorKey(error)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <span className="font-semibold">{t("market.store.hub.adsTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("market.store.hub.adsHint")}</p>

        {listings.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (listings.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("market.store.hub.adsEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {(listings.data ?? []).map((listing) => {
              const linked = listing.storefront_id === storefrontId;
              return (
                <div
                  key={listing.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{listing.title}</span>
                  <Badge variant="outline">
                    {t(`market.store.hub.adStatus.${listing.status}`)}
                  </Badge>
                  <Button
                    size="sm"
                    variant={linked ? "outline" : "default"}
                    disabled={busyId === listing.id}
                    onClick={() => void toggle(listing.id, linked)}
                  >
                    {busyId === listing.id ? (
                      <Loader2 className="me-1 h-4 w-4 animate-spin" />
                    ) : null}
                    {linked ? t("market.store.hub.unlink") : t("market.store.hub.link")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
