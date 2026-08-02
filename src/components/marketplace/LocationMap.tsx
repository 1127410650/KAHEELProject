import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  /** Fired after the marker is dragged or the map is clicked. */
  onPick: (lat: number, lng: number) => void;
}

/**
 * Bare Leaflet + OpenStreetMap map with a draggable marker.
 * Browser only: this module is always loaded lazily behind <ClientOnly>.
 */
export default function LocationMap({ lat, lng, zoom = 13, onPick }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holder.current || map.current) return;

      const icon = L.divIcon({
        className: "mkt-map-pin",
        html: '<span class="block size-4 rounded-full border-2 border-white bg-primary shadow-lg"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const instance = L.map(holder.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(instance);

      const pin = L.marker([lat, lng], { draggable: true, icon }).addTo(instance);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        pick.current(p.lat, p.lng);
      });
      instance.on("click", (event) => {
        const p = (event as unknown as { latlng: { lat: number; lng: number } }).latlng;
        pin.setLatLng(p);
        pick.current(p.lat, p.lng);
      });

      map.current = instance;
      marker.current = pin;
      // The container starts hidden inside a step, so sizes settle late.
      setTimeout(() => instance.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the view in sync when coordinates change from outside (search, GPS).
  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.setLatLng([lat, lng]);
    map.current.setView([lat, lng], Math.max(map.current.getZoom(), 13));
  }, [lat, lng]);

  return (
    <div
      ref={holder}
      data-testid="listing-map"
      className="h-64 w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
