/**
 * استوديو المحتوى — طبقة البيانات لصفحات `mkt_cms_pages` ونسخها.
 *
 * قواعد ملزمة:
 *  - سجل مكوّنات واحد: كل كتلة نوعها من `BLOCK_LIBRARY` في `mkt-page-composer`.
 *    نوع غير معروف لا يُحفظ ولا يُنشر (اختبار القبول ٩).
 *  - لا HTML ولا Script: كل قيمة نصية تُنظَّف قبل الحفظ (اختبار القبول ١٠).
 *  - المسودة لا تُصبح عامة أبدًا: الصفحة تُقرأ للعامة فقط عند `status='published'`
 *    مع `published_version_id` (اختبار القبول ٧).
 *  - الرجوع (Rollback) ينسخ نسخة كاملة ثم ينشرها، ولا يعدّل نسخة قديمة
 *    (اختبار القبول ١٣).
 *  - تغيير المسار يُنشئ Redirect ويمنع التعارض (اختبار القبول ١١).
 *  - تعارض التحرير مكشوف بقفل نابض لا بكتابة صامتة (اختبار القبول ١٥).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  blockDefinition,
  defaultSettings,
  type BlockSettings,
  type BlockType,
} from "@/lib/mkt-page-composer";

// ── الأنواع ────────────────────────────────────────────────────────────────

export type CmsPageStatus = "draft" | "published" | "archived";
export type CmsVersionStatus = "draft" | "preview" | "published" | "archived";
export type CmsDevice = "mobile" | "tablet" | "desktop";

/** كتلة داخل نسخة صفحة. `id` محلي للنسخة ويُولَّد جديدًا عند النسخ. */
export interface CmsBlock {
  id: string;
  block_type: BlockType;
  settings: BlockSettings;
  hidden?: boolean;
}

export interface CmsPage {
  id: string;
  slug: string;
  route_path: string;
  kind: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  og_image_path: string | null;
  robots: string;
  status: CmsPageStatus;
  published_version_id: string | null;
  is_system: boolean;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsVersion {
  id: string;
  page_id: string;
  version_no: number;
  blocks: CmsBlock[];
  tokens: Record<string, unknown>;
  seo: Record<string, unknown>;
  status: CmsVersionStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export const CMS_PAGES_KEY = ["mkt", "cms", "pages"] as const;
export const CMS_VERSIONS_KEY = ["mkt", "cms", "versions"] as const;
export const MAX_CMS_BLOCKS = 40;

const PAGE_COLUMNS =
  "id, slug, route_path, kind, title_ar, title_en, description_ar, description_en, og_image_path, robots, status, published_version_id, is_system, locked, created_at, updated_at";
const VERSION_COLUMNS =
  "id, page_id, version_no, blocks, tokens, seo, status, note, created_at, updated_at, published_at";

// ── التنظيف والتحقق ────────────────────────────────────────────────────────

/** نص عادي فقط: لا وسوم، لا `javascript:`، بحد ٢٠٠ حرف. */
export function safeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on[a-z]+\s*=/gi, "")
    .slice(0, 200)
    .trim();
}

/** وجهة مسموحة: مسار داخلي يبدأ بـ `/` أو رابط https صريح. */
export function safeHref(value: string): string | null {
  const raw = value.trim();
  if (raw.startsWith("/")) return raw.replace(/[<>"']/g, "").slice(0, 300);
  if (/^https:\/\/[^\s<>"']+$/i.test(raw)) return raw.slice(0, 300);
  return null;
}

function sanitizeSettings(type: BlockType, settings: BlockSettings): BlockSettings {
  const def = blockDefinition(type);
  if (!def) return {};
  const out: BlockSettings = {};
  for (const field of def.fields) {
    const value = settings[field.key];
    if (value === undefined || value === null) continue;
    if (field.type === "boolean") out[field.key] = value === true;
    else if (field.type === "number") {
      const n = Number(value);
      if (Number.isFinite(n)) out[field.key] = n;
    } else if (field.type === "link") {
      const href = safeHref(String(value));
      if (href) out[field.key] = href;
    } else out[field.key] = safeText(String(value));
  }
  return out;
}

export interface BlockIssue {
  index: number;
  code: "unknown_type" | "over_limit";
  detail: string;
}

/** يُرجع كتلًا منظّفة + قائمة مشاكل تمنع النشر إن وُجدت. */
export function validateBlocks(blocks: CmsBlock[]): { blocks: CmsBlock[]; issues: BlockIssue[] } {
  const issues: BlockIssue[] = [];
  const clean: CmsBlock[] = [];
  blocks.forEach((block, index) => {
    if (!blockDefinition(block.block_type)) {
      issues.push({ index, code: "unknown_type", detail: block.block_type });
      return;
    }
    if (clean.length >= MAX_CMS_BLOCKS) {
      issues.push({ index, code: "over_limit", detail: String(MAX_CMS_BLOCKS) });
      return;
    }
    clean.push({
      id: block.id,
      block_type: block.block_type,
      settings: sanitizeSettings(block.block_type, block.settings ?? {}),
      hidden: block.hidden === true,
    });
  });
  return { blocks: clean, issues };
}

/** كتلة جديدة بإعداداتها الابتدائية ومعرّف جديد (اختبار القبول ٥١). */
export function newBlock(type: BlockType): CmsBlock {
  return { id: crypto.randomUUID(), block_type: type, settings: defaultSettings(type), hidden: false };
}

/** نسخ كتلة يعطيها `block_id` جديدًا دائمًا. */
export function duplicateBlock(block: CmsBlock): CmsBlock {
  return { ...block, id: crypto.randomUUID(), settings: { ...block.settings } };
}

// ── قراءة ──────────────────────────────────────────────────────────────────

export async function fetchCmsPages(): Promise<CmsPage[]> {
  const { data, error } = await supabase
    .from("mkt_cms_pages")
    .select(PAGE_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CmsPage[];
}

export async function fetchCmsPage(id: string): Promise<CmsPage> {
  const { data, error } = await supabase
    .from("mkt_cms_pages")
    .select(PAGE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("PAGE_NOT_FOUND");
  return data as unknown as CmsPage;
}

export async function fetchCmsVersions(pageId: string): Promise<CmsVersion[]> {
  const { data, error } = await supabase
    .from("mkt_cms_page_versions")
    .select(VERSION_COLUMNS)
    .eq("page_id", pageId)
    .order("version_no", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as CmsVersion[];
}

export function useCmsPages() {
  return useQuery({ queryKey: CMS_PAGES_KEY, queryFn: fetchCmsPages, staleTime: 15_000 });
}

export function useCmsPage(id: string) {
  return useQuery({
    queryKey: [...CMS_PAGES_KEY, id],
    queryFn: () => fetchCmsPage(id),
    staleTime: 10_000,
  });
}

export function useCmsVersions(pageId: string) {
  return useQuery({
    queryKey: [...CMS_VERSIONS_KEY, pageId],
    queryFn: () => fetchCmsVersions(pageId),
    staleTime: 10_000,
  });
}

// ── كتابة ──────────────────────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createCmsPage(input: {
  slug: string;
  route_path: string;
  title_ar: string;
  kind?: string;
}): Promise<CmsPage> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from("mkt_cms_pages")
    .insert({
      slug: input.slug,
      route_path: input.route_path,
      title_ar: safeText(input.title_ar),
      kind: input.kind ?? "page",
      status: "draft",
      created_by: uid,
    } as never)
    .select(PAGE_COLUMNS)
    .single();
  if (error) throw error;
  const page = data as unknown as CmsPage;
  await createVersion(page.id, [], null);
  return page;
}

/** نسخة جديدة برقم تالٍ — كل حفظ جديد لا يلمس نسخة منشورة. */
export async function createVersion(
  pageId: string,
  blocks: CmsBlock[],
  note: string | null,
  seo: Record<string, unknown> = {},
): Promise<CmsVersion> {
  const uid = await currentUserId();
  const versions = await fetchCmsVersions(pageId);
  const next = (versions[0]?.version_no ?? 0) + 1;
  const { blocks: clean } = validateBlocks(blocks);
  const { data, error } = await supabase
    .from("mkt_cms_page_versions")
    .insert({
      page_id: pageId,
      version_no: next,
      blocks: clean as never,
      seo: seo as never,
      status: "draft",
      note,
      created_by: uid,
    } as never)
    .select(VERSION_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as CmsVersion;
}

/**
 * حفظ المسودة. `expected_updated_at` هو حرس التعارض: إن تغيّرت النسخة على
 * الخادم بعد قراءتنا لها، يفشل الحفظ بـ `EDIT_CONFLICT` بدل الكتابة الصامتة.
 */
export async function saveDraftVersion(input: {
  versionId: string;
  blocks: CmsBlock[];
  seo?: Record<string, unknown>;
  expectedUpdatedAt: string;
}): Promise<CmsVersion> {
  const { blocks } = validateBlocks(input.blocks);
  const { data, error } = await supabase
    .from("mkt_cms_page_versions")
    .update({
      blocks: blocks as never,
      ...(input.seo ? { seo: input.seo as never } : {}),
    } as never)
    .eq("id", input.versionId)
    .eq("updated_at", input.expectedUpdatedAt)
    .select(VERSION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("EDIT_CONFLICT");
  return data as unknown as CmsVersion;
}

/** النشر: النسخة تصبح `published` والصفحة تشير إليها. فشل النشر لا يلمس القديم. */
export async function publishVersion(pageId: string, versionId: string): Promise<void> {
  const { blocks } = await fetchVersion(versionId);
  const { issues } = validateBlocks(blocks);
  if (issues.length > 0) throw new Error("INVALID_BLOCKS");
  const uid = await currentUserId();

  const { error: vErr } = await supabase
    .from("mkt_cms_page_versions")
    .update({ status: "published", published_at: new Date().toISOString(), published_by: uid } as never)
    .eq("id", versionId);
  if (vErr) throw vErr;

  const { error: pErr } = await supabase
    .from("mkt_cms_pages")
    .update({ status: "published", published_version_id: versionId } as never)
    .eq("id", pageId);
  if (pErr) throw pErr;
}

/** إلغاء النشر يبقي التاريخ والنسخ كما هي (اختبار القبول ١٢). */
export async function unpublishPage(pageId: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_cms_pages")
    .update({ status: "draft" } as never)
    .eq("id", pageId);
  if (error) throw error;
}

/** الأرشفة حالة لا حذف: الصفحة تخرج من العرض ويبقى تاريخها كاملًا. */
export async function setPageArchived(pageId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_cms_pages")
    .update({ status: archived ? "archived" : "draft" } as never)
    .eq("id", pageId);
  if (error) throw error;
}

export interface CmsPageSettings {
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  og_image_path: string | null;
  robots: string;
}

/** إعدادات الصفحة (SEO والفهرسة) — كل نص يُنظَّف قبل الحفظ. */
export async function updatePageSettings(
  pageId: string,
  settings: CmsPageSettings,
): Promise<void> {
  const title = safeText(settings.title_ar);
  if (title.length < 2) throw new Error("TITLE_REQUIRED");
  const clean = (value: string | null) => {
    const text = value ? safeText(value) : "";
    return text.length > 0 ? text : null;
  };
  const { error } = await supabase
    .from("mkt_cms_pages")
    .update({
      title_ar: title,
      title_en: clean(settings.title_en),
      description_ar: clean(settings.description_ar),
      description_en: clean(settings.description_en),
      og_image_path: settings.og_image_path ? safeHref(settings.og_image_path) : null,
      robots: settings.robots === "noindex" ? "noindex" : "index",
    } as never)
    .eq("id", pageId);
  if (error) throw error;
}

// ── فحص ما قبل النشر ───────────────────────────────────────────────────────

export interface PreflightItem {
  code:
    | "unknown_block"
    | "block_limit"
    | "missing_translation"
    | "empty_field"
    | "bad_target"
    | "empty_page"
    | "missing_description"
    | "oversized_asset"
    | "layout_shift"
    | "slow_page";
  message: string;
  /** يمنع النشر، أو تحذير يراه الناشر ويقرّر. */
  blocking: boolean;
}

/**
 * سياق الأداء المقيس لهذا المسار — يأتي من `mkt_perf_summary` (قياس حقيقي من
 * متصفحات الزوار) وميزانية نوع الصفحة، فلا تقدير ولا رقم ثابت في الواجهة.
 */
export interface PreflightPerfContext {
  budget: {
    lcp_ms: number;
    inp_ms: number;
    cls_milli: number;
    max_asset_kb: number;
  };
  measured?: {
    samples: number;
    lcp_p75: number | null;
    cls_p75: number | null;
  };
  /** أثقل الأصول المقيسة على هذا المسار: المسار والحجم بالكيلوبايت. */
  assets?: { path: string; kb: number }[];
}

/**
 * فحص إلزامي يراه الناشر قبل النشر: ترجمة ناقصة، زر بلا وجهة صالحة، كتلة
 * غير معروفة، وحقل مطلوب فارغ. البنود المانعة تُعطّل زر النشر.
 *
 * عند تمرير سياق أداء، يمتد الفحص إلى ميزانيات الأداء: أصل أثقل من الميزانية
 * أو إزاحة تصميم أعلى من الحد يمنعان النشر، والتباطؤ دون الضعف تحذير.
 */
export function preflightPage(
  page: CmsPage,
  blocks: CmsBlock[],
  perf?: PreflightPerfContext,
): PreflightItem[] {
  const items: PreflightItem[] = [];
  const { issues } = validateBlocks(blocks);

  for (const issue of issues) {
    items.push(
      issue.code === "unknown_type"
        ? {
            code: "unknown_block",
            message: `كتلة غير معروفة في الموضع ${issue.index + 1}: ${issue.detail}`,
            blocking: true,
          }
        : {
            code: "block_limit",
            message: `تجاوز حد ${issue.detail} كتلة — الكتلة ${issue.index + 1} لن تُحفظ`,
            blocking: true,
          },
    );
  }

  const visible = blocks.filter((b) => b.hidden !== true);
  if (visible.length === 0)
    items.push({ code: "empty_page", message: "لا كتلة مرئية في الصفحة", blocking: true });

  if (!page.title_en || page.title_en.trim().length === 0)
    items.push({ code: "missing_translation", message: "العنوان الإنجليزي ناقص", blocking: false });
  if (!page.description_ar || page.description_ar.trim().length === 0)
    items.push({ code: "missing_description", message: "وصف الصفحة العربي ناقص", blocking: false });
  if (!page.description_en || page.description_en.trim().length === 0)
    items.push({
      code: "missing_translation",
      message: "وصف الصفحة الإنجليزي ناقص",
      blocking: false,
    });

  blocks.forEach((block, index) => {
    const def = blockDefinition(block.block_type);
    if (!def) return;
    const label = `${def.name_ar} (${index + 1})`;
    for (const field of def.fields) {
      const raw = block.settings[field.key];
      const text = raw === undefined || raw === null ? "" : String(raw).trim();

      if (field.type === "link" || field.type === "anchor") {
        if (text.length === 0)
          items.push({
            code: "bad_target",
            message: `${label}: «${field.label_ar}» بلا وجهة`,
            blocking: true,
          });
        else if (field.type === "link" && safeHref(text) === null)
          items.push({
            code: "bad_target",
            message: `${label}: وجهة «${field.label_ar}» غير صالحة`,
            blocking: true,
          });
        continue;
      }

      // حقل يملك قيمة ابتدائية نصية = حقل ذو معنى: فراغه نقص لا اختيار.
      const hasMeaningfulDefault =
        typeof field.default === "string" && field.default.trim().length > 0;
      if (text.length === 0 && (hasMeaningfulDefault || field.type === "slot"))
        items.push({
          code: "empty_field",
          message: `${label}: «${field.label_ar}» فارغ`,
          blocking: false,
        });
    }
  });

  if (perf) {
    for (const asset of perf.assets ?? []) {
      const over = asset.kb - perf.budget.max_asset_kb;
      if (over > 0)
        items.push({
          code: "oversized_asset",
          message: `أصل أثقل من الميزانية: ${asset.path} بحجم ${asset.kb}KB (الحد ${perf.budget.max_asset_kb}KB)`,
          // تجاوز الضعف يمنع النشر، وما دونه تحذير يراه الناشر.
          blocking: asset.kb >= perf.budget.max_asset_kb * 2,
        });
    }

    const measured = perf.measured;
    if (measured && measured.samples >= 3) {
      const clsBudget = perf.budget.cls_milli / 1000;
      if (measured.cls_p75 !== null && measured.cls_p75 > clsBudget)
        items.push({
          code: "layout_shift",
          message: `إزاحة تصميم مقيسة ${measured.cls_p75.toFixed(3)} تتجاوز الحد ${clsBudget.toFixed(3)}`,
          blocking: measured.cls_p75 > clsBudget * 2,
        });
      if (measured.lcp_p75 !== null && measured.lcp_p75 > perf.budget.lcp_ms)
        items.push({
          code: "slow_page",
          message: `أبطأ عنصر مرئي ${Math.round(measured.lcp_p75)}ms يتجاوز ميزانية ${perf.budget.lcp_ms}ms`,
          blocking: measured.lcp_p75 > perf.budget.lcp_ms * 2,
        });
    }
  }

  return items;
}


export async function fetchVersion(versionId: string): Promise<CmsVersion> {
  const { data, error } = await supabase
    .from("mkt_cms_page_versions")
    .select(VERSION_COLUMNS)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("VERSION_NOT_FOUND");
  return data as unknown as CmsVersion;
}

/** الرجوع = نسخة كاملة جديدة من القديمة ثم نشرها، مع سجل. */
export async function rollbackToVersion(pageId: string, versionId: string): Promise<CmsVersion> {
  const source = await fetchVersion(versionId);
  const copy = await createVersion(
    pageId,
    source.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
    `رجوع إلى النسخة ${source.version_no}`,
    source.seo,
  );
  await publishVersion(pageId, copy.id);
  return copy;
}

/** تغيير المسار: يمنع التعارض ثم يسجّل Redirect من القديم إلى الجديد. */
export async function changeRoutePath(page: CmsPage, nextPath: string): Promise<void> {
  const path = nextPath.trim();
  if (!/^\/[A-Za-z0-9/_.$-]*$/.test(path)) throw new Error("BAD_PATH");
  if (path === page.route_path) return;

  const { data: clash } = await supabase
    .from("mkt_cms_pages")
    .select("id")
    .eq("route_path", path)
    .maybeSingle();
  if (clash) throw new Error("PATH_TAKEN");

  const { error } = await supabase
    .from("mkt_cms_pages")
    .update({ route_path: path } as never)
    .eq("id", page.id);
  if (error) throw error;

  const uid = await currentUserId();
  await supabase
    .from("mkt_cms_page_redirects")
    .upsert(
      {
        from_path: page.route_path,
        to_path: path,
        page_id: page.id,
        reason: "slug change",
        created_by: uid,
      } as never,
      { onConflict: "from_path" },
    );
}

// ── قفل التحرير ────────────────────────────────────────────────────────────

export interface CmsLock {
  page_id: string;
  user_id: string;
  heartbeat_at: string;
}

const LOCK_STALE_MS = 90_000;

/**
 * قفل نابض: يُعلن محرِّرًا واحدًا نشطًا لكل صفحة. القفل يسقط تلقائيًا بعد
 * ٩٠ ثانية بلا نبضة، ولا يمنع القراءة — يمنع فقط الكتابة الصامتة المزدوجة.
 */
export function usePageEditLock(pageId: string, enabled: boolean) {
  const [holder, setHolder] = useState<CmsLock | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !pageId) return;
    let alive = true;

    const beat = async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      if (!alive) return;
      setMe(uid);
      if (!uid) return;

      const { data: current } = await supabase
        .from("mkt_cms_page_locks")
        .select("page_id, user_id, heartbeat_at")
        .eq("page_id", pageId)
        .maybeSingle();
      const row = (current ?? null) as unknown as CmsLock | null;
      const stale = row ? Date.now() - new Date(row.heartbeat_at).getTime() > LOCK_STALE_MS : true;

      if (!row || row.user_id === uid || stale) {
        await supabase
          .from("mkt_cms_page_locks")
          .upsert(
            { page_id: pageId, user_id: uid, heartbeat_at: new Date().toISOString() } as never,
            { onConflict: "page_id" },
          );
        if (alive) setHolder({ page_id: pageId, user_id: uid, heartbeat_at: new Date().toISOString() });
      } else if (alive) {
        setHolder(row);
      }
    };

    void beat();
    timer.current = setInterval(() => void beat(), 30_000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [pageId, enabled]);

  const mine = holder !== null && me !== null && holder.user_id === me;
  return { holder, mine, blocked: holder !== null && me !== null && !mine };
}

// ── تراجع/إعادة ────────────────────────────────────────────────────────────

/** تاريخ محلي للكتل: تراجع/إعادة بحد ٥٠ خطوة، مستقل عن الشبكة. */
export function useBlockHistory(initial: CmsBlock[]) {
  const [stack, setStack] = useState<CmsBlock[][]>([initial]);
  const [cursor, setCursor] = useState(0);

  const blocks = stack[cursor] ?? [];

  const push = (next: CmsBlock[]) => {
    setStack((prev) => [...prev.slice(Math.max(0, cursor - 48), cursor + 1), next]);
    setCursor((c) => Math.min(c + 1, 49));
  };
  const reset = (next: CmsBlock[]) => {
    setStack([next]);
    setCursor(0);
  };

  return {
    blocks,
    push,
    reset,
    undo: () => setCursor((c) => Math.max(0, c - 1)),
    redo: () => setCursor((c) => Math.min(stack.length - 1, c + 1)),
    canUndo: cursor > 0,
    canRedo: cursor < stack.length - 1,
  };
}

// ── طلبات الكتابة المجمّعة ─────────────────────────────────────────────────

export function useCmsMutations(pageId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CMS_PAGES_KEY });
    void qc.invalidateQueries({ queryKey: CMS_VERSIONS_KEY });
  };

  return {
    createPage: useMutation({ mutationFn: createCmsPage, onSuccess: invalidate }),
    saveDraft: useMutation({ mutationFn: saveDraftVersion }),
    newVersion: useMutation({
      mutationFn: (input: { blocks: CmsBlock[]; note: string | null }) =>
        createVersion(pageId ?? "", input.blocks, input.note),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: (versionId: string) => publishVersion(pageId ?? "", versionId),
      onSuccess: invalidate,
    }),
    unpublish: useMutation({
      mutationFn: () => unpublishPage(pageId ?? ""),
      onSuccess: invalidate,
    }),
    rollback: useMutation({
      mutationFn: (versionId: string) => rollbackToVersion(pageId ?? "", versionId),
      onSuccess: invalidate,
    }),
    changePath: useMutation({
      mutationFn: (input: { page: CmsPage; nextPath: string }) =>
        changeRoutePath(input.page, input.nextPath),
      onSuccess: invalidate,
    }),
    saveSettings: useMutation({
      mutationFn: (settings: CmsPageSettings) => updatePageSettings(pageId ?? "", settings),
      onSuccess: invalidate,
    }),
    setArchived: useMutation({
      mutationFn: (archived: boolean) => setPageArchived(pageId ?? "", archived),
      onSuccess: invalidate,
    }),
  };
}


/** مقاسات المعاينة الثلاثة — نفس المقاسات المطلوبة في اختبارات التجاوب. */
export const DEVICE_WIDTH: Record<CmsDevice, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1366,
};

export function useCmsErrorText() {
  return useMemo(
    () => (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EDIT_CONFLICT"))
        return "محرِّر آخر حفظ نسخة أحدث — أعد التحميل قبل الحفظ";
      if (message.includes("PATH_TAKEN")) return "المسار مستخدم في صفحة أخرى";
      if (message.includes("BAD_PATH")) return "المسار غير صالح";
      if (message.includes("INVALID_BLOCKS")) return "توجد كتلة غير معروفة — لا يمكن النشر";
      if (message.includes("duplicate key")) return "المسار أو الاسم مستخدم مسبقًا";
      if (message.includes("row-level security") || message.includes("permission"))
        return "لا تملك صلاحية تعديل المحتوى";
      return "تعذّر التنفيذ — أعد المحاولة";
    },
    [],
  );
}
