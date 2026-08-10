/**
 * الهيكل الشجري للأقسام: قسم رئيسي (له عالمه على `/c/{slug}`) ← أقسام فرعية.
 *
 * كل عمليات التعديل تمرّ بدوال `SECURITY DEFINER` في القاعدة
 * (`mkt_admin_category_*`) فلا تُكتب الأقسام من المتصفح مباشرة، وكل عملية
 * تُسجَّل في `mkt_category_audit`. لا حذف فعلي: الدمج يخفي المصدر بحذف ناعم
 * ويترك تحويل 301 في `mkt_category_redirects`.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface CategoryNode {
  id: string;
  parent_id: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  is_primary: boolean;
  cover_slot_key: string | null;
  tagline_ar: string | null;
  deleted_at: string | null;
  merged_into_id: string | null;
}

export interface CategoryAuditRow {
  id: string;
  action: string;
  source_slug: string | null;
  target_slug: string | null;
  moved_listings: number;
  moved_children: number;
  created_at: string;
  actor_id: string | null;
}

const COLUMNS =
  "id, parent_id, slug, name_ar, name_en, icon, sort_order, is_active, is_primary, " +
  "cover_slot_key, tagline_ar, deleted_at, merged_into_id";

/** كل الأقسام الظاهرة (بلا المدموجة) — للواجهة العامة. */
export async function loadCategoryTree(): Promise<CategoryNode[]> {
  const { data, error } = await supabase
    .from("mkt_categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order")
    .order("name_ar");
  if (error) throw error;
  return (data ?? []) as unknown as CategoryNode[];
}

/** كل الأقسام بما فيها المعطّلة والمدموجة — لشاشة الإدارة. */
export async function loadCategoryTreeAdmin(): Promise<CategoryNode[]> {
  const { data, error } = await supabase
    .from("mkt_categories")
    .select(COLUMNS)
    .order("sort_order")
    .order("name_ar");
  if (error) throw error;
  return (data ?? []) as unknown as CategoryNode[];
}

/** الأقسام الرئيسية الفعلية — مصدر بلاطات الصفحة الرئيسية. */
export function primaryCategories(rows: CategoryNode[]): CategoryNode[] {
  return rows.filter((row) => row.is_primary && !row.deleted_at && row.is_active);
}

export function childrenOf(rows: CategoryNode[], parentId: string): CategoryNode[] {
  return rows.filter((row) => row.parent_id === parentId && !row.deleted_at && row.is_active);
}

export function categoryName(row: CategoryNode, locale: string): string {
  return locale === "ar" ? row.name_ar : row.name_en || row.name_ar;
}

export function useCategoryTree(admin = false) {
  return useQuery({
    queryKey: ["mkt", "category-tree", admin ? "admin" : "public"],
    staleTime: 60_000,
    queryFn: () => (admin ? loadCategoryTreeAdmin() : loadCategoryTree()),
  });
}

/** عدد إعلانات كل قسم — لتأكيد حجم عملية الدمج قبل تنفيذها. */
export async function loadCategoryListingCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("mkt_listings")
    .select("category_id")
    .is("deleted_at", null)
    .limit(5000);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { category_id: string | null }[]) {
    if (row.category_id) out[row.category_id] = (out[row.category_id] ?? 0) + 1;
  }
  return out;
}

/* ------------------------------------------------------------ عمليات الإدارة */

export async function createCategory(input: {
  parentId: string | null;
  slug: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  taglineAr?: string;
  sortOrder?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_category_upsert", {
    _parent_id: input.parentId,
    _slug: input.slug,
    _name_ar: input.nameAr,
    _name_en: input.nameEn ?? input.nameAr,
    _icon: input.icon ?? undefined,
    _tagline_ar: input.taglineAr ?? undefined,
    _sort_order: input.sortOrder ?? 0,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function renameCategory(input: {
  id: string;
  nameAr: string;
  nameEn?: string;
  taglineAr?: string;
  sortOrder?: number;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_category_upsert", {
    _id: input.id,
    _name_ar: input.nameAr,
    _name_en: input.nameEn ?? undefined,
    _tagline_ar: input.taglineAr ?? undefined,
    _sort_order: input.sortOrder ?? undefined,
  });
  if (error) throw error;
}

export async function moveCategory(id: string, parentId: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_category_move", {
    _id: id,
    _parent_id: parentId,
  });
  if (error) throw error;
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_category_set_active", {
    _id: id,
    _active: active,
  });
  if (error) throw error;
}

/** ترقية إلى رئيسي: يصبح جذرًا بعالمه وتُنشأ فتحات وسائطه تلقائيًا. */
export async function promoteCategory(id: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_category_promote", { _id: id });
  if (error) throw error;
}

/** تخفيض إلى فرعي مع تحويل 301 من مسار العالم القديم. */
export async function demoteCategory(id: string, parentId: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_category_demote", {
    _id: id,
    _parent_id: parentId,
  });
  if (error) throw error;
}

export interface MergeResult {
  moved_listings: number;
  moved_children: number;
  source: string;
  target: string;
}

/** دمج قسم في قسم: نقل الإعلانات، إخفاء ناعم للمصدر، وتحويل 301. */
export async function mergeCategories(sourceId: string, targetId: string): Promise<MergeResult> {
  const { data, error } = await supabase.rpc("mkt_admin_category_merge", {
    _source_id: sourceId,
    _target_id: targetId,
  });
  if (error) throw error;
  return data as unknown as MergeResult;
}

export async function loadCategoryAudit(limit = 40): Promise<CategoryAuditRow[]> {
  const { data, error } = await supabase
    .from("mkt_category_audit")
    .select("id, action, source_slug, target_slug, moved_listings, moved_children, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as CategoryAuditRow[];
}

/** مسار العالم أو صفحة القسم بحسب نوعه. */
export function categoryPath(row: CategoryNode): string {
  return row.is_primary ? `/c/${row.slug}` : `/categories/${row.slug}`;
}
