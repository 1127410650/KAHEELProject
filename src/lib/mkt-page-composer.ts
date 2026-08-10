/**
 * Page Composer — كل شاشة عامة = قائمة كتل مرتّبة تُقرأ من `mkt_page_blocks`.
 *
 * هذا الملف هو المصدر الوحيد لـ:
 *  - الصفحات القابلة للتأليف (`COMPOSER_PAGES`)
 *  - مكتبة أنواع الكتل ووصف حقول إعداداتها (`BLOCK_LIBRARY`) — التي تبني
 *    نموذج التعديل في `/admin/composer` تلقائيًا بلا HTML أو CSS حر
 *  - قراءة الكتل للعرض العام، وكل عمليات الكتابة عبر دوال القاعدة المحمية
 *
 * حدود صارمة مقصودة: لا نص HTML، لا CSS، حد ٢٠ كتلة لكل صفحة (مفروض في
 * القاعدة أيضًا)، وكل تعديل يُسجَّل في `mkt_page_block_audit`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

// ── الصفحات ────────────────────────────────────────────────────────────────

export const COMPOSER_PAGES = [
  { page: "market.home", name_ar: "الرئيسية", name_en: "Marketplace home", path: "/" },
  { page: "aqar.home", name_ar: "رئيسية كَحيل عقار", name_en: "Aqar home", path: "/aqar" },
  { page: "category.world", name_ar: "قالب عوالم الأقسام", name_en: "Category world", path: "/c/$slug" },
] as const;

export type ComposerPage = (typeof COMPOSER_PAGES)[number]["page"];

export const MAX_BLOCKS_PER_PAGE = 20;

// ── أنواع الكتل ────────────────────────────────────────────────────────────

export type BlockType =
  | "hero_image"
  | "hero_gradient"
  | "search_field"
  | "text_strip"
  | "campaign_mosaic"
  | "sponsored_banner"
  | "category_grid"
  | "listing_rail"
  | "type_cards"
  | "city_circles"
  | "link_tile"
  | "design_banner"
  | "spacer"
  | "shape_layer"
  | "quick_tiles"
  | "pride_strip"
  | "exclusive_offers";

export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "slot"
  | "link"
  | "shape"
  | "anchor";

export interface BlockField {
  key: string;
  label_ar: string;
  type: FieldType;
  /** قيمة ابتدائية تُستخدم عند إضافة الكتلة. */
  default?: string | number | boolean;
  options?: { value: string; label_ar: string }[];
  min?: number;
  max?: number;
  hint_ar?: string;
}

export interface BlockDefinition {
  type: BlockType;
  name_ar: string;
  description_ar: string;
  icon: string;
  fields: BlockField[];
}

const TITLE_FIELD: BlockField = { key: "title_ar", label_ar: "العنوان", type: "text" };
const SUBTITLE_FIELD: BlockField = { key: "subtitle_ar", label_ar: "العنوان الفرعي", type: "text" };

/** مراسي الموضع التسعة للأشكال والصور. */
export const ANCHOR_OPTIONS: { value: string; label_ar: string }[] = [
  { value: "top-start", label_ar: "أعلى البداية" },
  { value: "top-center", label_ar: "أعلى الوسط" },
  { value: "top-end", label_ar: "أعلى النهاية" },
  { value: "middle-start", label_ar: "وسط البداية" },
  { value: "middle-center", label_ar: "الوسط" },
  { value: "middle-end", label_ar: "وسط النهاية" },
  { value: "bottom-start", label_ar: "أسفل البداية" },
  { value: "bottom-center", label_ar: "أسفل الوسط" },
  { value: "bottom-end", label_ar: "أسفل النهاية" },
];

export const BLOCK_LIBRARY: BlockDefinition[] = [
  {
    type: "hero_image",
    name_ar: "هيرو بصورة",
    description_ar: "بطاقة صورة عريضة بنسبة ثابتة، تُدار صورتها من فتحات الوسائط.",
    icon: "image",
    fields: [
      { key: "slot_key", label_ar: "فتحة الصورة", type: "slot" },
      TITLE_FIELD,
      SUBTITLE_FIELD,
      {
        key: "ratio",
        label_ar: "النسبة",
        type: "select",
        default: "16/9",
        options: [
          { value: "16/9", label_ar: "16:9" },
          { value: "16/8", label_ar: "16:8" },
          { value: "4/3", label_ar: "4:3" },
        ],
      },
      { key: "overlap_header", label_ar: "يتداخل مع الهيدر", type: "boolean", default: true },
      { key: "link", label_ar: "الوجهة", type: "link" },
    ],
  },
  {
    type: "hero_gradient",
    name_ar: "هيرو بتدرج",
    description_ar: "لوح تدرّج بهوية كَحيل مع عنوان — بلا صورة، صفر تحميل.",
    icon: "sparkles",
    fields: [
      TITLE_FIELD,
      SUBTITLE_FIELD,
      {
        key: "height",
        label_ar: "الارتفاع",
        type: "select",
        default: "md",
        options: [
          { value: "sm", label_ar: "منخفض" },
          { value: "md", label_ar: "متوسط" },
          { value: "lg", label_ar: "مرتفع" },
        ],
      },
      { key: "show_mascot", label_ar: "إظهار الشخصية", type: "boolean", default: false },
      { key: "link", label_ar: "الوجهة", type: "link" },
    ],
  },
  {
    type: "search_field",
    name_ar: "حقل بحث",
    description_ar: "حقل بحث عريض دائري يوجّه إلى صفحة البحث.",
    icon: "search",
    fields: [
      { key: "placeholder_ar", label_ar: "النص الإرشادي", type: "text", default: "ابحث في كَحيل" },
      { key: "target", label_ar: "وجهة البحث", type: "link" },
      { key: "show_tabs", label_ar: "إظهار التبويبات", type: "boolean", default: false },
    ],
  },
  {
    type: "text_strip",
    name_ar: "شريط نصي",
    description_ar: "شريط رسالة قصيرة بعرض الشاشة — إعلان أو ترحيب.",
    icon: "megaphone",
    fields: [
      { key: "text_ar", label_ar: "النص", type: "text" },
      {
        key: "tone",
        label_ar: "النغمة",
        type: "select",
        default: "brand",
        options: [
          { value: "brand", label_ar: "هوية" },
          { value: "gold", label_ar: "ذهبي" },
          { value: "muted", label_ar: "هادئ" },
        ],
      },
      { key: "link", label_ar: "الوجهة", type: "link" },
    ],
  },
  {
    type: "campaign_mosaic",
    name_ar: "فسيفساء إعلانات",
    description_ar: "شبكة إعلانات بأحجام متفاوتة تُقرأ من الحملات النشطة.",
    icon: "layout-grid",
    fields: [
      TITLE_FIELD,
      { key: "limit", label_ar: "عدد الإعلانات", type: "number", default: 5, min: 3, max: 9 },
      {
        key: "pattern",
        label_ar: "النمط",
        type: "select",
        default: "wide_first",
        options: [
          { value: "wide_first", label_ar: "الأولى عريضة" },
          { value: "even", label_ar: "متساوية" },
        ],
      },
    ],
  },
  {
    type: "sponsored_banner",
    name_ar: "بانر ممول",
    description_ar: "إعلان مفرد موسوم «ممول» بصورة من فتحة وسائط.",
    icon: "badge-dollar-sign",
    fields: [
      { key: "slot_key", label_ar: "فتحة الصورة", type: "slot" },
      TITLE_FIELD,
      { key: "link", label_ar: "الوجهة", type: "link" },
      { key: "show_label", label_ar: "إظهار وسم «ممول»", type: "boolean", default: true },
    ],
  },
  {
    type: "category_grid",
    name_ar: "شبكة تصنيفات",
    description_ar: "بلاطات الأقسام المربعة بأيقونات خطية، تُقرأ من شجرة الأقسام.",
    icon: "grid-3x3",
    fields: [
      TITLE_FIELD,
      { key: "parent_slug", label_ar: "القسم الأب", type: "text", hint_ar: "اتركه فارغًا للأقسام الرئيسية" },
      { key: "limit", label_ar: "عدد البلاطات", type: "number", default: 8, min: 4, max: 16 },
      {
        key: "columns",
        label_ar: "الأعمدة",
        type: "select",
        default: "4",
        options: [
          { value: "3", label_ar: "٣" },
          { value: "4", label_ar: "٤" },
        ],
      },
    ],
  },
  {
    type: "listing_rail",
    name_ar: "صف أفقي",
    description_ar: "صف إعلانات أفقي قابل للتمرير مع رابط «الكل».",
    icon: "gallery-horizontal",
    fields: [
      TITLE_FIELD,
      {
        key: "source",
        label_ar: "المصدر",
        type: "select",
        default: "newest",
        options: [
          { value: "newest", label_ar: "الأحدث" },
          { value: "featured", label_ar: "المميزة" },
          { value: "nearby", label_ar: "الأقرب إليك" },
          { value: "category", label_ar: "قسم محدد" },
        ],
      },
      { key: "category_slug", label_ar: "القسم", type: "text" },
      { key: "limit", label_ar: "عدد البطاقات", type: "number", default: 10, min: 4, max: 20 },
      { key: "link", label_ar: "رابط «الكل»", type: "link" },
    ],
  },
  {
    type: "type_cards",
    name_ar: "بطاقات أنواع",
    description_ar: "فسيفساء أنواع (عقار/خدمة) الأولى منها عريضة بعمودين.",
    icon: "layout-panel-top",
    fields: [
      TITLE_FIELD,
      { key: "limit", label_ar: "عدد البطاقات", type: "number", default: 6, min: 3, max: 12 },
      { key: "wide_first", label_ar: "الأولى بعمودين", type: "boolean", default: true },
    ],
  },
  {
    type: "city_circles",
    name_ar: "مدن",
    description_ar: "دوائر المدن للهبوط السريع على نتائج المدينة.",
    icon: "map-pin",
    fields: [
      TITLE_FIELD,
      { key: "limit", label_ar: "عدد المدن", type: "number", default: 8, min: 4, max: 16 },
    ],
  },
  {
    type: "link_tile",
    name_ar: "رابط مخصص",
    description_ar: "بلاطة رابط واحدة — وجهة داخلية أو خارجية.",
    icon: "link",
    fields: [
      TITLE_FIELD,
      SUBTITLE_FIELD,
      { key: "link", label_ar: "الوجهة", type: "link" },
      {
        key: "tone",
        label_ar: "النغمة",
        type: "select",
        default: "brand",
        options: [
          { value: "brand", label_ar: "هوية" },
          { value: "gold", label_ar: "ذهبي" },
          { value: "surface", label_ar: "بطاقة بيضاء" },
        ],
      },
    ],
  },
  {
    type: "design_banner",
    name_ar: "بانر «تصاميمي»",
    description_ar: "بانر من قوالب التصاميم الموسومة باسم كَحيل مع الختم التلقائي.",
    icon: "palette",
    fields: [
      { key: "template_id", label_ar: "قالب التصميم", type: "text" },
      TITLE_FIELD,
      { key: "link", label_ar: "الوجهة", type: "link" },
    ],
  },
  {
    type: "spacer",
    name_ar: "فاصل مسافة",
    description_ar: "مسافة رأسية بمقاسات ثابتة تحفظ إيقاع الصفحة.",
    icon: "move-vertical",
    fields: [
      {
        key: "size",
        label_ar: "المقاس",
        type: "select",
        default: "md",
        options: [
          { value: "sm", label_ar: "صغير" },
          { value: "md", label_ar: "متوسط" },
          { value: "lg", label_ar: "كبير" },
        ],
      },
      { key: "divider", label_ar: "خط فاصل", type: "boolean", default: false },
    ],
  },
  {
    type: "shape_layer",
    name_ar: "طبقة أشكال",
    description_ar: "شكل زخرفي من المكتبة بموضع ودوران وشفافية — خلف المحتوى دائمًا.",
    icon: "shapes",
    fields: [
      { key: "shape_key", label_ar: "الشكل", type: "shape" },
      { key: "anchor", label_ar: "الموضع", type: "anchor", default: "top-end" },
      { key: "rotation", label_ar: "الدوران", type: "number", default: 0, min: 0, max: 350 },
      { key: "scale", label_ar: "الحجم %", type: "number", default: 100, min: 25, max: 200 },
      { key: "opacity", label_ar: "الشفافية %", type: "number", default: 12, min: 4, max: 60 },
      {
        key: "tone",
        label_ar: "اللون",
        type: "select",
        default: "brand",
        options: [
          { value: "brand", label_ar: "بنفسجي" },
          { value: "gold", label_ar: "ذهبي" },
          { value: "surface", label_ar: "محايد" },
        ],
      },
    ],
  },
];

export function blockDefinition(type: string): BlockDefinition | undefined {
  return BLOCK_LIBRARY.find((b) => b.type === type);
}

/** إعدادات ابتدائية لكتلة جديدة من تعريفها. */
export function defaultSettings(type: BlockType): BlockSettings {
  const def = blockDefinition(type);
  const out: BlockSettings = {};
  for (const field of def?.fields ?? []) {
    if (field.default !== undefined) out[field.key] = field.default;
  }
  return out;
}

// ── نوع الصف ───────────────────────────────────────────────────────────────

export type BlockSettings = Record<string, unknown>;

export interface PageBlock {
  id: string;
  page: string;
  block_type: BlockType;
  settings: BlockSettings;
  sort_order: number;
  hidden: boolean;
  deleted_at: string | null;
  updated_at: string;
}

export interface PageComposition {
  id: string;
  page: string;
  name_ar: string;
  kind: string;
  block_count: number;
  created_at: string;
}

const BLOCK_COLUMNS = "id, page, block_type, settings, sort_order, hidden, deleted_at, updated_at";

export const PAGE_BLOCKS_QUERY_KEY = ["mkt", "page-blocks"] as const;
export const PAGE_COMPOSITIONS_QUERY_KEY = ["mkt", "page-compositions"] as const;

/** كتل العرض العام: المرئية غير المحذوفة فقط. */
export async function fetchPageBlocks(page: string): Promise<PageBlock[]> {
  const { data, error } = await supabase
    .from("mkt_page_blocks")
    .select(BLOCK_COLUMNS)
    .eq("page", page)
    .is("deleted_at", null)
    .eq("hidden", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PageBlock[];
}

/** كتل الإدارة: تشمل المخفية والمحذوفة ناعمًا لإتاحة الاسترجاع. */
export async function fetchAllPageBlocks(page: string): Promise<PageBlock[]> {
  const { data, error } = await supabase
    .from("mkt_page_blocks")
    .select(BLOCK_COLUMNS)
    .eq("page", page)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PageBlock[];
}

export async function fetchPageCompositions(page: string): Promise<PageComposition[]> {
  const { data, error } = await supabase
    .from("mkt_page_compositions")
    .select("id, page, name_ar, kind, block_count, created_at")
    .eq("page", page)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PageComposition[];
}

/**
 * كتل صفحة عامة. `fallbackEmpty` مقصود: إن لم تُؤلَّف الصفحة بعد أو تعذّرت
 * القراءة، تعود الصفحة إلى تركيبها المكتوب في الكود بلا شاشة فارغة.
 */
export function usePageBlocks(page: string) {
  return useQuery({
    queryKey: [...PAGE_BLOCKS_QUERY_KEY, page],
    queryFn: () => fetchPageBlocks(page),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

export function useAllPageBlocks(page: string) {
  return useQuery({
    queryKey: [...PAGE_BLOCKS_QUERY_KEY, "all", page],
    queryFn: () => fetchAllPageBlocks(page),
    staleTime: 15_000,
  });
}

export function usePageCompositions(page: string) {
  return useQuery({
    queryKey: [...PAGE_COMPOSITIONS_QUERY_KEY, page],
    queryFn: () => fetchPageCompositions(page),
    staleTime: 15_000,
  });
}

// ── الكتابة: كلها عبر دوال القاعدة المحمية بـ mkt_is_platform_admin ────────

export async function saveBlock(input: {
  id?: string | null;
  page: string;
  block_type: BlockType;
  settings?: BlockSettings;
  sort_order?: number | null;
  hidden?: boolean | null;
}): Promise<PageBlock> {
  // القاعدة تفسّر الحقول الغائبة كـ «لا تغيير»، لذا نحذفها بدل إرسال null.
  const args: Record<string, unknown> = {
    _page: input.page,
    _block_type: input.block_type,
    _settings: input.settings ?? {},
  };
  if (input.id) args["_id"] = input.id;
  if (typeof input.sort_order === "number") args["_sort_order"] = input.sort_order;
  if (typeof input.hidden === "boolean") args["_hidden"] = input.hidden;

  const { data, error } = await supabase.rpc(
    "mkt_admin_page_block_save",
    args as never,
  );
  if (error) throw error;
  return data as unknown as PageBlock;
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_page_block_delete", { _id: id });
  if (error) throw error;
}

export async function restoreBlock(id: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_page_block_restore", { _id: id });
  if (error) throw error;
}

export async function reorderBlocks(page: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_page_blocks_reorder", { _page: page, _ids: ids });
  if (error) throw error;
}

export async function saveComposition(page: string, name_ar: string): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_page_composition_save", {
    _page: page,
    _name_ar: name_ar,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function applyComposition(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_admin_page_composition_apply", { _id: id });
  if (error) throw error;
  return (data as unknown as number) ?? 0;
}

/** كل عمليات الكتابة مع إبطال الكاش الصحيح — للعرض العام والإدارة معًا. */
export function useComposerMutations(page: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: PAGE_BLOCKS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PAGE_COMPOSITIONS_QUERY_KEY });
  };

  return {
    save: useMutation({ mutationFn: saveBlock, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteBlock, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: restoreBlock, onSuccess: invalidate }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorderBlocks(page, ids),
      onSuccess: invalidate,
    }),
    snapshot: useMutation({
      mutationFn: (name_ar: string) => saveComposition(page, name_ar),
      onSuccess: invalidate,
    }),
    apply: useMutation({ mutationFn: applyComposition, onSuccess: invalidate }),
  };
}

// ── مساعدات القراءة الآمنة للإعدادات ──────────────────────────────────────

export function str(settings: BlockSettings, key: string, fallback = ""): string {
  const v = settings[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

export function num(settings: BlockSettings, key: string, fallback: number): number {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function bool(settings: BlockSettings, key: string, fallback = false): boolean {
  const v = settings[key];
  return typeof v === "boolean" ? v : fallback;
}

/** رابط الكتلة: داخلي من ROUTE_MAP أو خارجي https فقط. */
export interface BlockLink {
  href: string;
  external: boolean;
}

export function blockLink(settings: BlockSettings, key = "link"): BlockLink | null {
  const raw = str(settings, key);
  if (!raw) return null;
  if (raw.startsWith("/")) return { href: raw, external: false };
  if (raw.startsWith("https://")) return { href: raw, external: true };
  return null;
}
