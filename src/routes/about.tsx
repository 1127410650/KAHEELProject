import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticPage } from "@/components/marketplace/MarketStaticPage";

const title = "عن المنصة — گحيل";
const description = "تعرّف على «گحيل»: سوق إلكتروني للخدمات والمقاولات والموردين والمعدات والعقارات.";

export const Route = createFileRoute("/about")({
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
      <MarketStaticPage pageKey="about" />
    </MarketShell>
  ),
});
