import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { LISTING_COLUMNS, priceLabel, type MktListing } from "@/lib/mkt";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/my-ads")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعلاناتي — سوق تحقّق" },
      {
        name: "description",
        content: "إدارة إعلاناتك في سوق تحقّق: المسودات، قيد المراجعة، المنشورة والمرفوضة.",
      },
      { property: "og:title", content: "إعلاناتي — سوق تحقّق" },
      {
        property: "og:description",
        content: "إدارة إعلانات الخدمات والمنتجات والمعدات الخاصة بك.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyAdsPage,
});

function MyAdsPage() {
  const { t } = useI18n();
  const { session } = useSession();

  const ads = useQuery({
    queryKey: ["mkt", "my-ads", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("owner_user_id", session!.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as MktListing[];
    },
  });

  async function removeAd(id: string) {
    const { error } = await supabase
      .from("mkt_listings")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id);
    if (error) {
      toast.error(t("market.actions.failed"));
      return;
    }
    toast.success(t("market.dash.archived"));
    void ads.refetch();
  }

  return (
    <DashboardShell title={t("market.dash.myAds")}>
      <div className="mb-4">
        <Button asChild size="sm">
          <Link to="/dashboard/ads/new">{t("market.addListing")}</Link>
        </Button>
      </div>

      <ul className="space-y-3">
        {(ads.data ?? []).map((ad) => (
          <li key={ad.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {priceLabel(ad, t("market.priceOnRequest"))} · {ad.city ?? "—"} · {ad.views_count}{" "}
                  {t("market.dash.views")}
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
              {ad.status === "published" && ad.slug && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/ads/$slug" params={{ slug: ad.slug }}>
                    {t("market.dash.view")}
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboard/ads/$id/edit" params={{ id: ad.id }}>
                  {t("market.dash.edit")}
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void removeAd(ad.id)}>
                {t("market.dash.archive")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!ads.isLoading && (ads.data ?? []).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("market.dash.noAds")}</p>
      )}
    </DashboardShell>
  );
}
