/**
 * حقل البحث العريض بنمط «نون»: أبيض، حواف دائرية كاملة، ارتفاع محجوز ثابت.
 */
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";

import { useI18n } from "@/i18n";

export function BigSearchField() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const label = ar ? "ابحث في كَحيل" : "Search Kaheel";
  const detailed = ar ? "بحث تفصيلي" : "Detailed search";
  return (
    <section aria-label={label}>
      <div className="flex h-12 items-center overflow-hidden rounded-full border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/35">
        <Link
          to="/search"
          search={{}}
          aria-label={label}
          className="flex min-w-0 flex-1 items-center gap-[var(--sp-3)] px-4 text-muted-foreground outline-none"
        >
          <Search className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate text-desc font-semibold sm:text-sm">
            {ar ? "ابحث عن عقار، سيارة، مطعم، مستلزمات…" : "Search property, car, food, essentials…"}
          </span>
        </Link>
        <Link
          to="/search"
          search={{ filters: 1 }}
          aria-label={detailed}
          title={detailed}
          className="me-[var(--sp-2)] inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
