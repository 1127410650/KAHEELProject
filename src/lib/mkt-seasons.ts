/**
 * الخلفيات الموسمية والعروض الحصرية.
 *
 * كل موسم صف واحد في `mkt_seasonal_backdrops` يقول: أين تُرسم الطبقة (خلف
 * الهيدر / خلف قسم المتاجر / مساحة العروض الحصرية / قسم محدّد)، وبأي صورة،
 * وبأي نمط عناصر متحركة، ومتى تبدأ ومتى تنتهي. لا كود يتغيّر عند تغيير الموسم:
 * سياسة القراءة العامة لا تُظهر إلا الصفوف النشطة التي حان وقتها ولم ينتهِ،
 * فالمسودة غير موجودة أصلًا بالنسبة للمتصفح.
 *
 * الأداء: الأبعاد مُخزّنة مع الصف، فالصورة تُرسم داخل حاوية بأبعاد صريحة —
 * صفر هزّة تخطيط حتى لو تأخّرت. الصور إما مؤشّر على شبكة التوصيل (أصل مرفق مع
 * التطبيق) أو ملف رفعه المدير في مجلد الحملات العام، ولا شيء غير ذلك (قيود
 * `CHECK` في قاعدة البيانات)، فلا يمكن توجيه الطبقة إلى مضيف خارجي.
 *
 * الحركة كلها `transform`/`opacity` في CSS، وتتوقف كليًا مع
 * `prefers-reduced-motion`.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signCampaignPaths } from "@/lib/mkt-campaigns";

export type SeasonPlacement = "header" | "stores" | "exclusive" | "section";
export type SeasonMotif =
  | "none"
  | "stars"
  | "school"
  | "lanterns"
  | "sparks"
  | "confetti"
  | "flag";

export type SeasonOverlay = "soft" | "medium" | "strong";
export type SeasonMascot = "none" | "kaheel" | "kaheelan" | "custom";
export type SeasonStatus = "draft" | "active" | "paused" | "ended";

/** كل كم ثانية تتناوب المواسم النشطة على الموضع نفسه. */
export const SEASON_ROTATE_MS = 15_000;

export interface SeasonalBackdrop {
  id: string;
  slug: string;
  label_ar: string;
  label_en: string;
  placement: SeasonPlacement;
  section_key: string;
  image_url: string | null;
  image_path: string | null;
  image_width: number;
  image_height: number;
  decor_url: string | null;
  decor_path: string | null;
  motif: SeasonMotif;
  overlay: SeasonOverlay;
  accent: string;
  mascot: SeasonMascot;
  mascot_url: string | null;
  mascot_path: string | null;
  headline_ar: string;
  headline_en: string;
  subheadline_ar: string;
  subheadline_en: string;
  priority: number;
  status: SeasonStatus;
  starts_at: string;
  ends_at: string | null;
}


export interface ResolvedSeason extends SeasonalBackdrop {
  imageUrl: string | null;
  decorUrl: string | null;
  mascotUrl: string | null;
}

export interface ExclusiveOffer {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar: string;
  subtitle_en: string;
  badge_ar: string;
  badge_en: string;
  cta_ar: string;
  cta_en: string;
  click_url: string;
  image_url: string | null;
  image_path: string | null;
  backdrop_id: string | null;
  priority: number;
  status: SeasonStatus;
  starts_at: string;
  ends_at: string | null;
}

export interface ResolvedOffer extends ExclusiveOffer {
  imageUrl: string | null;
}

const SEASON_COLUMNS =
  "id, slug, label_ar, label_en, placement, section_key, image_url, image_path, image_width, image_height, decor_url, decor_path, motif, overlay, accent, mascot, mascot_url, mascot_path, priority, status, starts_at, ends_at";

const OFFER_COLUMNS =
  "id, slug, title_ar, title_en, subtitle_ar, subtitle_en, badge_ar, badge_en, cta_ar, cta_en, click_url, image_url, image_path, backdrop_id, priority, status, starts_at, ends_at";

export const SEASON_PLACEMENTS: SeasonPlacement[] = ["header", "stores", "exclusive", "section"];

export const PLACEMENT_LABEL: Record<SeasonPlacement, [string, string]> = {
  header: ["خلف الهيدر", "Behind the header"],
  stores: ["خلف قسم المتاجر", "Behind the stores section"],
  exclusive: ["مساحة العروض الحصرية", "Exclusive offers area"],
  section: ["قسم محدّد", "A specific section"],
};

export const MOTIF_LABEL: Record<SeasonMotif, [string, string]> = {
  none: ["بلا عناصر", "No elements"],
  stars: ["نجوم تلمع", "Twinkling stars"],
  school: ["مدارس", "Back to school"],
  lanterns: ["فوانيس", "Lanterns"],
  sparks: ["بريق", "Sparks"],
  confetti: ["احتفال", "Confetti"],
};

export const OVERLAY_LABEL: Record<SeasonOverlay, [string, string]> = {
  soft: ["حجاب خفيف", "Soft scrim"],
  medium: ["حجاب متوسط", "Medium scrim"],
  strong: ["حجاب قوي", "Strong scrim"],
};

export const SEASON_STATUS_LABEL: Record<SeasonStatus, [string, string]> = {
  draft: ["مسودة", "Draft"],
  active: ["نشط", "Active"],
  paused: ["موقوف", "Paused"],
  ended: ["منتهٍ", "Ended"],
};

export function seasonLabel(row: SeasonalBackdrop, ar: boolean): string {
  const label = ar ? row.label_ar : row.label_en;
  return label || row.slug;
}

/** يحوّل مسارات التخزين إلى روابط قابلة للعرض ويُبقي مؤشّرات الشبكة كما هي. */
async function resolveSeasonAssets(rows: SeasonalBackdrop[]): Promise<ResolvedSeason[]> {
  const paths = rows.flatMap((row) =>
    [row.image_path, row.decor_path, row.mascot_path].filter((value): value is string => !!value),
  );
  const signed = paths.length > 0 ? await signCampaignPaths(paths) : {};
  return rows.map((row) => ({
    ...row,
    imageUrl: row.image_url ?? (row.image_path ? signed[row.image_path] ?? null : null),
    decorUrl: row.decor_url ?? (row.decor_path ? signed[row.decor_path] ?? null : null),
    mascotUrl: row.mascot_url ?? (row.mascot_path ? signed[row.mascot_path] ?? null : null),
  }));
}

/** المواسم النشطة لموضع واحد، مرتّبة بالأولوية. */
export function useLiveSeasons(placement: SeasonPlacement, sectionKey?: string) {
  return useQuery({
    queryKey: ["mkt", "seasons", placement, sectionKey ?? ""],
    staleTime: 300_000,
    queryFn: async (): Promise<ResolvedSeason[]> => {
      let query = supabase
        .from("mkt_seasonal_backdrops")
        .select(SEASON_COLUMNS)
        .eq("placement", placement)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .limit(6);
      if (placement === "section") query = query.eq("section_key", sectionKey ?? "");
      const { data, error } = await query;
      if (error) throw error;
      return resolveSeasonAssets((data ?? []) as unknown as SeasonalBackdrop[]);
    },
  });
}

/**
 * الموسم الظاهر الآن لهذا الموضع. عند وجود أكثر من موسم نشط يتناوبون كل
 * `SEASON_ROTATE_MS`، والمؤقّت لا يعمل إطلاقًا حين يكون هناك موسم واحد.
 */
export function useSeason(placement: SeasonPlacement, sectionKey?: string) {
  const { data } = useLiveSeasons(placement, sectionKey);
  const rows = useMemo(() => (data ?? []).filter((row) => row.imageUrl || row.motif !== "none"), [data]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (rows.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % rows.length),
      SEASON_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [rows.length]);

  return rows.length === 0 ? null : rows[index % rows.length] ?? null;
}

/** العروض الحصرية النشطة. */
export function useExclusiveOffers() {
  return useQuery({
    queryKey: ["mkt", "exclusive-offers"],
    staleTime: 300_000,
    queryFn: async (): Promise<ResolvedOffer[]> => {
      const { data, error } = await supabase
        .from("mkt_exclusive_offers")
        .select(OFFER_COLUMNS)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ExclusiveOffer[];
      const paths = rows.map((row) => row.image_path).filter((value): value is string => !!value);
      const signed = paths.length > 0 ? await signCampaignPaths(paths) : {};
      return rows.map((row) => ({
        ...row,
        imageUrl: row.image_url ?? (row.image_path ? signed[row.image_path] ?? null : null),
      }));
    },
  });
}

/* ── إدارة ───────────────────────────────────────────────── */

export function useAdminSeasons() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["mkt", "admin", "seasons"],
    queryFn: async (): Promise<SeasonalBackdrop[]> => {
      const { data, error } = await supabase
        .from("mkt_seasonal_backdrops")
        .select(SEASON_COLUMNS)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as unknown as SeasonalBackdrop[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "seasons"] });
    void queryClient.invalidateQueries({ queryKey: ["mkt", "seasons"] });
  };

  const save = useMutation({
    mutationFn: async (input: { id?: string; values: Partial<SeasonalBackdrop> }) => {
      if (input.id) {
        const { error } = await supabase
          .from("mkt_seasonal_backdrops")
          .update(input.values as never)
          .eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("mkt_seasonal_backdrops")
        .insert(input.values as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_seasonal_backdrops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, save, remove };
}

export function useAdminOffers() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["mkt", "admin", "exclusive-offers"],
    queryFn: async (): Promise<ExclusiveOffer[]> => {
      const { data, error } = await supabase
        .from("mkt_exclusive_offers")
        .select(OFFER_COLUMNS)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as unknown as ExclusiveOffer[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "exclusive-offers"] });
    void queryClient.invalidateQueries({ queryKey: ["mkt", "exclusive-offers"] });
  };

  const save = useMutation({
    mutationFn: async (input: { id?: string; values: Partial<ExclusiveOffer> }) => {
      if (input.id) {
        const { error } = await supabase
          .from("mkt_exclusive_offers")
          .update(input.values as never)
          .eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("mkt_exclusive_offers").insert(input.values as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_exclusive_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, save, remove };
}
