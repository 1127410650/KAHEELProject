import { useCallback, useEffect, useRef } from "react";

type AutoLoopDirection = -1 | 1;

/**
 * Keeps a three-copy horizontal rail moving without a visible end. Native
 * overflow remains enabled, so touch and trackpad gestures can move the same
 * rail. Only the rail being touched pauses, then it resumes automatically.
 */
export function useAutoLoopRail<T extends HTMLElement = HTMLDivElement>(
  direction: AutoLoopDirection,
  speed = 18,
) {
  const railRef = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const holdingRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const groupWidthRef = useRef(0);
  const visibleRef = useRef(true);

  const pause = useCallback((milliseconds = 1_800) => {
    pauseUntilRef.current = performance.now() + milliseconds;
  }, []);

  const startInteraction = useCallback(() => {
    holdingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    holdingRef.current = false;
    pause();
  }, [pause]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const measure = () => {
      groupWidthRef.current = rail.scrollWidth / 3;
    };
    const centreRail = () => {
      measure();
      const width = groupWidthRef.current;
      if (width > 0 && (rail.scrollLeft <= 1 || rail.scrollLeft >= width * 2)) {
        rail.scrollLeft = width;
      }
    };

    const firstFrame = window.requestAnimationFrame(centreRail);

    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const elapsed = Math.min(now - previous, 32);
      const width = groupWidthRef.current;

      if (
        width > 0 &&
        !reducedMotion.matches &&
        !holdingRef.current &&
        visibleRef.current &&
        now >= pauseUntilRef.current &&
        document.visibilityState === "visible"
      ) {
        // `scrollLeft` rounds to whole pixels, so a slow rail would never move
        // if each frame's fraction were written straight back. The exact
        // position is kept here and only whole pixels are handed to the DOM.
        const drift = rail.scrollLeft - Math.round(positionRef.current);
        if (Math.abs(drift) > 1) positionRef.current = rail.scrollLeft;
        positionRef.current += direction * speed * (elapsed / 1_000);
        rail.scrollLeft = Math.round(positionRef.current);
      } else {
        positionRef.current = rail.scrollLeft;
      }

      if (width > 0) {
        if (rail.scrollLeft >= width * 2) {
          rail.scrollLeft -= width;
          positionRef.current -= width;
        }
        if (rail.scrollLeft <= 0) {
          rail.scrollLeft += width;
          positionRef.current += width;
        }
      }


      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    const onResize = () => window.requestAnimationFrame(centreRail);
    const resizeObserver = new ResizeObserver(centreRail);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
        lastFrameRef.current = null;
      },
      { rootMargin: "180px" },
    );
    resizeObserver.observe(rail);
    visibilityObserver.observe(rail);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [direction, speed]);

  return {
    railRef,
    interactionProps: {
      onPointerDown: startInteraction,
      onPointerUp: endInteraction,
      onPointerCancel: endInteraction,
      onPointerLeave: endInteraction,
      onWheel: () => pause(),
    },
  };
}
