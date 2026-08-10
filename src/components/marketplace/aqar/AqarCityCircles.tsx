/**
 * دوائر المدن: صورة معلم فوتوغرافية حقيقية داخل دائرة 64px، والاسم أسفلها.
 * صف أفقي قابل للتمرير — يبقى مقروءًا على 390px.
 */

import { Link } from "@tanstack/react-router";

import type { AqarCityCircle } from "@/lib/aqar-imagery";
import type { AqarTrack } from "@/lib/mkt-aqar";

export function AqarCityCircles({
  cities,
  track,
}: {
  cities: AqarCityCircle[];
  track: AqarTrack;
}) {
  return (
    <section className="mt-5">
      <h2 className="mb-2.5 px-4 text-lg font-bold text-foreground">المدن</h2>
      <ul className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cities.map((city) => (
          <li key={city.name} className="shrink-0">
            <Link
              to="/aqar/browse"
              search={{ track, city: city.name }}
              className="flex w-[68px] flex-col items-center gap-1"
            >
              <span className="block size-16 overflow-hidden rounded-full border border-border bg-muted">
                <img
                  src={city.image}
                  alt={city.landmark}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </span>
              <span className="w-full truncate text-center text-desc font-semibold text-foreground">
                {city.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
