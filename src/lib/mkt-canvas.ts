/**
 * استوديو الرسم — طبقة البيانات وحدودها الصارمة.
 *
 * كل تصميم = لوح بنسبة ثابتة + قائمة عناصر. إحداثيات كل عنصر **نِسَب مئوية**
 * من اللوح (x/y/w/h) وزاوية بالدرجات، فيظهر التصميم نفسه على أي عرض شاشة.
 *
 * ضوابط مقصودة (تُفحَص هنا وفي القاعدة معًا):
 *  • لا HTML ولا CSS حر أبدًا — العنصر إمّا نص عادي، أو شكل من مكتبة الأشكال،
 *    أو صورة من فتحات الوسائط، أو ملصق شخصية معتمدة. لا مسار صورة حر.
 *  • الألوان من رموز اللوحة المفعّلة فقط (+ أبيض/أسود)، لا قيمة لون مكتوبة.
 *  • حد ٤٠ عنصرًا للتصميم، و٣ عناصر نص كحد أقصى.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { applyKaheelWatermark } from "@/lib/kaheel-watermark";
import { MEDIA_SLOT_BUCKET } from "@/lib/mkt-media-slots";
import { shapeDataUri, type DesignShape } from "@/lib/mkt-design-library";
import { mascotAsset, type MascotName } from "@/lib/mascot-assets";

// ── اللوح ──────────────────────────────────────────────────────────────────

export const ARTBOARDS = [
  { ratio: "16/5", label_ar: "بانر عريض 16:5", w: 1280, h: 400 },
  { ratio: "4/3", label_ar: "بطاقة 4:3", w: 1080, h: 810 },
  { ratio: "1/1", label_ar: "مربع 1:1", w: 1080, h: 1080 },
  { ratio: "9/16", label_ar: "ستوري 9:16", w: 720, h: 1280 },
  { ratio: "16/7", label_ar: "هيرو 16:7", w: 1280, h: 560 },
] as const;

export type ArtboardRatio = (typeof ARTBOARDS)[number]["ratio"];

export function artboard(ratio: string) {
  return ARTBOARDS.find((a) => a.ratio === ratio) ?? ARTBOARDS[0];
}

/** عرض مرجعي للنص: حجم الخط محفوظ بالبكسل على لوح بعرض 1200، ويُقاس بـ cqw. */
export const TEXT_REF_WIDTH = 1200;

// ── الألوان المسموحة ───────────────────────────────────────────────────────

export const CANVAS_COLORS = [
  { key: "primary", label_ar: "الأساس", css: "var(--primary)" },
  { key: "primary-foreground", label_ar: "على الأساس", css: "var(--primary-foreground)" },
  { key: "accent", label_ar: "التمييز", css: "var(--accent)" },
  { key: "accent-foreground", label_ar: "على التمييز", css: "var(--accent-foreground)" },
  { key: "foreground", label_ar: "النص", css: "var(--foreground)" },
  { key: "muted-foreground", label_ar: "نص خفيف", css: "var(--muted-foreground)" },
  { key: "card", label_ar: "البطاقة", css: "var(--card)" },
  { key: "border", label_ar: "الحدود", css: "var(--border)" },
  { key: "white", label_ar: "أبيض", css: "#ffffff" },
  { key: "black", label_ar: "أسود", css: "#000000" },
] as const;

export type CanvasColor = (typeof CANVAS_COLORS)[number]["key"];

export function colorCss(key: string): string {
  return CANVAS_COLORS.find((c) => c.key === key)?.css ?? "var(--foreground)";
}

/** يحوّل رمز اللوحة إلى قيمة rgb() فعلية — تحتاجها لوحة الرسم النقطية. */
export function resolveColor(key: string): string {
  const css = colorCss(key);
  if (css.startsWith("#")) return css;
  if (typeof document === "undefined") return "#000000";
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color || "#000000";
  probe.remove();
  return value;
}

// ── العناصر ────────────────────────────────────────────────────────────────

interface Base {
  id: string;
  /** نِسَب مئوية من اللوح. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** درجات. */
  rot: number;
  /** مخفي في المعاينة والتصدير. */
  hidden?: boolean;
  /** مقفل — لا يُسحب ولا يُحجَّم بالخطأ. */
  lock?: boolean;
}

export interface TextElement extends Base {
  kind: "text";
  text: string;
  size: number;
  weight: 400 | 700 | 800;
  color: string;
  align: "start" | "center" | "end";
}

export interface ShapeElement extends Base {
  kind: "shape";
  shape_key: string;
  color: string;
  opacity: number;
}

export interface ImageElement extends Base {
  kind: "image";
  /** مفتاح فتحة وسائط — لا مسار حر. */
  slot_key: string;
  fit: "cover" | "contain";
  radius: number;
}

export interface MascotElement extends Base {
  kind: "mascot";
  name: MascotName;
  flip: boolean;
}

export type CanvasElement = TextElement | ShapeElement | ImageElement | MascotElement;

export const MAX_ELEMENTS = 40;
export const MAX_TEXT_ELEMENTS = 3;
export const TEXT_SIZE_MIN = 14;
export const TEXT_SIZE_MAX = 48;

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
};

const safeText = (v: unknown): string =>
  String(v ?? "")
    .replace(/[<>]/g, "")
    .slice(0, 60);

const KEY_SAFE = /^[a-z0-9._-]{1,120}$/i;

/** تنقية عنصر واحد. أي عنصر لا يطابق المخطط يُسقَط بلا خطأ. */
function sanitizeElement(raw: unknown, index: number): CanvasElement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base: Base = {
    id: KEY_SAFE.test(String(r["id"] ?? "")) ? String(r["id"]) : `el-${index}-${Date.now()}`,
    x: clamp(r["x"], -20, 120, 10),
    y: clamp(r["y"], -20, 120, 10),
    w: clamp(r["w"], 2, 140, 30),
    h: clamp(r["h"], 2, 140, 20),
    rot: clamp(r["rot"], -180, 180, 0),
    ...(r["hidden"] === true ? { hidden: true } : {}),
    ...(r["lock"] === true ? { lock: true } : {}),
  };
  const colorKey = (v: unknown, fallback: string) =>
    CANVAS_COLORS.some((c) => c.key === v) ? String(v) : fallback;

  switch (r["kind"]) {
    case "text": {
      const text = safeText(r["text"]);
      if (!text) return null;
      const weight = [400, 700, 800].includes(Number(r["weight"])) ? (Number(r["weight"]) as 400 | 700 | 800) : 700;
      const align = ["start", "center", "end"].includes(String(r["align"]))
        ? (String(r["align"]) as TextElement["align"])
        : "center";
      return {
        ...base,
        kind: "text",
        text,
        size: clamp(r["size"], TEXT_SIZE_MIN, TEXT_SIZE_MAX, 28),
        weight,
        color: colorKey(r["color"], "foreground"),
        align,
      };
    }
    case "shape": {
      const key = String(r["shape_key"] ?? "");
      if (!KEY_SAFE.test(key)) return null;
      return {
        ...base,
        kind: "shape",
        shape_key: key,
        color: colorKey(r["color"], "primary"),
        opacity: clamp(r["opacity"], 5, 100, 100),
      };
    }
    case "image": {
      const key = String(r["slot_key"] ?? "");
      if (!KEY_SAFE.test(key)) return null;
      return {
        ...base,
        kind: "image",
        slot_key: key,
        fit: r["fit"] === "contain" ? "contain" : "cover",
        radius: clamp(r["radius"], 0, 50, 0),
      };
    }
    case "mascot": {
      const name = r["name"] === "kaheelan" ? "kaheelan" : "kaheel";
      return { ...base, kind: "mascot", name, flip: r["flip"] === true };
    }
    default:
      return null;
  }
}

/** تنقية قائمة العناصر بالكامل مع فرض السقوف. */
export function sanitizeElements(raw: unknown): CanvasElement[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: CanvasElement[] = [];
  let texts = 0;
  for (const [index, item] of list.entries()) {
    const element = sanitizeElement(item, index);
    if (!element) continue;
    if (element.kind === "text") {
      if (texts >= MAX_TEXT_ELEMENTS) continue;
      texts += 1;
    }
    out.push(element);
    if (out.length >= MAX_ELEMENTS) break;
  }
  return out;
}

// ── الصفوف ─────────────────────────────────────────────────────────────────

export interface CanvasDesignRow {
  id: string;
  name: string;
  artboard_ratio: string;
  elements: unknown;
  preview_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CanvasDesign extends Omit<CanvasDesignRow, "elements"> {
  elements: CanvasElement[];
  previewUrl: string | null;
}

const COLUMNS = "id, name, artboard_ratio, elements, preview_path, created_at, updated_at, deleted_at";

export const CANVAS_QUERY_KEY = ["mkt", "canvas-designs"] as const;

/** روابط موقّعة لمعاينات التصاميم (نفس أسلوب فتحات الوسائط). */
async function signPreviews(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const { data } = await supabase.storage.from(MEDIA_SLOT_BUCKET).createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

export async function fetchCanvasDesigns(includeDeleted = false): Promise<CanvasDesign[]> {
  let query = supabase.from("mkt_canvas_designs").select(COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (!includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CanvasDesignRow[];
  const signed = await signPreviews(
    [...new Set(rows.map((r) => r.preview_path).filter((p): p is string => !!p))],
  );
  return rows.map((row) => ({
    ...row,
    elements: sanitizeElements(row.elements),
    previewUrl: row.preview_path ? signed[row.preview_path] ?? null : null,
  }));
}

export function useCanvasDesigns(includeDeleted = false) {
  return useQuery({
    queryKey: [...CANVAS_QUERY_KEY, includeDeleted],
    queryFn: () => fetchCanvasDesigns(includeDeleted),
    staleTime: 30_000,
  });
}

export async function saveCanvasDesign(input: {
  id?: string | null;
  name: string;
  artboard_ratio: ArtboardRatio;
  elements: CanvasElement[];
}): Promise<CanvasDesignRow> {
  const payload = {
    name: input.name.replace(/[<>]/g, "").slice(0, 80) || "تصميم بلا اسم",
    artboard_ratio: input.artboard_ratio,
    elements: sanitizeElements(input.elements) as unknown as never,
  };
  const query = input.id
    ? supabase.from("mkt_canvas_designs").update(payload).eq("id", input.id).select(COLUMNS).single()
    : supabase.from("mkt_canvas_designs").insert(payload).select(COLUMNS).single();
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as CanvasDesignRow;
}

export async function softDeleteCanvasDesign(id: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_canvas_designs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreCanvasDesign(id: string): Promise<void> {
  const { error } = await supabase.from("mkt_canvas_designs").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export function useCanvasMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CANVAS_QUERY_KEY });
  };
  return {
    save: useMutation({ mutationFn: saveCanvasDesign, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: softDeleteCanvasDesign, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: restoreCanvasDesign, onSuccess: invalidate }),
  };
}

// ── التصدير النقطي ─────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

function withTransform(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number; rot: number },
  draw: (w: number, h: number) => void,
) {
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.translate(-box.w / 2, -box.h / 2);
  draw(box.w, box.h);
  ctx.restore();
}

/**
 * يرسم التصميم على لوحة نقطية ثم يعيده WebP مختومًا بعلامة كَحيل.
 * الصور تُقرأ من روابط الفتحات الموقّعة التي تمرّرها الشاشة.
 */
export async function rasterizeDesign(input: {
  elements: CanvasElement[];
  ratio: string;
  shapes: DesignShape[];
  slotUrls: Record<string, string>;
  stamp?: boolean;
}): Promise<Blob> {
  const board = artboard(input.ratio);
  const canvas = document.createElement("canvas");
  canvas.width = board.w;
  canvas.height = board.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.fillStyle = resolveColor("card");
  ctx.fillRect(0, 0, board.w, board.h);

  const px = (element: CanvasElement) => ({
    x: (element.x / 100) * board.w,
    y: (element.y / 100) * board.h,
    w: (element.w / 100) * board.w,
    h: (element.h / 100) * board.h,
    rot: element.rot,
  });

  for (const element of input.elements) {
    if (element.hidden) continue;
    const box = px(element);
    if (element.kind === "image" || element.kind === "mascot") {
      const src =
        element.kind === "image"
          ? input.slotUrls[element.slot_key]
          : mascotAsset(element.name, "full").src;
      if (!src) continue;
      let img: HTMLImageElement;
      try {
        img = await loadImage(src);
      } catch {
        continue;
      }
      withTransform(ctx, box, (w, h) => {
        if (element.kind === "mascot" && element.flip) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        const fit = element.kind === "image" ? element.fit : "contain";
        const scale =
          fit === "cover"
            ? Math.max(w / img.width, h / img.height)
            : Math.min(w / img.width, h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      });
      continue;
    }

    if (element.kind === "shape") {
      const shape = input.shapes.find((s) => s.key === element.shape_key);
      if (!shape) continue;
      const uri = shapeDataUri(shape, "#000000", 100);
      if (!uri) continue;
      const src = uri.slice(5, -2);
      let img: HTMLImageElement;
      try {
        img = await loadImage(src);
      } catch {
        continue;
      }
      withTransform(ctx, box, (w, h) => {
        ctx.globalAlpha = element.opacity / 100;
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = resolveColor(element.color);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      });
      continue;
    }

    withTransform(ctx, box, (w, h) => {
      const size = (element.size / TEXT_REF_WIDTH) * board.w;
      ctx.direction = "rtl";
      ctx.font = `${element.weight} ${size}px "Tajawal", "Cairo", system-ui, sans-serif`;
      ctx.fillStyle = resolveColor(element.color);
      ctx.textBaseline = "middle";
      ctx.textAlign = element.align === "center" ? "center" : element.align === "start" ? "right" : "left";
      const tx = element.align === "center" ? w / 2 : element.align === "start" ? w : 0;
      ctx.fillText(element.text, tx, h / 2, w);
    });
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
  );
  if (!blob) throw new Error("encode_failed");
  return input.stamp === false ? blob : applyKaheelWatermark(blob);
}

export const CANVAS_PREVIEW_PREFIX = "public/canvas";

/** يرفع المعاينة المصدّرة ويربطها بالتصميم. الملف القديم يُحذف بعد النجاح فقط. */
export async function uploadDesignPreview(design: { id: string; preview_path: string | null }, blob: Blob) {
  const path = `${CANVAS_PREVIEW_PREFIX}/${design.id}-${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from(MEDIA_SLOT_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { error: linkError } = await supabase
    .from("mkt_canvas_designs")
    .update({ preview_path: path })
    .eq("id", design.id);
  if (linkError) {
    await supabase.storage.from(MEDIA_SLOT_BUCKET).remove([path]).catch(() => undefined);
    throw linkError;
  }
  if (design.preview_path && design.preview_path !== path) {
    await supabase.storage.from(MEDIA_SLOT_BUCKET).remove([design.preview_path]).catch(() => undefined);
  }
  return path;
}
