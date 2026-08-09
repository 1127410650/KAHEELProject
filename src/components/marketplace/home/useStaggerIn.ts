import { useEffect, useRef } from "react";

/**
 * Adds `is-in` to every direct child of the returned container while it is on
 * screen, and removes it when the container scrolls away. Children carry their
 * own `--k-step`, so the stagger and every looping animation live entirely in
 * CSS on transform/opacity, and nothing animates off screen (no wasted CPU).
 *
 * The class is only ever added, never any geometry, so there is zero layout
 * shift; `prefers-reduced-motion` is handled in CSS.
 */
export function useStaggerIn<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const children = () => Array.from(node.children) as HTMLElement[];
    const paint = (on: boolean) => {
      for (const child of children()) child.classList.toggle("is-in", on);
    };

    if (typeof IntersectionObserver === "undefined") {
      paint(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) paint(entry.isIntersecting);
      },
      { rootMargin: "12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}
