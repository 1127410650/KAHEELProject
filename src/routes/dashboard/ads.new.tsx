import { createFileRoute } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingForm } from "@/components/marketplace/ListingForm";

export const Route = createFileRoute("/dashboard/ads/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعلان جديد — سوق تحقّق" },
      { name: "description", content: "أضف إعلان خدمة أو منتج أو معدة إلى سوق تحقّق ليُنشر بعد المراجعة." },
      { property: "og:title", content: "إعلان جديد — سوق تحقّق" },
      { property: "og:description", content: "أضف إعلانك إلى سوق الخدمات والمقاولات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { t } = useI18n();
    return (
      <DashboardShell title={t("market.addListing")}>
        <ListingForm />
      </DashboardShell>
    );
  },
});
