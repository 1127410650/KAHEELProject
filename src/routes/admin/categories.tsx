/**
 * شاشة إدارة الأقسام: عرض شجري (رئيسي ← فرعي) بأزرار نقل تعمل على الجوال،
 * إضافة/إعادة تسمية/تعطيل، ترقية إلى رئيسي وتخفيض إلى فرعي، ودمج قسم في قسم
 * بتأكيد مزدوج. كل عملية تنفّذها دالة `SECURITY DEFINER` في القاعدة وتُسجَّل
 * في `mkt_category_audit` الظاهر أسفل الصفحة.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpToLine, Loader2, Merge, Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import {
  categoryName,
  createCategory,
  demoteCategory,
  loadCategoryAudit,
  loadCategoryListingCounts,
  mergeCategories,
  moveCategory,
  promoteCategory,
  renameCategory,
  setCategoryActive,
  useCategoryTree,
  type CategoryNode,
} from "@/lib/mkt-category-tree";

export const Route = createFileRoute("/admin/categories")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إدارة الأقسام — كَحيل" },
      {
        name: "description",
        content: "الهيكل الشجري للأقسام الرئيسية والفرعية: النقل، الترقية، التخفيض، والدمج.",
      },
      { property: "og:title", content: "إدارة الأقسام — كَحيل" },
      { property: "og:description", content: "شجرة أقسام السوق وعوالم الأقسام الرئيسية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCategoriesPage,
});

const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";

function AdminCategoriesPage() {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const tree = useCategoryTree(true);
  const counts = useQuery({
    queryKey: ["mkt", "category-listing-counts"],
    queryFn: loadCategoryListingCounts,
    staleTime: 60_000,
  });
  const audit = useQuery({
    queryKey: ["mkt", "category-audit"],
    queryFn: () => loadCategoryAudit(40),
  });

  const [busy, setBusy] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  const rows = tree.data ?? [];
  const primaries = useMemo(
    () => rows.filter((r) => r.parent_id === null && !r.deleted_at),
    [rows],
  );
  const visible = useMemo(() => rows.filter((r) => !r.deleted_at), [rows]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["mkt", "category-tree"] });
    await qc.invalidateQueries({ queryKey: ["mkt", "categories"] });
    await qc.invalidateQueries({ queryKey: ["mkt", "category-audit"] });
    await qc.invalidateQueries({ queryKey: ["mkt", "media-slots"] });
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => {
    const row = rows.find((r) => r.id === id);
    return row ? categoryName(row, locale) : "";
  };

  const onMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) {
      toast.error("اختر قسمًا مصدرًا وقسمًا هدفًا مختلفين");
      return;
    }
    const listings = counts.data?.[mergeSource] ?? 0;
    // تأكيد مزدوج: العملية تنقل كل إعلانات المصدر وتخفيه.
    if (
      !window.confirm(
        `دمج «${nameOf(mergeSource)}» في «${nameOf(mergeTarget)}»؟ ستنتقل ${listings} إعلانًا.`,
      )
    )
      return;
    if (!window.confirm("تأكيد نهائي: المصدر سيُخفى ويحوَّل مساره القديم 301 إلى الهدف.")) return;

    await run("تم الدمج", async () => {
      const result = await mergeCategories(mergeSource, mergeTarget);
      toast.message(
        `نُقل ${result.moved_listings} إعلانًا و${result.moved_children} قسمًا فرعيًا إلى «${result.target}»`,
      );
      setMergeSource("");
      setMergeTarget("");
    });
  };

  return (
    <AdminShell title="إدارة الأقسام">
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-desc text-muted-foreground">
            الأقسام الرئيسية لها عالمها على <code>/c/{"{slug}"}</code> وبلاطتها في الرئيسية. العمق
            مستويان: رئيسي ← فرعي.
          </p>
          <Button type="button" onClick={() => setOpenAdd((v) => !v)} disabled={busy}>
            <Plus className="me-1 size-4" aria-hidden /> إضافة قسم
          </Button>
        </header>

        {openAdd && (
          <AddCategoryCard
            primaries={primaries}
            locale={locale}
            busy={busy}
            onCreate={(input) =>
              run("أُضيف القسم", async () => {
                await createCategory(input);
                setOpenAdd(false);
              })
            }
          />
        )}

        {tree.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {primaries.map((primary) => (
              <li key={primary.id} className="rounded-[var(--r-card)] border border-border bg-card p-3">
                <CategoryRow
                  row={primary}
                  locale={locale}
                  count={counts.data?.[primary.id] ?? 0}
                  busy={busy}
                  primaries={primaries}
                  onRename={(nameAr, nameEn) =>
                    run("تم التحديث", () => renameCategory({ id: primary.id, nameAr, nameEn }))
                  }
                  onToggle={() =>
                    run(primary.is_active ? "عُطّل القسم" : "فُعّل القسم", () =>
                      setCategoryActive(primary.id, !primary.is_active),
                    )
                  }
                  onPromote={() => run("صار قسمًا رئيسيًا بعالمه", () => promoteCategory(primary.id))}
                  onDemote={(parentId) =>
                    run("خُفّض إلى فرعي مع تحويل 301", () => demoteCategory(primary.id, parentId))
                  }
                  onMove={(parentId) => run("تم النقل", () => moveCategory(primary.id, parentId))}
                />

                <ul className="mt-2 space-y-2 border-t border-border pt-2">
                  {visible
                    .filter((row) => row.parent_id === primary.id)
                    .map((child) => (
                      <li key={child.id} className="rounded-xl bg-muted/40 p-2">
                        <CategoryRow
                          row={child}
                          locale={locale}
                          count={counts.data?.[child.id] ?? 0}
                          busy={busy}
                          primaries={primaries}
                          onRename={(nameAr, nameEn) =>
                            run("تم التحديث", () => renameCategory({ id: child.id, nameAr, nameEn }))
                          }
                          onToggle={() =>
                            run(child.is_active ? "عُطّل القسم" : "فُعّل القسم", () =>
                              setCategoryActive(child.id, !child.is_active),
                            )
                          }
                          onPromote={() =>
                            run("صار قسمًا رئيسيًا بعالمه", () => promoteCategory(child.id))
                          }
                          onDemote={(parentId) =>
                            run("خُفّض إلى فرعي مع تحويل 301", () =>
                              demoteCategory(child.id, parentId),
                            )
                          }
                          onMove={(parentId) => run("تم النقل", () => moveCategory(child.id, parentId))}
                        />
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {/* دمج قسم في قسم */}
        <section className="rounded-[var(--r-card)] border border-border bg-card p-3">
          <h2 className="text-section font-bold text-foreground">دمج قسم في قسم</h2>
          <p className="mt-1 text-desc text-muted-foreground">
            كل إعلانات المصدر تنتقل إلى الهدف، والمصدر يُخفى بحذف ناعم ومساره القديم يحوَّل 301 —
            لا حذف فعلي لأي سجل.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <Label htmlFor="merge-source">المصدر</Label>
              <select
                id="merge-source"
                className={selectClass}
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
              >
                <option value="">اختر…</option>
                {visible.map((row) => (
                  <option key={row.id} value={row.id}>
                    {categoryName(row, locale)} ({counts.data?.[row.id] ?? 0})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="merge-target">الهدف</Label>
              <select
                id="merge-target"
                className={selectClass}
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">اختر…</option>
                {visible.map((row) => (
                  <option key={row.id} value={row.id}>
                    {categoryName(row, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="destructive" onClick={onMerge} disabled={busy}>
                {busy ? (
                  <Loader2 className="me-1 size-4 animate-spin" aria-hidden />
                ) : (
                  <Merge className="me-1 size-4" aria-hidden />
                )}
                دمج
              </Button>
            </div>
          </div>
        </section>

        {/* سجل التدقيق */}
        <section className="rounded-[var(--r-card)] border border-border bg-card p-3">
          <h2 className="text-section font-bold text-foreground">سجل عمليات الأقسام</h2>
          <ul className="mt-2 divide-y divide-border">
            {(audit.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-desc">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                  {ACTION_LABELS[row.action] ?? row.action}
                </span>
                <span className="font-semibold text-foreground">{row.source_slug ?? "—"}</span>
                {row.target_slug ? <span className="text-muted-foreground">← {row.target_slug}</span> : null}
                {row.moved_listings > 0 ? (
                  <span className="text-muted-foreground">{row.moved_listings} إعلانًا</span>
                ) : null}
                <span className="ms-auto text-muted-foreground">{formatDateTime(row.created_at)}</span>
              </li>
            ))}
            {(audit.data ?? []).length === 0 && (
              <li className="py-3 text-desc text-muted-foreground">لا عمليات بعد.</li>
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

const ACTION_LABELS: Record<string, string> = {
  create: "إضافة",
  rename: "تسمية",
  move: "نقل",
  promote: "ترقية",
  demote: "تخفيض",
  merge: "دمج",
  activate: "تفعيل",
  deactivate: "تعطيل",
};

function CategoryRow({
  row,
  locale,
  count,
  busy,
  primaries,
  onRename,
  onToggle,
  onPromote,
  onDemote,
  onMove,
}: {
  row: CategoryNode;
  locale: string;
  count: number;
  busy: boolean;
  primaries: CategoryNode[];
  onRename: (nameAr: string, nameEn: string) => void;
  onToggle: () => void;
  onPromote: () => void;
  onDemote: (parentId: string) => void;
  onMove: (parentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameAr, setNameAr] = useState(row.name_ar);
  const [nameEn, setNameEn] = useState(row.name_en);
  const [parentPick, setParentPick] = useState("");

  const targets = primaries.filter((p) => p.id !== row.id);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="min-w-0 truncate text-body font-bold text-foreground">
          {categoryName(row, locale)}
        </strong>
        <code className="text-nav text-muted-foreground">{row.slug}</code>
        {row.is_primary && (
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-nav font-bold text-gold-foreground">
            رئيسي · /c/{row.slug}
          </span>
        )}
        {!row.is_active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-nav font-bold text-muted-foreground">
            معطّل
          </span>
        )}
        <span className="text-nav text-muted-foreground">{count} إعلانًا</span>

        <div className="ms-auto flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing((v) => !v)} disabled={busy}>
            تسمية
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onToggle} disabled={busy}>
            {row.is_active ? "تعطيل" : "تفعيل"}
          </Button>
          {!row.is_primary && (
            <Button type="button" size="sm" onClick={onPromote} disabled={busy}>
              <ArrowUpToLine className="me-1 size-4" aria-hidden /> ترقية إلى رئيسي
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor={`ar-${row.id}`}>الاسم بالعربية</Label>
            <Input id={`ar-${row.id}`} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`en-${row.id}`}>الاسم بالإنجليزية</Label>
            <Input id={`en-${row.id}`} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => {
                onRename(nameAr.trim(), nameEn.trim());
                setEditing(false);
              }}
              disabled={busy || !nameAr.trim()}
            >
              حفظ
            </Button>
          </div>
        </div>
      )}

      {targets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem]">
            <Label htmlFor={`parent-${row.id}`}>
              {row.is_primary ? "الرئيسي الأب (للتخفيض)" : "نقل إلى رئيسي"}
            </Label>
            <select
              id={`parent-${row.id}`}
              className={selectClass}
              value={parentPick}
              onChange={(e) => setParentPick(e.target.value)}
            >
              <option value="">اختر…</option>
              {targets.map((p) => (
                <option key={p.id} value={p.id}>
                  {categoryName(p, locale)}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !parentPick}
            onClick={() => (row.is_primary ? onDemote(parentPick) : onMove(parentPick))}
          >
            <ArrowDownToLine className="me-1 size-4" aria-hidden />
            {row.is_primary ? "تخفيض إلى فرعي" : "نقل"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddCategoryCard({
  primaries,
  locale,
  busy,
  onCreate,
}: {
  primaries: CategoryNode[];
  locale: string;
  busy: boolean;
  onCreate: (input: { parentId: string | null; slug: string; nameAr: string; nameEn?: string }) => void;
}) {
  const [slug, setSlug] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [parentId, setParentId] = useState("");

  return (
    <section className="rounded-[var(--r-card)] border border-border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <Label htmlFor="new-slug">المعرّف (slug)</Label>
          <Input id="new-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="restaurants" />
        </div>
        <div>
          <Label htmlFor="new-ar">الاسم بالعربية</Label>
          <Input id="new-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-en">الاسم بالإنجليزية</Label>
          <Input id="new-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-parent">القسم الأب</Label>
          <select
            id="new-parent"
            className={selectClass}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">بلا أب (قسم جذري)</option>
            {primaries.map((p) => (
              <option key={p.id} value={p.id}>
                {categoryName(p, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="button"
        className="mt-3"
        disabled={busy || !slug.trim() || !nameAr.trim()}
        onClick={() =>
          onCreate({
            parentId: parentId || null,
            slug: slug.trim(),
            nameAr: nameAr.trim(),
            ...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}),
          })
        }
      >
        إضافة
      </Button>
    </section>
  );
}
