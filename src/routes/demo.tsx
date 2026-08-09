import { createFileRoute, redirect } from "@tanstack/react-router";

import { LiveDemoEnvironment } from "@/components/marketplace/demo/LiveDemoEnvironment";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { LIVE_DEMO_VISIBLE } from "@/lib/live-demo";

export const Route = createFileRoute("/demo")({
  ssr: false,
  beforeLoad: () => {
    if (!LIVE_DEMO_VISIBLE) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "البيئة التجريبية الحيّة — كَحيل" },
      {
        name: "description",
        content: "تجربة حيّة لأنواع حسابات كَحيل والمتاجر والخدمات والحجوزات والشحن والتكاملات.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiveDemoPage,
});

function LiveDemoPage() {
  return (
    <MarketShell>
      <LiveDemoEnvironment />
    </MarketShell>
  );
}
