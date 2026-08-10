/**
 * عناصر الهيدر المنكمش المشتركة: الزخارف المرحة وكبسولة القسم التي تتحوّل من
 * كبسولة نصية إلى دائرة أيقونة مع تقدّم الانكماش (--p).
 *
 * كل الحركة بـ transform و clip-path و opacity فقط — لا خصائص تخطيط تتغيّر،
 * فلا تنتج الحركة أي إزاحة تخطيط (CLS = 0).
 */
import type { ReactNode } from "react";
import { Children, isValidElement, cloneElement } from "react";

import { useI18n } from "@/i18n";

/** عرض الكبسولة الكامل والمنكمش بالبكسل — ثابت كي تكون الحركة حسابية بحتة. */
const CHIP_W = 104;
const CHIP_COLLAPSED_W = 44;
const CHIP_SHRINK = CHIP_W - CHIP_COLLAPSED_W; // 60

/** زخارف خفيفة تتلاشى مع الانكماش — لا تؤثر في القياسات إطلاقًا. */
export function HeaderShapes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ opacity: "calc(0.5 * (1 - var(--p)))" }}
    >
      {/* نجمة — أعلى البداية */}
      <svg
        className="absolute start-6 top-2 size-4 text-primary-foreground/70"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2l2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4L12 2z" />
      </svg>
      {/* مثلث — أعلى النهاية */}
      <svg
        className="absolute end-10 top-3 size-3 rotate-12 text-primary-foreground/60"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 4l8 14H4l8-14z" />
      </svg>
      {/* خط متعرّج — وسط البداية */}
      <svg
        className="absolute start-16 top-9 h-2 w-10 text-primary-foreground/50"
        viewBox="0 0 60 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M2 8c6-8 10 8 16 0s10 8 16 0 10 8 16 0" />
      </svg>
      {/* حلقة — أسفل النهاية */}
      <svg
        className="absolute bottom-5 end-5 size-5 text-primary-foreground/40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
      {/* مربع صغير — أسفل البداية */}
      <svg
        className="absolute bottom-4 start-8 size-3 -rotate-6 text-primary-foreground/50"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    </div>
  );
}

/**
 * كبسولة قسم: عرضها الفعلي ثابت، لكنها تُقصّ بصريًا إلى دائرة أيقونة وتنزلق
 * نحو البداية بمقدار ما انكمشت الكبسولات التي قبلها — فلا تتحرّك أي عقدة تخطيط.
 */
export function HeaderChip({
  icon,
  label,
  href,
  index = 0,
  rtl = true,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  index?: number;
  rtl?: boolean;
}) {
  // إزاحة تراكمية: كل كبسولة سابقة تحرّر CHIP_SHRINK + الفراغ الذي بينهما.
  const slide = index * (CHIP_SHRINK + 8);
  const sign = rtl ? 1 : -1;
  return (
    <a
      href={href}
      className="relative flex h-11 shrink-0 items-center gap-1.5 bg-card ps-[14px] text-card-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
      style={{
        width: `${CHIP_W}px`,
        transform: `translateX(calc(${sign * slide}px * var(--p)))`,
        clipPath: rtl
          ? `inset(0 0 0 calc(${CHIP_SHRINK}px * var(--p)) round 9999px)`
          : `inset(0 calc(${CHIP_SHRINK}px * var(--p)) 0 0 round 9999px)`,
      }}
      aria-label={label}
    >
      <span className="grid size-6 shrink-0 place-items-center" aria-hidden>
        {icon}
      </span>
      <span
        className="overflow-hidden whitespace-nowrap text-sm font-extrabold"
        style={{ opacity: "calc(1 - var(--p)*1.4)" }}
      >
        {label}
      </span>
    </a>
  );
}

/** صف الكبسولات — يبقى دائمًا ظاهرًا (تتحوّل الكبسولات إلى دوائر). */
export function HeaderChipsRow({ children }: { children: ReactNode }) {
  const { dir } = useI18n();
  const rtl = dir === "rtl";
  return (
    <div className="relative z-10 h-12 overflow-hidden">
      <div className="mx-auto flex h-12 w-full max-w-[1240px] items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:px-5 lg:px-8 [&::-webkit-scrollbar]:hidden">
        {Children.map(children, (child, index) =>
          isValidElement<{ index?: number; rtl?: boolean }>(child)
            ? cloneElement(child, { index, rtl })
            : child,
        )}
      </div>
    </div>
  );
}
