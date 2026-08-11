/**
 * قراءة وكتابة لوحة ألوان المنصة.
 *
 * القراءة العامة: استعلام واحد مخزَّن (`mkt_theme_active`) يعيد رموز اللوحة
 * المفعّلة لكل زائر. الكتابة والتفعيل يمران بدوال SECURITY DEFINER تتحقق من
 * صفة مدير المنصة في القاعدة وتسجّل كل تغيير (من/متى/قديم/جديد).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  normalizeDesignTokens,
  normalizeTokens,
  type ThemeTokenMap,
} from "@/lib/theme-tokens";

export const THEME_QUERY_KEY = ["mkt", "theme", "active"] as const;
export const THEME_PALETTES_KEY = ["mkt", "theme", "palettes"] as const;

export interface ThemePaletteRow {
  id: string;
  name_ar: string;
  is_active: boolean;
  is_builtin: boolean;
  updated_at: string;
  tokens: ThemeTokenMap;
}

/** رموز اللوحة المفعّلة — استعلام واحد لكل زيارة. */
export function useActiveTheme() {
  return useQuery({
    queryKey: THEME_QUERY_KEY,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc("mkt_theme_active" as never);
      if (error) throw error;
      return (data ?? {}) as unknown as Record<string, unknown>;
    },
    // نفس المخزن يخدم الألوان ورموز التصميم — الاشتقاق في `select` لا في `queryFn`.
    select: (raw): ThemeTokenMap => normalizeTokens(raw),
  });
}


/** كل اللوحات المحفوظة — لشاشة الإدارة فقط. */
export function useThemePalettes(enabled = true) {
  return useQuery({
    queryKey: THEME_PALETTES_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ThemePaletteRow[]> => {
      const { data, error } = await supabase.rpc("mkt_theme_palette_list" as never);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        name_ar: String(row["name_ar"] ?? ""),
        is_active: row["is_active"] === true,
        is_builtin: row["is_builtin"] === true,
        updated_at: String(row["updated_at"] ?? ""),
        tokens: normalizeTokens(row["tokens"] as Record<string, unknown>),
      }));
    },
  });
}

export async function saveThemePalette(input: {
  paletteId: string | null;
  nameAr: string;
  tokens: ThemeTokenMap;
  activate: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc(
    "mkt_theme_palette_save" as never,
    {
      _palette_id: input.paletteId,
      _name_ar: input.nameAr,
      _tokens: input.tokens,
      _activate: input.activate,
    } as never,
  );
  if (error) throw error;
  return String(data);
}

export async function activateThemePalette(paletteId: string): Promise<void> {
  const { error } = await supabase.rpc(
    "mkt_theme_palette_activate" as never,
    { _palette_id: paletteId } as never,
  );
  if (error) throw error;
}

export async function resetThemeToDefault(): Promise<void> {
  const { error } = await supabase.rpc("mkt_theme_reset_default" as never);
  if (error) throw error;
}

export async function deleteThemePalette(paletteId: string): Promise<void> {
  const { error } = await supabase.rpc(
    "mkt_theme_palette_delete" as never,
    { _palette_id: paletteId } as never,
  );
  if (error) throw error;
}

/** يفرّغ مخزن اللوحة بعد أي تغيير فيسري اللون فورًا في كل الشاشة. */
export function useRefreshTheme() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: THEME_QUERY_KEY });
    void client.invalidateQueries({ queryKey: THEME_PALETTES_KEY });
  };
}

export function useThemeMutation<TInput>(run: (input: TInput) => Promise<unknown>) {
  const refresh = useRefreshTheme();
  return useMutation({
    mutationFn: run,
    onSuccess: () => refresh(),
  });
}

// ── رموز التصميم غير اللونية (خطوط/أحجام/استدارات/ظلال/تباعد) ───────────────
//
// نفس الجدول ونفس اللوحة المفعّلة: `mkt_theme_active` يعيد كل الرموز، فالقراءة
// العامة لا تضيف استعلامًا. الكتابة تمر بدوال المسودة ثم التطبيق.

export const THEME_TOKEN_ROWS_KEY = ["mkt", "theme", "token-rows"] as const;

export interface ThemeTokenRow {
  palette_id: string;
  token_key: string;
  category: string;
  value: string;
  draft_value: string | null;
}

/** رموز التصميم المفعّلة — مشتقّة من نفس مخزن اللوحة. */
export function useActiveDesignTokens() {
  const theme = useQuery({
    queryKey: THEME_QUERY_KEY,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc("mkt_theme_active" as never);
      if (error) throw error;
      return (data ?? {}) as unknown as Record<string, unknown>;
    },
    select: (raw) => normalizeDesignTokens(raw),
  });
  return theme;
}

/** صفوف الرموز مع مسوداتها — لشاشة الإدارة فقط. */
export function useThemeTokenRows(enabled = true) {
  return useQuery({
    queryKey: THEME_TOKEN_ROWS_KEY,
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<ThemeTokenRow[]> => {
      const { data, error } = await supabase.rpc("mkt_theme_tokens_admin" as never, {
        _palette_id: null,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        palette_id: String(row["palette_id"] ?? ""),
        token_key: String(row["token_key"] ?? ""),
        category: String(row["category"] ?? "color"),
        value: String(row["value"] ?? ""),
        draft_value: row["draft_value"] === null ? null : String(row["draft_value"]),
      }));
    },
  });
}

export async function setDesignTokenDraft(input: {
  tokenKey: string;
  category: string;
  draft: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_theme_token_draft_set" as never, {
    _palette_id: null,
    _token_key: input.tokenKey,
    _category: input.category,
    _draft: input.draft,
  } as never);
  if (error) throw error;
}

/** يعتمد المسودات: تصبح القيم الفعلية ويُسجَّل كل تغيير. */
export async function applyDesignTokenDrafts(): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_theme_tokens_apply" as never, {
    _palette_id: null,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

export async function discardDesignTokenDrafts(): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_theme_tokens_discard" as never, {
    _palette_id: null,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

/** يفرّغ مخزن الرموز بعد الاعتماد أو التخلي. */
export function useRefreshThemeTokens() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: THEME_TOKEN_ROWS_KEY });
    void client.invalidateQueries({ queryKey: THEME_QUERY_KEY });
  };
}
