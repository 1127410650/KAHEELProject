import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { OffersEditor } from "@/components/marketplace/store/OffersEditor";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyStorefront } from "@/lib/mkt-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/business/store/offers")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "عروض المتجر — سوق كَحيل" },
      {
        name: "description",
        content: "أنشئ عروض متجرك وخصوماته، وحدّد مدّتها والمنتجات المشمولة بها.",
      },
      { property: "og:title", content: "عروض المتجر — سوق كَحيل" },
      { property: "og:description", content: "إدارة عروض المتجر وخصوماته ومدّتها." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreOffersPage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function StoreOffersPage() {
  const { account } = useActiveAccount();
  const store = useMyStorefront(account?.account_key ?? null);

  // The currency is decided by the account country on the server; shown only.
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
    <DashboardShell title="عروض المتجر">
      <p className="text-desc text-muted-foreground">
        سند كَحيل: خصومات يراها زوّار صفحة متجرك العامة.
      </p>
      {store.isLoading ? (

        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !store.data ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm text-muted-foreground">
              لا يوجد متجر لهذا الحساب بعد. أنشئ متجرك أولًا ثم أضِف عروضك.
            </p>
            <Button asChild size="sm">
              <Link to="/business/store/new">إنشاء المتجر</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OffersEditor storefrontId={store.data.id} currency={currency.data ?? "SAR"} />
      )}
    </DashboardShell>
  );
}
