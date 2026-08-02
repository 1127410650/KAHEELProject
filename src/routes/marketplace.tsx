import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketHome } from "@/components/marketplace/MarketHome";

const title = "سوق تحقّق — خدمات ومقاولات وموردين ومعدات";
const description =
  "سوق أعمال B2B للخدمات والمقاولات ومواد البناء والمعدات: تصفّح الإعلانات واطلب عرض سعر من منشآت موثقة في السعودية.";

export const Route = createFileRoute("/marketplace")({
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
      <MarketHome />
    </MarketShell>
  ),
});
