/**
 * قنوات الأكواد — قائمة داخلية مصنّفة حسب نوع/لغة البرمجة.
 *
 * هذه **طبقة تنظيم فوق** شجرة الكود المصدري الكاملة، لا بديلًا عنها ولا تقليصًا
 * لنطاقها: كل قناة تفتح نفس المحرر، وتخضع لنفس فحوص الخادم (owner-only،
 * حصر المسارات، الامتدادات المسموحة، اللقطة الإلزامية قبل كل حفظ، ومسار
 * الاسترجاع). الشجرة الكاملة تبقى متاحة كما هي في بطاقة مستقلة.
 *
 * `kind` هنا يجب أن يطابق مفتاحًا في `CODE_KINDS` داخل `code-editor.server.ts`
 * (قائمة مغلقة على الخادم) — فلا يمكن للواجهة اختراع نوع جديد.
 */

export type CodeChannelIcon =
  | "css"
  | "js"
  | "ts"
  | "component"
  | "theme"
  | "json"
  | "markdown"
  | "html"
  | "sql";

export interface CodeShortcut {
  path: string;
  label: string;
}

export interface CodeChannel {
  /** مفتاح النوع على الخادم (`CODE_KINDS`). */
  kind: string;
  /** معرّف القناة — قناتان قد تشتركان في نفس النوع باختصارات مختلفة. */
  id: string;
  label: string;
  description: string;
  icon: CodeChannelIcon;
  /** ملفات شائعة تُفتح بضغطة واحدة (كلها موجودة فعلًا في بنية المشروع). */
  shortcuts: CodeShortcut[];
}

export const CODE_CHANNELS: CodeChannel[] = [
  {
    kind: "css",
    id: "css",
    label: "تخصيص باستخدام CSS",
    description: "الأنماط العامة ومتغيّرات التصميم (الألوان، المسافات، الزوايا).",
    icon: "css",
    shortcuts: [{ path: "src/styles.css", label: "الأنماط العامة ومتغيّرات الثيم" }],
  },
  {
    kind: "ts",
    id: "ts",
    label: "تخصيص باستخدام JavaScript",
    description: "منطق الواجهة والمكتبات المساعدة (TypeScript/JavaScript).",
    icon: "ts",
    shortcuts: [
      { path: "src/lib/format.ts", label: "تنسيق الأرقام والتواريخ والعملة" },
      { path: "src/lib/track.ts", label: "تتبّع الأحداث والتحليلات" },
    ],
  },
  {
    kind: "js",
    id: "js",
    label: "ملفات JavaScript خام",
    description: "ملفات ‎.js / .jsx / .mjs‎ (إعدادات أدوات البناء والسكربتات).",
    icon: "js",
  shortcuts: [],
  },
  {
    kind: "tsx",
    id: "theme",
    label: "قالب وأجزاء تصميم الثيم",
    description: "المكوّنات التي ترسم هيكل الموقع: الجذر، الطبقات، الهيدر، الصفحة الرئيسية.",
    icon: "theme",
    shortcuts: [
      { path: "src/routes/__root.tsx", label: "قالب الجذر (الهيكل العام)" },
      { path: "src/components/marketplace/ThemeVarsLayer.tsx", label: "طبقة متغيّرات الثيم" },
      { path: "src/components/marketplace/BackdropLayer.tsx", label: "طبقة الخلفية" },
      {
        path: "src/components/marketplace/home/noon/CollapsingHomeHeader.tsx",
        label: "هيدر الصفحة الرئيسية",
      },
      { path: "src/routes/index.tsx", label: "الصفحة الرئيسية" },
    ],
  },
  {
    kind: "tsx",
    id: "tsx",
    label: "مكوّنات وصفحات React",
    description: "كل ملفات ‎.tsx‎: الصفحات والمكوّنات ولوحات الإدارة.",
    icon: "component",
    shortcuts: [],
  },
  {
    kind: "json",
    id: "json",
    label: "إعدادات JSON",
    description: "ملفات الإعداد والحزم (بلا أي ملف أسرار — محجوب على الخادم).",
    icon: "json",
    shortcuts: [
      { path: "components.json", label: "إعداد مكتبة المكوّنات" },
      { path: "vercel.json", label: "إعداد الاستضافة" },
    ],
  },
  {
    kind: "html",
    id: "html",
    label: "قوالب HTML",
    description: "ملفات ‎.html‎ إن وُجدت في بنية المشروع.",
    icon: "html",
    shortcuts: [],
  },
  {
    kind: "sql",
    id: "sql",
    label: "ملفات SQL",
    description: "استعلامات وسكربتات SQL — هجرات قاعدة الإنتاج محجوبة تمامًا.",
    icon: "sql",
    shortcuts: [],
  },
  {
    kind: "md",
    id: "md",
    label: "نصوص وتوثيق",
    description: "ملفات ‎.md / .txt‎: التوثيق والتقارير وملاحظات المشروع.",
    icon: "markdown",
    shortcuts: [{ path: "README.md", label: "تعريف المشروع" }],
  },
];

export function channelById(id: string): CodeChannel | undefined {
  return CODE_CHANNELS.find((channel) => channel.id === id);
}
