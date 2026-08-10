/**
 * دوائر المدن: صورة معلم داخل دائرة، مع اسم المدينة أسفلها.
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
    <section className="mt-7">
      <h2 className="mb-3 px-4 text-section font-extrabold text-foreground">المدن</h2>
      <ul className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {cities.map((city) => (
          <li key={city.name} className="shrink-0">
            <Link
              to="/aqar/browse"
              search={{ track, city: city.name }}
              className="flex w-20 flex-col items-center gap-1"
            >
              <span className="block size-20 overflow-hidden rounded-full border-2 border-primary/25 bg-muted">
                <img
                  src={city.image}
                  alt={city.landmark}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </span>
              <span className="w-full truncate text-center text-desc font-bold text-foreground">
                {city.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
