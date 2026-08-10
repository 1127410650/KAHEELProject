import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { LegalArticle, type LegalBlock } from "@/components/marketplace/guide/LegalArticle";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "شروط الاستخدام — كَحيل";
const description =
  "شروط استخدام منصة كَحيل: طبيعة الخدمة، مسؤولية المحتوى، الإدراج المجاني في الدليل، والتواصل مع الدعم.";

export const Route = createFileRoute("/legal/terms")({
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
      ...canonicalMeta("/legal/terms"),
    ],
    links: canonicalLinks("/legal/terms"),
  }),
  component: TermsPage,
});

const BLOCKS: LegalBlock[] = [
  {
    h: "طبيعة الخدمة",
    p: [
      "كَحيل منصة خدمية تتيح سوقًا عامًا للإعلانات والخدمات، ودليلًا عامًا للجهات والأماكن. استخدامك للمنصة يعني موافقتك على هذه الشروط.",
      "الوصول إلى الدليل والسوق مجاني، ولا يُشترط التسجيل للاطّلاع على المحتوى العام.",
    ],
  },
  {
    h: "الإدراج في الدليل مجاني وغير مدفوع",
    p: [
      "إدراج أي جهة في دليل كَحيل مجاني بالكامل ولا يُتقاضى عنه أي مقابل، ولا يُمكن شراء موقع أو ترتيب أو شارة تحقق.",
      "الإدراج لا يعني تمثيل الجهة ولا ارتباطًا بها ولا توصية بها، والشارات المعروضة تعبّر عن حالة السجل ومصدره لا عن تقييم للجهة.",
    ],
  },
  {
    h: "دقة المعلومات",
    p: [
      "بيانات الدليل مجمّعة من مصادر عامة منشورة، وقد تكون ناقصة أو غير محدَّثة. تُقدَّم المعلومات «كما هي» بلا ضمان لدقتها أو اكتمالها.",
      "قبل الاعتماد على أي بيان — عنوان، رقم تواصل، أوقات دوام — يُنصح بالتحقق من الجهة مباشرة.",
    ],
  },
  {
    h: "محتوى المستخدمين",
    p: [
      "أنت مسؤول عن صحة ما تنشره من إعلانات وصور وتقييمات، وعن حقك في نشره.",
      "يُمنع نشر محتوى مخالف للقانون أو مضلّل أو ماسّ بخصوصية الآخرين، وللإدارة إخفاء أي محتوى مخالف مع تسجيل السبب.",
    ],
  },
  {
    h: "التصحيح والإزالة",
    p: [
      "يمكن لأي جهة أو من يمثّلها طلب تصحيح بياناتها أو إزالتها من الدليل عبر صفحة «طلب تعديل أو إزالة».",
      "الإزالة تُنفَّذ بإخفاء السجل من العرض العام مع تسجيل السبب والتاريخ، ولا يُحذف السجل نهائيًا لأسباب تتعلق بالتتبّع والمساءلة.",
    ],
  },
  {
    h: "التواصل",
    p: ["للاستفسارات والملاحظات القانونية: support@kaheel.sa"],
  },
];

function TermsPage() {
  return (
    <MarketShell>
      <LegalArticle title="شروط الاستخدام" intro={description} blocks={BLOCKS} />
    </MarketShell>
  );
}
