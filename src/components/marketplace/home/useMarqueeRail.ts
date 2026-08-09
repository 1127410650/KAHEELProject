import { useCallback, useEffect, useRef } from "react";

type MarqueeDirection = -1 | 1;

/**
 * Smooth infinite rail driven by `transform: translate3d` on a GPU-composited
 * track instead of `scrollLeft`. Writing sub-pixel scroll offsets is what made
 * the old rail jitter: the scroll container rounds to whole pixels and fights
 * scroll snapping every frame. Here the browser interpolates the transform on
 * the compositor, so movement stays perfectly even at any speed.
 *
 * The track must render its content exactly twice; the offset wraps at half the
 * track width, which makes the seam invisible. Touching the rail pauses it and
 * drags it directly, and it resumes shortly after release.
 */
export function useMarqueeRail<T extends HTMLElement = HTMLDivElement>(
  direction: MarqueeDirection = 1,
  pixelsPerSecond = 22,
) {
  const trackRef = useRef<T | null>(null);
  const offsetRef = useRef(0);
  const holdingRef = useRef(false);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const pauseUntilRef = useRef(0);
  const visibleRef = useRef(true);

  const pause = useCallback((milliseconds = 1_600) => {
    pauseUntilRef.current = performance.now() + milliseconds;
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    holdingRef.current = true;
    draggingRef.current = false;
    lastXRef.current = event.clientX;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!holdingRef.current) return;
    const delta = event.clientX - lastXRef.current;
    if (Math.abs(delta) < 0.5) return;
    lastXRef.current = event.clientX;
    draggingRef.current = true;
    offsetRef.current -= delta;
  }, []);

  const release = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    draggingRef.current = false;
    pause();
  }, [pause]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last: number | null = null;

    const tick = (now: number) => {
      const previous = last ?? now;
      last = now;
      const elapsed = Math.min(now - previous, 40);
      // The track holds two copies, so one loop is exactly half its width.
      const loop = track.scrollWidth / 2;

      if (loop > 0) {
        const running =
          !holdingRef.current &&
          !reducedMotion.matches &&
          visibleRef.current &&
          now >= pauseUntilRef.current &&
          document.visibilityState === "visible";
        if (running) offsetRef.current += direction * pixelsPerSecond * (elapsed / 1_000);
        offsetRef.current = ((offsetRef.current % loop) + loop) % loop;
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
        last = null;
      },
      { rootMargin: "160px" },
    );
    visibility.observe(track);

    return () => {
      window.cancelAnimationFrame(frame);
      visibility.disconnect();
    };
  }, [direction, pixelsPerSecond]);

  return {
    trackRef,
    interactionProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onWheel: () => pause(),
    },
  };
}
