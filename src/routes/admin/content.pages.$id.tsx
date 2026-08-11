/**
 * محرّر الصفحة — /admin/content/pages/$id
 *
 * ثلاثة أعمدة: المكتبة (نفس `BLOCK_LIBRARY`)، لوحة الرسم بمقاسات الجوال
 * والتابلت والكمبيوتر، ولوحة الخصائص المبنية من تعريف الكتلة.
 *
 * الحفظ التلقائي كل ثانيتين من آخر تعديل، مع تراجع/إعادة محلي وحرس تعارض
 * تحرير: إن حفظ محرِّر آخر نسخةً أحدث يظهر الخطأ ولا تُكتب فوق عمله بصمت.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  History,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { BlockFieldEditor } from "@/components/admin/cms/BlockFieldEditor";
import { PageSettingsCard } from "@/components/admin/cms/PageSettingsCard";
import { PreflightList } from "@/components/admin/cms/PreflightList";
import { AdminCard, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { PageBlocks } from "@/components/marketplace/composer/PageBlocks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  DEVICE_WIDTH,
  duplicateBlock,
  newBlock,
  preflightPage,
  useBlockHistory,
  useCmsErrorText,
  useCmsMutations,
  useCmsPage,
  useCmsVersions,
  usePageEditLock,
  validateBlocks,
  type CmsBlock,
  type CmsDevice,
  type CmsVersion,
} from "@/lib/mkt-cms";
import { BLOCK_LIBRARY, blockDefinition, type PageBlock } from "@/lib/mkt-page-composer";


export const Route = createFileRoute("/admin/content/pages/$id")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "محرّر الصفحة — كَحيل" },
      { name: "description", content: "بناء كتل الصفحة ومعاينتها بثلاثة مقاسات قبل النشر." },
      { property: "og:title", content: "محرّر الصفحة — كَحيل" },
      { property: "og:description", content: "لوحة رسم الصفحة ومكتبة المكوّنات ولوحة الخصائص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsPageEditor,
});

const DEVICES: { key: CmsDevice; label: string; icon: typeof Monitor }[] = [
  { key: "mobile", label: "جوال", icon: Smartphone },
  { key: "tablet", label: "تابلت", icon: Tablet },
  { key: "desktop", label: "كمبيوتر", icon: Monitor },
];

/** كتل المحرّر → شكل صفوف العارض العام، بلا نسخة ثانية من العارض. */
function toPreviewBlocks(blocks: CmsBlock[], page: string): PageBlock[] {
  return blocks
    .filter((b) => b.hidden !== true)
    .map((b, index) => ({
      id: b.id,
      page,
      block_type: b.block_type,
      settings: b.settings,
      sort_order: index * 10,
      hidden: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }));
}

function CmsPageEditor() {
  const { id } = Route.useParams();
  const page = useCmsPage(id);
  const versions = useCmsVersions(id);
  const mutations = useCmsMutations(id);
  const errorText = useCmsErrorText();
  const lock = usePageEditLock(id, true);

  const [device, setDevice] = useState<CmsDevice>("mobile");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CmsVersion | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const history = useBlockHistory([]);
  const bootstrapped = useRef(false);
  const dirty = useRef(false);

  /** أحدث نسخة مسودة، أو نسخة جديدة منسوخة من المنشورة. */
  useEffect(() => {
    if (bootstrapped.current || !versions.data) return;
    const list = versions.data;
    const editable = list.find((v) => v.status === "draft");
    if (editable) {
      bootstrapped.current = true;
      setDraft(editable);
      history.reset(editable.blocks ?? []);
      return;
    }
    const published = list.find((v) => v.status === "published") ?? list[0];
    bootstrapped.current = true;
    mutations.newVersion.mutate(
      {
        blocks: (published?.blocks ?? []).map((b) => ({ ...b, id: crypto.randomUUID() })),
        note: published ? `مسودة من النسخة ${published.version_no}` : "مسودة أولى",
      },
      {
        onSuccess: (created) => {
          setDraft(created);
          history.reset(created.blocks ?? []);
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.data]);

  const blocks = history.blocks;
  const issues = useMemo(() => validateBlocks(blocks).issues, [blocks]);
  const preflight = useMemo(
    () => (page.data ? preflightPage(page.data, blocks) : []),
    [page.data, blocks],
  );
  const blockingCount = preflight.filter((i) => i.blocking).length;


  const commit = useCallback(
    (next: CmsBlock[]) => {
      dirty.current = true;
      history.push(next);
    },
    [history],
  );

  /** حفظ تلقائي بعد سكون ثانيتين — لا زر حفظ إجباري. */
  useEffect(() => {
    if (!draft || !dirty.current || lock.blocked) return;
    const t = setTimeout(() => {
      mutations.saveDraft.mutate(
        { versionId: draft.id, blocks, expectedUpdatedAt: draft.updated_at },
        {
          onSuccess: (saved) => {
            dirty.current = false;
            setDraft(saved);
            setSavedAt(saved.updated_at);
            setConflict(false);
          },
          onError: (error) => {
            if (error instanceof Error && error.message.includes("EDIT_CONFLICT")) setConflict(true);
            else toast.error(errorText(error));
          },
        },
      );
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, draft?.id, draft?.updated_at, lock.blocked]);

  const current = blocks.find((b) => b.id === selected) ?? null;
  const def = current ? blockDefinition(current.block_type) : undefined;

  const move = (index: number, delta: number) => {
    const next = [...blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    commit(next);
  };

  const publish = () => {
    if (!draft) return;
    if (issues.length > 0) {
      toast.error("توجد كتلة غير معروفة — لا يمكن النشر");
      return;
    }
    if (blockingCount > 0) {
      toast.error(`فحص ما قبل النشر: ${blockingCount} بند مانع`);
      return;
    }

    mutations.publish.mutate(draft.id, {
      onSuccess: () => {
        toast.success("نُشرت الصفحة");
        bootstrapped.current = false;
        void versions.refetch();
      },
      onError: (error) => toast.error(errorText(error)),
    });
  };

  if (page.isLoading || !draft) {
    return (
      <AdminShell title="محرّر الصفحة">
        <Skeleton className="h-[420px] w-full" />
      </AdminShell>
    );
  }

  if (page.isError || !page.data) {
    return (
      <AdminShell title="محرّر الصفحة">
        <AdminCard title="غير متاح">
          <p className="text-desc text-muted-foreground">
            تعذّر فتح الصفحة — قد تكون محذوفة أو بلا صلاحية.
          </p>
        </AdminCard>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="محرّر الصفحة">
      <AdminPageHead
        title={page.data.title_ar}
        description={`${page.data.route_path} • نسخة ${draft.version_no} مسودة${
          savedAt ? ` • حُفظ ${formatDateTime(savedAt)}` : ""
        }`}
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin/content">
                <ArrowLeft aria-hidden className="size-4" />
                الصفحات
              </Link>
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="تراجع"
              className="size-11"
              disabled={!history.canUndo}
              onClick={history.undo}
            >
              <Undo2 aria-hidden className="size-5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="إعادة"
              className="size-11"
              disabled={!history.canRedo}
              onClick={history.redo}
            >
              <Redo2 aria-hidden className="size-5" />
            </Button>
            <Button
              disabled={mutations.publish.isPending || blockingCount > 0}
              onClick={publish}
              style={{ minHeight: 44 }}
            >
              <Upload aria-hidden className="size-4" />
              نشر
            </Button>
          </>
        }
      />

      {lock.blocked && (
        <AdminCard title="محرِّر آخر يعمل على هذه الصفحة" accent className="mb-[var(--sp-4)]">
          <p className="text-desc text-muted-foreground">
            التحرير معروض للقراءة فقط الآن حتى ينتهي المحرِّر الآخر — لن يُكتب فوق عمله.
          </p>
        </AdminCard>
      )}

      {conflict && (
        <AdminCard title="تعارض تحرير" className="mb-[var(--sp-4)]">
          <p className="text-desc text-muted-foreground">
            حُفظت نسخة أحدث على الخادم. أعد تحميل الصفحة لتأخذ آخر حالة قبل المتابعة.
          </p>
          <Button className="mt-2" variant="outline" onClick={() => window.location.reload()}>
            إعادة التحميل
          </Button>
        </AdminCard>
      )}

      <div className="grid gap-[var(--sp-4)] lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        {/* المكتبة */}
        <AdminCard title="المكوّنات" description="نفس مكتبة المؤلّف — سجل واحد.">
          <ul className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-1">
            {BLOCK_LIBRARY.map((item) => (
              <li key={item.type}>
                <button
                  type="button"
                  disabled={lock.blocked}
                  onClick={() => {
                    const block = newBlock(item.type);
                    commit([...blocks, block]);
                    setSelected(block.id);
                  }}
                  className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-start text-nav font-bold text-foreground"
                  style={{ minHeight: 44 }}
                >
                  {item.name_ar}
                </button>
              </li>
            ))}
          </ul>
        </AdminCard>

        {/* لوحة الرسم */}
        <div className="space-y-[var(--sp-3)]">
          <div className="flex flex-wrap items-center gap-2">
            {DEVICES.map((d) => (
              <Button
                key={d.key}
                size="sm"
                variant={device === d.key ? "default" : "outline"}
                onClick={() => setDevice(d.key)}
                style={{ minHeight: 44 }}
              >
                <d.icon aria-hidden className="size-4" />
                {d.label}
              </Button>
            ))}
            <span className="text-nav text-muted-foreground" dir="ltr">
              {DEVICE_WIDTH[device]}px
            </span>
          </div>

          <AdminCard title="المعاينة" description="نفس عارض الكتل المستخدم في الصفحات العامة.">
            <div className="overflow-x-auto">
              <div
                className="mx-auto rounded-[var(--r-card)] border border-border bg-background p-3"
                style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
              >
                {blocks.length === 0 ? (
                  <p className="py-8 text-center text-desc text-muted-foreground">
                    أضف مكوّنًا من المكتبة لتبدأ.
                  </p>
                ) : (
                  <PageBlocks blocks={toPreviewBlocks(blocks, page.data.slug)} />
                )}
              </div>
            </div>
          </AdminCard>

          <AdminCard title="ترتيب الكتل" description="حدّد كتلة لتعديل خصائصها.">
            <ul className="space-y-2">
              {blocks.map((block, index) => (
                <li
                  key={block.id}
                  className={[
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2",
                    block.id === selected ? "border-primary" : "border-border",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(block.id)}
                    className="min-w-0 text-start"
                    style={{ minHeight: 44 }}
                  >
                    <span className="block truncate text-body font-bold text-foreground">
                      {blockDefinition(block.block_type)?.name_ar ?? block.block_type}
                    </span>
                    <span className="block truncate text-nav text-muted-foreground">
                      {block.hidden ? "مخفية" : "مرئية"}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="أعلى"
                      className="size-11"
                      disabled={lock.blocked}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="أسفل"
                      className="size-11"
                      disabled={lock.blocked}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={block.hidden ? "إظهار" : "إخفاء"}
                      className="size-11"
                      disabled={lock.blocked}
                      onClick={() =>
                        commit(
                          blocks.map((b) =>
                            b.id === block.id ? { ...b, hidden: !(b.hidden === true) } : b,
                          ),
                        )
                      }
                    >
                      {block.hidden ? (
                        <EyeOff aria-hidden className="size-5" />
                      ) : (
                        <Eye aria-hidden className="size-5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="تكرار"
                      className="size-11"
                      disabled={lock.blocked}
                      onClick={() => commit([...blocks, duplicateBlock(block)])}
                    >
                      <Copy aria-hidden className="size-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف"
                      className="size-11 text-destructive"
                      disabled={lock.blocked}
                      onClick={() => {
                        commit(blocks.filter((b) => b.id !== block.id));
                        if (selected === block.id) setSelected(null);
                      }}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>

        {/* الخصائص + النسخ */}
        <div className="space-y-[var(--sp-4)]">
          <PreflightList items={preflight} />

          <PageSettingsCard
            page={page.data}
            mutations={mutations}
            errorText={errorText}
            disabled={lock.blocked}
            onChanged={() => void page.refetch()}
          />

          <AdminCard title="الخصائص">
            {!current || !def ? (
              <p className="text-desc text-muted-foreground">اختر كتلة من القائمة.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-desc text-muted-foreground">{def.description_ar}</p>
                {def.fields.length === 0 ? (
                  <p className="text-nav text-muted-foreground">لا خصائص لهذه الكتلة.</p>
                ) : (
                  def.fields.map((field) => (
                    <BlockFieldEditor
                      key={field.key}
                      field={field}
                      value={current.settings[field.key]}
                      onChange={(next) =>
                        commit(
                          blocks.map((b) =>
                            b.id === current.id
                              ? { ...b, settings: { ...b.settings, [field.key]: next } }
                              : b,
                          ),
                        )
                      }
                    />
                  ))
                )}
              </div>
            )}
          </AdminCard>

          <AdminCard title="النسخ" description="الرجوع ينسخ نسخة كاملة ثم ينشرها.">
            <ul className="space-y-2">
              {(versions.data ?? []).slice(0, 10).map((v) => (
                <li
                  key={v.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border p-2"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-nav font-bold text-foreground">
                      نسخة {v.version_no} — {v.status === "published" ? "منشورة" : "مسودة"}
                    </span>
                    <span className="block truncate text-nav text-muted-foreground">
                      {formatDateTime(v.created_at)}
                    </span>
                  </div>
                  {v.status === "published" ? null : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutations.rollback.isPending}
                      onClick={() =>
                        mutations.rollback.mutate(v.id, {
                          onSuccess: () => {
                            toast.success("تم الرجوع بنسخة كاملة");
                            bootstrapped.current = false;
                            void versions.refetch();
                          },
                          onError: (error) => toast.error(errorText(error)),
                        })
                      }
                    >
                      <History aria-hidden className="size-4" />
                      رجوع
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      </div>
    </AdminShell>
  );
}
