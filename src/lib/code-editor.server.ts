/**
 * محرر الكود — الطبقة الخادمية الخالصة (نظام الملفات).
 *
 * هذا الملف لا يفحص الهوية: الفحص كله في `code-editor.functions.ts` قبل أي
 * استدعاء هنا. مهمته حصر العمليات داخل جذر المشروع وقائمة امتدادات مسموحة،
 * ومنع أي مسار حسّاس (أسرار، أسرار Supabase المولّدة، الهجرات، node_modules).
 *
 * الكتابة تعمل في بيئة التطوير/المعاينة فقط: نظام ملفات الإنتاج
 * (Cloudflare Workers) للقراءة فقط، فالكتابة هناك ترفع خطأً واضحًا لا سقوطًا صامتًا.
 */
import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";

export const ROOT = process.cwd();

const ALLOWED_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".html",
  ".txt",
  ".sql",
]);

/** أي مسار يبدأ بأحد هذه المقاطع مرفوض قراءةً وكتابةً. */
const DENY_PREFIX = [
  "node_modules",
  ".git",
  ".env",
  "dist",
  ".output",
  ".vercel",
  "supabase/migrations",
  "src/integrations/supabase/types.ts",
  ".workspace",
];

/** مجلدات لا تُدرَج في الشجرة (ضجيج أو ضخمة). */
const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  "dist",
  ".output",
  ".vercel",
  ".cache",
  ".vite",
  "coverage",
]);

export class CodeEditorError extends Error {}

/**
 * محرر الكود متاح في بيئة التطوير/المعاينة فقط.
 *
 * بيئة التشغيل المنشورة (Cloudflare Worker) لا تملك نظام ملفات قابلًا للكتابة،
 * فلا يمكن لأي كود أن يعدّل ملفات المشروع بعد النشر. نرفض صريحًا بدل السقوط
 * الصامت أو الوعد الكاذب بالحفظ.
 */
export function assertEditorEnvironment(): void {
  if (process.env['NODE_ENV'] === 'production' || process.env['CF_PAGES'] || process.env['CLOUDFLARE_ENVIRONMENT']) {
    throw new CodeEditorError('CODE_EDITOR_DISABLED_IN_PRODUCTION');
  }
}

/** يعيد مسارًا نسبيًا آمنًا أو يرفع خطأً. */
export function safePath(input: string): string {
  const raw = String(input ?? "").trim().replace(/^\/+/, "");
  if (!raw) throw new CodeEditorError("BAD_PATH");
  if (raw.includes("\0")) throw new CodeEditorError("BAD_PATH");
  const rel = normalize(raw).split(sep).join("/");
  if (rel.startsWith("..") || rel.includes("../")) throw new CodeEditorError("PATH_ESCAPE");

  const abs = join(ROOT, rel);
  const back = relative(ROOT, abs).split(sep).join("/");
  if (back.startsWith("..")) throw new CodeEditorError("PATH_ESCAPE");
  if (DENY_PREFIX.some((deny) => back === deny || back.startsWith(`${deny}/`))) {
    throw new CodeEditorError("PATH_DENIED");
  }
  return back;
}

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
}

export function assertEditable(rel: string): void {
  if (!ALLOWED_EXT.has(extOf(rel))) throw new CodeEditorError("EXT_NOT_ALLOWED");
}

export interface TreeEntry {
  path: string;
  kind: "dir" | "file";
  size: number;
}

/** شجرة مجلد واحد (بلا تعمّق) — الواجهة تتنقل مستوى بمستوى. */
export async function listDir(rel: string): Promise<TreeEntry[]> {
  const dir = rel === "." ? ROOT : join(ROOT, rel);
  const items = await readdir(dir, { withFileTypes: true });
  const out: TreeEntry[] = [];
  for (const item of items) {
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory() && SKIP_DIR.has(item.name)) continue;
    if (item.name.startsWith(".env")) continue;
    const child = rel === "." ? item.name : `${rel}/${item.name}`;
    if (DENY_PREFIX.some((deny) => child === deny || child.startsWith(`${deny}/`))) continue;
    if (item.isDirectory()) {
      out.push({ path: child, kind: "dir", size: 0 });
    } else if (item.isFile() && ALLOWED_EXT.has(extOf(item.name))) {
      let size = 0;
      try {
        size = (await stat(join(ROOT, child))).size;
      } catch {
        size = 0;
      }
      out.push({ path: child, kind: "file", size });
    }
  }
  return out.sort((a, b) =>
    a.kind === b.kind ? a.path.localeCompare(b.path) : a.kind === "dir" ? -1 : 1,
  );
}

/**
 * أنواع/لغات الكود المسموح تصنيفها — قائمة مغلقة.
 *
 * هذه طبقة تنظيم فوق الشجرة الكاملة: نفس حصر المسارات ونفس الامتدادات
 * المسموحة، ولا تفتح أي مسار جديد. أي مفتاح غير مسجّل هنا يُرفض.
 */
export const CODE_KINDS: Record<string, string[]> = {
  css: [".css"],
  js: [".js", ".jsx", ".mjs"],
  ts: [".ts"],
  tsx: [".tsx"],
  json: [".json"],
  md: [".md", ".txt"],
  html: [".html"],
  sql: [".sql"],
};

const MAX_KIND_RESULTS = 600;

/**
 * كل ملفات نوع واحد في المشروع (مسح متعمّق) — بنفس استثناءات الشجرة
 * (`SKIP_DIR` و`DENY_PREFIX`) وبلا اتباع للروابط الرمزية.
 */
export async function listByKind(kind: string): Promise<TreeEntry[]> {
  const exts = CODE_KINDS[kind];
  if (!exts) throw new CodeEditorError("UNKNOWN_KIND");
  const allowed = new Set(exts.filter((ext) => ALLOWED_EXT.has(ext)));
  const out: TreeEntry[] = [];

  const walk = async (rel: string): Promise<void> => {
    if (out.length >= MAX_KIND_RESULTS) return;
    const dir = rel === "." ? ROOT : join(ROOT, rel);
    let items: Dirent[];
    try {
      items = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (out.length >= MAX_KIND_RESULTS) return;
      if (item.isSymbolicLink()) continue;
      if (item.name.startsWith(".env")) continue;
      const child = rel === "." ? item.name : `${rel}/${item.name}`;
      if (DENY_PREFIX.some((deny) => child === deny || child.startsWith(`${deny}/`))) continue;
      if (item.isDirectory()) {
        if (SKIP_DIR.has(item.name)) continue;
        await walk(child);
      } else if (item.isFile() && allowed.has(extOf(item.name))) {
        let size = 0;
        try {
          size = (await stat(join(ROOT, child))).size;
        } catch {
          size = 0;
        }
        out.push({ path: child, kind: "file", size });
      }
    }
  };

  await walk(".");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export const MAX_FILE_BYTES = 512 * 1024;

export async function readTextFile(rel: string): Promise<{ content: string; sha256: string }> {
  assertEditable(rel);
  const info = await stat(join(ROOT, rel));
  if (!info.isFile()) throw new CodeEditorError("NOT_A_FILE");
  if (info.size > MAX_FILE_BYTES) throw new CodeEditorError("FILE_TOO_LARGE");
  const content = await readFile(join(ROOT, rel), "utf8");
  return { content, sha256: sha256(content) };
}

export async function readIfExists(
  rel: string,
): Promise<{ content: string | null; sha256: string | null; existed: boolean }> {
  try {
    const { content, sha256: hash } = await readTextFile(rel);
    return { content, sha256: hash, existed: true };
  } catch (error) {
    if (error instanceof CodeEditorError) throw error;
    return { content: null, sha256: null, existed: false };
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function writeTextFile(rel: string, content: string): Promise<void> {
  assertEditable(rel);
  if (content.length > MAX_FILE_BYTES) throw new CodeEditorError("FILE_TOO_LARGE");
  try {
    await writeFile(join(ROOT, rel), content, "utf8");
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new CodeEditorError("FILESYSTEM_READONLY");
    }
    throw error;
  }
}
