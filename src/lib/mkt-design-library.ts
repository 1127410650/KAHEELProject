/**
 * مكتبة الأشكال والحركات والوجهات وقوالب «تصاميمي».
 *
 * كل ما يظهر في قوائم وضع التحرير يأتي من جداول المكتبة في القاعدة
 * (`mkt_design_shapes` / `mkt_design_motions` / `mkt_design_routes` /
 * `mkt_design_templates`)، فإضافة شكل أو حركة أو قالب جديد لاحقًا = صف واحد في
 * الجدول، والقوائم تعرضه تلقائيًا بلا تعديل أي شاشة.
 *
 * لا يُقبل أي CSS أو HTML حر: الشكل يُخزَّن كمسار رسم SVG محدود المحارف، والحركة
 * اسم من مجموعة مسماة مغلقة منفّذة كـ keyframes في `src/styles.css`، والوجهة
 * مسار مسجّل في جدول الوجهات.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { slotStyleCss, type MediaSlotRow } from "@/lib/mkt-media-slots";

export const DESIGN_LIB_QUERY_KEY = ["mkt", "design-library"] as const;
export const DESIGN_TEMPLATES_QUERY_KEY = ["mkt", "design-templates"] as const;

/** مواضع الشكل الزخرفي — قائمة مغلقة تطابق قيود القاعدة. */
export const SHAPE_POSITIONS = [
  { value: "corner-tl", label: "زاوية أعلى البداية" },
  { value: "corner-tr", label: "زاوية أعلى النهاية" },
  { value: "corner-bl", label: "زاوية أسفل البداية" },
  { value: "corner-br", label: "زاوية أسفل النهاية" },
  { value: "edge-top", label: "الحافة العلوية" },
  { value: "edge-bottom", label: "الحافة السفلية" },
  { value: "edge-start", label: "حافة البداية" },
  { value: "edge-end", label: "حافة النهاية" },
  { value: "behind-title", label: "خلف العنوان" },
] as const;

export const SIZE_OPTIONS = [
  { value: "sm", label: "صغير" },
  { value: "md", label: "عادي" },
  { value: "lg", label: "كبير" },
] as const;

export const SPEED_OPTIONS = [
  { value: "slow", label: "بطيء" },
  { value: "medium", label: "متوسط" },
] as const;

export type DesignSize = "sm" | "md" | "lg";
export type MotionState = "static" | "animated";
export type MotionSpeed = "slow" | "medium";

export interface DesignShape {
  key: string;
  label_ar: string;
  label_en: string;
  view_box: string;
  path_d: string;
  sort_order: number;
}

export interface DesignMotion {
  key: string;
  label_ar: string;
  label_en: string;
  anim_name: string;
  slow_ms: number;
  medium_ms: number;
  sort_order: number;
}

export interface DesignRoute {
  path: string;
  label_ar: string;
  sort_order: number;
}

export interface DesignTemplate {
  id: string;
  kind: "offer" | "promo";
  name_ar: string;
  title_ar: string | null;
  body_ar: string | null;
  discount_pct: number | null;
  bg_color: string | null;
  grad_from: string | null;
  grad_to: string | null;
  grad_angle: number | null;
  image_path: string | null;
  shape_key: string | null;
  shape_color: string | null;
  shape_opacity: number;
  shape_size: DesignSize;
  shape_pos: string;
  motion_key: string | null;
  motion_state: MotionState;
  motion_speed: MotionSpeed;
  link_path: string | null;
  campaign_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface DesignLibrary {
  shapes: DesignShape[];
  motions: DesignMotion[];
  routes: DesignRoute[];
}

async function fetchDesignLibrary(): Promise<DesignLibrary> {
  const [shapes, motions, routes] = await Promise.all([
    supabase
      .from("mkt_design_shapes")
      .select("key, label_ar, label_en, view_box, path_d, sort_order")
      .order("sort_order"),
    supabase
      .from("mkt_design_motions")
      .select("key, label_ar, label_en, anim_name, slow_ms, medium_ms, sort_order")
      .order("sort_order"),
    supabase.from("mkt_design_routes").select("path, label_ar, sort_order").order("sort_order"),
  ]);
  return {
    shapes: (shapes.data ?? []) as unknown as DesignShape[],
    motions: (motions.data ?? []) as unknown as DesignMotion[],
    routes: (routes.data ?? []) as unknown as DesignRoute[],
  };
}

/** المكتبة كاملة — استعلام واحد مشترك، ويُخزَّن طويلًا لأنه شبه ثابت. */
export function useDesignLibrary(enabled = true) {
  return useQuery({
    queryKey: DESIGN_LIB_QUERY_KEY,
    queryFn: fetchDesignLibrary,
    enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}

const TEMPLATE_COLUMNS =
  "id, kind, name_ar, title_ar, body_ar, discount_pct, bg_color, grad_from, grad_to, grad_angle, " +
  "image_path, shape_key, shape_color, shape_opacity, shape_size, shape_pos, motion_key, " +
  "motion_state, motion_speed, link_path, campaign_id, starts_at, ends_at, is_active, updated_at";

export async function fetchDesignTemplates(): Promise<DesignTemplate[]> {
  const { data, error } = await supabase
    .from("mkt_design_templates")
    .select(TEMPLATE_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DesignTemplate[];
}

export function useDesignTemplates(enabled = true) {
  return useQuery({
    queryKey: DESIGN_TEMPLATES_QUERY_KEY,
    queryFn: fetchDesignTemplates,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

/** حفظ قالب في «تصاميمي» — التنقية والتحقق من صفة المدير يجريان في القاعدة. */
export async function saveDesignTemplate(
  id: string | null,
  patch: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_design_template_save", {
    _id: id as never,
    _patch: patch as never,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function setDesignTemplateActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_design_template_set_active", {
    _id: id,
    _active: active,
  });
  if (error) throw error;
}

export function useRefreshDesignTemplates() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: DESIGN_TEMPLATES_QUERY_KEY });
    void client.invalidateQueries({ queryKey: DESIGN_LIB_QUERY_KEY });
  };
}

/* ───────────────────────── ترجمة آمنة إلى CSS ───────────────────────── */

const HEX = /^#[0-9a-f]{6}$/i;
const PATH_SAFE = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.eE-]+$/;
const VIEWBOX_SAFE = /^[0-9 .-]{5,32}$/;
const ANIM_SAFE = /^k[a-z]{4,10}$/;

const SHAPE_SIZE_CSS: Record<DesignSize, string> = { sm: "26%", md: "42%", lg: "64%" };

const SHAPE_POS_CSS: Record<string, string> = {
  "corner-tl": "left top",
  "corner-tr": "right top",
  "corner-bl": "left bottom",
  "corner-br": "right bottom",
  "edge-top": "center top",
  "edge-bottom": "center bottom",
  "edge-start": "left center",
  "edge-end": "right center",
  "behind-title": "center center",
};

/** أبعاد البلاطة داخل شبكة من ٦ أعمدة — الأحجام الثلاثة تُكمل الصف بلا فجوات. */
export const TILE_SPAN: Record<DesignSize, string> = {
  sm: "col-span-2",
  md: "col-span-3",
  lg: "col-span-6",
};

/**
 * صورة الشكل الزخرفي كـ data-URI. المسار واللون وصندوق العرض تُفحص هنا مرة
 * أخرى بعد التنقية الخادمية، فلا يمكن لأي نص حر أن يصل إلى صفحة الأنماط.
 */
export function shapeDataUri(
  shape: DesignShape,
  color: string,
  opacityPct: number,
): string | null {
  if (!PATH_SAFE.test(shape.path_d) || !VIEWBOX_SAFE.test(shape.view_box)) return null;
  if (!HEX.test(color)) return null;
  const opacity = Math.min(100, Math.max(0, Math.round(opacityPct))) / 100;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.view_box}">` +
    `<path d="${shape.path_d}" fill="${color}" fill-opacity="${opacity}" ` +
    `stroke="${color}" stroke-opacity="${opacity}" stroke-width="2"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export interface DecorInput {
  shape_key: string | null;
  shape_color: string | null;
  shape_opacity: number | null;
  shape_size: string | null;
  shape_pos: string | null;
  motion_key: string | null;
  motion_state: string | null;
  motion_speed: string | null;
}

/** إعلانات CSS للشكل الزخرفي (تُطبَّق على الطبقة الزخرفية أو ::after). */
export function decorDeclarations(input: DecorInput, shapes: DesignShape[]): string[] {
  const shape = shapes.find((item) => item.key === input.shape_key);
  if (!shape) return [];
  const uri = shapeDataUri(shape, input.shape_color ?? "#8a4fff", input.shape_opacity ?? 18);
  if (!uri) return [];
  const size = SHAPE_SIZE_CSS[(input.shape_size as DesignSize) ?? "md"] ?? SHAPE_SIZE_CSS.md;
  const pos = SHAPE_POS_CSS[input.shape_pos ?? "corner-tr"] ?? SHAPE_POS_CSS["corner-tr"]!;
  return [
    `background-image:${uri}`,
    `background-position:${pos}`,
    `background-size:${size}`,
    "background-repeat:no-repeat",
  ];
}

/** إعلان الحركة الواحد — اسم keyframes من المجموعة المسماة فقط. */
export function motionDeclaration(input: DecorInput, motions: DesignMotion[]): string | null {
  if (input.motion_state !== "animated" || !input.motion_key) return null;
  const motion = motions.find((item) => item.key === input.motion_key);
  if (!motion || !ANIM_SAFE.test(motion.anim_name)) return null;
  const ms = input.motion_speed === "medium" ? motion.medium_ms : motion.slow_ms;
  const duration = Math.min(60000, Math.max(400, Math.round(ms)));
  const once = motion.anim_name === "kslide";
  return (
    `animation:${motion.anim_name} ${duration}ms ` +
    `${once ? "ease-out 1 both" : "ease-in-out infinite"}`
  );
}


/** أقصى عدد عناصر متحركة في الشاشة الواحدة — حدّ أداء لا يُتجاوز. */
export const MAX_ANIMATED_SLOTS = 3;

/**
 * كل قواعد أنماط الفتحات: الخلفية المنشورة + الشكل الزخرفي على `::after` +
 * الحركة. الحركة تُمنح لأول ثلاث فتحات متحركة فقط (بترتيب العرض) حتى لا يتحرك
 * أكثر من ثلاثة عناصر في الشاشة، والباقي يظهر ثابتًا.
 */
export function slotsCss(slots: MediaSlotRow[], lib: DesignLibrary | undefined): string {
  const rules: string[] = [];
  let animated = 0;

  for (const slot of slots) {
    const base = slotStyleCss(slot);
    if (base) rules.push(base);
    if (!lib) continue;

    const decor = decorDeclarations(slot, lib.shapes);
    const allowMotion = animated < MAX_ANIMATED_SLOTS;
    const motion = allowMotion ? motionDeclaration(slot, lib.motions) : null;
    if (motion) animated += 1;
    if (decor.length === 0 && !motion) continue;

    const target = `[data-kslot="${slot.slot_key}"]`;
    rules.push(`${target}{position:relative}`);
    if (decor.length > 0) {
      const inner = [
        'content:""',
        "position:absolute",
        "inset:0",
        "pointer-events:none",
        "border-radius:inherit",
        ...decor,
        ...(motion ? [motion] : []),
      ];
      rules.push(`${target}::after{${inner.join(";")}}`);
    } else if (motion) {
      rules.push(`${target}{${motion}}`);
    }
  }

  return rules.join("\n");
}

/** هل تحتاج هذه الفتحات مكتبة الأشكال أصلًا؟ (لتجنّب استعلام بلا داعٍ للزائر) */
export function needsDesignLibrary(slots: MediaSlotRow[] | undefined): boolean {
  return (slots ?? []).some((slot) => !!slot.shape_key || slot.motion_state === "animated");
}

/* ───────────────── أنماط جاهزة للمكوّنات (نفس القيم المقيّدة) ───────────────── */

/** خلفية البطاقة: لون أو تدرّج بلونين — لا شيء غير ذلك. */
export function surfaceStyle(input: {
  bg_color: string | null;
  grad_from: string | null;
  grad_to: string | null;
  grad_angle: number | null;
}): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (input.bg_color && HEX.test(input.bg_color)) style.backgroundColor = input.bg_color;
  if (input.grad_from && input.grad_to && HEX.test(input.grad_from) && HEX.test(input.grad_to)) {
    const angle = Math.min(360, Math.max(0, input.grad_angle ?? 90));
    style.backgroundImage = `linear-gradient(${angle}deg, ${input.grad_from} 0%, ${input.grad_to} 100%)`;
    style.backgroundSize = "180% 180%";
  }
  return style;
}

/** الشكل الزخرفي كطبقة خلفية داخل البطاقة. */
export function decorStyle(input: DecorInput, shapes: DesignShape[]): React.CSSProperties | null {
  const decls = decorDeclarations(input, shapes);
  if (decls.length === 0) return null;
  const shape = shapes.find((item) => item.key === input.shape_key)!;
  const uri = shapeDataUri(shape, input.shape_color ?? "#8a4fff", input.shape_opacity ?? 18)!;
  return {
    backgroundImage: uri,
    backgroundPosition: SHAPE_POS_CSS[input.shape_pos ?? "corner-tr"] ?? "right top",
    backgroundSize: SHAPE_SIZE_CSS[(input.shape_size as DesignSize) ?? "md"] ?? SHAPE_SIZE_CSS.md,
    backgroundRepeat: "no-repeat",
  };
}

/** حركة العنصر كنمط جاهز — الاسم من المجموعة المسماة فقط. */
export function motionStyle(input: DecorInput, motions: DesignMotion[]): React.CSSProperties {
  const decl = motionDeclaration(input, motions);
  if (!decl) return {};
  return { animation: decl.slice("animation:".length) };
}
