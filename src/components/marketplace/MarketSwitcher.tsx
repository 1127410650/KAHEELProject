import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { useI18n } from "@/i18n";
import { geoName, loadCities, loadCountries, useMarketPreference } from "@/lib/mkt-geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Browsing-market picker: country plus an optional city. It only changes what
 * the visitor sees — the country stored on their account is never touched.
 * A bottom sheet on phones, a popover on wide screens.
 */
export function MarketSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { preference, setPreference } = useMarketPreference();
  const [term, setTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const filteredCities = useMemo(() => {
    const rows = cities.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) => c.name_ar.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [cities.data, term]);

  async function apply(next: { countryIso2?: string; cityId?: string | null }) {
    const switchingCountry = !!next.countryIso2 && next.countryIso2 !== preference.countryIso2;
    const value = {
      countryIso2: next.countryIso2 ?? preference.countryIso2,
      cityId: switchingCountry ? null : (next.cityId ?? preference.cityId),
    };
    await setPreference(value);
    setSheetOpen(false);
    void navigate({
      to: "/search",
      search: {
        country: value.countryIso2,
        ...(value.cityId ? { cityId: value.cityId } : {}),
      },
    });
  }

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className="max-w-[10rem] shrink-0 justify-start gap-1.5 truncate"
      aria-label={t("market.geo.pick")}
    >
      <MapPin className="size-4 shrink-0" aria-hidden />
      {!compact && <span className="truncate">{label}</span>}
    </Button>
  );

  const body = (
    <div className="space-y-3">
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
                  ? "rounded-md bg-primary px-2 py-2 text-start text-xs font-semibold text-primary-foreground"
                  : "rounded-md border border-input px-2 py-2 text-start text-xs text-foreground hover:bg-secondary"
              }
            >
              {geoName(c, locale)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">{t("market.geo.city")}</p>
        {(cities.data ?? []).length > 8 && (
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("market.geo.searchCity")}
            aria-label={t("market.geo.searchCity")}
            className="h-9"
          />
        )}
        <div className="max-h-56 space-y-1 overflow-y-auto pe-1">
          <button
            type="button"
            onClick={() => void apply({ cityId: null })}
            className={
              preference.cityId === null
                ? "block w-full rounded-md bg-secondary px-2 py-2 text-start text-xs font-semibold text-foreground"
                : "block w-full rounded-md px-2 py-2 text-start text-xs text-muted-foreground hover:bg-secondary"
            }
          >
            {t("market.geo.allCities")}
          </button>
          {filteredCities.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void apply({ cityId: c.id })}
              className={
                c.id === preference.cityId
                  ? "block w-full rounded-md bg-secondary px-2 py-2 text-start text-xs font-semibold text-foreground"
                  : "block w-full rounded-md px-2 py-2 text-start text-xs text-muted-foreground hover:bg-secondary"
              }
            >
              {geoName(c, locale)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-sm">{t("market.geo.browsingMarket")}</SheetTitle>
            </SheetHeader>
            <div className="mt-3">{body}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden lg:block">
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            {body}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
