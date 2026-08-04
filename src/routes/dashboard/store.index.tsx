import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Store } from "lucide-react";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyStorefront } from "@/lib/mkt-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/store/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "متجري — سوق تحقّق" },
      {
        name: "description",
        content: "أدر متجرك المصغّر في سوق تحقّق: الحالة، البيانات، الأقسام والطلبات.",
      },
      { property: "og:title", content: "متجري — سوق تحقّق" },
      { property: "og:description", content: "إدارة المتجر المصغّر والطلبات." },
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
  const { account } = useActiveAccount();
  const store = useMyStorefront(account?.account_key ?? null);

  return (
    <DashboardShell title={t("market.store.hubTitle")}>
      {store.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : store.data ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <span className="font-semibold">{store.data.name_ar}</span>
              <Badge variant="secondary">{t(`market.store.status.${store.data.status}`)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(`market.store.statusHint.${store.data.status}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/dashboard/store/new">{t("market.store.continueSetup")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-5 text-sm">
            <p className="font-medium">{t("market.store.emptyTitle")}</p>
            <p className="text-muted-foreground">{t("market.store.emptyHint")}</p>
            <Button asChild>
              <Link to="/dashboard/store/new">{t("market.store.createTitle")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
