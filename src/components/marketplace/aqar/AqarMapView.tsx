/**
 * خريطة موقع للعرض فقط (OpenStreetMap عبر Leaflet).
 *
 * للتأجير نعرض دائرة تقريبية بلا دبوس دقيق (حماية خصوصية الموقع)، وللبيع دبوسًا
 * على الإحداثية. يُستورد هذا الملف كسولًا داخل `<ClientOnly>` فقط.
 */

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import "leaflet/dist/leaflet.css";

export default function AqarMapView({
  lat,
  lng,
  approximate = false,
  zoom = 14,
}: {
  lat: number;
  lng: number;
  /** دائرة تقريبية بدل الدبوس الدقيق. */
  approximate?: boolean;
  zoom?: number;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holder.current || map.current) return;

      const instance = L.map(holder.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(instance);

      if (approximate) {
        L.circle([lat, lng], {
          radius: 450,
          color: "var(--primary)",
          weight: 2,
          fillColor: "var(--primary)",
          fillOpacity: 0.15,
        }).addTo(instance);
      } else {
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "mkt-map-pin",
            html: '<span class="block size-4 rounded-full border-2 border-white bg-primary shadow-lg"></span>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(instance);
      }

      map.current = instance;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [lat, lng, zoom, approximate]);

  return <div ref={holder} className="h-56 w-full rounded-2xl border border-border" />;
}
