import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { LegalArticle, type LegalBlock } from "@/components/marketplace/guide/LegalArticle";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "سياسة الخصوصية — كَحيل";
const description =
  "كيف تجمع منصة كَحيل البيانات وتستخدمها: بيانات الحساب، بيانات الدليل، مستندات المطالبة ومدة الاحتفاظ بها، وحقوقك.";

export const Route = createFileRoute("/legal/privacy")({
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
      ...canonicalMeta("/legal/privacy"),
    ],
    links: canonicalLinks("/legal/privacy"),
  }),
  component: PrivacyPage,
});

const BLOCKS: LegalBlock[] = [
  {
    h: "البيانات التي نجمعها",
    p: [
      "بيانات الحساب: رقم الجوال أو البريد المستخدم للدخول، والاسم والمدينة إن أضفتها، وما تنشره من إعلانات ومحتوى.",
      "بيانات الدليل: معلومات الجهات مجمّعة من مصادر عامة منشورة، وليست بيانات شخصية لأفراد.",
    ],
  },
  {
    h: "أرقام التواصل",
    p: [
      "لا نعرض أرقام أفراد طبيعيين في الدليل. تُعرض فقط أرقام تواصل الجهات المنشورة رسميًا في مصادرها العامة.",
      "رقم جوالك الشخصي في حسابك لا يُعرض إلا بالإعداد الذي تختاره أنت في ملفك الشخصي.",
    ],
  },
  {
    h: "مستندات المطالبة بالصفحة",
    p: [
      "المستندات التي ترفعها لإثبات ملكية جهة (سجل تجاري، ترخيص، تفويض) تُخزَّن في حاوية خاصة غير عامة، ولا يمكن الوصول إليها برابط مباشر.",
      "لا يقرأ هذه المستندات إلا أنت وفريق مراجعة المنصة، ولمدة المراجعة فقط.",
      "تُحذف المستندات تلقائيًا بعد ٩٠ يومًا من البتّ في الطلب، ولا يبقى منها سوى قرار المراجعة وتاريخه.",
    ],
  },
  {
    h: "استخدام البيانات",
    p: [
      "نستخدم البيانات لتشغيل المنصة: عرض المحتوى، منع الإساءة والتلاعب، مراجعة المساهمات، والرد على طلبات التصحيح والإزالة.",
      "لا نبيع بياناتك ولا نشاركها لأغراض تسويقية خارج المنصة.",
    ],
  },
  {
    h: "حقوقك",
    p: [
      "يمكنك تعديل بيانات حسابك في أي وقت، وطلب تصحيح أو إزالة سجل جهة عبر صفحة «طلب تعديل أو إزالة».",
      "لأي طلب متعلق بالخصوصية: support@kaheel.sa",
    ],
  },
];

function PrivacyPage() {
  return (
    <MarketShell>
      <LegalArticle title="سياسة الخصوصية" intro={description} blocks={BLOCKS} />
    </MarketShell>
  );
}
