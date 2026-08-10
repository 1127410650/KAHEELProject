/**
 * بطاقات أنواع العقار: فسيفساء عمودين — البطاقة الأولى تأخذ العمودين بنسبة 16:7،
 * والباقي 16:10 فتظهر الستة في مساحة قصيرة (كثافة أعلى). النسب مثبّتة فلا إزاحة
 * تخطيط. الصور فوتوغرافية حقيقية من `src/lib/aqar-imagery.ts`.
 */

import { Link } from "@tanstack/react-router";

import type { AqarTypeCard } from "@/lib/aqar-imagery";
import type { AqarTrack } from "@/lib/mkt-aqar";

export function AqarTypeGrid({
  types,
  track,
  counts,
}: {
  types: AqarTypeCard[];
  track: AqarTrack;
  counts: Record<string, number>;
}) {
  return (
    <section className="k-section k-gutter">
      <h2 className="k-section-title">تصفّح حسب نوع العقار</h2>
      <ul className="grid grid-cols-2 gap-[var(--sp-3)]">
        {types.map((card, index) => {
          const total = [card.key, ...(card.also ?? [])].reduce(
            (sum, key) => sum + (counts[key] ?? 0),
            0,
          );
          const wide = index === 0;
          return (
            <li key={card.key} className={wide ? "col-span-2" : ""}>
              <Link
                to="/aqar/browse"
                search={{ track, type: card.key }}
                className={`k-lift k-press group relative block overflow-hidden rounded-[var(--r-card)] ${
                  wide ? "aspect-[16/7]" : "aspect-[16/10]"
                }`}
              >
                <img
                  src={card.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                {/* تعتيم متدرّج يضمن تباين النص الأبيض 4.5:1 فوق أي صورة. */}
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                {/* الاسم في البداية والعدد في النهاية — أسلوب ناضج بلا كبسولات ضخمة. */}
                <span className="absolute inset-x-[var(--sp-3)] bottom-[var(--sp-2)] flex items-end justify-between gap-[var(--sp-2)]">
                  <strong className="min-w-0 truncate text-base font-bold text-white drop-shadow-md">
                    {card.label}
                  </strong>
                  <span className="shrink-0 rounded-full bg-black/50 px-[var(--sp-2)] py-0.5 text-[14px] font-semibold leading-5 text-white">
                    {total.toLocaleString("en-US")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
