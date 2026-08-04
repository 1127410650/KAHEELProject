import { createFileRoute, Link } from "@tanstack/react-router";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyStorefront } from "@/lib/mkt-store";
import { CatalogEditor } from "@/components/marketplace/store/CatalogEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/store/catalog")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "أقسام المتجر ومنتجاته — سوق كحلي" },
      {
        name: "description",
        content: "حرّر منيو المطعم أو منتجات المتجر: الأقسام، الأصناف، الأسعار، الصور والخيارات.",
      },
      { property: "og:title", content: "أقسام المتجر ومنتجاته — سوق كحلي" },
      { property: "og:description", content: "تحرير المنيو والمنتجات والخيارات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreCatalogPage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function StoreCatalogPage() {
  const { t } = useI18n();
  const { account } = useActiveAccount();
  const store = useMyStorefront(account?.account_key ?? null);

  return (
    <DashboardShell title={t("market.store.catalog.title")}>
      {store.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : store.data ? (
        <CatalogEditor
          storefrontId={store.data.id}
          storeType={store.data.store_type}
          currency="SAR"
        />
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-5 text-sm">
            <p className="font-medium">{t("market.store.emptyTitle")}</p>
            <Button asChild>
              <Link to="/dashboard/store/new">{t("market.store.createTitle")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
