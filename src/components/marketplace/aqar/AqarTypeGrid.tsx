/**
 * بطاقات أنواع العقار: صورة خلفية مع اسم النوع بخط أبيض كبير فوقها.
 * الصور تأتي من `src/lib/aqar-imagery.ts` (قابلة للتعديل من الإعدادات).
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
    <section className="px-4 py-3">
      <h2 className="mb-2 text-section font-extrabold text-foreground">تصفّح حسب نوع العقار</h2>
      <ul className="grid grid-cols-2 gap-3">
        {types.map((card) => {
          const total = [card.key, ...(card.also ?? [])].reduce(
            (sum, key) => sum + (counts[key] ?? 0),
            0,
          );
          return (
            <li key={card.key} className={card.wide ? "col-span-2" : ""}>
              <Link
                to="/aqar/browse"
                search={{ track, type: card.key }}
                className="k-lift relative block overflow-hidden rounded-2xl border border-border"
              >
                <img
                  src={card.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`w-full object-cover ${card.wide ? "h-36" : "h-28"}`}
                />
                {/* تعتيم متدرّج يضمن تباين النص الأبيض 4.5:1 فوق أي صورة. */}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <span className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                  <strong className="text-section font-extrabold text-white drop-shadow-md">
                    {card.label}
                  </strong>
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-nav font-bold text-foreground">
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
