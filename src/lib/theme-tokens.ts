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

/** «أخضر × كحلي» — لوحة سابقة، محفوظة للتوافق. */
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

/** «كَحيل الأخضر الغامق» — الهوية المعتمدة: #083a31 أساسًا و#dbefe4 نعناعيًا. */
export const PALETTE_KAHEEL_GREEN: ThemeTokenMap = {
  primary: "#083A31",
  "primary-deep": "#062A24",
  "primary-soft": "#DBEFE4",
  "header-from": "#083A31",
  "header-to": "#0D5646",
  "page-bg": "#FFFFFF",
  card: "#FFFFFF",
  divider: "#E6EBE8",
  "text-primary": "#0B2B24",
  "text-secondary": "#5C6F68",
  disabled: "#C3CDC9",
  focus: "#083A31",
  "price-color": "#083A31",
  "story-ring": "#083A31",
  "cta-bg": "#FFFFFF",
  "cta-fg": "#083A31",
  "pulse-color": "rgba(8,58,49,0.45)",
  "bottomnav-active": "#083A31",
};

/** القيم الافتراضية عند غياب القاعدة — مطابقة لما هو مطبوع في styles.css. */
export const DEFAULT_TOKENS: ThemeTokenMap = PALETTE_KAHEEL_GREEN;

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
   * (`.k-header-hero::before`) تمزج 60% من `header-from` فوق الطرف الفاتح،
   * فالنص الأبيض لا يقع على `header-to` الخالص. عنوان الهيدر نص كبير/عريض،
   * فحد WCAG له 3:1.
   */
  {
    const composited = mixHex(tokens["header-from"], tokens["header-to"], 0.6);
    const ratio = contrastRatio("#FFFFFF", composited);
    if (Number.isFinite(ratio) && ratio + 0.005 < 3) {
      issues.push({
        pair: "نص أبيض فوق نهاية تدرج الهيدر",
        ratio: Math.round(ratio * 100) / 100,
        min: 3,
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

// ── رموز التصميم غير اللونية: خطوط ومقاسات واستدارات وظلال وتباعد ──────────
//
// نفس محرك اللوحة ونفس الجدول (`mkt_theme_settings.category`) — لا نظام رموز
// ثانٍ. كل رمز هنا يقود متغيّر CSS موجود أصلًا في `styles.css`، فالقيمة
// الافتراضية تظل مطبوعة من الخادم بلا وميض.

export type DesignTokenCategory = "font" | "type" | "radius" | "shadow" | "space";

export interface DesignTokenDef {
  key: string;
  category: DesignTokenCategory;
  label: string;
  /** متغيّر CSS الذي يقوده هذا الرمز. */
  cssVar: string;
  default: string;
  /** قيم جاهزة تُعرض للاختيار بدل الكتابة الحرة. */
  presets: string[];
  hint?: string;
}

export const DESIGN_TOKENS: DesignTokenDef[] = [
  {
    key: "font-family",
    category: "font",
    label: "خط الواجهة",
    cssVar: "--font-sans",
    default: "IBM Plex Sans Arabic",
    presets: ["IBM Plex Sans Arabic", "Noto Kufi Arabic", "Cairo", "Tajawal"],
    hint: "اسم العائلة فقط — الاحتياطي يُضاف تلقائيًا.",
  },
  {
    key: "font-display-family",
    category: "font",
    label: "خط العناوين",
    cssVar: "--font-display",
    default: "IBM Plex Sans Arabic",
    presets: ["IBM Plex Sans Arabic", "Noto Kufi Arabic", "Cairo", "Tajawal"],
  },
  { key: "type-body", category: "type", label: "حجم النص الأساسي", cssVar: "--text-body", default: "16px", presets: ["15px", "16px", "17px"] },
  { key: "type-title", category: "type", label: "حجم عنوان البطاقة", cssVar: "--text-title", default: "16px", presets: ["16px", "17px", "18px"] },
  { key: "type-section", category: "type", label: "حجم عنوان القسم", cssVar: "--text-section", default: "20px", presets: ["18px", "20px", "22px"] },
  { key: "type-page", category: "type", label: "حجم عنوان الصفحة", cssVar: "--text-page", default: "26px", presets: ["24px", "26px", "28px"] },
  { key: "radius-card", category: "radius", label: "استدارة البطاقة", cssVar: "--r-card", default: "14px", presets: ["8px", "14px", "20px", "24px"] },
  { key: "radius-control", category: "radius", label: "استدارة الحقول والأزرار", cssVar: "--r-control", default: "12px", presets: ["8px", "12px", "16px", "999px"] },
  { key: "radius-image", category: "radius", label: "استدارة الصور", cssVar: "--r-img", default: "12px", presets: ["0px", "12px", "16px"] },
  {
    key: "shadow-panel",
    category: "shadow",
    label: "ظل اللوحات",
    cssVar: "--shadow-panel",
    default: "0 2px 8px rgb(0 0 0 / 0.05)",
    presets: ["none", "0 1px 3px rgb(0 0 0 / 0.06)", "0 2px 8px rgb(0 0 0 / 0.05)", "0 8px 24px rgb(0 0 0 / 0.10)"],
  },
  {
    key: "shadow-raised",
    category: "shadow",
    label: "ظل العناصر البارزة",
    cssVar: "--shadow-raised",
    default: "0 2px 8px rgb(0 0 0 / 0.05)",
    presets: ["none", "0 2px 8px rgb(0 0 0 / 0.05)", "0 10px 30px rgb(0 0 0 / 0.12)"],
  },
  { key: "space-3", category: "space", label: "تباعد صغير", cssVar: "--sp-3", default: "12px", presets: ["10px", "12px", "14px"] },
  { key: "space-4", category: "space", label: "تباعد أساسي", cssVar: "--sp-4", default: "16px", presets: ["14px", "16px", "18px"] },
  { key: "space-6", category: "space", label: "تباعد الأقسام", cssVar: "--sp-6", default: "24px", presets: ["20px", "24px", "28px"] },
];

export const DESIGN_TOKEN_CATEGORY_LABELS: Record<DesignTokenCategory, string> = {
  font: "الخطوط",
  type: "سلّم الأحجام",
  radius: "الاستدارات",
  shadow: "الظلال",
  space: "التباعد",
};

export function designTokenDef(key: string): DesignTokenDef | undefined {
  return DESIGN_TOKENS.find((token) => token.key === key);
}

const LENGTH = /^(?:0|\d{1,3}(?:\.\d+)?)(?:px|rem|%)$|^999px$/;
const SHADOW = /^(?:none|[0-9a-z\s./()%-]{3,40})$/i;
const FAMILY = /^[A-Za-z\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF\s-]{1,38}$/;

/** قيمة رمز تصميم صالحة — لا فاصلة منقوطة ولا أقواس معقوفة ولا وسوم. */
export function isValidDesignValue(key: string, value: string): boolean {
  const def = designTokenDef(key);
  if (!def) return false;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 40 || /[<>;{}]/.test(raw)) return false;
  if (def.category === "font") return FAMILY.test(raw);
  if (def.category === "shadow") return SHADOW.test(raw);
  return LENGTH.test(raw);
}

export type DesignTokenMap = Record<string, string>;

export const DEFAULT_DESIGN_TOKENS: DesignTokenMap = Object.fromEntries(
  DESIGN_TOKENS.map((token) => [token.key, token.default]),
);

/** يبقي المعروف والصالح فقط، فوق الافتراضي. */
export function normalizeDesignTokens(
  raw: Record<string, unknown> | null | undefined,
): DesignTokenMap {
  const out = { ...DEFAULT_DESIGN_TOKENS };
  if (!raw) return out;
  for (const def of DESIGN_TOKENS) {
    const value = raw[def.key];
    if (typeof value === "string" && isValidDesignValue(def.key, value)) out[def.key] = value.trim();
  }
  return out;
}

/** خط الواجهة يُركَّب مع الاحتياطي دائمًا حتى لا يسقط النص العربي. */
function fontStack(family: string): string {
  return `"${family}", "Kaheel Arabic Fallback", "Inter", system-ui, sans-serif`;
}

/** نص CSS لرموز التصميم — يُطبع مع رموز الألوان في نفس الطبقة. */
export function designTokensCss(tokens: DesignTokenMap, selector = ":root"): string {
  const body = DESIGN_TOKENS.map((def) => {
    const value = tokens[def.key] ?? def.default;
    return `${def.cssVar}:${def.category === "font" ? fontStack(value) : value}`;
  }).join(";");
  return `${selector}{${body}}`;
}

/** هل تختلف الرموز عن الافتراضي؟ لا نطبع طبقة بلا داعٍ. */
export function designTokensChanged(tokens: DesignTokenMap): boolean {
  return DESIGN_TOKENS.some((def) => tokens[def.key] !== def.default);
}
