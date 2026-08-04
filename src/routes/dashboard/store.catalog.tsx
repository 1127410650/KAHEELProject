import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
  // Currency follows the account country and is decided by the server; the
  // editor only displays it.
  const currency = useQuery({
    queryKey: ["mkt", "store-currency", store.data?.id ?? null],
    enabled: !!store.data?.id,
    staleTime: 300_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("mkt_storefronts")
        .select("currency_code")
        .eq("id", store.data!.id)
        .single();
      if (error) throw error;
      return (data as { currency_code: string }).currency_code;
    },
  });

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
          currency={currency.data ?? "SAR"}
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
