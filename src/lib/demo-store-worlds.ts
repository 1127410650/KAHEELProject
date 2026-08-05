export type DemoWorldId =
  | "women"
  | "men"
  | "kids"
  | "games"
  | "clubs"
  | "restaurants"
  | "cafes"
  | "jewelry"
  | "gifts"
  | "pets";

export interface DemoStorePreview {
  name: string;
  subtitle: string;
  image: string;
  rating: string;
  count: string;
  tags: string[];
}

export interface DemoStoreWorld {
  id: DemoWorldId;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  image: string;
  gradient: string;
  accent: string;
  stores: DemoStorePreview[];
}

const image = (id: string, width = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=84`;

export const DEMO_STORE_WORLDS: DemoStoreWorld[] = [
  {
    id: "women",
    title: "عالم الأنوثة",
    shortTitle: "نساء",
    eyebrow: "أزياء · عطور · عناية",
    description: "متاجر نسائية راقية تجمع الأزياء والعطور والعناية والإكسسوارات في تجربة ناعمة وفاخرة.",
    image: image("photo-1529139574466-a303027c1d8b"),
    gradient: "from-[#24111f] via-[#7d1748] to-[#e74791]",
    accent: "#f5bfd8",
    stores: [
      {
        name: "دار لِين",
        subtitle: "عبايات وتصاميم مختارة",
        image: image("photo-1539109136881-3be0616acf4b", 900),
        rating: "4.9",
        count: "128 منتجًا",
        tags: ["عبايات", "فساتين", "تصميم خاص"],
      },
      {
        name: "روز بيوتي",
        subtitle: "عناية وجمال وعطور",
        image: image("photo-1483985988355-763728e1935b", 900),
        rating: "4.8",
        count: "94 منتجًا",
        tags: ["عناية", "عطور", "هدايا"],
      },
      {
        name: "تفاصيل",
        subtitle: "حقائب وإكسسوارات",
        image: image("photo-1490481651871-ab68de25d43d", 900),
        rating: "4.9",
        count: "76 منتجًا",
        tags: ["حقائب", "إكسسوارات", "تشكيلات"],
      },
    ],
  },
  {
    id: "men",
    title: "عالم الرجل",
    shortTitle: "رجال",
    eyebrow: "أناقة · ساعات · عطور",
    description: "واجهات رجالية عصرية بطابع داكن وفخم للملابس والساعات والعطور والإكسسوارات.",
    image: image("photo-1617137968427-85924c800a22"),
    gradient: "from-[#07101f] via-[#0d2b54] to-[#2f6fa3]",
    accent: "#b8d5ef",
    stores: [
      {
        name: "هيبة",
        subtitle: "أزياء رجالية فاخرة",
        image: image("photo-1516257984-b1b4d707412e", 900),
        rating: "4.9",
        count: "112 منتجًا",
        tags: ["ثياب", "بدل", "إطلالات"],
      },
      {
        name: "توقيت",
        subtitle: "ساعات وإكسسوارات",
        image: image("photo-1521572163474-6864f9cf17ab", 900),
        rating: "4.7",
        count: "63 منتجًا",
        tags: ["ساعات", "محافظ", "هدايا"],
      },
      {
        name: "أثر",
        subtitle: "عطور رجالية مختارة",
        image: image("photo-1617127365659-c47fa864d8bc", 900),
        rating: "4.8",
        count: "81 منتجًا",
        tags: ["عطور", "بخور", "مجموعات"],
      },
    ],
  },
  {
    id: "kids",
    title: "عالم الصغار",
    shortTitle: "أطفال",
    eyebrow: "أطفال · مواليد · ألعاب",
    description: "مساحة مرحة وآمنة لمتاجر الأطفال والمواليد والألعاب والهدايا التعليمية.",
    image: image("photo-1503454537195-1dcabb73ffb9"),
    gradient: "from-[#123047] via-[#2d8eb4] to-[#f3c969]",
    accent: "#d8f3ff",
    stores: [
      {
        name: "حكاية طفل",
        subtitle: "ملابس ومواليد",
        image: image("photo-1516627145497-ae6968895b74", 900),
        rating: "4.9",
        count: "146 منتجًا",
        tags: ["مواليد", "ملابس", "مستلزمات"],
      },
      {
        name: "ألعب وأتعلم",
        subtitle: "ألعاب تعليمية",
        image: image("photo-1596461404969-9ae70f2830c1", 900),
        rating: "4.8",
        count: "91 منتجًا",
        tags: ["تعليمي", "ترفيه", "هدايا"],
      },
      {
        name: "فرحة",
        subtitle: "حفلات وهدايا أطفال",
        image: image("photo-1607453998774-d533f65dac99", 900),
        rating: "4.7",
        count: "58 منتجًا",
        tags: ["حفلات", "تغليف", "هدايا"],
      },
    ],
  },
  {
    id: "games",
    title: "عالم اللاعبين",
    shortTitle: "ألعاب",
    eyebrow: "أجهزة · ألعاب · بطاقات",
    description: "تجربة نيون حماسية لمتاجر الألعاب والأجهزة والإكسسوارات والبطاقات الرقمية.",
    image: image("photo-1542751371-adc38448a05e"),
    gradient: "from-[#09051f] via-[#4b197e] to-[#00a9c7]",
    accent: "#a4f4ff",
    stores: [
      {
        name: "بوابة اللاعب",
        subtitle: "أجهزة وألعاب",
        image: image("photo-1606144042614-b2417e99c4e3", 900),
        rating: "4.9",
        count: "104 منتجات",
        tags: ["أجهزة", "ألعاب", "إصدارات"],
      },
      {
        name: "زون",
        subtitle: "إكسسوارات احترافية",
        image: image("photo-1598550476439-6847785fcea6", 900),
        rating: "4.8",
        count: "72 منتجًا",
        tags: ["سماعات", "كراسي", "تحكم"],
      },
      {
        name: "كود",
        subtitle: "بطاقات رقمية",
        image: image("photo-1550745165-9bc0b252726f", 900),
        rating: "4.9",
        count: "49 بطاقة",
        tags: ["بطاقات", "اشتراكات", "شحن"],
      },
    ],
  },
  {
    id: "clubs",
    title: "عالم اللياقة",
    shortTitle: "نوادٍ",
    eyebrow: "نوادٍ · تدريب · صحة",
    description: "واجهات قوية للنوادي والمدربين وبرامج اللياقة والاشتراكات والمعدات الرياضية.",
    image: image("photo-1534438327276-14e5300c3a48"),
    gradient: "from-[#071b18] via-[#12664f] to-[#8dc63f]",
    accent: "#d7ff9f",
    stores: [
      {
        name: "قمة فيتنس",
        subtitle: "نادي وبرامج لياقة",
        image: image("photo-1517836357463-d25dfeac3438", 900),
        rating: "4.9",
        count: "18 برنامجًا",
        tags: ["اشتراكات", "حصص", "تدريب"],
      },
      {
        name: "مدربك",
        subtitle: "تدريب شخصي",
        image: image("photo-1571019613454-1cb2f99b2d8b", 900),
        rating: "4.8",
        count: "12 باقة",
        tags: ["تدريب", "خطط", "متابعة"],
      },
      {
        name: "باور جير",
        subtitle: "معدات رياضية",
        image: image("photo-1517838277536-f5f99be501cd", 900),
        rating: "4.7",
        count: "86 منتجًا",
        tags: ["معدات", "ملابس", "إكسسوارات"],
      },
    ],
  },
  {
    id: "restaurants",
    title: "عالم المطاعم",
    shortTitle: "مطاعم",
    eyebrow: "مطاعم · وجبات · حلويات",
    description: "تجربة شهية للمطاعم والمطابخ والحلويات مع قوائم وعروض مرئية وجذابة.",
    image: image("photo-1517248135467-4c7edcad34c4"),
    gradient: "from-[#2a0d08] via-[#9b2d13] to-[#e9a23b]",
    accent: "#ffe2a9",
    stores: [
      {
        name: "مذاق الدار",
        subtitle: "أطباق محلية مختارة",
        image: image("photo-1555396273-367ea4eb4db5", 900),
        rating: "4.9",
        count: "38 صنفًا",
        tags: ["غداء", "عائلي", "ضيافة"],
      },
      {
        name: "ذا تيبل",
        subtitle: "تجربة طعام عصرية",
        image: image("photo-1414235077428-338989a2e8c0", 900),
        rating: "4.8",
        count: "29 صنفًا",
        tags: ["عصري", "حجوزات", "قوائم"],
      },
      {
        name: "لقمة",
        subtitle: "وجبات سريعة مميزة",
        image: image("photo-1504674900247-0877df9cc836", 900),
        rating: "4.7",
        count: "44 صنفًا",
        tags: ["برجر", "وجبات", "توصيل"],
      },
    ],
  },
  {
    id: "cafes",
    title: "عالم المقاهي",
    shortTitle: "مقاهٍ",
    eyebrow: "قهوة · مخبوزات · جلسات",
    description: "تصاميم دافئة للمقاهي والقهوة المختصة والمخبوزات وتجارب الجلسات.",
    image: image("photo-1495474472287-4d71bcdd2085"),
    gradient: "from-[#1d120d] via-[#6a3b23] to-[#c98b57]",
    accent: "#f2d4b5",
    stores: [
      {
        name: "مزاج",
        subtitle: "قهوة مختصة",
        image: image("photo-1445116572660-236099ec97a0", 900),
        rating: "4.9",
        count: "23 صنفًا",
        tags: ["قهوة", "بارد", "مختص"],
      },
      {
        name: "روف كافيه",
        subtitle: "جلسات ومخبوزات",
        image: image("photo-1509042239860-f550ce710b93", 900),
        rating: "4.8",
        count: "31 صنفًا",
        tags: ["جلسات", "حلى", "مخبوزات"],
      },
      {
        name: "بن",
        subtitle: "محاصيل وأدوات قهوة",
        image: image("photo-1511081692775-05d0f180a065", 900),
        rating: "4.7",
        count: "67 منتجًا",
        tags: ["محاصيل", "أدوات", "هدايا"],
      },
    ],
  },
  {
    id: "jewelry",
    title: "عالم المجوهرات",
    shortTitle: "مجوهرات",
    eyebrow: "ذهب · ألماس · هدايا",
    description: "واجهات راقية وهادئة للمجوهرات والساعات والهدايا الفاخرة والتصاميم الخاصة.",
    image: image("photo-1515562141207-7a88fb7ce338"),
    gradient: "from-[#0d1018] via-[#4f401f] to-[#c7a349]",
    accent: "#f7e4a5",
    stores: [
      {
        name: "دار الجوهرة",
        subtitle: "مجوهرات راقية",
        image: image("photo-1535632066927-ab7c9ab60908", 900),
        rating: "5.0",
        count: "64 قطعة",
        tags: ["ذهب", "ألماس", "تصاميم"],
      },
      {
        name: "لمعان",
        subtitle: "هدايا ومناسبات",
        image: image("photo-1599643478518-a784e5dc4c8f", 900),
        rating: "4.9",
        count: "47 قطعة",
        tags: ["هدايا", "مناسبات", "تغليف"],
      },
      {
        name: "توقيع",
        subtitle: "قطع مصممة حسب الطلب",
        image: image("photo-1617038220319-276d3cfab638", 900),
        rating: "4.8",
        count: "35 تصميمًا",
        tags: ["خاص", "نقش", "حسب الطلب"],
      },
    ],
  },
  {
    id: "gifts",
    title: "عالم الورد والهدايا",
    shortTitle: "هدايا",
    eyebrow: "ورد · تغليف · مناسبات",
    description: "عالم بصري مبهج للورد والهدايا والتغليف والمناسبات والطلبات الخاصة.",
    image: image("photo-1490750967868-88aa4486c946"),
    gradient: "from-[#24112f] via-[#8a3479] to-[#ef7c9a]",
    accent: "#ffd4e3",
    stores: [
      {
        name: "بتلة",
        subtitle: "ورد وتنسيقات",
        image: image("photo-1513883049090-d0b7439799bf", 900),
        rating: "4.9",
        count: "58 تنسيقًا",
        tags: ["ورد", "بوكيه", "مناسبات"],
      },
      {
        name: "لحظة",
        subtitle: "هدايا جاهزة",
        image: image("photo-1512909006721-3d6018887383", 900),
        rating: "4.8",
        count: "73 هدية",
        tags: ["هدايا", "صناديق", "توصيل"],
      },
      {
        name: "تغليفة",
        subtitle: "تغليف حسب الطلب",
        image: image("photo-1549465220-1a8b9238cd48", 900),
        rating: "4.8",
        count: "41 تصميمًا",
        tags: ["تغليف", "بطاقات", "طلبات خاصة"],
      },
    ],
  },
  {
    id: "pets",
    title: "عالم الرفقاء",
    shortTitle: "حيوانات",
    eyebrow: "حيوانات · عناية · مستلزمات",
    description: "متاجر ودودة للحيوانات الأليفة والغذاء والعناية والإكسسوارات والخدمات.",
    image: image("photo-1450778869180-41d0601e046e"),
    gradient: "from-[#0d2730] via-[#157588] to-[#70c6ad]",
    accent: "#c6fff0",
    stores: [
      {
        name: "رفيقك",
        subtitle: "مستلزمات وعناية",
        image: image("photo-1548199973-03cce0bbc87b", 900),
        rating: "4.9",
        count: "89 منتجًا",
        tags: ["عناية", "غذاء", "إكسسوارات"],
      },
      {
        name: "مواء",
        subtitle: "كل ما تحتاجه القطط",
        image: image("photo-1518791841217-8f162f1e1131", 900),
        rating: "4.8",
        count: "62 منتجًا",
        tags: ["قطط", "ألعاب", "رمل"],
      },
      {
        name: "بيت الحيوان",
        subtitle: "خدمات ومنتجات متنوعة",
        image: image("photo-1552053831-71594a27632d", 900),
        rating: "4.7",
        count: "74 منتجًا",
        tags: ["كلاب", "طيور", "خدمات"],
      },
    ],
  },
];

export const DEMO_WORLD_IDS = new Set<DemoWorldId>(DEMO_STORE_WORLDS.map((world) => world.id));

export function getDemoStoreWorld(id: string | undefined): DemoStoreWorld | undefined {
  return DEMO_STORE_WORLDS.find((world) => world.id === id);
}
