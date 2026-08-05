export type SyriaDirectoryCategory =
  | "government"
  | "hospital-public"
  | "hospital-private"
  | "university-public"
  | "university-private";

export interface SyriaDirectoryEntry {
  id: string;
  name: string;
  category: SyriaDirectoryCategory;
  city: string;
  description: string;
  address: string;
  phones: string[];
  email?: string;
  website: string;
  sourceLabel: string;
  sourceUrl: string;
  verifiedAt: string;
  hoursNote: string;
  mapQuery: string;
  tags: string[];
}

/**
 * Starter directory records are intentionally small and source-backed.
 * No opening hours are guessed. Every record links to the page used for the
 * contact details and carries a verification date so stale data is visible.
 */
export const SYRIA_DIRECTORY: SyriaDirectoryEntry[] = [
  {
    id: "ministry-culture",
    name: "وزارة الثقافة السورية",
    category: "government",
    city: "دمشق",
    description: "جهة حكومية مختصة بالشؤون الثقافية والفنون والتراث.",
    address: "دمشق، المالكي، طلعة شورى",
    phones: ["+963 11 3331556", "+963 11 3331557"],
    email: "info@moc.gov.sy",
    website: "https://moc.gov.sy/",
    sourceLabel: "صفحة التواصل الرسمية لوزارة الثقافة",
    sourceUrl: "https://moc.gov.sy/contact-us",
    verifiedAt: "2026-08-06",
    hoursNote: "الدوام غير منشور في المصدر؛ اتصل قبل الذهاب.",
    mapQuery: "وزارة الثقافة السورية دمشق المالكي طلعة شورى",
    tags: ["وزارة", "ثقافة", "تراث", "فنون", "حكومة", "دائرة حكومية"],
  },
  {
    id: "syrian-development-fund",
    name: "صندوق التنمية السوري",
    category: "government",
    city: "دمشق",
    description: "مؤسسة وطنية معنية بدعم مشاريع إعادة البناء والتنمية.",
    address: "دمشق، كفرسوسة، مبنى رئاسة مجلس الوزراء",
    phones: ["+963 11 4477177", "+963 980 177177"],
    email: "contact@syrfund.gov.sy",
    website: "https://syrfund.gov.sy/",
    sourceLabel: "صفحة التواصل الرسمية لصندوق التنمية السوري",
    sourceUrl: "https://syrfund.gov.sy/ar/contact",
    verifiedAt: "2026-08-06",
    hoursNote: "الدوام غير منشور في المصدر؛ اتصل قبل الذهاب.",
    mapQuery: "صندوق التنمية السوري كفرسوسة دمشق",
    tags: ["تنمية", "تمويل", "إعمار", "حكومة", "مشاريع"],
  },
  {
    id: "smeda",
    name: "هيئة تنمية المشروعات الصغيرة والمتوسطة",
    category: "government",
    city: "دمشق",
    description: "خدمات تدريب وتمويل وحاضنات واستشارات لرواد الأعمال والمشروعات الصغيرة.",
    address: "دمشق، أوتستراد بناء الإسكان",
    phones: ["+963 60701377"],
    email: "acu-md@mail.sy",
    website: "https://smeda.gov.sy/",
    sourceLabel: "البوابة الرسمية لهيئة تنمية المشروعات الصغيرة والمتوسطة",
    sourceUrl: "https://smeda.gov.sy/",
    verifiedAt: "2026-08-06",
    hoursNote: "المصدر يذكر أن الاستفسارات تعالج خلال أيام العمل الرسمية دون ساعات محددة.",
    mapQuery: "هيئة تنمية المشروعات الصغيرة والمتوسطة دمشق أوتستراد بناء الإسكان",
    tags: ["مشاريع", "تمويل", "تدريب", "ريادة أعمال", "حاضنات", "استشارات"],
  },
  {
    id: "edpa",
    name: "هيئة دعم وتنمية الإنتاج المحلي والصادرات",
    category: "government",
    city: "دمشق",
    description: "خدمات دعم الإنتاج المحلي وتنمية الصادرات والسجل الوطني للمصدرين.",
    address: "دمشق، المهاجرين، خورشيد",
    phones: ["+963 11 3731445", "+963 11 3731513"],
    email: "info@edpa.gov.sy",
    website: "https://edpa.gov.sy/ar",
    sourceLabel: "الموقع الرسمي لهيئة دعم وتنمية الإنتاج المحلي والصادرات",
    sourceUrl: "https://edpa.gov.sy/ar",
    verifiedAt: "2026-08-06",
    hoursNote: "الدوام غير منشور في المصدر؛ اتصل قبل الذهاب.",
    mapQuery: "هيئة دعم وتنمية الإنتاج المحلي والصادرات دمشق المهاجرين خورشيد",
    tags: ["تصدير", "إنتاج محلي", "سجل مصدرين", "اقتصاد", "صناعة", "تجارة"],
  },
  {
    id: "almouwasat",
    name: "مستشفى المواساة الجامعي",
    category: "hospital-public",
    city: "دمشق",
    description: "مستشفى جامعي عام يقدم خدمات علاجية وتعليمية وتدريبية.",
    address: "دمشق، المزة، شارع عمر بن عبد العزيز",
    phones: ["+963 11 2133000", "+963 11 2133020"],
    email: "info@almouwasat.sy",
    website: "https://almouwasat.sy/",
    sourceLabel: "صفحة التواصل الرسمية لمستشفى المواساة الجامعي",
    sourceUrl: "https://almouwasat.sy/contact-us",
    verifiedAt: "2026-08-06",
    hoursNote: "ساعات العيادات غير منشورة بوضوح؛ اتصل قبل المراجعة. الإسعاف يعالج بحسب الحالة.",
    mapQuery: "مستشفى المواساة الجامعي دمشق المزة شارع عمر بن عبد العزيز",
    tags: ["مشفى", "مستشفى", "عام", "جامعي", "إسعاف", "صحة", "المزة"],
  },
  {
    id: "dar-alshifa",
    name: "مستشفى دار الشفاء",
    category: "hospital-private",
    city: "دمشق",
    description: "مستشفى خاص يضم أقسام إسعاف وعناية وجراحة ومراكز طبية متعددة.",
    address: "دمشق، العدوي، شارع خليل الزركلي",
    phones: ["+963 11 4465340"],
    email: "info@dsh.sy",
    website: "https://dsh.sy/ar",
    sourceLabel: "صفحة التواصل الرسمية لمستشفى دار الشفاء",
    sourceUrl: "https://dsh.sy/ar/contacts",
    verifiedAt: "2026-08-06",
    hoursNote: "الدوام التفصيلي غير منشور في صفحة التواصل؛ اتصل قبل الذهاب.",
    mapQuery: "مستشفى دار الشفاء دمشق العدوي شارع خليل الزركلي",
    tags: ["مشفى", "مستشفى", "خاص", "إسعاف", "جراحة", "العدوي", "صحة"],
  },
  {
    id: "damascus-university",
    name: "جامعة دمشق",
    category: "university-public",
    city: "دمشق",
    description: "جامعة حكومية عامة تضم كليات طبية وهندسية وإنسانية وبرامج تعليم مفتوح.",
    address: "دمشق، جانب وكالة سانا",
    phones: ["+963 11 33923000"],
    website: "https://damascusuniversity.edu.sy/",
    sourceLabel: "بوابة جامعتي السورية التي تربط بالموقع الرسمي للجامعة",
    sourceUrl: "https://www.uni.sy/Syria/University/damascusuniversity.edu.sy",
    verifiedAt: "2026-08-06",
    hoursNote: "أوقات الدوام تختلف حسب الكلية والمديرية؛ راجع الموقع أو اتصل قبل الزيارة.",
    mapQuery: "جامعة دمشق جانب وكالة سانا",
    tags: ["جامعة", "حكومية", "طلاب", "كليات", "تعليم", "قبول", "تسجيل"],
  },
  {
    id: "syrian-private-university",
    name: "الجامعة السورية الخاصة",
    category: "university-private",
    city: "ريف دمشق",
    description: "جامعة خاصة تضم كليات طبية وهندسية وإدارية.",
    address: "أوتستراد درعا الدولي، بعد الكسوة، خيارة دنون",
    phones: ["+963 11 9860"],
    email: "info@spu.edu.sy",
    website: "https://spu.edu.sy/",
    sourceLabel: "صفحة التواصل الرسمية للجامعة السورية الخاصة",
    sourceUrl: "https://spu.edu.sy/index.php?dir=html&ex=1&lang=1&page=contactus",
    verifiedAt: "2026-08-06",
    hoursNote: "الدوام يختلف حسب المديرية والكلية؛ اتصل قبل الذهاب.",
    mapQuery: "الجامعة السورية الخاصة خيارة دنون ريف دمشق",
    tags: ["جامعة", "خاصة", "طلاب", "قبول", "تسجيل", "طب", "هندسة"],
  },
];

const ARABIC_MARKS = /[\u064B-\u065F\u0670]/g;

export function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryBoost(query: string, entry: SyriaDirectoryEntry): number {
  const q = normalizeArabic(query);
  if (/مشفى|مستشفى|طبيب|صحه|اسعاف/.test(q) && entry.category.startsWith("hospital")) return 5;
  if (/جامعه|طالب|كليه|تسجيل|قبول/.test(q) && entry.category.startsWith("university")) return 5;
  if (/وزاره|دائره|حكوم|هيئه|معامله/.test(q) && entry.category === "government") return 5;
  return 0;
}

export function searchSyriaDirectory(query: string, limit = 8): SyriaDirectoryEntry[] {
  const q = normalizeArabic(query);
  if (!q) return SYRIA_DIRECTORY.slice(0, limit);
  const words = q.split(" ").filter((word) => word.length > 1);

  return SYRIA_DIRECTORY.map((entry) => {
    const haystack = normalizeArabic(
      [entry.name, entry.city, entry.description, entry.address, entry.hoursNote, ...entry.tags].join(" "),
    );
    let score = categoryBoost(q, entry);
    if (haystack.includes(q)) score += 12;
    for (const word of words) {
      if (normalizeArabic(entry.name).includes(word)) score += 5;
      else if (haystack.includes(word)) score += 2;
    }
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "ar"))
    .slice(0, limit)
    .map((row) => row.entry);
}

const STOP_WORDS = new Set([
  "من",
  "في",
  "على",
  "الى",
  "إلى",
  "عن",
  "هو",
  "هي",
  "هذا",
  "هذه",
  "ذلك",
  "التي",
  "الذي",
  "مع",
  "او",
  "أو",
  "ثم",
  "كما",
  "كان",
  "كانت",
  "يكون",
]);

/** Extractive browser-only summary: no network request and no paid model. */
export function summarizeLocally(text: string, maxSentences = 4): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 25);
  if (sentences.length <= maxSentences) return sentences;

  const frequency = new Map<string, number>();
  for (const word of normalizeArabic(text).split(" ")) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  return sentences
    .map((sentence, index) => {
      const words = normalizeArabic(sentence).split(" ");
      const score = words.reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) / Math.max(words.length, 1);
      return { sentence, index, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((row) => row.sentence);
}

/** Creates simple study prompts locally from the most informative sentences. */
export function createStudyQuestions(text: string, limit = 6): string[] {
  return summarizeLocally(text, limit).map((sentence, index) => {
    const clean = sentence.replace(/[.!؟\n]+$/g, "").trim();
    return `${index + 1}. اشرح الفكرة التالية بأسلوبك: ${clean}`;
  });
}
