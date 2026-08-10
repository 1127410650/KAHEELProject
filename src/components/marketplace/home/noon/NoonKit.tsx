/**
 * أدوات مشتركة لصفحة كَحيل الرئيسية بنمط «نون».
 *
 * • `SectionHead`: عنوان القسم + زر «عرض الكل» بنفس الإيقاع في كل الصفوف.
 * • `LazyMount`: يحجز ارتفاعًا ثابتًا ثم يركّب المحتوى عند اقترابه من الشاشة،
 *   فكل ما هو أسفل الشاشة الأولى لا يُحمّل مبكرًا ولا يُحدث هزّة تخطيط.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";

export function SectionHead({
  id,
  title,
  href,
  hint,
}: {
  id: string;
  title: string;
  href: string;
  hint?: string;
}) {
  const { locale } = useI18n();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <h2 id={id} className="truncate text-body font-black sm:text-lg">
          {title}
        </h2>
        {hint ? (
          <p className="truncate text-desc font-semibold text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <a
        href={href}
        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-[var(--sp-3)] text-desc font-black text-primary outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/45 sm:text-desc"
      >
        {locale === "ar" ? "عرض الكل" : "View all"}
        <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
      </a>
    </div>
  );
}

/** رقعة تمرير أفقية موحّدة: بطاقة بعرض 80% وحافة البطاقة التالية ظاهرة. */
export const RAIL_SCROLLER =
  "-mx-[var(--page-x)] mt-[var(--sp-3)] flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[var(--page-x)] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0";
export const RAIL_ITEM = "w-[80%] max-w-[300px] shrink-0 snap-start sm:w-[46%] lg:w-[31%]";

export function LazyMount({
  minHeight,
  children,
}: {
  /** الارتفاع المحجوز قبل التركيب — يجب أن يقارب الارتفاع النهائي. */
  minHeight: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            setMounted(true);
            observer.disconnect();
          }
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div ref={ref} style={mounted ? undefined : { minHeight }}>
      {mounted ? children : null}
    </div>
  );
}
