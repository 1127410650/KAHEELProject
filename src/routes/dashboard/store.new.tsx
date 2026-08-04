import { createFileRoute } from "@tanstack/react-router";

import {
  FormRouteError,
  FormRoutePending,
} from "@/components/marketplace/FormRouteFallback";
import { useI18n } from "@/i18n";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { StoreWizard } from "@/components/marketplace/store/StoreWizard";

export const Route = createFileRoute("/dashboard/store/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "متجر جديد — سوق تحقّق" },
      {
        name: "description",
        content: "أنشئ متجرك أو مطعمك المصغّر داخل سوق تحقّق واستقبل الطلبات بعد المراجعة.",
      },
      { property: "og:title", content: "متجر جديد — سوق تحقّق" },
      { property: "og:description", content: "أنشئ متجرًا مصغّرًا أو مطعمًا واستقبل الطلبات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewStorePage,
  pendingComponent: FormRoutePending,
  errorComponent: FormRouteError,
  pendingMs: 100,
  pendingMinMs: 200,
});

function NewStorePage() {
  const { t } = useI18n();
  return (
    <DashboardShell title={t("market.store.createTitle")}>
      <StoreWizard />
    </DashboardShell>
  );
}
