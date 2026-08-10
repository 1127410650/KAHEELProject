import { createFileRoute } from "@tanstack/react-router";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { LegalArticle, type LegalBlock } from "@/components/marketplace/guide/LegalArticle";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

const title = "سياسة الدليل — كَحيل";
const description =
  "مصادر بيانات دليل كَحيل، مجانية الإدراج، إخلاء المسؤولية عن الدقة، آلية التصحيح والإزالة، وشروط المطالبة بالصفحة ومدة الاحتفاظ بالمستندات.";

export const Route = createFileRoute("/legal/directory-policy")({
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
      ...canonicalMeta("/legal/directory-policy"),
    ],
    links: canonicalLinks("/legal/directory-policy"),
  }),
  component: DirectoryPolicyPage,
});

const BLOCKS: LegalBlock[] = [
  {
    h: "مصادر البيانات",
    p: [
      "بيانات الدليل مجمّعة من مصادر عامة منشورة: سجلات رسمية للجهات المعنية، وصفحات ومواقع الجهات نفسها، وبيانات خرائط مفتوحة من OpenStreetMap.",
      "بيانات الخرائط: © مساهمو OpenStreetMap، متاحة بموجب ترخيص ODbL. يظهر هذا النسب في كل صفحة تعرض إحداثيات أو خرائط.",
      "يُعرض مصدر كل سجل وتاريخه — عند توفّره — أسفل صفحة الجهة، ليتمكّن أي زائر من الرجوع إليه.",
    ],
  },
  {
    h: "الإدراج مجاني وغير مدفوع",
    p: [
      "الإدراج في الدليل مجاني تمامًا. لا نتقاضى مقابلًا للإدراج ولا للترتيب ولا لشارة التحقق، ولا يمكن شراء أي منها.",
      "كَحيل لا يمثّل الجهات المدرجة ولا يرتبط بها، والإدراج ليس توصية.",
    ],
  },
  {
    h: "إخلاء المسؤولية عن الدقة",
    p: [
      "المعلومات قد تكون ناقصة أو غير محدَّثة، وتُقدَّم «كما هي» بلا ضمان. المسؤولية عن التحقق النهائي تقع على المستخدم.",
      "لا نعرض أرقام أفراد طبيعيين؛ تُنشر فقط أرقام تواصل الجهات المستمدة من مصدر عام منشور، ويُحجب أي رقم لا يستوفي هذا الشرط.",
    ],
  },
  {
    h: "آلية التصحيح والإزالة",
    p: [
      "أي جهة أو من يمثّلها يمكنه تقديم طلب تصحيح أو إزالة عبر صفحة «طلب تعديل أو إزالة» بلا حساب.",
      "يمرّ الطلب بالحالات: جديد، ثم قيد المراجعة، ثم منفّذ أو مرفوض، مع تسجيل من بتّ فيه ومتى.",
      "الإزالة تُنفَّذ كإخفاء من العرض العام مع تسجيل السبب والتاريخ (إزالة ناعمة)، بلا حذف نهائي للسجل.",
    ],
  },
  {
    h: "المطالبة بالصفحة",
    p: [
      "المطالبة تتطلّب: اسم مقدّم الطلب، صفته (مالك أو مفوّض)، جوالًا موثّقًا برمز تحقق، ومستندًا واحدًا على الأقل — سجل تجاري أو ترخيص أو تفويض رسمي.",
      "كل مطالبة تبدأ بحالة «قيد المراجعة»، والموافقة يدوية دائمًا من فريق المنصة مع تسجيل من وافق ومتى. لا توجد أي موافقة آلية.",
    ],
  },
  {
    h: "مدة الاحتفاظ بالمستندات",
    p: [
      "المستندات تُخزَّن في حاوية خاصة غير عامة، ويُرفض أي رابط مباشر لغير المصرّح لهم.",
      "تُحذف المستندات تلقائيًا بعد ٩٠ يومًا من البتّ في الطلب، ويبقى قرار المراجعة وتاريخه للسجل فقط.",
    ],
  },
];

function DirectoryPolicyPage() {
  return (
    <MarketShell>
      <LegalArticle title="سياسة الدليل" intro={description} blocks={BLOCKS} />
    </MarketShell>
  );
}
