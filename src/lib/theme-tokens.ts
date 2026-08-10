/**
 * محرك ألوان المنصة — تعريف الرموز (Tokens) واللوحات المدمجة وفحص التباين.
 *
 * كل لون في الواجهة يشتق من رمز واحد هنا، ويُطبع في `:root` كمتغيّر CSS باسم
 * `--kt-<token>`. القيم الافتراضية مطبوعة أصلًا في `src/styles.css` فلا تحدث
 * وميض قبل وصول اللوحة من القاعدة، والتبديل من لوحة الإدارة يسري فورًا.
 *
 * لمسات الأقسام تبقى في `section-accent.ts` بلا تغيير.
 */
import { contrastRatio } from "@/lib/mkt-live-edit";

/** المجموعة الكاملة لرموز اللوحة — لا رمز خارج هذه القائمة. */
export const THEME_TOKENS = [
  "primary",
  "primary-deep",
  "primary-soft",
  "header-from",
  "header-to",
  "page-bg",
  "card",
  "divider",
  "text-primary",
  "text-secondary",
  "disabled",
  "focus",
  "price-color",
  "story-ring",
  "cta-bg",
  "cta-fg",
  "pulse-color",
  "bottomnav-active",
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeTokenMap = Record<ThemeToken, string>;

/** مجموعات لوحة الإدارة: كل مجموعة صف من منتقيات الألوان. */
export const THEME_GROUPS: Array<{ key: string; label: string; tokens: ThemeToken[] }> = [
  {
    key: "identity",
    label: "الهوية",
    tokens: ["primary", "primary-deep", "primary-soft", "focus", "bottomnav-active", "story-ring"],
  },
  { key: "surfaces", label: "الخلفيات", tokens: ["page-bg", "card", "divider"] },
  {
    key: "text",
    label: "النصوص",
    tokens: ["text-primary", "text-secondary", "disabled", "price-color"],
  },
  { key: "header", label: "تدرج الهيدر", tokens: ["header-from", "header-to"] },
  { key: "cta", label: "الأزرار والنبضة", tokens: ["cta-bg", "cta-fg", "pulse-color"] },
];

/** اسم عربي مختصر لكل رمز — يُستخدم في المنتقيات وفي رسائل التباين. */
export const TOKEN_LABELS: Record<ThemeToken, string> = {
  primary: "اللون الأساس",
  "primary-deep": "الأساس الغامق (النصوص والأزرار)",
  "primary-soft": "الأساس الفاتح جدًا",
  "header-from": "بداية تدرج الهيدر",
  "header-to": "نهاية تدرج الهيدر",
  "page-bg": "خلفية الصفحة",
  card: "خلفية البطاقة",
  divider: "لون الفاصل والحدود",
  "text-primary": "النص الأساسي",
  "text-secondary": "النص الثانوي",
  disabled: "المعطَّل",
  focus: "حلقة التركيز",
  "price-color": "لون السعر",
  "story-ring": "حلقة الستوري",
  "cta-bg": "خلفية زر الإجراء",
  "cta-fg": "لون رمز زر الإجراء",
  "pulse-color": "لون النبضة",
  "bottomnav-active": "الشريط السفلي — النشط",
};

/** رموز تقبل rgba() (شفافية) — البقية لون سداسي صريح. */
export const ALPHA_TOKENS: ThemeToken[] = ["pulse-color"];

/** «كَحيل البنفسجي» — اللوحة التاريخية، محفوظة كما هي. */
export const PALETTE_PURPLE: ThemeTokenMap = {
  primary: "#8A4FFF",
  "primary-deep": "#6522D6",
  "primary-soft": "#F4EFFF",
  "header-from": "#8A4FFF",
  "header-to": "#C3ABFF",
  "page-bg": "#F7F7F8",
  card: "#FFFFFF",
  divider: "#E5E5EA",
  "text-primary": "#1B1B1F",
  "text-secondary": "#6E6E7D",
  disabled: "#C7C7CC",
  focus: "#8A4FFF",
  "price-color": "#1B1B1F",
  "story-ring": "#8A4FFF",
  "cta-bg": "#FFFFFF",
  "cta-fg": "#6522D6",
  "pulse-color": "rgba(138,79,255,0.5)",
  "bottomnav-active": "#8A4FFF",
};

/** «أخضر × كحلي» — اللوحة المعتمدة حاليًا. */
export const PALETTE_GREEN_NAVY: ThemeTokenMap = {
  primary: "#0E9F6E",
  "primary-deep": "#0B7A55",
  "primary-soft": "#E6F5EF",
  "header-from": "#14324F",
  "header-to": "#1E4C77",
  "page-bg": "#FFFFFF",
  card: "#FFFFFF",
  divider: "#E5E7EB",
  "text-primary": "#14324F",
  "text-secondary": "#64748B",
  disabled: "#C7CDD4",
  focus: "#0E9F6E",
  "price-color": "#14324F",
  "story-ring": "#0E9F6E",
  "cta-bg": "#FFFFFF",
  "cta-fg": "#0E9F6E",
  "pulse-color": "rgba(14,159,110,0.5)",
  "bottomnav-active": "#0E9F6E",
};

/** القيم الافتراضية عند غياب القاعدة — مطابقة لما هو مطبوع في styles.css. */
export const DEFAULT_TOKENS: ThemeTokenMap = PALETTE_GREEN_NAVY;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;

export function isValidTokenValue(token: ThemeToken, value: string): boolean {
  const trimmed = value.trim();
  if (HEX.test(trimmed)) return true;
  return ALPHA_TOKENS.includes(token) && RGBA.test(trimmed);
}

/** خريطة كاملة: القيم القادمة من القاعدة فوق الافتراضي، مع تنقية كل قيمة. */
export function normalizeTokens(raw: Record<string, unknown> | null | undefined): ThemeTokenMap {
  const out = { ...DEFAULT_TOKENS };
  if (!raw) return out;
  for (const token of THEME_TOKENS) {
    const value = raw[token];
    if (typeof value === "string" && isValidTokenValue(token, value)) out[token] = value.trim();
  }
  return out;
}

/** نص CSS يُطبع في `<style>` فيغيّر كل المنصة فورًا. */
export function tokensCss(tokens: ThemeTokenMap, selector = ":root"): string {
  const body = THEME_TOKENS.map((token) => `--kt-${token}:${tokens[token]}`).join(";");
  return `${selector}{${body}}`;
}

/** يحوّل rgba() إلى أقرب لون صلب فوق أبيض — للفحص فقط. */
function flatten(value: string): string {
  const match = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!match) return value;
  const alpha = match[4] ? Number(match[4]) : 1;
  const mix = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  const hex = [Number(match[1]), Number(match[2]), Number(match[3])]
    .map((channel) => mix(channel).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

export interface ContrastIssue {
  pair: string;
  ratio: number;
  min: number;
}

/**
 * أزواج «نص فوق خلفية» الواجبة الفحص. النصوص عند 4.5:1، والرموز الرسومية
 * (أيقونة زر الإجراء) عند 3:1 وفق WCAG للعناصر غير النصية.
 */
/** يمزج لونين سداسيين بنسبة `weight` من الأول — يحاكي `color-mix` في CSS. */
function mixHex(a: string, b: string, weight: number): string {
  const parse = (hex: string): [number, number, number] => {
    const value = hex.replace("#", "");
    const full =
      value.length === 3
        ? value
            .split("")
            .map((channel) => channel + channel)
            .join("")
        : value.slice(0, 6);
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const blend = (x: number, y: number) => Math.round(x * weight + y * (1 - weight));
  return `#${[blend(r1, r2), blend(g1, g2), blend(b1, b2)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

const PAIRS: Array<{ text: ThemeToken | "#FFFFFF"; bg: ThemeToken; label: string; min: number }> = [
  { text: "text-primary", bg: "page-bg", label: "النص الأساسي فوق خلفية الصفحة", min: 4.5 },
  { text: "text-primary", bg: "card", label: "النص الأساسي فوق البطاقة", min: 4.5 },
  { text: "text-secondary", bg: "card", label: "النص الثانوي فوق البطاقة", min: 4.5 },
  { text: "price-color", bg: "card", label: "لون السعر فوق البطاقة", min: 4.5 },
  { text: "primary-deep", bg: "card", label: "الأساس الغامق فوق البطاقة", min: 4.5 },
  { text: "primary-deep", bg: "primary-soft", label: "الأساس الغامق فوق الأساس الفاتح", min: 4.5 },
  { text: "#FFFFFF", bg: "primary-deep", label: "نص أبيض فوق الأساس الغامق", min: 4.5 },
  { text: "#FFFFFF", bg: "header-from", label: "نص أبيض فوق بداية تدرج الهيدر", min: 4.5 },
  { text: "cta-fg", bg: "cta-bg", label: "رمز زر الإجراء فوق خلفيته", min: 3 },
];

/** كل الأزواج التي لا تجتاز الحد — قائمة فارغة تعني «مسموح بالحفظ». */
export function contrastIssues(tokens: ThemeTokenMap): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  /*
   * نهاية تدرج الهيدر تُفحص على اللون المركّب فعليًا: طبقة التعتيم
   * (`.k-header-hero::before`) تمزج 46% من `header-from` فوق الطرف الفاتح،
   * فالنص الأبيض لا يقع على `header-to` الخالص. الحد 4.5:1 كبقية النصوص.
   */
  {
    const composited = mixHex(tokens["header-from"], tokens["header-to"], 0.46);
    const ratio = contrastRatio("#FFFFFF", composited);
    if (Number.isFinite(ratio) && ratio + 0.005 < 4.5) {
      issues.push({
        pair: "نص أبيض فوق نهاية تدرج الهيدر",
        ratio: Math.round(ratio * 100) / 100,
        min: 4.5,
      });
    }
  }

  for (const pair of PAIRS) {
    const text = pair.text === "#FFFFFF" ? "#FFFFFF" : tokens[pair.text];
    const bg = tokens[pair.bg];
    const ratio = contrastRatio(flatten(text), flatten(bg));
    if (!Number.isFinite(ratio)) continue;
    if (ratio + 0.005 < pair.min) {
      issues.push({ pair: pair.label, ratio: Math.round(ratio * 100) / 100, min: pair.min });
    }
  }
  return issues;
}
