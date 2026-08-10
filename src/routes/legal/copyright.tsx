import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { useI18n } from "@/i18n";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "حقوق الأصول البصرية — كَحيل";
const description =
  "ملكية منصة كَحيل لأصولها البصرية: الشخصيات والبانرات والخلفيات الموسمية، والعلامة المائية وحقوق المستخدمين على صورهم.";

export const Route = createFileRoute("/legal/copyright")({
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
      ...canonicalMeta("/legal/copyright"),
    ],
    links: canonicalLinks("/legal/copyright"),
  }),
  component: CopyrightPage,
});

type Block = { h: string; p: string[] };

const AR: Block[] = [
  {
    h: "ملكية الأصول البصرية",
    p: [
      "جميع الأصول البصرية التي تنتجها منصة كَحيل — الشخصيات (كَحيل، كَحيلان، أصدقاء كَحيل)، الشعارات، البانرات، أصول الحملات، الخلفيات الموسمية، وصور الستوريات الرسمية — مملوكة لمنصة كَحيل، وجميع الحقوق محفوظة.",
      "يُمنع نسخها أو تعديلها أو إعادة نشرها أو استخدامها تجاريًا خارج المنصة دون إذن كتابي مسبق.",
    ],
  },
  {
    h: "العلامة المائية",
    p: [
      "كل أصل بصري تنتجه المنصة يحمل علامة مائية خفيفة في إحدى زوايا الصورة، مع بيانات حقوق داخل ملف الصورة نفسه (Copyright وAuthor وDescription).",
      "العلامة المائية دليل مصدر وليست حجبًا للمحتوى: حجمها متناسب مع أبعاد الصورة، وشفافيتها لا تشوّه موضوع الصورة، ولا تزيد حجم الملف زيادة معتبرة.",
    ],
  },
  {
    h: "صورك تبقى لك",
    p: [
      "الصور التي يرفعها المستخدمون والمتاجر ملك أصحابها، ولا تضع المنصة علامتها المائية عليها.",
      "كذلك لا تُوضع العلامة على صور أو بيانات مأخوذة من سجلات وجهات رسمية أو مصادر خارجية؛ فالعلامة المائية لا تنشئ حقًا على ما لا نملكه.",
    ],
  },
  {
    h: "الإبلاغ عن انتهاك",
    p: [
      "إذا وجدت أصلًا من أصول كَحيل مستخدمًا دون إذن، أو رأيت أن أصلًا على المنصة ينتهك حقوقك، راسلنا على support@kaheel.sa مع الرابط ووصف الحالة.",
    ],
  },
];

const EN: Block[] = [
  {
    h: "Ownership of visual assets",
    p: [
      "Every visual asset produced by the Kaheel platform — the mascots (Kaheel, Kaheelan, Kaheel's Friends), logos, banners, campaign assets, seasonal backdrops and official story images — is owned by Kaheel. All rights reserved.",
      "Copying, modifying, redistributing or commercially using these assets outside the platform requires prior written permission.",
    ],
  },
  {
    h: "Watermark",
    p: [
      "Platform-produced assets carry a light watermark in one corner of the image, plus copyright fields written inside the image file itself (Copyright, Author, Description).",
      "The watermark marks provenance rather than obscuring content: its size scales with the image, its opacity keeps the subject clear, and it does not meaningfully grow the file.",
    ],
  },
  {
    h: "Your uploads stay yours",
    p: [
      "Images uploaded by users and stores belong to their owners; Kaheel does not watermark them.",
      "We also never watermark imagery or data taken from official registries or third-party sources — a watermark does not create rights over content we do not own.",
    ],
  },
  {
    h: "Reporting misuse",
    p: [
      "If you find a Kaheel asset used without permission, or believe an asset on the platform infringes your rights, email support@kaheel.sa with the link and a short description.",
    ],
  },
];

function CopyrightPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const blocks = ar ? AR : EN;

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-[var(--page-x)] pb-10 pt-6">
        <header className="market-page-intro">
          <h1 className="text-page font-black text-foreground">
            {ar ? "حقوق الأصول البصرية" : "Visual asset copyright"}
          </h1>
          <p className="mt-1 text-desc text-muted-foreground">
            {ar
              ? "© منصة كَحيل — KAHEEL Platform · kaheel.market"
              : "© KAHEEL Platform — منصة كَحيل · kaheel.market"}
          </p>
        </header>

        <div className="mt-4 grid gap-3">
          {blocks.map((block) => (
            <section key={block.h} className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-section font-bold text-foreground">{block.h}</h2>
              {block.p.map((line) => (
                <p key={line} className="mt-2 text-desc leading-6 text-muted-foreground">
                  {line}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </MarketShell>
  );
}
