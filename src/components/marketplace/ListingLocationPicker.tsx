import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const LocationMap = lazy(() => import("@/components/marketplace/LocationMap"));

export interface ListingLocationValue {
  cityId: string;
  district: string;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: "device" | "account" | "manual" | null;
  visibility: "approximate" | "exact";
}

interface Props {
  value: ListingLocationValue;
  onChange: (next: ListingLocationValue) => void;
  /** City of the account, used as the initial value of a new ad. */
  accountCityId?: string | null | undefined;
}

/** Rough map centre per supported market, used until a real point is known. */
const COUNTRY_CENTER: Record<string, [number, number]> = {
  SA: [24.7136, 46.6753],
  KW: [29.3759, 47.9774],
  AE: [24.4539, 54.3773],
  JO: [31.9539, 35.9106],
  LB: [33.8938, 35.5018],
  EG: [30.0444, 31.2357],
  SY: [33.5138, 36.2765],
  IQ: [33.3152, 44.3661],
};

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function ListingLocationPicker({ value, onChange, accountCityId }: Props) {
  const { t, locale } = useI18n();
  const country = useAccountCountry();
  const countryId = country.data?.id ?? "";
  const cities = useQuery({
    queryKey: ["mkt", "cities", countryId],
    enabled: !!countryId,
    queryFn: () => loadCities(countryId),
  });

  const [locating, setLocating] = useState(false);
  const [askedForDevice, setAskedForDevice] = useState(false);
  const [permission, setPermission] = useState<PermissionState | "unsupported">("prompt");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [geocodeNote, setGeocodeNote] = useState<string | null>(null);
  const initialPoint = useRef<[number, number] | null>(null);

  const iso2 = country.data?.iso2 ?? "SA";
  const center = COUNTRY_CENTER[iso2] ?? COUNTRY_CENTER["SA"]!;
  const lat = value.latitude ?? center[0];
  const lng = value.longitude ?? center[1];

  const patch = useCallback(
    (next: Partial<ListingLocationValue>) => onChange({ ...value, ...next }),
    [onChange, value],
  );

  // The account city is the initial value; the user can change it freely.
  useEffect(() => {
    if (!value.cityId && accountCityId) patch({ cityId: accountCityId, source: value.source ?? "account" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCityId, value.cityId]);

  /** Reverse geocoding is best effort: a failure never blocks saving. */
  const reverse = useCallback(
    async (plat: number, plng: number) => {
      setGeocodeNote(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${plat}&lon=${plng}&accept-language=${locale}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) throw new Error("reverse failed");
        const data = (await res.json()) as {
          address?: Record<string, string>;
          display_name?: string;
        };
        const a = data.address ?? {};
        const district = a["neighbourhood"] || a["suburb"] || a["quarter"] || a["city_district"] || "";
        const cityName = a["city"] || a["town"] || a["village"] || a["state"] || "";
        const matched = (cities.data ?? []).find(
          (c) => c.name_ar === cityName || c.name_en?.toLowerCase() === cityName.toLowerCase(),
        );
        return {
          district,
          addressText: data.display_name ?? "",
          cityId: matched?.id ?? "",
        };
      } catch {
        setGeocodeNote(t("market.loc.geocodeFailed"));
        return null;
      }
    },
    [cities.data, locale, t],
  );

  const applyPoint = useCallback(
    async (plat: number, plng: number, source: ListingLocationValue["source"], accuracy?: number | null) => {
      const next: Partial<ListingLocationValue> = {
        latitude: plat,
        longitude: plng,
        source,
        accuracy: accuracy ?? null,
      };
      onChange({ ...value, ...next });
      const resolved = await reverse(plat, plng);
      if (!resolved) return;
      onChange({
        ...value,
        ...next,
        district: resolved.district || value.district,
        addressText: resolved.addressText || value.addressText,
        cityId: resolved.cityId || value.cityId,
      });
    },
    [onChange, reverse, value],
  );

  // Permission state is only read, never requested: no surprise prompt.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      setPermission("unsupported");
      return;
    }
    void navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => setPermission(status.state))
      .catch(() => setPermission("unsupported"));
  }, []);

  const locate = useCallback(
    (silent: boolean) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          void applyPoint(pos.coords.latitude, pos.coords.longitude, "device", pos.coords.accuracy);
        },
        () => {
          setLocating(false);
          // A refused permission is normal: the form keeps working on the city.
          if (!silent) setGeocodeNote(t("market.loc.permissionDenied"));
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
      );
    },
    [applyPoint, t],
  );

  // Already granted before? Fetch quietly. Otherwise wait for the button.
  useEffect(() => {
    if (permission !== "granted" || askedForDevice || value.latitude != null) return;
    setAskedForDevice(true);
    locate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, askedForDevice, value.latitude]);

  // Without any point yet, centre on the chosen city once (best effort).
  useEffect(() => {
    if (value.latitude != null || !value.cityId || initialPoint.current) return;
    const city = (cities.data ?? []).find((c) => c.id === value.cityId);
    if (!city) return;
    initialPoint.current = [lat, lng];
    void (async () => {
      try {
        const name = geoName(city, "en") || city.name_ar;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${iso2}&q=${encodeURIComponent(name)}`,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as { lat: string; lon: string }[];
        const first = rows[0];
        if (!first) return;
        patch({
          latitude: Number(first.lat),
          longitude: Number(first.lon),
          source: value.source ?? "account",
        });
      } catch {
        /* the country centre stays; saving is unaffected */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cityId, cities.data]);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${iso2}&accept-language=${locale}&q=${encodeURIComponent(q)}`,
      );
      const rows = res.ok ? ((await res.json()) as { lat: string; lon: string }[]) : [];
      const first = rows[0];
      if (!first) {
        setSearchNote(t("market.loc.noResults"));
        return;
      }
      await applyPoint(Number(first.lat), Number(first.lon), "manual");
    } catch {
      setSearchNote(t("market.loc.noResults"));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("market.loc.searchPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={() => void search()} disabled={searching}>
            {searching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            <span className="sr-only">{t("market.loc.searchOnMap")}</span>
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={() => locate(false)} disabled={locating}>
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-4" aria-hidden />
          )}
          {t("market.loc.useMyLocation")}
        </Button>
      </div>
      {searchNote && <p className="text-xs text-muted-foreground">{searchNote}</p>}

      <ClientOnly fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <LocationMap
            lat={lat}
            lng={lng}
            onPick={(plat, plng) => void applyPoint(plat, plng, "manual")}
          />
        </Suspense>
      </ClientOnly>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="size-3" aria-hidden />
        {t("market.loc.dragHint")}
      </p>
      {geocodeNote && <p className="text-xs text-muted-foreground">{geocodeNote}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="loc_city">{t("market.geo.city")}</Label>
          <select
            id="loc_city"
            className={selectClass}
            value={value.cityId}
            onChange={(e) => patch({ cityId: e.target.value, source: "manual" })}
          >
            <option value="">{t("market.geo.pickCity")}</option>
            {(cities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {geoName(c, locale)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {t("market.loc.countryFromAccount", { country: geoName(country.data ?? undefined, locale) })}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc_district">{t("market.loc.district")}</Label>
          <Input
            id="loc_district"
            value={value.district}
            maxLength={120}
            onChange={(e) => patch({ district: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="loc_address">{t("market.loc.address")}</Label>
        <Input
          id="loc_address"
          value={value.addressText}
          maxLength={240}
          onChange={(e) => patch({ addressText: e.target.value })}
        />
      </div>

      <fieldset className="space-y-1.5 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-medium text-foreground">
          {t("market.loc.visibility")}
        </legend>
        {(["approximate", "exact"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="location_visibility"
              className="size-4"
              checked={value.visibility === option}
              onChange={() => patch({ visibility: option })}
            />
            {t(`market.loc.${option}`)}
          </label>
        ))}
        <p className="text-[11px] text-muted-foreground">{t("market.loc.visibilityHint")}</p>
      </fieldset>
    </div>
  );
}
