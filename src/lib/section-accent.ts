/**
 * لمسة لون لكل قسم بنمط «نون»: كل عالم قسم له لون تمييز واحد يظهر في الرؤوس
 * والحالات النشطة والبلاطات، فوق سطح محايد واحد وبطاقات بيضاء.
 *
 * القاعدة: الأساس هو لون اللوحة المفعّلة (`--kt-primary`) — الرئيسية والعقار
 * وكل قسم بلا لون خاص تتبعه، فتغيير اللوحة من لوحة الإدارة يسري فورًا. بقية
 * الأقسام تستعير لونها من هذه الخريطة فقط؛ لا لون مكتوب في أي مكوّن.
 */

/** لون الأساس: يُقرأ من اللوحة المفعّلة وقت العرض. */
export const BASE_ACCENT = "var(--kt-primary)";

/** لون تمييز كل قسم؛ المفتاح هو slug القسم في mkt_categories. */
export const SECTION_ACCENTS: Record<string, string> = {
  "real-estate": BASE_ACCENT,
  restaurants: BASE_ACCENT,
  cars: BASE_ACCENT,
  devices: BASE_ACCENT,
  furniture: BASE_ACCENT,
  services: BASE_ACCENT,
  fashion: BASE_ACCENT,
  jobs: BASE_ACCENT,
  training: BASE_ACCENT,
  "schools-universities": BASE_ACCENT,
  events: BASE_ACCENT,
  programming: BASE_ACCENT,
  gardens: BASE_ACCENT,
  arts: BASE_ACCENT,
  "lost-found": BASE_ACCENT,
  "projects-investments": BASE_ACCENT,
  "travel-tourism": BASE_ACCENT,
};

/** لون القسم من الـ slug، ولون اللوحة المفعّلة إن لم يوجد. */
export function sectionAccent(slug?: string | null): string {
  if (!slug) return BASE_ACCENT;
  return SECTION_ACCENTS[slug] ?? BASE_ACCENT;
}

/** مسارات ثابتة لها لون قسم معروف (خارج عوالم /c/{slug}). */
const PATH_ACCENTS: Array<[string, string]> = [
  ["/aqar", SECTION_ACCENTS["real-estate"]!],
  ["/errands", BASE_ACCENT],
  ["/guides/students", BASE_ACCENT],
  ["/guides/syria", BASE_ACCENT],
  ["/services", SECTION_ACCENTS["services"]!],
];

/** لون التمييز المناسب لمسار الصفحة الحالي. */
export function accentForPath(pathname: string): string {
  const world = pathname.match(/^\/c\/([^/?#]+)/);
  if (world) return sectionAccent(decodeURIComponent(world[1]!));
  const hit = PATH_ACCENTS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : BASE_ACCENT;
}
