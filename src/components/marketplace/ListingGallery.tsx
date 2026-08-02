import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Minus, Plus, X } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * Listing gallery: one swipeable image at a time on phones, a large image plus
 * a thumbnail strip on desktop, and a full-screen viewer with zoom on tap.
 */
export function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [scale, setScale] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setActive((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, images.length]);

  useEffect(() => {
    if (!zoom) setScale(1);
  }, [zoom]);

  if (images.length === 0) {
    // A clean placeholder keeps the layout intact instead of a broken gap.
    return (
      <div className="grid aspect-[16/10] w-full place-items-center gap-2 rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        <ImageOff className="size-7" aria-hidden />
        <span>{t("market.noImage")}</span>
      </div>
    );
  }

  function go(next: number) {
    const index = (next + images.length) % images.length;
    setActive(index);
    const track = trackRef.current;
    if (!track) return;
    // In an RTL page the track scrolls towards negative values, so the target
    // offset has to follow the writing direction.
    const rtl = getComputedStyle(track).direction === "rtl";
    track.scrollTo({ left: (rtl ? -1 : 1) * index * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            // Math.abs keeps the index correct in both writing directions.
            if (el.clientWidth > 0) setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto"
        >

          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setActive(i);
                setZoom(true);
              }}
              aria-label={t("market.ad.openImage")}
              className="w-full shrink-0 snap-center"
            >
              <img
                src={url}
                alt={`${title} — ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                {...(i === 0 ? { fetchPriority: "high" as const } : {})}
                decoding={i === 0 ? "sync" : "async"}
                className="aspect-[16/10] w-full object-cover"
              />
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label={t("common.previous")}
              className="absolute top-1/2 start-2 hidden -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground sm:block"
            >
              <ChevronRight className="size-4 ltr:hidden" aria-hidden />
              <ChevronLeft className="size-4 rtl:hidden" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label={t("common.next")}
              className="absolute top-1/2 end-2 hidden -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground sm:block"
            >
              <ChevronLeft className="size-4 ltr:hidden" aria-hidden />
              <ChevronRight className="size-4 rtl:hidden" aria-hidden />
            </button>
            <span
              className="absolute bottom-2 end-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground"
              dir="ltr"
            >
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails are a desktop aid; phones swipe the main image instead. */}
      {images.length > 1 && (
        <div className="mt-2 hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => go(i)}
              aria-label={`${t("market.ad.openImage")} ${i + 1}`}
              aria-current={i === active}
              className={
                i === active
                  ? "size-16 shrink-0 overflow-hidden rounded-lg border-2 border-primary"
                  : "size-16 shrink-0 overflow-hidden rounded-lg border border-border"
              }
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-foreground/90 p-4"
          onClick={() => setZoom(false)}
        >
          <div
            className="absolute top-4 end-4 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t("market.ad.zoomOut")}
              className="grid size-11 place-items-center rounded-full bg-background/90 text-foreground"
              onClick={() => setScale((s) => Math.max(1, +(s - 0.5).toFixed(1)))}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("market.ad.zoomIn")}
              className="grid size-11 place-items-center rounded-full bg-background/90 text-foreground"
              onClick={() => setScale((s) => Math.min(4, +(s + 0.5).toFixed(1)))}
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("common.close")}
              className="grid size-11 place-items-center rounded-full bg-background/90 text-foreground"
              onClick={() => setZoom(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {images.length > 1 && (
            <span
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground"
              dir="ltr"
            >
              {active + 1} / {images.length}
            </span>
          )}

          <img
            src={images[active]}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `scale(${scale})` }}
            className="max-h-full max-w-full rounded-lg object-contain transition-transform"
          />
        </div>
      )}
    </div>
  );
}
