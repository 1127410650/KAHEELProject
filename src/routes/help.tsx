import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticSection } from "@/components/marketplace/MarketStaticPage";
import { useI18n } from "@/i18n";

const title = "المساعدة — گحيل";
const description = "كيف تنشر إعلانًا في «گحيل»، وكيف تتواصل مع المعلنين، ومدة الإعلان وتجديده.";

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
  component: SupportPage,
});

function SupportPage() {
  const { locale } = useI18n();
  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
        <header className="market-page-intro">
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {locale === "ar" ? "المساعدة والتواصل" : "Help & contact"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === "ar"
              ? "إجابات الاستخدام وطريقة التواصل مع إدارة گحيل في مكان واحد."
              : "Usage help and ways to contact Gohail in one place."}
          </p>
        </header>
        <MarketStaticSection pageKey="help" />
        <MarketStaticSection pageKey="contact" email="support@kaheel.sa" />
      </div>
    </MarketShell>
  );
}
