/**
 * محرّر لوح الرسم — سحب/تحجيم/تدوير حقيقي داخل لوح بنسبة ثابتة.
 *
 * كل شيء بالنِسَب المئوية: الإمساك يحسب فرق المؤشر ÷ مقاس اللوح، فيتصرّف المحرّر
 * نفس التصرّف على الجوال وسطح المكتب وعند أي تكبير. القفل والإخفاء يمنعان
 * الإمساك بالخطأ، والالتقاط (snap) يحاذي المركز والأثلاث بفارق ١٪.
 *
 * التراجع/الإعادة يحفظان ٣٠ خطوة، والحالة كلها في هذا المكوّن — الحفظ في القاعدة
 * يقع في الشاشة المستضيفة.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { CanvasArtboard, elementBoxStyle } from "@/components/admin/canvas/CanvasArtboard";
import { Button } from "@/components/ui/button";
import type { DesignShape } from "@/lib/mkt-design-library";
import { artboard, MAX_ELEMENTS, type CanvasElement } from "@/lib/mkt-canvas";

const SNAP_TARGETS = [33.333, 50, 66.667];
const SNAP_TOLERANCE = 1;

function snap(value: number): { value: number; guide: number | null } {
  for (const target of SNAP_TARGETS) {
    if (Math.abs(value - target) <= SNAP_TOLERANCE) return { value: target, guide: target };
  }
  return { value, guide: null };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 100) / 100;

type Mode = "move" | "resize" | "rotate";

export function useCanvasHistory(initial: CanvasElement[]) {
  const [past, setPast] = useState<CanvasElement[][]>([]);
  const [future, setFuture] = useState<CanvasElement[][]>([]);
  const [elements, setElements] = useState<CanvasElement[]>(initial);

  const commit = useCallback((next: CanvasElement[]) => {
    setPast((prev) => [...prev.slice(-29), elements]);
    setFuture([]);
    setElements(next);
  }, [elements]);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      setFuture((f) => [elements, ...f].slice(0, 30));
      setElements(last);
      return prev.slice(0, -1);
    });
  }, [elements]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0]!;
      setPast((p) => [...p.slice(-29), elements]);
      setElements(first);
      return prev.slice(1);
    });
  }, [elements]);

  const reset = useCallback((next: CanvasElement[]) => {
    setPast([]);
    setFuture([]);
    setElements(next);
  }, []);

  return { elements, commit, undo, redo, reset, canUndo: past.length > 0, canRedo: future.length > 0 };
}

export function CanvasEditor({
  ratio,
  elements,
  shapes,
  slotUrls,
  selectedId,
  onSelect,
  onChange,
  history,
}: {
  ratio: string;
  elements: CanvasElement[];
  shapes: DesignShape[];
  slotUrls: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: CanvasElement[]) => void;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const drag = useRef<{
    id: string;
    mode: Mode;
    pointerId: number;
    startX: number;
    startY: number;
    box: { x: number; y: number; w: number; h: number; rot: number };
    rect: DOMRect;
  } | null>(null);

  const board = artboard(ratio);
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const patch = useCallback(
    (id: string, next: Partial<CanvasElement>) => {
      onChange(
        elements.map((element) =>
          element.id === id ? ({ ...element, ...next } as CanvasElement) : element,
        ),
      );
    },
    [elements, onChange],
  );

  function begin(event: React.PointerEvent, element: CanvasElement, mode: Mode) {
    if (element.lock) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    onSelect(element.id);
    drag.current = {
      id: element.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      box: { x: element.x, y: element.y, w: element.w, h: element.h, rot: element.rot },
      rect,
    };
  }

  function move(event: React.PointerEvent) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dxPct = ((event.clientX - state.startX) / state.rect.width) * 100;
    const dyPct = ((event.clientY - state.startY) / state.rect.height) * 100;
    // في الاتجاه من اليمين لليسار يكون محور البداية معكوسًا.
    const rtl = getComputedStyle(state.rect ? document.documentElement : document.documentElement).direction === "rtl";
    const dx = rtl ? -dxPct : dxPct;

    if (state.mode === "move") {
      const nx = snap(clamp(state.box.x + dx, -10, 100));
      const ny = snap(clamp(state.box.y + dyPct, -10, 100));
      setGuides({ x: nx.guide, y: ny.guide });
      patch(state.id, { x: round(nx.value), y: round(ny.value) } as Partial<CanvasElement>);
      return;
    }

    if (state.mode === "resize") {
      patch(state.id, {
        w: round(clamp(state.box.w + dx, 3, 130)),
        h: round(clamp(state.box.h + dyPct, 3, 130)),
      } as Partial<CanvasElement>);
      return;
    }

    const degrees = clamp(state.box.rot + dxPct * 2, -180, 180);
    patch(state.id, { rot: Math.round(degrees) } as Partial<CanvasElement>);
  }

  function end() {
    drag.current = null;
    setGuides({ x: null, y: null });
  }

  const layers = useMemo(() => [...elements].reverse(), [elements]);

  function reorder(id: string, direction: -1 | 1) {
    const index = elements.findIndex((e) => e.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= elements.length) return;
    const next = [...elements];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }

  function duplicate(element: CanvasElement) {
    if (elements.length >= MAX_ELEMENTS) return;
    if (element.kind === "text" && elements.filter((e) => e.kind === "text").length >= 3) return;
    onChange([
      ...elements,
      {
        ...element,
        id: `${element.kind}-${Date.now()}`,
        x: round(clamp(element.x + 4, -10, 100)),
        y: round(clamp(element.y + 4, -10, 100)),
      } as CanvasElement,
    ]);
  }

  return (
    <div className="space-y-[var(--sp-3)]">
      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="size-11"
          aria-label="تراجع"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 aria-hidden className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-11"
          aria-label="إعادة"
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Redo2 aria-hidden className="size-5" />
        </Button>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <Button
          size="icon"
          variant="outline"
          className="size-11"
          aria-label="تصغير العرض"
          onClick={() => setZoom((z) => Math.max(1, round(z - 0.25)))}
        >
          <ZoomOut aria-hidden className="size-5" />
        </Button>
        <span className="text-[14px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button
          size="icon"
          variant="outline"
          className="size-11"
          aria-label="تكبير العرض"
          onClick={() => setZoom((z) => Math.min(2.5, round(z + 0.25)))}
        >
          <ZoomIn aria-hidden className="size-5" />
        </Button>
        <span className="ms-auto text-[14px] text-muted-foreground">
          {elements.length} / {MAX_ELEMENTS} عنصر · {board.label_ar}
        </span>
      </div>

      {/* اللوح */}
      <div className="overflow-auto rounded-[var(--r-card)] bg-secondary/40 p-[var(--sp-3)]">
        <div style={{ width: `${zoom * 100}%` }}>
          <div ref={boardRef} onPointerDown={() => onSelect(null)}>
            <CanvasArtboard ratio={ratio} elements={elements} shapes={shapes} slotUrls={slotUrls}>
              {/* خطوط المحاذاة */}
              {guides.x !== null ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0 h-full w-px bg-primary"
                  style={{ insetInlineStart: `${guides.x}%` }}
                />
              ) : null}
              {guides.y !== null ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute start-0 h-px w-full bg-primary"
                  style={{ top: `${guides.y}%` }}
                />
              ) : null}

              {/* مقابض التحديد */}
              {elements
                .filter((element) => !element.hidden)
                .map((element) => (
                  <div
                    key={`handle-${element.id}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`عنصر ${element.kind}`}
                    style={{ ...elementBoxStyle(element), cursor: element.lock ? "not-allowed" : "move" }}
                    className={
                      "touch-none " +
                      (selectedId === element.id
                        ? "outline outline-2 outline-offset-2 outline-primary"
                        : "outline outline-1 outline-transparent hover:outline-primary/40")
                    }
                    onPointerDown={(event) => begin(event, element, "move")}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    onKeyDown={(event) => {
                      if (element.lock) return;
                      const step = event.shiftKey ? 5 : 1;
                      if (event.key === "ArrowLeft") patch(element.id, { x: round(element.x - step) } as never);
                      if (event.key === "ArrowRight") patch(element.id, { x: round(element.x + step) } as never);
                      if (event.key === "ArrowUp") patch(element.id, { y: round(element.y - step) } as never);
                      if (event.key === "ArrowDown") patch(element.id, { y: round(element.y + step) } as never);
                    }}
                  >
                    {selectedId === element.id && !element.lock ? (
                      <>
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label="تحجيم"
                          className="absolute -bottom-3 -end-3 size-6 rounded-full border-2 border-card bg-primary"
                          onPointerDown={(event) => begin(event, element, "resize")}
                          onPointerMove={move}
                          onPointerUp={end}
                        />
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label="تدوير"
                          className="absolute -top-3 -end-3 grid size-6 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground"
                          onPointerDown={(event) => begin(event, element, "rotate")}
                          onPointerMove={move}
                          onPointerUp={end}
                        >
                          <RotateCw aria-hidden className="size-3" />
                        </span>
                      </>
                    ) : null}
                  </div>
                ))}
            </CanvasArtboard>
          </div>
        </div>
      </div>

      {/* الطبقات */}
      <div className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-3)]">
        <p className="mb-[var(--sp-2)] text-[16px] font-bold text-foreground">الطبقات</p>
        {layers.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">أضف عنصرًا من أزرار الإضافة أعلاه.</p>
        ) : (
          <ul className="space-y-2">
            {layers.map((element) => (
              <li
                key={element.id}
                className={
                  "flex items-center gap-1 rounded-[12px] border p-1 " +
                  (selectedId === element.id ? "border-primary bg-primary/5" : "border-border")
                }
              >
                <button
                  type="button"
                  onClick={() => onSelect(element.id)}
                  className="min-w-0 flex-1 truncate px-2 text-start text-[14px] text-foreground"
                  style={{ minHeight: 44 }}
                >
                  {element.kind === "text"
                    ? `نص: ${element.text}`
                    : element.kind === "shape"
                      ? `شكل: ${element.shape_key}`
                      : element.kind === "image"
                        ? `صورة: ${element.slot_key}`
                        : `شخصية: ${element.name === "kaheel" ? "كَحيل" : "كَحيلان"}`}
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label="لأعلى"
                  onClick={() => reorder(element.id, 1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label="لأسفل"
                  onClick={() => reorder(element.id, -1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label={element.hidden ? "إظهار" : "إخفاء"}
                  onClick={() => patch(element.id, { hidden: !element.hidden } as never)}
                >
                  {element.hidden ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label={element.lock ? "فتح القفل" : "قفل"}
                  onClick={() => patch(element.id, { lock: !element.lock } as never)}
                >
                  {element.lock ? (
                    <Lock aria-hidden className="size-4" />
                  ) : (
                    <LockOpen aria-hidden className="size-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label="تكرار"
                  onClick={() => duplicate(element)}
                >
                  <Copy aria-hidden className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 text-destructive"
                  aria-label="حذف"
                  onClick={() => onChange(elements.filter((e) => e.id !== element.id))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? <p className="text-[14px] text-muted-foreground">المحدَّد: {selected.kind}</p> : null}
    </div>
  );
}
