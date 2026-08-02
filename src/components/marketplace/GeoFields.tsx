import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/i18n";
import { geoName, loadCities, loadCountries } from "@/lib/mkt-geo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-50";

/**
 * The single place where a country and one of its cities are picked. Cities are
 * always scoped to the chosen country, and the list has its own search so long
 * country lists never fill a small screen.
 */
export function CountryCitySelect({
  countryId,
  cityId,
  onChange,
  required = false,
  cityLabel,
}: {
  countryId: string | null;
  cityId: string | null;
  onChange: (next: { countryId: string | null; cityId: string | null }) => void;
  required?: boolean;
  cityLabel?: string;
}) {
  const { t, locale } = useI18n();
  const [term, setTerm] = useState("");

  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const cities = useQuery({
    queryKey: ["mkt", "cities", countryId],
    enabled: !!countryId,
    queryFn: () => loadCities(countryId),
  });

  const filtered = useMemo(() => {
    const rows = cities.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) => c.name_ar.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [cities.data, term]);

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="geo-country">{t("market.geo.country")}</Label>
        <select
          id="geo-country"
          className={selectClass}
          required={required}
          value={countryId ?? ""}
          onChange={(e) => onChange({ countryId: e.target.value || null, cityId: null })}
        >
          <option value="">{t("market.geo.pick")}</option>
          {(countries.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {geoName(c, locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="geo-city">{cityLabel ?? t("market.filters.city")}</Label>
        {(cities.data ?? []).length > 8 && (
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("market.geo.searchCity")}
            aria-label={t("market.geo.searchCity")}
            className="h-9"
          />
        )}
        <select
          id="geo-city"
          className={selectClass}
          required={required}
          disabled={!countryId}
          value={cityId ?? ""}
          onChange={(e) => onChange({ countryId, cityId: e.target.value || null })}
        >
          <option value="">{t("market.geo.pickCity")}</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {geoName(c, locale)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
