import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketHome } from "@/components/marketplace/MarketHome";

const title = "كَحيل — سوق العقارات والسيارات والأجهزة والخدمات";
const description =
  "كَحيل: سوق إلكتروني للعقارات والسيارات والأجهزة والخدمات والمعدات والموردين. تصفّح الإعلانات وتواصل مع المعلن مباشرة.";

export const Route = createFileRoute("/")({
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
