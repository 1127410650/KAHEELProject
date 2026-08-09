/**
 * مشي حقيقي بالأرجل — تشغيل تسلسل الإطارات الأربعة أثناء تنقّل الشخصية أفقيًا.
 *
 * كيف يبدو المشي حقيقيًا:
 *  • تتابع الإطارات بـ ~٨-١٠ إطارات/ث ⇒ الأرجل تتحرّك فعلًا لا انزلاق صورة.
 *  • ارتدادة عمودية خفيفة جدًا (2-3px) + ميلان 2-3° للأمام، بإيقاع الخطوة.
 *  • عند تغيير الاتجاه: `scaleX(-1)` ⇒ يمشي للجهة المعاكسة بوجهه لا بظهره.
 *
 * الضوابط:
 *  • الحركة كلها على `transform` فقط ⇒ صفر إعادة تخطيط (CLS = 0).
 *  • الإطارات تُحمَّل كسولًا عند أول ظهور (`loading="lazy"`)، وتبقى في الكاش.
 *  • المؤقّت يتوقّف عند خروج الشخصية من الشاشة (IntersectionObserver) أو إخفاء
 *    التبويب أو `paused` ⇒ لا استهلاك معالج بلا فائدة.
 *  • `prefers-reduced-motion` ⇒ إطار واحد ثابت بلا مشي ولا ارتداد.
 */
import { useEffect, useRef, useState } from "react";

import type { MascotName } from "@/lib/mascot-assets";
import { walkCycle } from "@/lib/mascot-walk-frames";

export function MascotWalk({
  name,
  lang = "ar",
  /** اتجاه المشي: `-1` يقلب الشخصية أفقيًا لتمشي للجهة المعاكسة. */
  facing = 1,
  paused = false,
  className,
}: {
  name: MascotName;
  lang?: "ar" | "en";
  facing?: 1 | -1;
  paused?: boolean;
  className?: string;
}) {
  const cycle = walkCycle(name);
  const [frame, setFrame] = useState(0);
  const [visible, setVisible] = useState(true);
  const hostRef = useRef<HTMLSpanElement | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // يتوقّف المشي حين تخرج الشخصية من الشاشة.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "40px" },
    );
    io.observe(host);
    return () => io.disconnect();
  }, []);

  const running = !paused && visible && !reduced;

  useEffect(() => {
    if (!running) return;
    const step = window.setInterval(
      () => setFrame((current) => (current + 1) % cycle.frames.length),
      Math.round(1000 / cycle.fps),
    );
    return () => window.clearInterval(step);
  }, [running, cycle.fps, cycle.frames.length]);

  const stepMs = Math.round((1000 / cycle.fps) * 2); // خطوة كاملة = إطاران

  return (
    <span
      ref={hostRef}
      data-kaheel-walk={name}
      className={`relative block ${className ?? "h-full"}`}
      style={{ aspectRatio: `${cycle.width} / ${cycle.height}` }}
    >
      <span
        className="block h-full w-full"
        style={{ transform: `scaleX(${facing})`, transformOrigin: "center bottom" }}
      >
        {/* الارتدادة العمودية + الميلان — متزامنة مع إيقاع الخطوات. */}
        <span
          className="block h-full w-full motion-reduce:animate-none"
          style={
            reduced
              ? undefined
              : {
                  animation: `mascot-walk-bob ${stepMs}ms ease-in-out infinite`,
                  animationPlayState: running ? "running" : "paused",
                }
          }
        >
          {cycle.frames.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={index === 0 ? (lang === "en" ? cycle.alt.en : cycle.alt.ar) : ""}
              aria-hidden={index === 0 ? undefined : true}
              width={cycle.width}
              height={cycle.height}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-contain"
              style={{ opacity: index === (reduced ? 0 : frame) ? 1 : 0 }}
            />
          ))}
        </span>
      </span>
    </span>
  );
}
