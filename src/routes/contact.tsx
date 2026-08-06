import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticPage } from "@/components/marketplace/MarketStaticPage";

const title = "التواصل مع إدارة المنصة — كَحيل";
const description = "طرق التواصل مع إدارة سوق «كَحيل» والإبلاغ عن الإعلانات المخالفة.";

export const Route = createFileRoute("/contact")({
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
      <MarketStaticPage pageKey="contact" email="support@kahli.sa" />
    </MarketShell>
  ),
});
