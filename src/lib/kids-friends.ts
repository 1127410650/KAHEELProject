/* ═══════════════════════════════════════════════════════════════════════════
   أصدقاء كَحيل الصغار — شخصيات كرتونية **أصلية** خاصة بقسم الأطفال.

   قانونيًا: كل الأشكال مرسومة من الصفر هنا (SVG متجهي داخل الكود) بأسلوب
   كرتون كلاسيكي عام: عيون كبيرة مستديرة، خطوط ناعمة، ألوان زاهية مع لمسة
   بنفسجية من هوية كَحيل. لا محاكاة لأي شخصية مملوكة لأي شركة.

   هذه شخصيات مساعدة لقسم الأطفال فقط — كَحيل وكَحيلان يبقيان شخصيتَي
   المنصة الرئيسيتين بلا تغيير.
   ═══════════════════════════════════════════════════════════════════════════ */

export type KidsFriendId = "birdy" | "mishmisha" | "dabdoob" | "nabnab" | "najma";

export type KidsFriendMood = "happy" | "sad" | "wink";

export interface KidsFriendMeta {
  id: KidsFriendId;
  /** اسم الشخصية بالعربية */
  nameAr: string;
  nameEn: string;
  /** الدور داخل القسم */
  roleAr: string;
  roleEn: string;
  /** كلمات مفتاحية لمطابقة التصنيفات الفرعية (slug أو اسم) */
  match: string[];
}

export const KIDS_FRIENDS: KidsFriendMeta[] = [
  {
    id: "birdy",
    nameAr: "زقزوق",
    nameEn: "Zaqzooq",
    roleAr: "الألعاب",
    roleEn: "Toys",
    match: ["toy", "toys", "game", "games", "play", "لعب", "ألعاب", "العاب"],
  },
  {
    id: "mishmisha",
    nameAr: "مشمشة",
    nameEn: "Mishmisha",
    roleAr: "ملابس الأطفال",
    roleEn: "Kids clothing",
    match: ["cloth", "fashion", "wear", "shoe", "ملابس", "أحذية", "احذية", "لبس"],
  },
  {
    id: "dabdoob",
    nameAr: "دبدوب",
    nameEn: "Dabdoob",
    roleAr: "مستلزمات الرضّع",
    roleEn: "Baby care",
    match: ["baby", "babies", "infant", "newborn", "رضع", "رضّع", "مواليد", "حفاض", "حليب"],
  },
  {
    id: "nabnab",
    nameAr: "نبنوب",
    nameEn: "Nabnoob",
    roleAr: "القرطاسية والمدارس",
    roleEn: "School & stationery",
    match: [
      "school",
      "stationery",
      "book",
      "study",
      "قرطاسية",
      "مدرس",
      "مدارس",
      "كتب",
      "حقائب",
    ],
  },
  {
    id: "najma",
    nameAr: "نجمة",
    nameEn: "Najma",
    roleAr: "الصيف والمسابح",
    roleEn: "Summer & pools",
    match: ["pool", "swim", "summer", "beach", "water", "مسبح", "مسابح", "سباحة", "صيف", "بحر"],
  },
];

const FRIEND_ORDER: KidsFriendId[] = KIDS_FRIENDS.map((f) => f.id);

export function kidsFriendMeta(id: KidsFriendId): KidsFriendMeta {
  return KIDS_FRIENDS.find((f) => f.id === id) ?? KIDS_FRIENDS[0]!;
}

/**
 * يختار الشخصية المناسبة لتصنيف فرعي. المطابقة على الـ slug أولًا ثم الاسم،
 * وإن لم يطابق شيء نوزّع الشخصيات بالدور حسب الفهرس حتى تبقى العائلة كاملة
 * ظاهرة بلا تكرار مزعج.
 */
export function kidsFriendFor(
  input: { slug?: string | null; name?: string | null },
  index = 0,
): KidsFriendId {
  const haystack = `${input.slug ?? ""} ${input.name ?? ""}`.toLowerCase();
  for (const friend of KIDS_FRIENDS) {
    if (friend.match.some((token) => haystack.includes(token.toLowerCase()))) return friend.id;
  }
  return FRIEND_ORDER[index % FRIEND_ORDER.length]!;
}

/** هل هذا التصنيف داخل عالم الأطفال؟ */
export function isKidsWorld(slugs: Array<string | null | undefined>): boolean {
  return slugs.some((slug) => {
    if (!slug) return false;
    const value = slug.toLowerCase();
    return value === "kids" || value.startsWith("kids-") || value.includes("atfal");
  });
}
