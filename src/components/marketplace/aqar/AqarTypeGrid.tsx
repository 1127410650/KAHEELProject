/**
 * بطاقات أنواع العقار: فسيفساء عمودين — البطاقة الأولى تأخذ العمودين،
 * والباقي بنسبة 4:3. النسب مثبّتة (aspect) فلا إزاحة تخطيط عند تحميل الصور.
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
    <section className="mt-7 px-4">
      <h2 className="mb-3 text-section font-extrabold text-foreground">تصفّح حسب نوع العقار</h2>
      <ul className="grid grid-cols-2 gap-3">
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
                className={`k-lift group relative block overflow-hidden rounded-2xl ${
                  wide ? "aspect-[16/8]" : "aspect-[4/3]"
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
                {/* الاسم والعدد في صف واحد: الاسم يُقصّ بدل أن يتراكب مع الشارة. */}
                <span className="absolute inset-x-3 bottom-2.5 flex flex-row-reverse items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-section font-extrabold text-white drop-shadow-md">
                    {card.label}
                  </strong>
                  <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-0.5 text-nav font-bold text-foreground">
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
