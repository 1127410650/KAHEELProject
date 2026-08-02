import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * Listing gallery: swipeable and snap-scrolling on phones, thumbnail strip on
 * larger screens, with a full-screen viewer on tap.
 */
export function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
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

  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/10] w-full place-items-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        {t("market.noImage")}
      </div>
    );
  }

  function go(next: number) {
    const index = (next + images.length) % images.length;
    setActive(index);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setZoom(true)}
              aria-label={t("market.ad.openImage")}
              className="w-full shrink-0 snap-center"
            >
              <img
                src={url}
                alt={`${title} — ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
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
            <span className="absolute bottom-2 end-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => go(i)}
              aria-label={`${t("market.ad.openImage")} ${i + 1}`}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            aria-label={t("common.close")}
            className="absolute top-4 end-4 rounded-full bg-background/90 p-2 text-foreground"
            onClick={() => setZoom(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
          <img
            src={images[active]}
            alt={title}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
