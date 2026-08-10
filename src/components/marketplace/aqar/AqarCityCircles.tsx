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
    <section className="k-section">
      <h2 className="k-section-title k-gutter">المدن</h2>
      <ul className="k-rail flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cities.map((city) => (
          <li key={city.name} className="shrink-0">
            <Link
              to="/aqar/browse"
              search={{ track, city: city.name }}
              className="flex w-[72px] flex-col items-center gap-[var(--sp-2)]"
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
              <span className="w-full truncate text-center text-[14px] font-semibold leading-[1.3] text-foreground">
                {city.name}
              </span>
              <span className="w-full truncate text-center text-[14px] font-medium leading-[1.3] text-muted-foreground">
                {city.landmark}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
