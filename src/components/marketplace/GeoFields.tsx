import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  geoName,
  loadCities,
  loadCountries,
  suggestCity,
  useAccountCountry,
} from "@/lib/mkt-geo";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-50";

const OTHER = "__other__";

/**
 * The single place where a country and one of its cities are picked. Cities are
 * always scoped to the chosen country, and the list has its own search so long
 * country lists never fill a small screen. A missing city can be proposed; it
 * only becomes selectable for everyone after an admin approves it.
 */
export function CountryCitySelect({
  countryId,
  cityId,
  onChange,
  required = false,
  cityLabel,
  allowSuggest = true,
}: {
  countryId: string | null;
  cityId: string | null;
  onChange: (next: { countryId: string | null; cityId: string | null }) => void;
  required?: boolean;
  cityLabel?: string;
  allowSuggest?: boolean;
}) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function submitSuggestion() {
    if (!countryId || !session || !suggestion.trim()) return;
    setBusy(true);
    try {
      await suggestCity({ countryId, name: suggestion, userId: session.user.id });
      setSuggestion("");
      setSuggesting(false);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin-city-suggestions"] });
      toast.success(t("market.geo.suggested"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }


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
          value={suggesting ? OTHER : (cityId ?? "")}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setSuggesting(true);
              onChange({ countryId, cityId: null });
              return;
            }
            setSuggesting(false);
            onChange({ countryId, cityId: e.target.value || null });
          }}
        >
          <option value="">{t("market.geo.pickCity")}</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {geoName(c, locale)}
            </option>
          ))}
          {allowSuggest && !!session && !!countryId && (
            <option value={OTHER}>{t("market.geo.otherCity")}</option>
          )}
        </select>

        {suggesting && (
          <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
            <Input
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder={t("market.geo.otherCity")}
              aria-label={t("market.geo.otherCity")}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">{t("market.geo.otherCityHint")}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !suggestion.trim()}
              onClick={() => void submitSuggestion()}
            >
              {t("market.geo.save")}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
