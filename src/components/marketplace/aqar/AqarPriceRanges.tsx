/**
 * نطاقات السعر: بطاقات صغيرة تنقل إلى البحث بمدى سعري جاهز.
 * المفاتيح مطابقة لنطاقات `AqarFilterBar` ليبقى الرابط قابلًا للمشاركة.
 */

import { Link } from "@tanstack/react-router";

import type { AqarTrack } from "@/lib/mkt-aqar";

const RANGES: { key: string; label: string; note: string }[] = [
  { key: "u100", label: "أقل من 100", note: "الأوفر" },
  { key: "100-300", label: "100 – 300", note: "الأكثر طلبًا" },
  { key: "300-800", label: "300 – 800", note: "أوسع وأرقى" },
  { key: "o800", label: "أكثر من 800", note: "مميّز" },
];

export function AqarPriceRanges({ track }: { track: AqarTrack }) {
  return (
    <section className="mt-5">
      <h2 className="mb-3 px-4 text-section font-extrabold text-foreground">حسب ميزانيتك</h2>
      <ul className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {RANGES.map((range) => (
          <li key={range.key} className="shrink-0">
            <Link
              to="/aqar/browse"
              search={{ track, price: range.key }}
              className="k-lift flex w-36 flex-col justify-center rounded-[var(--r-card)] border border-border bg-card px-3 py-3"
              style={{ minHeight: 72 }}
            >
              <strong className="text-title font-extrabold text-primary">{range.label}</strong>
              <span className="text-nav text-muted-foreground">{range.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
