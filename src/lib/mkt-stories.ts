/**
 * ستوريات كَحيل — شريط قصص أعلى الصفحة الرئيسية بنمط إنستغرام.
 *
 * قواعد الخفة (غير قابلة للتفاوض):
 * • لا فيديو إطلاقًا. كل ستوري = خلفية متدرجة + نص + صورة WebP واحدة اختيارية
 *   بحد 150KB + حركة CSS على الشخصية. لا مكتبات إضافية.
 * • صور الستوريات لا تُوقّع ولا تُحمَّل إلا عند فتح الشاشة الكاملة
 *   (`useStoryImages(enabled)`)، فالشريط نفسه صفر بايت صور.
 * • المشاهدة/النقر يمرّان عبر `mkt_story_track` (SECURITY DEFINER) الذي يتحقق
 *   أن الستوري سارية، فلا يستطيع متصفح قديم أو مزوّر تضخيم الأرقام.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import type { MascotName, MascotPose } from "@/components/marketplace/campaign/Mascot";

export type StoryGradient = "violet" | "sunset" | "mint" | "night" | "gold";
export type StoryStatus = "draft" | "active" | "paused" | "ended";

export interface Story {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  cta_ar: string;
  cta_en: string;
  click_url: string;
  image_path: string | null;
  image_width: number;
  image_height: number;
  gradient: StoryGradient;
  mascot: MascotName;
  mascot_pose: string;
  priority: number;
  status: StoryStatus;
  starts_at: string;
  ends_at: string | null;
  views: number;
  clicks: number;
  created_at: string;
}

const COLUMNS =
  "id, slug, title_ar, title_en, body_ar, body_en, cta_ar, cta_en, click_url, " +
  "image_path, image_width, image_height, gradient, mascot, mascot_pose, priority, " +
  "status, starts_at, ends_at, views, clicks, created_at";

export const STORY_GRADIENTS: StoryGradient[] = ["violet", "sunset", "mint", "night", "gold"];

/** خلفيات جاهزة — تدرجات CSS فقط، فلا وزن على الشبكة. */
export const STORY_GRADIENT_CSS: Record<StoryGradient, string> = {
  violet: "linear-gradient(160deg,#3c096c,#7b2cbf 55%,#c77dff)",
  sunset: "linear-gradient(160deg,#4a1042,#a4133c 55%,#ff8500)",
  mint: "linear-gradient(160deg,#10403b,#128f7e 55%,#7ae582)",
  night: "linear-gradient(160deg,#0b0a1f,#241046 55%,#5a189a)",
  gold: "linear-gradient(160deg,#3f2c05,#a97a11 55%,#ffd166)",
};

/** حد صورة الستوري: 150KB. أي شيء أكبر يُرفض قبل أن يلمس التخزين. */
export const STORY_IMAGE_LIMIT = 150 * 1024;
export const STORY_IMAGE_ACCEPT = "image/webp,image/jpeg,image/png";

export function storyImagePath(): string {
  return `public/stories/${crypto.randomUUID()}.webp`;
}

export function storyPose(story: Story): MascotPose {
  return story.mascot_pose as MascotPose;
}

/** القصص السارية الآن — بلا أي تحميل لصور. */
export function useLiveStories() {
  return useQuery({
    queryKey: ["mkt", "stories", "live"],
    staleTime: 300_000,
    queryFn: async (): Promise<Story[]> => {
      const { data, error } = await supabase
        .from("mkt_stories")
        .select(COLUMNS)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as unknown as Story[];
    },
  });
}

/**
 * روابط صور الستوريات — تُطلب فقط بعد فتح الشاشة الكاملة (`enabled`).
 * القصص بلا صورة لا تُدخل الطلب أصلًا.
 */
export function useStoryImages(stories: Story[], enabled: boolean) {
  const paths = stories.map((story) => story.image_path).filter((path): path is string => !!path);
  return useQuery({
    queryKey: ["mkt", "stories", "images", paths],
    enabled: enabled && paths.length > 0,
    staleTime: 1_800_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrls(paths, 3600);
      const out: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
      }
      return out;
    },
  });
}

// ── حالة «مشاهَد» ────────────────────────────────────────────────────────────
const SEEN_KEY = "kaheel.stories.seen";
const SEEN_EVENT = "kaheel:stories-seen";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** أي القصص شوهدت على هذا الجهاز — يحدّد لون الإطار (بنفسجي/رمادي). */
export function useSeenStories() {
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    setSeen(readSeen());
    const sync = () => setSeen(readSeen());
    window.addEventListener(SEEN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEEN_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const markSeen = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const next = Array.from(new Set([...readSeen(), id])).slice(-60);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* التخزين محجوب: الإطار يبقى «غير مشاهَد»، وهذا مقبول. */
    }
    window.dispatchEvent(new CustomEvent(SEEN_EVENT));
  }, []);

  return { seen, markSeen };
}

// ── تتبّع ────────────────────────────────────────────────────────────────────
const SESSION_KEY_STORE = "kaheel.story.session";
const tracked = new Set<string>();

function sessionKey(): string {
  if (typeof window === "undefined") return "";
  let key = window.sessionStorage.getItem(SESSION_KEY_STORE);
  if (!key) {
    key = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY_STORE, key);
  }
  return key;
}

/** إرسال وننسى. المشاهدة تُحسب مرة واحدة لكل ستوري في الجلسة. */
export function trackStory(storyId: string, kind: "view" | "click"): void {
  if (typeof window === "undefined") return;
  const guard = `${kind}:${storyId}`;
  if (kind === "view") {
    if (tracked.has(guard)) return;
    tracked.add(guard);
  }
  void supabase
    .rpc("mkt_story_track", { _story_id: storyId, _kind: kind, _session_key: sessionKey() })
    .then(() => undefined);
}

// ── الإدارة ─────────────────────────────────────────────────────────────────
export function useAdminStories(enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "admin", "stories"],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<Story[]> => {
      const { data, error } = await supabase
        .from("mkt_stories")
        .select(COLUMNS)
        .order("priority", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Story[];
    },
  });
}

export type StoryDraft = Omit<Story, "id" | "views" | "clicks" | "created_at">;

export function useSaveStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<StoryDraft> }) => {
      if (id) {
        const { error } = await supabase.from("mkt_stories").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("mkt_stories")
        .insert(values as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "stories"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "stories"] });
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_stories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "stories"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "stories"] });
    },
  });
}

/** رفع صورة ستوري بعد التحقق من الحجم والنوع الحقيقي. */
export async function uploadStoryImage(file: File): Promise<{ path: string; width: number; height: number }> {
  if (file.size > STORY_IMAGE_LIMIT) throw new Error("STORY_IMAGE_TOO_LARGE");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 12));
  const isWebp =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (!isWebp && !isJpeg && !isPng) throw new Error("STORY_IMAGE_TYPE");

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("STORY_IMAGE_DECODE"));
    };
    image.src = url;
  });

  const path = storyImagePath();
  const { error } = await supabase.storage
    .from(MKT_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return { path, ...dimensions };
}
