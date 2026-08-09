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
  /** Flick physics: last drag speed, then a damped spring that rebounds. */
  const dragVelocityRef = useRef(0);
  const lastMoveAtRef = useRef(0);
  const springRef = useRef<{ target: number; velocity: number } | null>(null);
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
    const now = performance.now();
    const elapsed = Math.max(now - (lastMoveAtRef.current || now), 8);
    lastMoveAtRef.current = now;
    lastXRef.current = event.clientX;
    draggingRef.current = true;
    springRef.current = null;
    offsetRef.current -= delta;
    // Smoothed pointer speed in px/s, used to project the flick on release.
    const instant = (-delta / elapsed) * 1_000;
    dragVelocityRef.current = dragVelocityRef.current * 0.7 + instant * 0.3;
  }, []);

  const release = useCallback(() => {
    if (!holdingRef.current) return;
    const flicked = draggingRef.current;
    holdingRef.current = false;
    draggingRef.current = false;
    const velocity = dragVelocityRef.current;
    dragVelocityRef.current = 0;
    lastMoveAtRef.current = 0;
    if (flicked && Math.abs(velocity) > 40) {
      // Project where the flick "wants" to land, then let a slightly
      // under-damped spring carry the rail there: it overshoots a little and
      // springs back, which is what makes the rail feel physical.
      springRef.current = { target: offsetRef.current + velocity * 0.22, velocity };
      pause(2_600);
    } else {
      pause();
    }
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

      const spring = springRef.current;
      if (loop > 0 && spring && !holdingRef.current) {
        const seconds = Math.min(elapsed, 32) / 1_000;
        // Under-damped: stiffness beats damping, so the tail visibly rebounds.
        const acceleration =
          -140 * (offsetRef.current - spring.target) - 16 * spring.velocity;
        spring.velocity += acceleration * seconds;
        offsetRef.current += spring.velocity * seconds;
        if (
          Math.abs(spring.velocity) < 6 &&
          Math.abs(offsetRef.current - spring.target) < 0.6
        ) {
          springRef.current = null;
          pauseUntilRef.current = Math.min(pauseUntilRef.current, now + 240);
        }
      }

      if (loop > 0) {
        const running =
          !springRef.current &&
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
