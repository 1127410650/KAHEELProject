/**
 * تعدد التصاميم لكل صفحة (Layout Variants).
 *
 * كل صفحة رئيسية لها عدة تصاميم في `mkt_page_variants`، وواحد فقط نشط
 * (مضمون بفهرس فريد في القاعدة). التبديل من `/admin/appearance/variants`
 * يسري على كل الزوار فورًا بلا نشر ولا تعديل كود.
 *
 * منع الهزّة: التصميم النشط يُحفظ في متصفح الزائر ويُستخدم كقيمة أولية، فلا
 * يُركّب تصميم ثم يُستبدل بآخر أثناء التحميل.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const PAGE_VARIANTS_QUERY_KEY = ["mkt", "page-variants"] as const;

export interface PageVariant {
  variant_key: string;
  page: string;
  name_ar: string;
  description_ar: string;
  preview_path: string | null;
  is_active: boolean;
  sort_order: number;
}

export async function fetchPageVariants(): Promise<PageVariant[]> {
  const { data, error } = await supabase
    .from("mkt_page_variants")
    .select("variant_key, page, name_ar, description_ar, preview_path, is_active, sort_order")
    .order("page", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PageVariant[];
}

export function usePageVariants() {
  return useQuery({
    queryKey: PAGE_VARIANTS_QUERY_KEY,
    queryFn: fetchPageVariants,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

function cacheKey(page: string) {
  return `kaheel.variant.${page}`;
}

function readCached(page: string): string | null {
  try {
    return localStorage.getItem(cacheKey(page));
  } catch {
    return null;
  }
}

function writeCached(page: string, key: string): void {
  try {
    localStorage.setItem(cacheKey(page), key);
  } catch {
    /* التخزين المحلي معطّل — التصميم يبقى يعمل من القاعدة */
  }
}

/**
 * التصميم النشط لصفحة معيّنة. يعود إلى `fallback` قبل جهوز البيانات وعند أي خطأ،
 * فلا تظهر صفحة فارغة إن تعذّرت القراءة.
 */
export function useActivePageVariant(page: string, fallback: string): string {
  const cached = typeof window === "undefined" ? null : readCached(page);
  const query = useQuery({
    queryKey: [...PAGE_VARIANTS_QUERY_KEY, "active", page],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_page_variants")
        .select("variant_key")
        .eq("page", page)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      const key = data?.variant_key ?? fallback;
      writeCached(page, key);
      return key;
    },
  });
  return query.data ?? cached ?? fallback;
}

export async function activatePageVariant(page: string, variantKey: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_activate_page_variant", {
    _page: page,
    _variant_key: variantKey,
  });
  if (error) throw error;
}

export function useRefreshPageVariants() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: PAGE_VARIANTS_QUERY_KEY });
  };
}
