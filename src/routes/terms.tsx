import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticPage } from "@/components/marketplace/MarketStaticPage";

const title = "الشروط والأحكام — كَحيل";
const description = "شروط استخدام سوق «كَحيل» ومسؤوليات ناشري الإعلانات ومراجعة المحتوى.";

export const Route = createFileRoute("/terms")({
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
      <MarketStaticPage pageKey="terms" />
    </MarketShell>
  ),
});
