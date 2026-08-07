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

    const groupWidth = () => rail.scrollWidth / 3;
    const centreRail = () => {
      const width = groupWidth();
      if (width > 0 && (rail.scrollLeft <= 1 || rail.scrollLeft >= width * 2)) {
        rail.scrollLeft = width;
      }
    };

    const firstFrame = window.requestAnimationFrame(centreRail);

    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const elapsed = Math.min(now - previous, 32);
      const width = groupWidth();

      if (
        width > 0 &&
        !reducedMotion.matches &&
        !holdingRef.current &&
        now >= pauseUntilRef.current &&
        document.visibilityState === "visible"
      ) {
        rail.scrollLeft += direction * speed * (elapsed / 1_000);
      }

      if (width > 0) {
        if (rail.scrollLeft >= width * 2) rail.scrollLeft -= width;
        if (rail.scrollLeft <= 0) rail.scrollLeft += width;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    const onResize = () => window.requestAnimationFrame(centreRail);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
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
