import { useEffect, useRef, type ReactNode } from "react";

/**
 * A light entrance animation for content blocks. One IntersectionObserver per
 * block reveals it once and then disconnects, so scrolling stays cheap and no
 * layout shift happens (only opacity and transform change).
 *
 * `prefers-reduced-motion` is honoured in CSS, so the markup is identical for
 * everyone and the block is always visible even if JS never runs.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already inside the first viewport, or the browser lacks the observer:
    // show it immediately instead of waiting for a scroll that may never come.
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-revealed");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Element = Tag as "div";
  return (
    <Element
      ref={ref}
      className={`market-reveal ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Element>
  );
}
