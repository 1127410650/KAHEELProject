/**
 * /admin/studio/canvas — استوديو الرسم: «ورقة بيضاء» تُرسم عليها كتل المنصة.
 *
 * المدير يختار لوحًا بنسبة ثابتة، يضيف نصًا أو شكلًا من المكتبة أو صورة من فتحة
 * وسائط أو شخصية، يسحب ويحجّم ويدوّر، ثم يصدّر WebP مختومًا بعلامة كَحيل ويحوّله
 * إلى كتلة مخصصة بمناطق نقر تُستخدم في المؤلّف.
 *
 * لا كود ولا مسارات حرة: الأشكال والصور من مكتبات مسجّلة، ووجهات النقر من خريطة
 * المسارات العامة أو https، والكتابة كلها تمرّ بسياسات `mkt_is_platform_admin`.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, ImagePlus, Plus, Save, Shapes, Sparkles, Trash2, Type } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminEmptyState, AdminPageHead } from "@/components/admin/AdminPage";
import { CanvasEditor, useCanvasHistory } from "@/components/admin/canvas/CanvasEditor";
import { HotspotEditor } from "@/components/admin/canvas/HotspotEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { MASCOT_NAMES } from "@/lib/mascot-assets";
import { useDesignLibrary } from "@/lib/mkt-design-library";
import { useMediaSlots } from "@/lib/mkt-media-slots";
import { useCustomBlockMutations, useCustomBlocks, type BlockZone } from "@/lib/mkt-custom-blocks";
import {
  ARTBOARDS,
  CANVAS_COLORS,
  MAX_ELEMENTS,
  MAX_TEXT_ELEMENTS,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  rasterizeDesign,
  uploadDesignPreview,
  useCanvasDesigns,
  useCanvasMutations,
  type ArtboardRatio,
  type CanvasDesign,
  type CanvasElement,
} from "@/lib/mkt-canvas";

export const Route = createFileRoute("/admin/studio/canvas")({
  head: () => ({
    meta: [
      { title: "استوديو الرسم — كَحيل" },
      {
        name: "description",
        content: "ارسم كتل المنصة على لوح فارغ: نصوص وأشكال وصور وشخصيات، ثم صدّرها ككتلة قابلة للنقر.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "استوديو الرسم — كَحيل" },
      { property: "og:description", content: "لوح رسم إداري يحوّل التصميم إلى كتلة جاهزة للمؤلّف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanvasStudioPage,
});

const SELECT =
  "mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-[16px] font-bold text-foreground";

function CanvasStudioPage() {
  const designs = useCanvasDesigns();
  const blocks = useCustomBlocks();
  const lib = useDesignLibrary(true);
  const slots = useMediaSlots();
  const canvasMutations = useCanvasMutations();
  const blockMutations = useCustomBlockMutations();

  const [designId, setDesignId] = useState<string | null>(null);
  const [name, setName] = useState("تصميم جديد");
  const [ratio, setRatio] = useState<ArtboardRatio>("16/5");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [zones, setZones] = useState<BlockZone[]>([]);
  const [blockName, setBlockName] = useState("");
  const history = useCanvasHistory([]);

  const shapes = lib.data?.shapes ?? [];
  const slotList = useMemo(
    () => (slots.data ?? []).filter((slot) => slot.kind === "image" || slot.url),
    [slots.data],
  );
  const slotUrls = useMemo(() => {
    const out: Record<string, string> = {};
    for (const slot of slots.data ?? []) if (slot.url) out[slot.slot_key] = slot.url;
    return out;
  }, [slots.data]);

  const current: CanvasDesign | null = (designs.data ?? []).find((d) => d.id === designId) ?? null;
  const linkedBlock = (blocks.data ?? []).find((b) => b.design_id === designId) ?? null;

  function loadDesign(design: CanvasDesign) {
    setDesignId(design.id);
    setName(design.name);
    setRatio(design.artboard_ratio as ArtboardRatio);
    history.reset(design.elements);
    setSelectedId(null);
    const block = (blocks.data ?? []).find((b) => b.design_id === design.id) ?? null;
    setZones(block?.zones ?? []);
    setBlockName(block?.name ?? design.name);
  }

  function newDesign() {
    setDesignId(null);
    setName("تصميم جديد");
    setRatio("16/5");
    history.reset([]);
    setSelectedId(null);
    setZones([]);
    setBlockName("");
  }

  function add(element: CanvasElement) {
    if (history.elements.length >= MAX_ELEMENTS) {
      toast.error(`الحد ${MAX_ELEMENTS} عنصرًا في اللوح.`);
      return;
    }
    if (
      element.kind === "text" &&
      history.elements.filter((e) => e.kind === "text").length >= MAX_TEXT_ELEMENTS
    ) {
      toast.error(`الحد ${MAX_TEXT_ELEMENTS} نصوص — التصميم البصري أولًا.`);
      return;
    }
    history.commit([...history.elements, element]);
    setSelectedId(element.id);
  }

  const base = (kind: string) => ({
    id: `${kind}-${Date.now()}`,
    x: 20,
    y: 25,
    w: 30,
    h: 25,
    rot: 0,
  });

  async function saveDesign() {
    try {
      const row = await canvasMutations.save.mutateAsync({
        id: designId,
        name,
        artboard_ratio: ratio,
        elements: history.elements,
      });
      setDesignId(row.id);
      toast.success("حُفظ التصميم.");
    } catch {
      toast.error("تعذّر الحفظ — تأكد من صلاحية الإدارة.");
    }
  }

  async function exportDesign() {
    if (!designId) {
      toast.error("احفظ التصميم أولًا ثم صدّره.");
      return;
    }
    setExporting(true);
    try {
      const blob = await rasterizeDesign({ elements: history.elements, ratio, shapes, slotUrls });
      await uploadDesignPreview({ id: designId, preview_path: current?.preview_path ?? null }, blob);
      await designs.refetch();
      toast.success("صُدِّر التصميم مختومًا بعلامة كَحيل.");
    } catch {
      toast.error("تعذّر التصدير — تأكد من ظهور كل الصور في المعاينة.");
    } finally {
      setExporting(false);
    }
  }

  async function saveBlock() {
    if (!designId) {
      toast.error("احفظ التصميم أولًا.");
      return;
    }
    try {
      await blockMutations.save.mutateAsync({
        id: linkedBlock?.id ?? null,
        name: blockName || name,
        design_id: designId,
        zones,
      });
      toast.success("جهزت الكتلة — اختَرها من المؤلّف كـ «كتلتي المخصصة».");
    } catch {
      toast.error("تعذّر حفظ الكتلة — تحقّق من وجهات النقر.");
    }
  }

  const selected = history.elements.find((e) => e.id === selectedId) ?? null;

  return (
    <AdminShell title="استوديو الرسم">
      <AdminPageHead
        title="استوديو الرسم"
        description="ورقة بيضاء بنسبة ثابتة: أضف نصًا وشكلًا وصورة وشخصية، اسحب وحجّم ودوّر، ثم صدّر ككتلة قابلة للنقر."
      />

      <div className="grid gap-[var(--sp-4)] lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* اللوح والمحرّر */}
        <div className="space-y-[var(--sp-4)]">
          <AdminCard title="اللوح">
            <div className="mb-[var(--sp-3)] grid gap-[var(--sp-3)] sm:grid-cols-2">
              <div>
                <Label htmlFor="design-name">اسم التصميم</Label>
                <Input
                  id="design-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="design-ratio">نسبة اللوح</Label>
                <select
                  id="design-ratio"
                  className={SELECT}
                  value={ratio}
                  onChange={(event) => setRatio(event.target.value as ArtboardRatio)}
                >
                  {ARTBOARDS.map((board) => (
                    <option key={board.ratio} value={board.ratio}>
                      {board.label_ar}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-[var(--sp-3)] flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  add({
                    ...base("text"),
                    kind: "text",
                    text: "نص جديد",
                    size: 36,
                    weight: 800,
                    color: "foreground",
                    align: "center",
                    h: 12,
                  } as CanvasElement)
                }
              >
                <Type aria-hidden className="me-1 size-4" /> نص
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={shapes.length === 0}
                onClick={() =>
                  add({
                    ...base("shape"),
                    kind: "shape",
                    shape_key: shapes[0]!.key,
                    color: "primary",
                    opacity: 100,
                  } as CanvasElement)
                }
              >
                <Shapes aria-hidden className="me-1 size-4" /> شكل
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={slotList.length === 0}
                onClick={() =>
                  add({
                    ...base("image"),
                    kind: "image",
                    slot_key: slotList[0]!.slot_key,
                    fit: "cover",
                    radius: 4,
                  } as CanvasElement)
                }
              >
                <ImagePlus aria-hidden className="me-1 size-4" /> صورة
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  add({ ...base("mascot"), kind: "mascot", name: "kaheel", flip: false } as CanvasElement)
                }
              >
                <Sparkles aria-hidden className="me-1 size-4" /> شخصية
              </Button>
            </div>

            {lib.isLoading || slots.isLoading ? (
              <Skeleton className="h-64 w-full rounded-[var(--r-card)]" />
            ) : (
              <CanvasEditor
                ratio={ratio}
                elements={history.elements}
                shapes={shapes}
                slotUrls={slotUrls}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={history.commit}
                history={history}
              />
            )}

            <div className="mt-[var(--sp-3)] flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={() => void saveDesign()}>
                <Save aria-hidden className="me-1 size-4" /> حفظ التصميم
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={exporting || !designId}
                onClick={() => void exportDesign()}
              >
                <Download aria-hidden className="me-1 size-4" />
                {exporting ? "جارٍ التصدير…" : "تصدير WebP مختوم"}
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={newDesign}>
                <Plus aria-hidden className="me-1 size-4" /> تصميم جديد
              </Button>
            </div>
          </AdminCard>

          <AdminCard
            title="تحويل إلى كتلة قابلة للنقر"
            description="حتى ٦ مناطق نقر فوق التصميم المصدَّر، وكل منطقة لها وجهة ووصف صوتي."
          >
            <div className="mb-[var(--sp-3)]">
              <Label htmlFor="block-name">اسم الكتلة</Label>
              <Input
                id="block-name"
                value={blockName}
                maxLength={80}
                placeholder={name}
                onChange={(event) => setBlockName(event.target.value)}
              />
            </div>
            <HotspotEditor
              ratio={ratio}
              previewUrl={current?.previewUrl ?? null}
              zones={zones}
              onChange={setZones}
            />
            <Button
              type="button"
              className="mt-[var(--sp-3)] min-h-11"
              disabled={!designId}
              onClick={() => void saveBlock()}
            >
              <Save aria-hidden className="me-1 size-4" /> حفظ الكتلة
            </Button>
          </AdminCard>
        </div>

        {/* المفتّش والمكتبة */}
        <div className="space-y-[var(--sp-4)]">
          <AdminCard title="خصائص العنصر">
            {!selected ? (
              <p className="text-[14px] text-muted-foreground">اختر عنصرًا من اللوح أو من قائمة الطبقات.</p>
            ) : (
              <ElementInspector
                element={selected}
                shapes={shapes.map((s) => ({ key: s.key, label: s.label_ar }))}
                slots={slotList.map((s) => ({ key: s.slot_key, label: s.title_ar ?? s.slot_key }))}
                onPatch={(next) =>
                  history.commit(
                    history.elements.map((e) =>
                      e.id === selected.id ? ({ ...e, ...next } as CanvasElement) : e,
                    ),
                  )
                }
              />
            )}
          </AdminCard>

          <AdminCard title="تصاميمي">
            {designs.isLoading ? (
              <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
            ) : (designs.data ?? []).length === 0 ? (
              <AdminEmptyState title="لا تصاميم بعد" description="ابدأ بلوح فارغ وأضف أول عنصر." />
            ) : (
              <ul className="space-y-2">
                {(designs.data ?? []).map((design) => (
                  <li
                    key={design.id}
                    className={
                      "flex items-center gap-1 rounded-[12px] border p-1 " +
                      (design.id === designId ? "border-primary bg-primary/5" : "border-border")
                    }
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-2 py-1 text-start"
                      style={{ minHeight: 44 }}
                      onClick={() => loadDesign(design)}
                    >
                      <span className="block truncate text-[16px] font-bold text-foreground">{design.name}</span>
                      <span className="block text-[14px] text-muted-foreground">
                        {design.artboard_ratio} · {formatDateTime(design.updated_at)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 text-destructive"
                      aria-label={`حذف ${design.name}`}
                      onClick={() => {
                        void canvasMutations.remove
                          .mutateAsync(design.id)
                          .then(() => {
                            if (design.id === designId) newDesign();
                            toast.success("نُقل التصميم إلى المحذوفات (بلا حذف نهائي).");
                          })
                          .catch(() => toast.error("تعذّر الحذف."));
                      }}
                    >
                      <Trash2 aria-hidden className="size-4" />
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

function ElementInspector({
  element,
  shapes,
  slots,
  onPatch,
}: {
  element: CanvasElement;
  shapes: { key: string; label: string }[];
  slots: { key: string; label: string }[];
  onPatch: (next: Partial<CanvasElement>) => void;
}) {
  return (
    <div className="space-y-[var(--sp-3)]">
      {element.kind === "text" ? (
        <>
          <div>
            <Label htmlFor="el-text">النص</Label>
            <Input
              id="el-text"
              value={element.text}
              maxLength={120}
              onChange={(event) => onPatch({ text: event.target.value } as Partial<CanvasElement>)}
            />
          </div>
          <div>
            <Label htmlFor="el-size">مقاس الخط ({element.size})</Label>
            <Input
              id="el-size"
              type="range"
              min={TEXT_SIZE_MIN}
              max={TEXT_SIZE_MAX}
              value={element.size}
              onChange={(event) => onPatch({ size: Number(event.target.value) } as Partial<CanvasElement>)}
            />
          </div>
          <div>
            <Label htmlFor="el-weight">الثقل</Label>
            <select
              id="el-weight"
              className={SELECT}
              value={element.weight}
              onChange={(event) => onPatch({ weight: Number(event.target.value) as 400 | 700 | 800 } as Partial<CanvasElement>)}
            >
              <option value={400}>عادي</option>
              <option value={700}>عريض</option>
              <option value={800}>عريض جدًا</option>
            </select>
          </div>
          <div>
            <Label htmlFor="el-align">المحاذاة</Label>
            <select
              id="el-align"
              className={SELECT}
              value={element.align}
              onChange={(event) => onPatch({ align: event.target.value as "start" | "center" | "end" } as Partial<CanvasElement>)}
            >
              <option value="start">للبداية</option>
              <option value="center">للوسط</option>
              <option value="end">للنهاية</option>
            </select>
          </div>
          <ColorPicker value={element.color} onPick={(color) => onPatch({ color } as Partial<CanvasElement>)} />
        </>
      ) : null}

      {element.kind === "shape" ? (
        <>
          <div>
            <Label htmlFor="el-shape">الشكل</Label>
            <select
              id="el-shape"
              className={SELECT}
              value={element.shape_key}
              onChange={(event) => onPatch({ shape_key: event.target.value } as Partial<CanvasElement>)}
            >
              {shapes.map((shape) => (
                <option key={shape.key} value={shape.key}>
                  {shape.label}
                </option>
              ))}
            </select>
          </div>
          <ColorPicker value={element.color} onPick={(color) => onPatch({ color } as Partial<CanvasElement>)} />
          <div>
            <Label htmlFor="el-opacity">الشفافية ({element.opacity}%)</Label>
            <Input
              id="el-opacity"
              type="range"
              min={10}
              max={100}
              value={element.opacity}
              onChange={(event) => onPatch({ opacity: Number(event.target.value) } as Partial<CanvasElement>)}
            />
          </div>
        </>
      ) : null}

      {element.kind === "image" ? (
        <>
          <div>
            <Label htmlFor="el-slot">فتحة الوسائط</Label>
            <select
              id="el-slot"
              className={SELECT}
              value={element.slot_key}
              onChange={(event) => onPatch({ slot_key: event.target.value } as Partial<CanvasElement>)}
            >
              {slots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="el-fit">طريقة الملء</Label>
            <select
              id="el-fit"
              className={SELECT}
              value={element.fit}
              onChange={(event) => onPatch({ fit: event.target.value as "cover" | "contain" } as Partial<CanvasElement>)}
            >
              <option value="cover">تغطية</option>
              <option value="contain">احتواء</option>
            </select>
          </div>
          <div>
            <Label htmlFor="el-radius">استدارة الحواف ({element.radius}%)</Label>
            <Input
              id="el-radius"
              type="range"
              min={0}
              max={50}
              value={element.radius}
              onChange={(event) => onPatch({ radius: Number(event.target.value) } as Partial<CanvasElement>)}
            />
          </div>
        </>
      ) : null}

      {element.kind === "mascot" ? (
        <>
          <div>
            <Label htmlFor="el-mascot">الشخصية</Label>
            <select
              id="el-mascot"
              className={SELECT}
              value={element.name}
              onChange={(event) => onPatch({ name: event.target.value as "kaheel" | "kaheelan" } as Partial<CanvasElement>)}
            >
              {MASCOT_NAMES.map((mascot) => (
                <option key={mascot} value={mascot}>
                  {mascot === "kaheel" ? "كَحيل" : "كَحيلان"}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onPatch({ flip: !element.flip } as Partial<CanvasElement>)}
          >
            {element.flip ? "إلغاء قلب الاتجاه" : "قلب الاتجاه"}
          </Button>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-[var(--sp-3)]">
        <div>
          <Label htmlFor="el-w">العرض %</Label>
          <Input
            id="el-w"
            type="number"
            min={3}
            max={130}
            value={element.w}
            onChange={(event) => onPatch({ w: Number(event.target.value) || 3 } as Partial<CanvasElement>)}
          />
        </div>
        <div>
          <Label htmlFor="el-h">الارتفاع %</Label>
          <Input
            id="el-h"
            type="number"
            min={3}
            max={130}
            value={element.h}
            onChange={(event) => onPatch({ h: Number(event.target.value) || 3 } as Partial<CanvasElement>)}
          />
        </div>
        <div>
          <Label htmlFor="el-rot">التدوير °</Label>
          <Input
            id="el-rot"
            type="number"
            min={-180}
            max={180}
            value={element.rot}
            onChange={(event) => onPatch({ rot: Number(event.target.value) || 0 } as Partial<CanvasElement>)}
          />
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ value, onPick }: { value: string; onPick: (key: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-[14px] font-bold text-foreground">اللون</p>
      <div className="flex flex-wrap gap-2">
        {CANVAS_COLORS.map((color) => (
          <button
            key={color.key}
            type="button"
            aria-label={color.label_ar}
            aria-pressed={value === color.key}
            onClick={() => onPick(color.key)}
            className={
              "size-11 rounded-full border-2 " +
              (value === color.key ? "border-foreground" : "border-border")
            }
            style={{ backgroundColor: `var(--${color.key === "foreground" ? "foreground" : color.key})` }}
          />
        ))}
      </div>
    </div>
  );
}
