import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticPage } from "@/components/marketplace/MarketStaticPage";

const title = "سياسة الخصوصية — كَحيل";
const description = "كيف نجمع بيانات الحساب والإعلانات في «كَحيل» ونحمي بيانات التواصل الخاصة.";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: () => (
    <MarketShell>
      <MarketStaticPage pageKey="privacy" />
    </MarketShell>
  ),
});
