/**
 * لوحة الاستديو والمحتوى — تبويب «الأكواد البرمجية» (/admin/content/code)
 *
 * owner-only حصرًا وعلى مستويين:
 *  - واجهة: التبويب لا يُرسَم لغير المالك، وهذه الصفحة تعرض «ممنوع» لو فُتح
 *    الرابط مباشرة.
 *  - خادم: كل دالة في `code-editor.functions.ts` تستدعي `mkt_is_system_owner()`
 *    في القاعدة وترفض بـ `NOT_OWNER` — فحجب الزر ليس هو الحماية.
 *
 * الواجهة الافتراضية قائمة مصنّفة حسب نوع/لغة البرمجة (`code-channels.ts`)،
 * وهي **طبقة تنظيم فوق** الوصول الكامل لشجرة الكود المصدري لا بديل عنها:
 * بطاقة «شجرة الكود المصدري الكاملة» تبقى متاحة بنفس صلاحياتها السابقة.
 *
 * الكتابة مباشرة على الملف الحي، ولا تحدث إلا بعد نجاح لقطة في
 * `mkt_code_snapshots` (وإلا فلا كتابة إطلاقًا)، ومسار الاسترجاع من نفس القائمة.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Braces,
  ChevronUp,
  Code2,
  FileCode2,
  FileJson,
  FileText,
  File as FileIcon,
  Folder,
  FolderTree,
  History,
  LayoutTemplate,
  Palette,
  Save,
  Search,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { StudioTabs } from "@/components/admin/StudioTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  codeListDir,
  codeListKind,
  codeReadFile,
  codeRestoreSnapshot,
  codeWriteFile,
} from "@/lib/code-editor.functions";
import { CODE_CHANNELS, channelById, type CodeChannelIcon } from "@/lib/code-channels";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { studioError, useCodeSnapshots } from "@/lib/mkt-studio";

export const Route = createFileRoute("/admin/content/code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأكواد البرمجية — استوديو كَحيل" },
      {
        name: "description",
        content:
          "قائمة مصنّفة حسب لغة البرمجة فوق شجرة الكود المصدري الكاملة، لمالك المنصة حصرًا مع نسخة احتياطية قبل كل حفظ.",
      },
      { property: "og:title", content: "الأكواد البرمجية — استوديو كَحيل" },
      { property: "og:description", content: "محرر كود مباشر للمالك مع مسار استرجاع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StudioCodeRoute,
});

interface Entry {
  path: string;
  kind: "dir" | "file";
  size: number;
}

type View = { mode: "catalog" } | { mode: "channel"; id: string } | { mode: "tree" };

const CHANNEL_ICONS: Record<CodeChannelIcon, typeof Code2> = {
  css: Palette,
  js: Braces,
  ts: FileCode2,
  component: Code2,
  theme: LayoutTemplate,
  json: FileJson,
  markdown: FileText,
  html: LayoutTemplate,
  sql: FileCode2,
};

function parentOf(path: string): string {
  if (path === "." || !path.includes("/")) return ".";
  return path.slice(0, path.lastIndexOf("/"));
}

function StudioCodeRoute() {
  const { identity, loading } = usePlatformIdentity();
  const isOwner = identity?.is_system_owner === true;

  const listDir = useServerFn(codeListDir);
  const listKind = useServerFn(codeListKind);
  const readFile = useServerFn(codeReadFile);
  const writeFile = useServerFn(codeWriteFile);
  const restore = useServerFn(codeRestoreSnapshot);

  const [view, setView] = useState<View>({ mode: "catalog" });
  const [dir, setDir] = useState(".");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kindFiles, setKindFiles] = useState<Entry[]>([]);
  const [kindBusy, setKindBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const snapshots = useCodeSnapshots(openPath ?? undefined);

  const load = useCallback(
    async (path: string) => {
      try {
        const result = await listDir({ data: { path } });
        setDir(result.path);
        setEntries(result.entries as Entry[]);
      } catch (error) {
        toast.error(studioError(error));
      }
    },
    [listDir],
  );

  const openChannel = useCallback(
    async (id: string) => {
      const channel = channelById(id);
      if (!channel) return;
      setView({ mode: "channel", id });
      setFilter("");
      setKindBusy(true);
      try {
        const result = await listKind({ data: { kind: channel.kind } });
        setKindFiles(result.entries as Entry[]);
      } catch (error) {
        setKindFiles([]);
        toast.error(studioError(error));
      } finally {
        setKindBusy(false);
      }
    },
    [listKind],
  );

  useEffect(() => {
    if (!isOwner) return;
    void load(".");
  }, [isOwner, load]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return kindFiles;
    return kindFiles.filter((file) => file.path.toLowerCase().includes(needle));
  }, [filter, kindFiles]);

  if (loading) {
    return (
      <AdminShell title="لوحة الاستديو والمحتوى">
        <Skeleton className="h-40 w-full" />
      </AdminShell>
    );
  }

  if (!isOwner) {
    return (
      <AdminShell title="لوحة الاستديو والمحتوى">
        <AdminCard title="ممنوع">
          <p className="flex items-start gap-[var(--sp-2)] text-body text-foreground">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            محرر الأكواد البرمجية لمالك المنصة حصرًا. حتى لو فُتح هذا الرابط مباشرة، يرفض الخادم كل
            عملية قراءة أو كتابة لغير المالك.
          </p>
        </AdminCard>
      </AdminShell>
    );
  }

  const openFile = async (path: string) => {
    try {
      const file = await readFile({ data: { path } });
      setOpenPath(file.path);
      setContent(file.content);
      setDirty(false);
    } catch (error) {
      toast.error(studioError(error));
    }
  };

  const save = async () => {
    if (!openPath) return;
    setBusy(true);
    try {
      const result = await writeFile({ data: { path: openPath, content } });
      setDirty(false);
      toast.success(`حُفظ الملف — نسخة احتياطية ${result.snapshot_id.slice(0, 8)}`);
      void snapshots.refetch();
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (snapshotId: string) => {
    setBusy(true);
    try {
      const result = await restore({ data: { snapshot_id: snapshotId } });
      toast.success(`استُرجع ${result.path}`);
      if (openPath) await openFile(openPath);
      void snapshots.refetch();
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      setBusy(false);
    }
  };

  const activeChannel = view.mode === "channel" ? channelById(view.id) : undefined;

  return (
    <AdminShell title="لوحة الاستديو والمحتوى">
      <StudioTabs />
      <AdminPageHead
        title="إضافة أو تعديل الأكواد البرمجية"
        description="ابدأ من القائمة المصنّفة حسب لغة البرمجة، أو افتح شجرة الكود المصدري الكاملة. كل حفظ يسبقه لقطة إلزامية، والاسترجاع من قائمة اللقطات."
      />

      <div className="grid gap-[var(--sp-4)] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-[var(--sp-4)]">
          {view.mode === "catalog" ? (
            <>
              <AdminCard
                title="أنواع الأكواد"
                description="اختر نوع/لغة الكود لتفتح محرره الخاص."
              >
                <ul className="space-y-2">
                  {CODE_CHANNELS.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.icon];
                    return (
                      <li key={channel.id}>
                        <button
                          type="button"
                          onClick={() => void openChannel(channel.id)}
                          className="flex w-full items-start gap-[var(--sp-3)] rounded-[var(--r-card)] border border-border bg-card p-3 text-start transition hover:border-primary/40 hover:bg-muted"
                          style={{ minHeight: 56 }}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-nav font-bold text-foreground">
                              {channel.label}
                            </span>
                            <span className="block text-nav text-muted-foreground">
                              {channel.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </AdminCard>

              <AdminCard
                title="شجرة الكود المصدري الكاملة"
                description="الوصول الكامل كما هو — القائمة المصنّفة أعلاه طبقة تنظيم فوقه لا بديل عنه."
              >
                <Button
                  variant="outline"
                  onClick={() => setView({ mode: "tree" })}
                  style={{ minHeight: 44 }}
                >
                  <FolderTree className="size-4" aria-hidden />
                  تصفّح كل ملفات المشروع
                </Button>
              </AdminCard>
            </>
          ) : null}

          {view.mode === "channel" && activeChannel ? (
            <AdminCard
              title={activeChannel.label}
              description={activeChannel.description}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setView({ mode: "catalog" })}
                  style={{ minHeight: 40 }}
                >
                  <ChevronUp className="size-4" aria-hidden />
                  رجوع للأنواع
                </Button>
              }
            >
              {activeChannel.shortcuts.length > 0 ? (
                <div className="mb-[var(--sp-3)] space-y-1">
                  <p className="text-nav font-bold text-foreground">الملفات الشائعة</p>
                  <ul className="space-y-1">
                    {activeChannel.shortcuts.map((shortcut) => (
                      <li key={shortcut.path}>
                        <button
                          type="button"
                          onClick={() => void openFile(shortcut.path)}
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-start hover:bg-muted"
                          style={{ minHeight: 44 }}
                        >
                          <span className="block text-nav text-foreground">{shortcut.label}</span>
                          <span className="block truncate text-nav text-muted-foreground" dir="ltr">
                            {shortcut.path}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="mb-2 flex items-center gap-[var(--sp-2)]">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">تصفية الملفات</span>
                <Input
                  dir="ltr"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="تصفية بالمسار"
                  style={{ minHeight: 44 }}
                />
              </label>

              {kindBusy ? (
                <Skeleton className="h-40 w-full" />
              ) : filtered.length === 0 ? (
                <p className="text-desc text-muted-foreground">
                  لا ملفات من هذا النوع في بنية المشروع الحالية.
                </p>
              ) : (
                <ul className="max-h-[420px] space-y-1 overflow-auto">
                  {filtered.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        dir="ltr"
                        onClick={() => void openFile(file.path)}
                        className="flex w-full items-center gap-[var(--sp-2)] rounded-xl px-2 py-2 text-start text-nav text-foreground hover:bg-muted"
                        style={{ minHeight: 40 }}
                      >
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{file.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-nav text-muted-foreground">
                {filtered.length.toLocaleString("en-US")} ملف
              </p>
            </AdminCard>
          ) : null}

          {view.mode === "tree" ? (
            <AdminCard
              title="شجرة الملفات"
              description={dir === "." ? "جذر المشروع" : dir}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setView({ mode: "catalog" })}
                  style={{ minHeight: 40 }}
                >
                  <ChevronUp className="size-4" aria-hidden />
                  رجوع للأنواع
                </Button>
              }
            >
              <div className="mb-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={dir === "."}
                  onClick={() => void load(parentOf(dir))}
                  style={{ minHeight: 40 }}
                >
                  <ChevronUp className="size-4" aria-hidden />
                  للأعلى
                </Button>
              </div>
              <ul className="max-h-[520px] space-y-1 overflow-auto">
                {entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      dir="ltr"
                      onClick={() =>
                        entry.kind === "dir" ? void load(entry.path) : void openFile(entry.path)
                      }
                      className="flex w-full items-center gap-[var(--sp-2)] rounded-xl px-2 py-2 text-start text-nav text-foreground hover:bg-muted"
                      style={{ minHeight: 40 }}
                    >
                      {entry.kind === "dir" ? (
                        <Folder className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="truncate">{entry.path.split("/").pop()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : null}
        </div>

        <div className="space-y-[var(--sp-4)]">
          <AdminCard
            title={openPath ?? "لم يُفتح ملف"}
            description="الكتابة مباشرة على الملف الحي — لا مسودة ولا نشر منفصل."
            actions={
              <Button disabled={!openPath || !dirty || busy} onClick={() => void save()} style={{ minHeight: 44 }}>
                <Save className="size-4" aria-hidden />
                حفظ مع نسخة احتياطية
              </Button>
            }
          >
            <textarea
              dir="ltr"
              spellCheck={false}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setDirty(true);
              }}
              disabled={!openPath}
              className="h-[420px] w-full resize-y rounded-[var(--r-card)] border border-border bg-card p-3 font-mono text-[13px] leading-relaxed text-foreground"
            />
          </AdminCard>

          <AdminCard
            title="النسخ الاحتياطية والاسترجاع"
            description="كل حفظ يُنشئ لقطة للمحتوى السابق، والاسترجاع يأخذ لقطة جديدة قبل الكتابة."
          >
            {snapshots.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : (snapshots.data ?? []).length === 0 ? (
              <p className="flex items-center gap-[var(--sp-2)] text-desc text-muted-foreground">
                <History className="size-4" aria-hidden />
                لا لقطات لهذا الملف بعد.
              </p>
            ) : (
              <ul className="space-y-2">
                {(snapshots.data ?? []).map((snap) => (
                  <li
                    key={snap.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--r-card)] border border-border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-nav text-foreground" dir="ltr">
                        {snap.file_path}
                      </span>
                      <span className="block text-nav text-muted-foreground">
                        {formatDateTime(snap.created_at)} ·{" "}
                        {snap.byte_size.toLocaleString("en-US")} حرف ·{" "}
                        {snap.reason === "restore" ? "قبل استرجاع" : "قبل حفظ"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !snap.existed}
                      onClick={() => void rollback(snap.id)}
                      style={{ minHeight: 40 }}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      استرجاع
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminShell>
  );
}
