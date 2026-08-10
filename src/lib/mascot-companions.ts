/**
 * «رفاق كَحيل» — مشاهد مشتركة توجّه الزائر إلى قسم محدد.
 *
 * كل مشهد يجمع شخصية رئيسية (كَحيل أو الزعيم كَحيلان) + رفيقًا صغيرًا من
 * شخصيات قسم الأطفال المعتمدة (`src/lib/kids-friend-assets.ts`) — الرئيسية
 * أكبر والرفيق أصغر بجانبها، وفقاعة نصية **واحدة مشتركة** فوقهما.
 *
 * قواعد ثابتة:
 *  • النصوص بلهجة شامية أصيلة، سطران: نكتة قصيرة + دعوة للقسم.
 *  • الضغط على المشهد أو النص يفتح القسم المذكور مباشرة (وجهة واحدة لكل مشهد).
 *  • لا شخصية جديدة ولا رسم جديد: كل الأصول من السجلات المعتمدة.
 */
import type { KidsFriendId } from "@/lib/kids-friends";
import type { MascotName } from "@/lib/mascot-assets";

export interface CompanionScene {
  /** معرّف المشهد — يُستخدم كنوع في مسرح الشخصيات فلا يتكرر مرتين متتاليتين. */
  id: string;
  /** القسم الهدف (مسار داخلي حقيقي فقط). */
  to: string;
  main: MascotName;
  /** الرفيق الصغير بجانب الشخصية الرئيسية. */
  friend: KidsFriendId;
  /** السطر الأول (النكتة القصيرة). */
  hook: { ar: string; en: string };
  /** السطر الثاني (الدعوة إلى القسم). */
  line: { ar: string; en: string };
}

export const COMPANION_SCENES: CompanionScene[] = [
  // ── قسم الأطفال ──────────────────────────────────────────────────────────
  {
    id: "kids:nono",
    to: "/kids",
    main: "kaheel",
    friend: "nono",
    hook: { ar: "شفت رفيقتي نونو؟ 🐱", en: "Met my friend Nono? 🐱" },
    line: {
      ar: "عندها أحلى أغراض للصغار… خد جولة بقسم الأطفال",
      en: "She has the cutest kids' picks — take a tour of the kids section",
    },
  },
  {
    id: "kids:dabdoob",
    to: "/kids",
    main: "kaheel",
    friend: "dabdoob",
    hook: { ar: "دبدوب مستنّيك بقسم الأطفال 🧸", en: "Dabdoob is waiting in the kids section 🧸" },
    line: { ar: "تعا شوف شو جمّعلك", en: "Come see what he gathered for you" },
  },
  {
    id: "kids:birdy",
    to: "/kids",
    main: "kaheelan",
    friend: "birdy",
    hook: { ar: "هالعصفور ما بيسكت عن قسم الأطفال 🐦", en: "This birdy won't stop chirping about kids 🐦" },
    line: { ar: "روح شوف، بواسطتي طبعًا", en: "Go take a look — through me, of course" },
  },
  // ── العقارات ─────────────────────────────────────────────────────────────
  {
    id: "realestate:kaheelan",
    to: "/categories/real-estate",
    main: "kaheelan",
    friend: "natnoot",
    hook: { ar: "بدّك بيت؟ 🏠", en: "Looking for a home? 🏠" },
    line: {
      ar: "عندي عقارات بتجنن… والسمسرة عليّ، بواسطتي",
      en: "I've got stunning properties — brokerage on me",
    },
  },
  {
    id: "realestate:kaheel",
    to: "/categories/real-estate",
    main: "kaheel",
    friend: "najooma",
    hook: { ar: "شقق وفلل من ملّاك موثوقين 🏡", en: "Flats and villas from trusted owners 🏡" },
    line: { ar: "فوت على قسم العقارات", en: "Step into the real-estate section" },
  },
  // ── السيارات ─────────────────────────────────────────────────────────────
  {
    id: "cars:kaheelan",
    to: "/categories/cars",
    main: "kaheelan",
    friend: "sami",
    hook: { ar: "لك وين ماشي على رجليك؟ 🚗", en: "Why are you still walking? 🚗" },
    line: { ar: "تعا شوف السيارات… بسعر بواسطتي", en: "Come see the cars — at my special price" },
  },
  // ── المطاعم ──────────────────────────────────────────────────────────────
  {
    id: "restaurants:kaheelan",
    to: "/categories/restaurants",
    main: "kaheelan",
    friend: "dabdoob",
    hook: { ar: "جعت وأنت عم تتصفح؟ 😋", en: "Hungry while browsing? 😋" },
    line: { ar: "المطاعم كلها هون", en: "All the restaurants are right here" },
  },
  // ── المقاضي (جيب لي) ─────────────────────────────────────────────────────
  {
    id: "grocery:kaheel",
    to: "/errands",
    main: "kaheel",
    friend: "karim",
    hook: { ar: "مقاضي البيت وصلت لعندك 🛒", en: "Your home groceries, delivered 🛒" },
    line: { ar: "اطلب «جيب لي» ونحنا نجيبها", en: "Order “Jeeb Li” and we'll bring it" },
  },
  // ── الخدمات والوظائف ─────────────────────────────────────────────────────
  {
    id: "services:kaheelan",
    to: "/categories/services",
    main: "kaheelan",
    friend: "natnoot",
    hook: { ar: "بدّك معلّم شاطر؟ 🔧", en: "Need a skilled pro? 🔧" },
    line: { ar: "كل المعلّمين بقسم الخدمات", en: "Every pro is in the services section" },
  },
  {
    id: "jobs:kaheelan",
    to: "/categories/jobs",
    main: "kaheelan",
    friend: "birdy",
    hook: { ar: "عم تدوّر على شغل؟ 💼", en: "Job hunting? 💼" },
    line: { ar: "الوظائف هون، وبواسطتي أحسن", en: "Jobs are here — better through me" },
  },
];

/** اختيار مشهد عشوائي مختلف عن آخر مشهد ظهر. */
export function pickCompanionScene(lastId: string | null): CompanionScene {
  const pool = lastId
    ? COMPANION_SCENES.filter((scene) => scene.id !== lastId)
    : COMPANION_SCENES;
  const list = pool.length > 0 ? pool : COMPANION_SCENES;
  return list[Math.floor(Math.random() * list.length)]!;
}
