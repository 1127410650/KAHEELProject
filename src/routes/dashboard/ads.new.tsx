import { createFileRoute } from "@tanstack/react-router";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";

import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingForm } from "@/components/marketplace/ListingForm";
import { SmartListingPriceController } from "@/components/marketplace/SmartListingPriceController";

export const Route = createFileRoute("/dashboard/ads/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search["field"] === "string" ? search["field"].toLowerCase() : "";
    return { field: /^[a-z0-9-]{2,64}$/.test(raw) ? raw : undefined };
  },
  head: () => ({
    meta: [
      { title: "إعلان جديد — گحيل" },
      {
        name: "description",
        content: "أضف إعلان خدمة أو منتج أو معدة إلى گحيل ليُنشر بعد المراجعة.",
      },
      { property: "og:title", content: "إعلان جديد — گحيل" },
      { property: "og:description", content: "أضف إعلانك إلى سوق الخدمات والمقاولات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewAdPage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function NewAdPage() {
  const { t } = useI18n();
  const { field } = Route.useSearch();
  return (
    <DashboardShell title={t("market.addListing")}>
      <style>{`
        /* The listing always uses the active personal account. Do not ask the
           advertiser to switch identities inside the form. */
        .listing-new-flow > div > p:first-of-type { display: none !important; }
      `}</style>
      <div className="listing-new-flow">
        <SmartListingPriceController />
        <ListingForm initialFieldSlug={field ?? null} />
      </div>
    </DashboardShell>
  );
}
