import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { LISTING_COLUMNS, type MktListing } from "@/lib/mkt";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingForm } from "@/components/marketplace/ListingForm";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/ads/$id/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تعديل الإعلان — سوق تحقّق" },
      { name: "description", content: "عدّل بيانات إعلانك وصوره وسعره ثم أعد إرساله للمراجعة." },
      { property: "og:title", content: "تعديل الإعلان — سوق تحقّق" },
      { property: "og:description", content: "تحديث تفاصيل الإعلان في سوق تحقّق." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditAdPage,
});

function EditAdPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const ad = useQuery({
    queryKey: ["mkt", "my-ad", id],
    queryFn: async () => {
      const { data } = await supabase.from("mkt_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
      return (data as unknown as MktListing | null) ?? null;
    },
  });

  return (
    <DashboardShell title={t("market.dash.edit")}>
      {ad.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : ad.data ? (
        <ListingForm listing={ad.data} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("market.ad.notFound")}</p>
      )}
    </DashboardShell>
  );
}
