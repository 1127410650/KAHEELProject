/**
 * تقدّم انكماش الهيدر: قيمة متصلة 0 (كامل) → 1 (منكمش) تتبع الإصبع.
 *
 * قرب أعلى الصفحة تتبع القيمة موضع التمرير حرفيًا، وفي منتصف الصفحة أي سحب
 * لأعلى يعيد الهيدر كاملًا فورًا. مع `prefers-reduced-motion` تُقفز القيمة إلى
 * هدفها بلا تنعيم.
 */
import { useEffect, useState } from "react";

const RANGE = 120; // بكسل التمرير اللازم للانكماش الكامل
const DIR_THRESHOLD = 6; // بكسل قبل انعكاس الاتجاه
const EASE = 0.35;

export function useHeaderProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let current = 0;
    let target = 0;
    let lastY = window.scrollY;
    let dir: "down" | "up" = "down";

    const computeTarget = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) > DIR_THRESHOLD) dir = dy > 0 ? "down" : "up";
      lastY = y;
      target = y <= RANGE ? Math.min(1, Math.max(0, y / RANGE)) : dir === "up" ? 0 : 1;
    };

    const tick = () => {
      raf = 0;
      let next = reduced ? target : current + (target - current) * EASE;
      if (Math.abs(next - target) < 0.01) next = target;
      if (next !== current) {
        current = next;
        setProgress(next);
      }
      if (current !== target) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      computeTarget();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return progress;
}
