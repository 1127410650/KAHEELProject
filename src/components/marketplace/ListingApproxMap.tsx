import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  /** "exact" draws a pin; anything else draws an approximate area only. */
  precision: "exact" | "approximate";
  /** Radius of the approximate area, in metres. */
  radius?: number;
  label: string;
}

/**
 * Read-only listing location map. The default is an approximate circle so the
 * exact spot is never revealed unless the advertiser chose to publish it.
 * Browser only: always loaded lazily behind <ClientOnly>.
 */
export default function ListingApproxMap({
  lat,
  lng,
  precision,
  radius = 900,
  label,
}: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holder.current || map.current) return;

      const instance = L.map(holder.current, {
        center: [lat, lng],
        zoom: precision === "exact" ? 15 : 12,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(instance);

      if (precision === "exact") {
        const icon = L.divIcon({
          className: "mkt-map-pin",
          html: '<span class="block size-4 rounded-full border-2 border-white bg-primary shadow-lg"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([lat, lng], { icon, keyboard: false, title: label }).addTo(instance);
      } else {
        L.circle([lat, lng], {
          radius,
          color: "hsl(var(--primary))",
          weight: 2,
          fillColor: "hsl(var(--primary))",
          fillOpacity: 0.15,
        }).addTo(instance);
        instance.fitBounds(
          L.circle([lat, lng], { radius: radius * 1.4 }).getBounds(),
        );
      }

      map.current = instance;
      setTimeout(() => instance.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={holder}
      role="img"
      aria-label={label}
      data-testid="listing-location-map"
      className="h-56 w-full overflow-hidden rounded-xl border border-border sm:h-64"
    />
  );
}
