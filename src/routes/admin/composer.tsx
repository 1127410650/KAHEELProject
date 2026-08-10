/**
 * مؤلّف الشاشات — /admin/composer
 *
 * كل شاشة عامة = قائمة كتل من `mkt_page_blocks`. هنا يختار المدير الصفحة،
 * يسحب الكتل لإعادة الترتيب، يعدّل إعدادات كل كتلة بنموذج مبني من تعريفها،
 * يخفي/يحذف ناعمًا ويسترجع، ويحفظ التركيبة الحالية كنسخة تصميم يمكن استرجاعها.
 *
 * حدود مقصودة: لا HTML ولا CSS حر، حد ٢٠ كتلة (مفروض في القاعدة أيضًا)، وكل
 * تعديل يُسجَّل في `mkt_page_block_audit` باسم فاعله ووقته.
 */

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  GripVertical,
  History,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { PageBlocks } from "@/components/marketplace/composer/PageBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { useDesignLibrary } from "@/lib/mkt-design-library";
import { useMediaSlots } from "@/lib/mkt-media-slots";
import {
  ANCHOR_OPTIONS,
  BLOCK_LIBRARY,
  COMPOSER_PAGES,
  MAX_BLOCKS_PER_PAGE,
  blockDefinition,
  defaultSettings,
  useAllPageBlocks,
  useComposerMutations,
  usePageCompositions,
  type BlockField,
  type BlockSettings,
  type BlockType,
  type PageBlock,
} from "@/lib/mkt-page-composer";
import { ROUTE_MAP } from "@/lib/routes-map";

export const Route = createFileRoute("/admin/composer")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مؤلّف الشاشات — كَحيل" },
      {
        name: "description",
        content: "تأليف الشاشات العامة كقائمة كتل: الترتيب، الإعدادات، نسخ التصميم، والمعاينة الحية.",
      },
      { property: "og:title", content: "مؤلّف الشاشات — كَحيل" },
      { property: "og:description", content: "كل شاشة عامة تُؤلَّف من لوحة المدير بلا كود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminComposerPage,
});

const ERROR_TEXT: Record<string, string> = {
  BLOCK_LIMIT_REACHED: `الحد ${MAX_BLOCKS_PER_PAGE} كتلة لكل صفحة`,
  NOT_ADMIN: "هذه الشاشة لمسؤولي المنصة فقط",
  BLOCK_NOT_FOUND: "الكتلة غير موجودة",
  COMPOSITION_NOT_FOUND: "النسخة غير موجودة",
};

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  for (const key of Object.keys(ERROR_TEXT)) {
    if (message.includes(key)) return ERROR_TEXT[key]!;
  }
  return "تعذّر التنفيذ — أعد المحاولة";
}

/** حقل واحد من تعريف الكتلة. لا حقل نص حر يُفسَّر كـ HTML: كله نص عادي. */
function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const slots = useMediaSlots();
  const lib = useDesignLibrary(field.type === "shape");

  const internalRoutes = useMemo(
    () => ROUTE_MAP.filter((r) => r.is_public && !r.path.includes("$")).map((r) => r.path),
    [],
  );

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
        <Label className="text-desc">{field.label_ar}</Label>
        <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }

  const options: { value: string; label_ar: string }[] =
    field.type === "select"
      ? (field.options ?? [])
      : field.type === "anchor"
        ? ANCHOR_OPTIONS
        : field.type === "slot"
          ? (slots.data ?? []).map((s) => ({ value: s.slot_key, label_ar: s.slot_key }))
          : field.type === "shape"
            ? (lib.data?.shapes ?? []).map((s) => ({ value: s.key, label_ar: s.label_ar }))
            : field.type === "link"
              ? internalRoutes.map((p) => ({ value: p, label_ar: p }))
              : [];

  return (
    <div className="space-y-1">
      <Label className="text-desc">{field.label_ar}</Label>

      {options.length > 0 && field.type !== "link" ? (
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger style={{ minHeight: 44 }}>
            <SelectValue placeholder="اختر" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "link" ? (
        <div className="space-y-1">
          <Select value="" onValueChange={onChange}>
            <SelectTrigger style={{ minHeight: 44 }}>
              <SelectValue placeholder="وجهة داخلية من خريطة المسارات" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            dir="ltr"
            value={typeof value === "string" ? value : ""}
            placeholder="/search أو https://..."
            onChange={(event) => onChange(event.target.value.trim())}
            style={{ minHeight: 44 }}
          />
          <p className="text-nav text-muted-foreground">
            الروابط الخارجية تبدأ بـ https:// وتُفتح بأيقونة خروج.
          </p>
        </div>
      ) : field.type === "number" ? (
        <Input
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ minHeight: 44 }}
        />
      ) : (
        <Input
          value={typeof value === "string" ? value : ""}
          maxLength={120}
          onChange={(event) => onChange(event.target.value.replace(/[<>]/g, ""))}
          style={{ minHeight: 44 }}
        />
      )}

      {field.hint_ar && <p className="text-nav text-muted-foreground">{field.hint_ar}</p>}
    </div>
  );
}

function BlockRow({
  block,
  onSave,
  onDelete,
  onRestore,
  busy,
}: {
  block: PageBlock;
  onSave: (patch: { settings?: BlockSettings; hidden?: boolean }) => void;
  onDelete: () => void;
  onRestore: () => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BlockSettings>(block.settings);
  const def = blockDefinition(block.block_type);
  const deleted = block.deleted_at !== null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "rounded-2xl border border-border bg-card p-3",
        isDragging ? "opacity-70 shadow-lg" : "",
        deleted ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="اسحب لإعادة الترتيب"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-start"
          style={{ minHeight: 44 }}
        >
          <span className="block truncate text-body font-bold text-foreground">
            {def?.name_ar ?? block.block_type}
          </span>
          <span className="block truncate text-nav text-muted-foreground">
            {deleted ? "محذوفة — قابلة للاسترجاع" : block.hidden ? "مخفية" : "مرئية"} •{" "}
            {formatDateTime(block.updated_at)}
          </span>
        </button>

        {deleted ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onRestore}>
            <RotateCcw aria-hidden className="size-4" />
            استرجاع
          </Button>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={block.hidden ? "إظهار" : "إخفاء"}
              disabled={busy}
              onClick={() => onSave({ hidden: !block.hidden })}
              className="size-11"
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
              aria-label="حذف"
              disabled={busy}
              onClick={onDelete}
              className="size-11 text-destructive"
            >
              <Trash2 aria-hidden className="size-5" />
            </Button>
          </>
        )}
      </div>

      {open && !deleted && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <p className="text-desc text-muted-foreground">{def?.description_ar}</p>
          {(def?.fields ?? []).map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={draft[field.key]}
              onChange={(next) => setDraft((prev) => ({ ...prev, [field.key]: next }))}
            />
          ))}
          <Button
            disabled={busy}
            onClick={() => onSave({ settings: draft })}
            style={{ minHeight: 44 }}
          >
            <Save aria-hidden className="size-4" />
            حفظ إعدادات الكتلة
          </Button>
        </div>
      )}
    </li>
  );
}

function AdminComposerPage() {
  const [page, setPage] = useState<string>(COMPOSER_PAGES[0].page);
  const [addType, setAddType] = useState<BlockType>("hero_gradient");
  const [snapshotName, setSnapshotName] = useState("");

  const blocks = useAllPageBlocks(page);
  const compositions = usePageCompositions(page);
  const m = useComposerMutations(page);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rows = blocks.data ?? [];
  const live = rows.filter((b) => b.deleted_at === null);
  const trashed = rows.filter((b) => b.deleted_at !== null);
  const preview = live.filter((b) => !b.hidden);
  const busy =
    m.save.isPending || m.remove.isPending || m.restore.isPending || m.reorder.isPending || m.apply.isPending;

  function run(promise: Promise<unknown>, ok: string) {
    promise.then(() => toast.success(ok)).catch((error: unknown) => toast.error(errorText(error)));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = live.findIndex((b) => b.id === active.id);
    const to = live.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    const ids = arrayMove(live, from, to).map((b) => b.id);
    run(m.reorder.mutateAsync(ids), "تم حفظ الترتيب الجديد");
  }

  return (
    <AdminShell title="مؤلّف الشاشات">
      <div className="space-y-5">
        {/* اختيار الصفحة */}
        <div className="rounded-2xl border border-border bg-card p-3">
          <Label className="text-desc">الصفحة</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMPOSER_PAGES.map((p) => (
              <Button
                key={p.page}
                variant={p.page === page ? "default" : "outline"}
                onClick={() => setPage(p.page)}
                style={{ minHeight: 44 }}
              >
                {p.name_ar}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-nav text-muted-foreground">
            الكتل المرئية: {preview.length} من {MAX_BLOCKS_PER_PAGE}
          </p>
        </div>

        {/* إضافة كتلة */}
        <div className="rounded-2xl border border-border bg-card p-3">
          <Label className="text-desc">إضافة كتلة من المكتبة</Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={addType} onValueChange={(v) => setAddType(v as BlockType)}>
              <SelectTrigger className="min-w-[220px]" style={{ minHeight: 44 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_LIBRARY.map((def) => (
                  <SelectItem key={def.type} value={def.type}>
                    {def.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={busy || live.length >= MAX_BLOCKS_PER_PAGE}
              onClick={() =>
                run(
                  m.save.mutateAsync({
                    page,
                    block_type: addType,
                    settings: defaultSettings(addType),
                  }),
                  "أُضيفت الكتلة في نهاية الصفحة",
                )
              }
              style={{ minHeight: 44 }}
            >
              <Plus aria-hidden className="size-4" />
              إضافة
            </Button>
          </div>
        </div>

        {/* الكتل: سحب لإعادة الترتيب */}
        <section>
          <h2 className="mb-3 text-xl font-extrabold text-foreground">كتل الصفحة</h2>
          {blocks.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : live.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-desc text-muted-foreground">
              لا كتل بعد — الصفحة تعرض تركيبها المكتوب في الكود حتى تُضاف أول كتلة.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={live.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {live.map((block) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      busy={busy}
                      onSave={(patch) =>
                        run(
                          m.save.mutateAsync({
                            id: block.id,
                            page,
                            block_type: block.block_type,
                            ...patch,
                          }),
                          "تم الحفظ",
                        )
                      }
                      onDelete={() => run(m.remove.mutateAsync(block.id), "حُذفت الكتلة (قابلة للاسترجاع)")}
                      onRestore={() => run(m.restore.mutateAsync(block.id), "أُعيدت الكتلة")}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {/* المحذوفة ناعمًا */}
        {trashed.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-extrabold text-foreground">كتل محذوفة</h2>
            <ul className="space-y-2">
              {trashed.map((block) => (
                <li
                  key={block.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3"
                >
                  <span className="text-body font-bold text-foreground">
                    {blockDefinition(block.block_type)?.name_ar ?? block.block_type}
                  </span>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(m.restore.mutateAsync(block.id), "أُعيدت الكتلة")}
                    style={{ minHeight: 44 }}
                  >
                    <RotateCcw aria-hidden className="size-4" />
                    استرجاع
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* نسخ التصميم */}
        <section className="rounded-2xl border border-border bg-card p-3">
          <h2 className="text-xl font-extrabold text-foreground">نسخ التصميم</h2>
          <p className="mt-1 text-desc text-muted-foreground">
            حفظ التركيبة الحالية باسم، واسترجاع أي نسخة لاحقًا. الاسترجاع يحفظ الحالة الراهنة
            تلقائيًا أولًا، فلا تُفقد تركيبة أبدًا.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={snapshotName}
              maxLength={60}
              placeholder="اسم النسخة — مثال: رمضان ٢٠٢٦"
              onChange={(event) => setSnapshotName(event.target.value.replace(/[<>]/g, ""))}
              className="min-w-0 flex-1"
              style={{ minHeight: 44 }}
            />
            <Button
              disabled={busy || snapshotName.trim().length < 2}
              onClick={() => {
                run(m.snapshot.mutateAsync(snapshotName.trim()), "حُفظت نسخة التصميم");
                setSnapshotName("");
              }}
              style={{ minHeight: 44 }}
            >
              <Save aria-hidden className="size-4" />
              حفظ نسخة
            </Button>
          </div>

          <ul className="mt-3 space-y-2">
            {(compositions.data ?? []).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-2"
              >
                <span className="min-w-0 flex-1 truncate text-desc text-foreground">
                  <History aria-hidden className="me-1 inline size-4 align-[-2px]" />
                  {c.name_ar} • {c.block_count} كتلة • {formatDateTime(c.created_at)}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(m.apply.mutateAsync(c.id), "تم استرجاع النسخة")}
                  style={{ minHeight: 44 }}
                >
                  استرجاع
                </Button>
              </li>
            ))}
            {compositions.data?.length === 0 && (
              <li className="text-nav text-muted-foreground">لا نسخ محفوظة لهذه الصفحة بعد.</li>
            )}
          </ul>
        </section>

        {/* معاينة حية بنفس عارض الكتل الذي يستخدمه الزائر */}
        <section>
          <h2 className="mb-3 text-xl font-extrabold text-foreground">معاينة حية</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-background p-3">
            {preview.length === 0 ? (
              <p className="text-desc text-muted-foreground">لا كتل مرئية لتُعرض.</p>
            ) : (
              <PageBlocks blocks={preview} />
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
