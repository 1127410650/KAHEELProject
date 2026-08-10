import { SYRIA_DIRECTORY, normalizeArabic } from "@/lib/syria-directory";

export type SyriaGuideCategory =
  | "government"
  | "hospital"
  | "university"
  | "heritage"
  | "tourism";

export interface SyriaGuideSection {
  title: string;
  content: string;
}

export interface SyriaGuideEntity {
  id: string;
  name: string;
  category: SyriaGuideCategory;
  city: string;
  shortDescription: string;
  image: string;
  imageAlt: string;
  address?: string;
  phones?: string[];
  website?: string;
  sourceLabel: string;
  sourceUrl: string;
  verifiedAt: string;
  mapQuery: string;
  tags: string[];
  sections: SyriaGuideSection[];
}

const IMAGE_BY_CATEGORY: Record<Exclude<SyriaGuideCategory, "heritage" | "tourism">, string> = {
  government:
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1400&q=82",
  hospital:
    "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=1400&q=82",
  university:
    "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1400&q=82",
};

const directoryEntities: SyriaGuideEntity[] = SYRIA_DIRECTORY.map((entry) => {
  const category: SyriaGuideCategory = entry.category.startsWith("hospital")
    ? "hospital"
    : entry.category.startsWith("university")
      ? "university"
      : "government";

  return {
    id: entry.id,
    name: entry.name,
    category,
    city: entry.city,
    shortDescription: entry.description,
    image: IMAGE_BY_CATEGORY[category],
    imageAlt: `صورة تعريفية لفئة ${category === "government" ? "الجهات الحكومية" : category === "hospital" ? "المشافي" : "الجامعات"}`,
    address: entry.address,
    phones: entry.phones,
    website: entry.website,
    sourceLabel: entry.sourceLabel,
    sourceUrl: entry.sourceUrl,
    verifiedAt: entry.verifiedAt,
    mapQuery: entry.mapQuery,
    tags: entry.tags,
    sections: [
      { title: "نبذة", content: entry.description },
      { title: "العنوان والوصول", content: entry.address },
      { title: "الدوام والمراجعة", content: entry.hoursNote },
      {
        title: "التواصل",
        content: entry.phones.length > 0 ? entry.phones.join(" · ") : "لا يوجد رقم منشور في المصدر الحالي.",
      },
    ],
  };
});

const heritageEntities: SyriaGuideEntity[] = [
  {
    id: "ancient-damascus",
    name: "دمشق القديمة والجامع الأموي",
    category: "heritage",
    city: "دمشق",
    shortDescription:
      "نسيج تاريخي متكامل يضم أسواقًا وبيوتًا ومعالم من عصور متعددة، ويبرز فيه الجامع الأموي.",
    image:
      "https://images.unsplash.com/photo-1548018560-c7196548f1d4?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لمدينة تاريخية ومسجد أثري",
    sourceLabel: "مركز التراث العالمي — مدينة دمشق القديمة",
    sourceUrl: "https://whc.unesco.org/en/list/20/",
    verifiedAt: "2026-08-06",
    mapQuery: "الجامع الأموي دمشق القديمة سوريا",
    tags: ["دمشق", "الجامع الأموي", "سوق الحميدية", "تراث", "آثار", "سياحة"],
    sections: [
      {
        title: "لماذا تستحق الزيارة؟",
        content:
          "تجمع دمشق القديمة طبقات تاريخية متعاقبة ومعالم دينية ومدنية وأسواقًا تقليدية ضمن نسيج عمراني واحد.",
      },
      {
        title: "أبرز المعالم",
        content: "الجامع الأموي، سوق الحميدية، قصر العظم، البيوت الدمشقية، الكنائس والأسواق التاريخية.",
      },
      {
        title: "نصيحة الزيارة",
        content: "خطط لمسار مشي، واحترم خصوصية الأحياء ودور العبادة، وتحقق محليًا من أوقات فتح المواقع.",
      },
    ],
  },
  {
    id: "aleppo-citadel",
    name: "قلعة حلب والمدينة القديمة",
    category: "heritage",
    city: "حلب",
    shortDescription:
      "واحدة من أبرز القلاع التاريخية في المنطقة، تتوسط مدينة حلب القديمة وأسواقها ومعالمها.",
    image:
      "https://images.unsplash.com/photo-1549492423-400259a2e574?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لقلعة حجرية تاريخية",
    sourceLabel: "مركز التراث العالمي — مدينة حلب القديمة",
    sourceUrl: "https://whc.unesco.org/en/list/21/",
    verifiedAt: "2026-08-06",
    mapQuery: "قلعة حلب سوريا",
    tags: ["حلب", "قلعة", "مدينة قديمة", "تراث", "أسواق", "آثار"],
    sections: [
      {
        title: "نبذة تاريخية",
        content:
          "تقع القلعة في قلب حلب القديمة التي شكّلت نقطة عبور لطرق تجارية وحضارات متعاقبة عبر قرون طويلة.",
      },
      { title: "ما حول القلعة", content: "الأسواق القديمة، الخانات، الحمامات، الجوامع والمدارس التاريخية." },
      {
        title: "قبل الذهاب",
        content: "تحقق من حالة الوصول وساعات الزيارة والتعليمات المحلية قبل الانطلاق.",
      },
    ],
  },
  {
    id: "palmyra",
    name: "تدمر",
    category: "heritage",
    city: "حمص",
    shortDescription:
      "واحة أثرية في البادية السورية كانت مركزًا حضاريًا وتجاريًا مهمًا عند تقاطع طرق وثقافات متعددة.",
    image:
      "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لأعمدة وموقع أثري صحراوي",
    sourceLabel: "مركز التراث العالمي — موقع تدمر",
    sourceUrl: "https://whc.unesco.org/en/list/23/",
    verifiedAt: "2026-08-06",
    mapQuery: "آثار تدمر حمص سوريا",
    tags: ["تدمر", "حمص", "بادية", "أعمدة", "آثار", "تراث عالمي"],
    sections: [
      {
        title: "قيمة الموقع",
        content:
          "تعكس عمارة تدمر تفاعل تقاليد محلية مع مؤثرات يونانية ورومانية وفارسية ضمن مركز قوافل تاريخي.",
      },
      {
        title: "ملاحظات السلامة",
        content: "لا تزُر الموقع دون التحقق من الإرشادات الرسمية والمحلية الحالية وحالة الطرق والوصول.",
      },
    ],
  },
  {
    id: "krak-des-chevaliers",
    name: "قلعة الحصن",
    category: "heritage",
    city: "حمص",
    shortDescription: "قلعة تاريخية بارزة بتكوين دفاعي حجري وموقع مرتفع وإطلالات واسعة.",
    image:
      "https://images.unsplash.com/photo-1520637836862-4d197d17c38a?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لقلعة تاريخية على مرتفع",
    sourceLabel: "مركز التراث العالمي — قلعة الحصن وقلعة صلاح الدين",
    sourceUrl: "https://whc.unesco.org/en/list/1229/",
    verifiedAt: "2026-08-06",
    mapQuery: "قلعة الحصن حمص سوريا",
    tags: ["قلعة الحصن", "حمص", "قلعة", "سياحة", "تراث عالمي"],
    sections: [
      { title: "تجربة المكان", content: "ممرات حجرية، أبراج وساحات داخلية مع إطلالات على المناطق المحيطة." },
      { title: "الزيارة", content: "ارتدِ حذاء مناسبًا للمشي وتحقق من ساعات الدخول وحالة الطريق قبل التوجه." },
    ],
  },
  {
    id: "bosra",
    name: "بصرى القديمة",
    category: "heritage",
    city: "درعا",
    shortDescription: "مدينة تاريخية تشتهر بمسرحها البازلتي ونسيجها العمراني وآثارها المتنوعة.",
    image:
      "https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لمسرح وموقع أثري حجري",
    sourceLabel: "مركز التراث العالمي — مدينة بصرى القديمة",
    sourceUrl: "https://whc.unesco.org/en/list/22/",
    verifiedAt: "2026-08-06",
    mapQuery: "مسرح بصرى درعا سوريا",
    tags: ["بصرى", "درعا", "مسرح", "بازلت", "آثار", "تراث عالمي"],
    sections: [
      { title: "أبرز ما يميزها", content: "المسرح الروماني البازلتي ومعالم دينية ومدنية من مراحل تاريخية متعددة." },
      { title: "قبل الزيارة", content: "تحقق من ساعات الفتح وإمكانية الوصول والخدمات المتاحة محليًا." },
    ],
  },
  {
    id: "maaloula",
    name: "معلولا",
    category: "tourism",
    city: "ريف دمشق",
    shortDescription: "بلدة جبلية معروفة بمشهدها الصخري وأديرتها وبيوتها المتدرجة على السفوح.",
    image:
      "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1400&q=84",
    imageAlt: "صورة تعريفية لبلدة جبلية تاريخية",
    sourceLabel: "قائمة سوريا التمهيدية لدى مركز التراث العالمي",
    sourceUrl: "https://whc.unesco.org/en/statesparties/sy/",
    verifiedAt: "2026-08-06",
    mapQuery: "معلولا ريف دمشق سوريا",
    tags: ["معلولا", "ريف دمشق", "جبال", "أديرة", "سياحة"],
    sections: [
      { title: "طبيعة المكان", content: "ممرات جبلية وعمارة متدرجة ومواقع دينية ضمن مشهد طبيعي مميز." },
      { title: "احترام الموقع", content: "التزم بآداب زيارة المواقع الدينية واسأل محليًا عن المسارات المتاحة." },
    ],
  },
];

export const SYRIA_GUIDE_ENTITIES: SyriaGuideEntity[] = [...directoryEntities, ...heritageEntities];

export const SYRIA_GUIDE_CATEGORIES: Array<{ id: "all" | SyriaGuideCategory; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "government", label: "جهات حكومية" },
  { id: "hospital", label: "مشافٍ" },
  { id: "university", label: "جامعات" },
  { id: "heritage", label: "معالم أثرية" },
  { id: "tourism", label: "أماكن سياحية" },
];

export function searchSyriaGuide(query: string, category: "all" | SyriaGuideCategory) {
  const normalized = normalizeArabic(query);
  return SYRIA_GUIDE_ENTITIES.filter((entity) => {
    if (category !== "all" && entity.category !== category) return false;
    if (!normalized) return true;
    const haystack = normalizeArabic(
      [entity.name, entity.city, entity.shortDescription, entity.address ?? "", ...entity.tags].join(" "),
    );
    return haystack.includes(normalized) || normalized.split(" ").some((word) => word.length > 1 && haystack.includes(word));
  });
}
