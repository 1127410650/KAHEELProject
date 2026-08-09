import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketHome } from "@/components/marketplace/MarketHome";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "گحيل — سوق العقارات والسيارات والأجهزة والخدمات";
const description =
  "گحيل: سوق إلكتروني للعقارات والسيارات والأجهزة والخدمات والمعدات والموردين. تصفّح الإعلانات وتواصل مع المعلن مباشرة.";

export const Route = createFileRoute("/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
      ...canonicalMeta("/"),
    ],
    links: canonicalLinks("/"),
  }),
  component: () => (
    <MarketShell>
      <MarketHome />
    </MarketShell>
  ),
});
