/**
 * الكتل المخصصة — تصميم مرسوم + مناطق نقر شفافة فوقه.
 *
 * الكتلة = صورة التصميم المصدّرة (WebP) + حتى ٦ مستطيلات شفافة بنِسَب مئوية،
 * لكل واحد وجهة واحدة: مسار داخلي من خريطة المسارات، أو رابط https خارجي.
 * لا HTML ولا CSS حر، ولا وجهة غير مصرّح بها، والنسبة محفوظة ⇒ صفر هزّة تخطيط.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MEDIA_SLOT_BUCKET } from "@/lib/mkt-media-slots";
import { ROUTE_MAP } from "@/lib/routes-map";
import { artboard } from "@/lib/mkt-canvas";

export const MAX_ZONES = 6;
/** أصغر مقاس يضمن هدف لمس ≥44px على شاشة 390px. */
export const MIN_ZONE_PCT = 12;

export interface BlockZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  label: string;
}

const KEY_SAFE = /^[a-z0-9._-]{1,120}$/i;

function internalPaths(): string[] {
  return ROUTE_MAP.filter((r) => r.is_public && !r.path.includes("$")).map((r) => r.path);
}

/** الوجهة المسموحة: مسار عام من الخريطة، أو https خارجي. */
export function isAllowedHref(href: string): boolean {
  const value = href.trim();
  if (/^https:\/\/[\w.-]+(\/[^\s<>"']*)?$/i.test(value)) return true;
  return internalPaths().includes(value);
}

export function isExternalHref(href: string): boolean {
  return /^https:\/\//i.test(href.trim());
}

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
};

export function sanitizeZones(raw: unknown): BlockZone[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: BlockZone[] = [];
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const href = String(r["href"] ?? "").trim();
    if (!isAllowedHref(href)) continue;
    out.push({
      id: KEY_SAFE.test(String(r["id"] ?? "")) ? String(r["id"]) : `zone-${index}`,
      x: clamp(r["x"], 0, 100 - MIN_ZONE_PCT, 0),
      y: clamp(r["y"], 0, 100 - MIN_ZONE_PCT, 0),
      w: clamp(r["w"], MIN_ZONE_PCT, 100, MIN_ZONE_PCT),
      h: clamp(r["h"], MIN_ZONE_PCT, 100, MIN_ZONE_PCT),
      href,
      label: String(r["label"] ?? "").replace(/[<>]/g, "").slice(0, 40) || "انتقال",
    });
    if (out.length >= MAX_ZONES) break;
  }
  return out;
}

// ── الصفوف ─────────────────────────────────────────────────────────────────

export interface CustomBlockRow {
  id: string;
  name: string;
  design_id: string;
  zones: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  mkt_canvas_designs: { artboard_ratio: string; preview_path: string | null; name: string } | null;
}

export interface CustomBlock {
  id: string;
  name: string;
  design_id: string;
  zones: BlockZone[];
  ratio: string;
  previewUrl: string | null;
  deleted_at: string | null;
  updated_at: string;
}

const COLUMNS =
  "id, name, design_id, zones, created_at, updated_at, deleted_at, mkt_canvas_designs(artboard_ratio, preview_path, name)";

export const CUSTOM_BLOCKS_QUERY_KEY = ["mkt", "custom-blocks"] as const;

export async function fetchCustomBlocks(includeDeleted = false): Promise<CustomBlock[]> {
  let query = supabase
    .from("mkt_custom_blocks")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (!includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CustomBlockRow[];

  const paths = [
    ...new Set(
      rows
        .map((row) => row.mkt_canvas_designs?.preview_path)
        .filter((p): p is string => !!p),
    ),
  ];
  const signed: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage.from(MEDIA_SLOT_BUCKET).createSignedUrls(paths, 3600);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    design_id: row.design_id,
    zones: sanitizeZones(row.zones),
    ratio: artboard(row.mkt_canvas_designs?.artboard_ratio ?? "16/5").ratio,
    previewUrl: row.mkt_canvas_designs?.preview_path
      ? signed[row.mkt_canvas_designs.preview_path] ?? null
      : null,
    deleted_at: row.deleted_at,
    updated_at: row.updated_at,
  }));
}

export function useCustomBlocks(includeDeleted = false) {
  return useQuery({
    queryKey: [...CUSTOM_BLOCKS_QUERY_KEY, includeDeleted],
    queryFn: () => fetchCustomBlocks(includeDeleted),
    staleTime: 60_000,
  });
}

export async function saveCustomBlock(input: {
  id?: string | null;
  name: string;
  design_id: string;
  zones: BlockZone[];
}): Promise<{ id: string }> {
  const payload = {
    name: input.name.replace(/[<>]/g, "").slice(0, 80) || "كتلة مخصصة",
    design_id: input.design_id,
    zones: sanitizeZones(input.zones) as unknown as never,
  };
  const query = input.id
    ? supabase.from("mkt_custom_blocks").update(payload).eq("id", input.id).select("id").single()
    : supabase.from("mkt_custom_blocks").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as { id: string };
}

export async function softDeleteCustomBlock(id: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_custom_blocks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function useCustomBlockMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CUSTOM_BLOCKS_QUERY_KEY });
  };
  return {
    save: useMutation({ mutationFn: saveCustomBlock, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: softDeleteCustomBlock, onSuccess: invalidate }),
  };
}
