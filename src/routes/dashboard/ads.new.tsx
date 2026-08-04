import { createFileRoute } from "@tanstack/react-router";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";

import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingForm } from "@/components/marketplace/ListingForm";

export const Route = createFileRoute("/dashboard/ads/new")({
  ssr: false,
  // Only a canonical root-category slug travels in the URL; the form resolves
  // the real id, so a label can never be saved instead of an identifier.
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search["field"] === "string" ? search["field"].toLowerCase() : "";
    return { field: /^[a-z0-9-]{2,64}$/.test(raw) ? raw : undefined };
  },
  head: () => ({
    meta: [
      { title: "إعلان جديد — سوق تحقّق" },
      {
        name: "description",
        content: "أضف إعلان خدمة أو منتج أو معدة إلى سوق تحقّق ليُنشر بعد المراجعة.",
      },
      { property: "og:title", content: "إعلان جديد — سوق تحقّق" },
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
      <ListingForm initialFieldSlug={field ?? null} />
    </DashboardShell>
  );
}
