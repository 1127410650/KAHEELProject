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
  restaurants: "#e2691b",
  cars: "#1f7ae0",
  devices: "#0f9b8e",
  furniture: "#a2622b",
  services: "#6c5ce7",
  fashion: "#d63a7a",
  jobs: "#2f6f4f",
  training: "#b9791f",
  "schools-universities": "#3d5bd6",
  events: "#c0399b",
  programming: "#1e6e8c",
  gardens: "#3f8f3f",
  arts: "#a3379b",
  "lost-found": "#b0552a",
  "projects-investments": "#2b6a8f",
  "travel-tourism": "#0e8f9e",
};

/** لون القسم من الـ slug، ولون اللوحة المفعّلة إن لم يوجد. */
export function sectionAccent(slug?: string | null): string {
  if (!slug) return BASE_ACCENT;
  return SECTION_ACCENTS[slug] ?? BASE_ACCENT;
}

/** مسارات ثابتة لها لون قسم معروف (خارج عوالم /c/{slug}). */
const PATH_ACCENTS: Array<[string, string]> = [
  ["/aqar", SECTION_ACCENTS["real-estate"]!],
  ["/errands", "#e2691b"],
  ["/guides/students", "#3d5bd6"],
  ["/guides/syria", "#0e8f9e"],
  ["/services", SECTION_ACCENTS["services"]!],
];

/** لون التمييز المناسب لمسار الصفحة الحالي. */
export function accentForPath(pathname: string): string {
  const world = pathname.match(/^\/c\/([^/?#]+)/);
  if (world) return sectionAccent(decodeURIComponent(world[1]!));
  const hit = PATH_ACCENTS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : BASE_ACCENT;
}
