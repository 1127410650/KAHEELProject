import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { useI18n } from "@/i18n";
import { geoName, loadCities, loadCountries, useMarketPreference } from "@/lib/mkt-geo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Country + city picker for the public marketplace. Choosing a market both
 * remembers the preference and re-runs the search in that market.
 */
export function MarketSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { preference, setPreference } = useMarketPreference();

  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const country = (countries.data ?? []).find((c) => c.iso2 === preference.countryIso2);
  const cities = useQuery({
    queryKey: ["mkt", "cities", country?.id],
    enabled: !!country?.id,
    queryFn: () => loadCities(country?.id),
  });
  const city = (cities.data ?? []).find((c) => c.id === preference.cityId);

  const label = country
    ? `${geoName(country, locale)}${city ? ` — ${geoName(city, locale)}` : ""}`
    : t("market.geo.pick");

  async function apply(next: { countryIso2?: string; cityId?: string | null }) {
    const value = {
      countryIso2: next.countryIso2 ?? preference.countryIso2,
      cityId: next.countryIso2 && next.countryIso2 !== preference.countryIso2 ? null : (next.cityId ?? preference.cityId),
    };
    await setPreference(value);
    void navigate({
      to: "/search",
      search: {
        country: value.countryIso2,
        ...(value.cityId ? { cityId: value.cityId } : {}),
      },
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-[10rem] shrink-0 justify-start gap-1.5 truncate"
          aria-label={t("market.geo.pick")}
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          {!compact && <span className="truncate">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{t("market.geo.country")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(countries.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void apply({ countryIso2: c.iso2 })}
                className={
                  c.iso2 === preference.countryIso2
                    ? "rounded-md bg-primary px-2 py-1.5 text-start text-xs font-semibold text-primary-foreground"
                    : "rounded-md border border-input px-2 py-1.5 text-start text-xs text-foreground hover:bg-secondary"
                }
              >
                {geoName(c, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{t("market.geo.city")}</p>
          <div className="max-h-48 space-y-1 overflow-y-auto pe-1">
            <button
              type="button"
              onClick={() => void apply({ cityId: null })}
              className={
                preference.cityId === null
                  ? "block w-full rounded-md bg-secondary px-2 py-1.5 text-start text-xs font-semibold text-foreground"
                  : "block w-full rounded-md px-2 py-1.5 text-start text-xs text-muted-foreground hover:bg-secondary"
              }
            >
              {t("market.geo.allCities")}
            </button>
            {(cities.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void apply({ cityId: c.id })}
                className={
                  c.id === preference.cityId
                    ? "block w-full rounded-md bg-secondary px-2 py-1.5 text-start text-xs font-semibold text-foreground"
                    : "block w-full rounded-md px-2 py-1.5 text-start text-xs text-muted-foreground hover:bg-secondary"
                }
              >
                {geoName(c, locale)}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
