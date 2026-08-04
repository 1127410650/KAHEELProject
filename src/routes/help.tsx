import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticPage } from "@/components/marketplace/MarketStaticPage";

const title = "المساعدة — كحلي";
const description = "كيف تنشر إعلانًا في «كحلي»، وكيف تتواصل مع المعلنين، ومدة الإعلان وتجديده.";

export const Route = createFileRoute("/help")({
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
      <MarketStaticPage pageKey="help" />
    </MarketShell>
  ),
});
