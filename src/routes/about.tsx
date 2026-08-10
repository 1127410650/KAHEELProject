import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { MarketStaticSection } from "@/components/marketplace/MarketStaticPage";
import { useI18n } from "@/i18n";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "عن المنصة — كَحيل";
const description =
  "تعرّف على «كَحيل»: سوق إلكتروني للخدمات والمقاولات والموردين والمعدات والعقارات.";

export const Route = createFileRoute("/about")({
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
      ...canonicalMeta("/about"),
    ],
    links: canonicalLinks("/about"),
  }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const { locale } = useI18n();
  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
        <header className="market-page-intro">
          <h1 className="text-page font-black tracking-tight text-foreground">
            {locale === "ar" ? "عن المنصة والسياسات" : "About & policies"}
          </h1>
          <p className="mt-1 text-desc text-muted-foreground">
            {locale === "ar"
              ? "عن كَحيل، وشروط الاستخدام، وسياسة الخصوصية في صفحة واحدة."
              : "About Kaheel, terms of use and privacy in one place."}
          </p>
        </header>
        <MarketStaticSection pageKey="about" />
        <MarketStaticSection pageKey="terms" />
        <MarketStaticSection pageKey="privacy" />
      </div>
    </MarketShell>
  );
}
