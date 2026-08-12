/**
 * لوحة الاستديو والمحتوى — طبقة البيانات المشتركة.
 *
 * سجل الفتحات (`mkt_editable_slots`) هو مصدر الحقيقة الوحيد لنطاق كل مكوّن:
 * `platform` (مدير المنصة)، `store`/`listing` (صاحب المتجر أو الإعلان)، و
 * `functional` (منطق مشترك: حجز، مطابقة، دفع، مسافة) — والأخير ثابت لأي أحد،
 * والقاعدة نفسها ترفض حفظه لا الواجهة.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SlotScope = "platform" | "store" | "listing" | "functional";

export interface EditableSlot {
  slot_key: string;
  scope: SlotScope;
  module: string;
  label_ar: string;
  fields: string[];
}

export interface CodeSnapshot {
  id: string;
  file_path: string;
  byte_size: number;
  existed: boolean;
  reason: string;
  created_at: string;
}

export const EDITABLE_SLOTS_KEY = ["mkt", "studio", "editable-slots"] as const;
export const CODE_SNAPSHOTS_KEY = ["mkt", "studio", "code-snapshots"] as const;
export const STORE_DESIGN_KEY = ["mkt", "studio", "store-design"] as const;

/** الحقول الحرة ممنوعة: النص يُنقّى قبل الإرسال، والقاعدة تعيد التحقق. */
export function studioText(value: string, max = 200): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on[a-z]+\s*=/gi, "")
    .slice(0, max)
    .trim();
}

export function useEditableSlots() {
  return useQuery({
    queryKey: EDITABLE_SLOTS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EditableSlot[]> => {
      const { data, error } = await supabase
        .from("mkt_editable_slots" as never)
        .select("slot_key, scope, module, label_ar, fields");
      if (error) throw error;
      return (data ?? []) as unknown as EditableSlot[];
    },
  });
}

/** خرائط سريعة: مفتاح الفتحة → نطاقها. */
export function scopeOf(slots: EditableSlot[] | undefined, slotKey: string): SlotScope | null {
  return slots?.find((slot) => slot.slot_key === slotKey)?.scope ?? null;
}

export function isFunctionalSlot(slots: EditableSlot[] | undefined, slotKey: string): boolean {
  return scopeOf(slots, slotKey) === "functional";
}

/** لقطات محرر الكود — القراءة محكومة بـ RLS للمالك وحده. */
export function useCodeSnapshots(filePath?: string) {
  return useQuery({
    queryKey: [...CODE_SNAPSHOTS_KEY, filePath ?? "all"],
    staleTime: 10_000,
    queryFn: async (): Promise<CodeSnapshot[]> => {
      let query = supabase
        .from("mkt_code_snapshots" as never)
        .select("id, file_path, byte_size, existed, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filePath) query = query.eq("file_path", filePath);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CodeSnapshot[];
    },
  });
}

// ── تصميم صفحة المتجر (صاحب المتجر) ────────────────────────────────────────

export type StorePatch = Record<string, string | number | boolean | null>;

export function useStoreDesign(storefrontId: string | undefined) {
  return useQuery({
    queryKey: [...STORE_DESIGN_KEY, storefrontId ?? "none"],
    enabled: !!storefrontId,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, StorePatch>> => {
      const { data, error } = await supabase
        .from("mkt_store_design" as never)
        .select("slot_key, patch")
        .eq("storefront_id", storefrontId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { slot_key: string; patch: StorePatch }[];
      return Object.fromEntries(rows.map((row) => [row.slot_key, row.patch ?? {}]));
    },
  });
}

export function useSaveStoreDesign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storefrontId: string; slotKey: string; patch: StorePatch }) => {
      const { data, error } = await supabase.rpc(
        "mkt_store_design_save" as never,
        {
          _storefront_id: input.storefrontId,
          _slot_key: input.slotKey,
          _patch: input.patch,
        } as never,
      );
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: STORE_DESIGN_KEY });
    },
  });
}

const STUDIO_ERRORS: Record<string, string> = {
  NOT_OWNER: "محرر الكود لمالك المنصة حصرًا.",
  NOT_ADMIN: "هذه العملية لمدير المنصة فقط.",
  NOT_STORE_OWNER: "لا تملك هذا المتجر — التعديل مرفوض.",
  FUNCTIONAL_SLOT_IMMUTABLE: "مكوّن وظيفي مشترك (حجز/مطابقة/دفع/مسافة) — ثابت ولا يُعدَّل.",
  SLOT_NOT_STORE_SCOPED: "هذه الفتحة ليست ضمن نطاق صفحة المتجر.",
  UNKNOWN_SLOT: "فتحة غير مسجّلة.",
  SNAPSHOT_FAILED: "تعذّر إنشاء النسخة الاحتياطية — لم يُكتب أي شيء.",
  FILESYSTEM_READONLY: "نظام ملفات هذه البيئة للقراءة فقط — الكتابة متاحة في بيئة التطوير/المعاينة.",
  PATH_DENIED: "هذا المسار محجوب (أسرار أو ملفات مولّدة أو هجرات).",
  PATH_ESCAPE: "مسار غير مقبول.",
  EXT_NOT_ALLOWED: "امتداد غير مسموح بالتحرير.",
  FILE_TOO_LARGE: "الملف أكبر من الحد المسموح (٥١٢ كيلوبايت).",
  SNAPSHOT_NOT_FOUND: "اللقطة غير موجودة.",
  SNAPSHOT_HAS_NO_CONTENT: "اللقطة لملف لم يكن موجودًا — لا محتوى لاسترجاعه.",
};

export function studioError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const key = Object.keys(STUDIO_ERRORS).find((code) => raw.includes(code));
  return key ? STUDIO_ERRORS[key]! : `تعذّر التنفيذ (${raw})`;
}
