import { useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, RefreshCw, Repeat, Star, X } from "lucide-react";

import { useI18n } from "@/i18n";
import { ACCEPT_ATTR, MAX_LISTING_IMAGES, type StagedImage } from "@/lib/mkt-listing-media";
import type { ListingImagesApi } from "@/lib/use-listing-images";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  api: ListingImagesApi;
}

/**
 * Photo grid of an ad: multi upload with per-photo progress, retry of a single
 * failed photo, drag ordering (mouse, touch and keyboard), cover choice,
 * replace and delete. Controls sit under each photo so nothing covers it.
 */
export function ListingImages({ api }: Props) {
  const { t } = useI18n();
  const remaining = Math.max(0, MAX_LISTING_IMAGES - api.activeCount);
  const inputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // A short hold starts the drag on touch, so scrolling still works.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = api.items.findIndex((i) => i.id === active.id);
    const to = api.items.findIndex((i) => i.id === over.id);
    api.reorder(from, to);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          // Extra files beyond the limit are refused with a visible message.
          if (picked.length > 0) api.addFiles(picked);
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && replacing) api.replace(replacing, file);
          setReplacing(null);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={remaining === 0}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-3 text-sm text-muted-foreground disabled:opacity-60"
      >
        <ImagePlus className="size-4" aria-hidden />
        {t("market.media.add")}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {t("market.media.hint").replace("{max}", String(MAX_LISTING_IMAGES))}
      </p>

      {api.loading && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={api.items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {api.items.map((item) => (
              <PhotoTile
                key={item.id}
                item={item}
                isCover={api.coverId === item.id}
                onCover={() => api.setCover(item.id)}
                onRemove={() => api.remove(item.id)}
                onRetry={() => api.retry(item.id)}
                onReplace={() => {
                  setReplacing(item.id);
                  replaceRef.current?.click();
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface TileProps {
  item: StagedImage;
  isCover: boolean;
  onCover: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onReplace: () => void;
}

function PhotoTile({ item, isCover, onCover, onRemove, onRetry, onReplace }: TileProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  // The preview URL is owned by the state hook: it is revoked when the photo is
  // removed, never on unmount, so reordering cannot break an existing preview.


  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`min-w-0 rounded-lg border border-border bg-card p-1.5 ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {item.preview ? (
          <img src={item.preview} alt={item.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden />
          </div>
        )}
        {item.status === "uploading" && (
          <div className="absolute inset-x-0 bottom-0 bg-background/80 px-1.5 py-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
            </div>
            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              <span dir="ltr">{item.progress}%</span>
            </span>
          </div>
        )}
      </div>

      {item.status === "failed" && (
        <p className="mt-1 text-[11px] text-destructive">
          {t(`market.media.err.${item.error ?? "upload"}`)}
        </p>
      )}
      {isCover && item.status === "ready" && (
        <p className="mt-1 text-[11px] font-medium text-primary">{t("market.dash.cover")}</p>
      )}

      <div className="mt-1 flex items-center justify-between gap-0.5">
        <button
          type="button"
          className="flex size-11 touch-none items-center justify-center rounded-md text-muted-foreground"
          aria-label={t("market.media.drag")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {item.status === "failed" && item.error === "upload" ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11"
            aria-label={t("market.media.retry")}
            onClick={onRetry}
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11"
            disabled={isCover || item.status !== "ready"}
            aria-label={t("market.dash.makeCover")}
            onClick={onCover}
          >
            <Star className="size-4" aria-hidden />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11"
          aria-label={t("market.media.replace")}
          onClick={onReplace}
        >
          <Repeat className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11"
          aria-label={t("market.actions.remove")}
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
