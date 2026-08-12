/**
 * محرر الكود — دوال الخادم (owner-only حصرًا).
 *
 * كل دالة تفحص أمرين على الخادم قبل أي عمل:
 *  1. جلسة صحيحة عبر `requireSupabaseAuth` (رمز حامل مُتحقَّق منه في القاعدة).
 *  2. صفة المالك عبر `mkt_is_system_owner()` في القاعدة — لا فحص واجهة.
 * فمحاولة الوصول المباشر بالرابط أو باستدعاء الدالة من متصفح حساب آخر تُرفض
 * بـ `NOT_OWNER` مهما كانت حالة الواجهة.
 *
 * الحفظ إلزاميًا بعد لقطة: `mkt_code_snapshot_add` تُنفَّذ أولًا، وإن فشلت
 * لا تُكتب الملف إطلاقًا (لا حفظ بلا نسخة احتياطية).
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Supa = { rpc: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }> };

async function assertOwner(supabase: unknown): Promise<void> {
  const { data, error } = await (supabase as Supa).rpc("mkt_is_system_owner");
  if (error) throw new Error("OWNER_CHECK_FAILED");
  if (data !== true) throw new Error("NOT_OWNER");
}

/** شجرة مجلد واحد. */
export const codeListDir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path?: string }) => ({ path: data?.path ?? "." }))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase);
    const mod = await import("@/lib/code-editor.server");
    mod.assertEditorEnvironment();
    const rel = data.path === "." || !data.path ? "." : mod.safePath(data.path);
    return { path: rel, entries: await mod.listDir(rel) };
  });

/** كل ملفات نوع/لغة واحدة (طبقة تنظيم فوق الشجرة — نفس الحصر والامتدادات). */
export const codeListKind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: string }) => ({ kind: String(data?.kind ?? "") }))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase);
    const mod = await import("@/lib/code-editor.server");
    mod.assertEditorEnvironment();
    return { kind: data.kind, entries: await mod.listByKind(data.kind) };
  });

/** قراءة ملف نصي. */
export const codeReadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) => ({ path: String(data?.path ?? "") }))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase);
    const mod = await import("@/lib/code-editor.server");
    mod.assertEditorEnvironment();
    const rel = mod.safePath(data.path);
    const file = await mod.readTextFile(rel);
    return { path: rel, ...file };
  });

/** كتابة مباشرة على الملف الحي — بعد لقطة إلزامية. */
export const codeWriteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string; content: string }) => ({
    path: String(data?.path ?? ""),
    content: String(data?.content ?? ""),
  }))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase);
    const mod = await import("@/lib/code-editor.server");
    mod.assertEditorEnvironment();
    const rel = mod.safePath(data.path);
    mod.assertEditable(rel);

    const before = await mod.readIfExists(rel);

    // اللقطة أولًا: لا كتابة بلا نسخة احتياطية محفوظة فعلًا.
    const { data: snapshotId, error } = await (context.supabase as unknown as Supa).rpc(
      "mkt_code_snapshot_add",
      {
        _file_path: rel,
        _before_content: before.content,
        _before_sha256: before.sha256,
        _existed: before.existed,
        _reason: "write",
      },
    );
    if (error || !snapshotId) throw new Error("SNAPSHOT_FAILED");

    await mod.writeTextFile(rel, data.content);
    return { path: rel, snapshot_id: String(snapshotId), bytes: data.content.length };
  });

/** استرجاع ملف من لقطة — يأخذ لقطة للحالة الحالية أولًا ثم يكتب المحتوى القديم. */
export const codeRestoreSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { snapshot_id: string }) => ({
    snapshot_id: String(data?.snapshot_id ?? ""),
  }))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase);
    const supa = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    } & Supa;

    const { data: row, error } = await supa
      .from("mkt_code_snapshots")
      .select("id, file_path, before_content, existed")
      .eq("id", data.snapshot_id)
      .maybeSingle();
    if (error) throw new Error("SNAPSHOT_READ_FAILED");
    const snap = row as { file_path?: string; before_content?: string | null } | null;
    if (!snap?.file_path) throw new Error("SNAPSHOT_NOT_FOUND");
    if (snap.before_content === null || snap.before_content === undefined) {
      throw new Error("SNAPSHOT_HAS_NO_CONTENT");
    }

    const mod = await import("@/lib/code-editor.server");
    mod.assertEditorEnvironment();
    const rel = mod.safePath(snap.file_path);
    const current = await mod.readIfExists(rel);

    const { error: snapErr } = await supa.rpc("mkt_code_snapshot_add", {
      _file_path: rel,
      _before_content: current.content,
      _before_sha256: current.sha256,
      _existed: current.existed,
      _reason: "restore",
    });
    if (snapErr) throw new Error("SNAPSHOT_FAILED");

    await mod.writeTextFile(rel, snap.before_content);
    return { path: rel, restored: true, bytes: snap.before_content.length };
  });
