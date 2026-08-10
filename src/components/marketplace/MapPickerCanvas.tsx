import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  /** يتغيّر رقمه لطلب القفز إلى موقع الجهاز الحالي. */
  locateSignal?: number;
  /** الإحداثيات بعد كل تحريك للدبوس أو الخريطة أو ضغط مباشر. */
  onChange: (lat: number, lng: number) => void;
  /** موقع الجهاز الحقيقي (أيًّا كان البلد) عند الضغط على «موقعي الحالي». */
  onLocate?: () => void;
}

/**
 * خريطة OpenStreetMap عبر Leaflet مع دبوس مركزي قابل للسحب.
 * وحدة متصفح فقط — تُحمَّل كسولًا عند فتح نافذة الخريطة لا مع الصفحة.
 */
export default function MapPickerCanvas({
  lat,
  lng,
  zoom = 15,
  locateSignal = 0,
  onChange,
  onLocate,
}: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const dragging = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  // آخر نقطة ضُبطت برمجيًا: تمنع إعادة بثّ نفس النقطة كأنها تحريك مستخدم.
  const target = useRef<{ lat: number; lng: number }>({ lat, lng });
  const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;


  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holder.current || map.current) return;

      const icon = L.divIcon({
        className: "mkt-map-pin",
        html: '<span class="mkt-pin"><span class="mkt-pin-dot"></span></span>',
        iconSize: [28, 40],
        iconAnchor: [14, 38],
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

      const pin = L.marker([lat, lng], { draggable: true, icon, autoPan: true }).addTo(instance);

      pin.on("dragstart", () => {
        dragging.current = true;
      });
      pin.on("dragend", () => {
        dragging.current = false;
        const point = pin.getLatLng();
        external.current = false;
        instance.panTo(point, { animate: true });
        change.current(point.lat, point.lng);
      });

      // تحريك الخريطة يحرّك الدبوس معها (نمط الدبوس المركزي).
      instance.on("move", () => {
        if (dragging.current) return;
        pin.setLatLng(instance.getCenter());
      });
      instance.on("moveend", () => {
        if (dragging.current) return;
        if (external.current) {
          external.current = false;
          return;
        }
        const point = instance.getCenter();
        change.current(point.lat, point.lng);
      });

      // الضغط المباشر على النقطة المطلوبة.
      instance.on("click", (event) => {
        const point = (event as unknown as { latlng: { lat: number; lng: number } }).latlng;
        pin.setLatLng(point);
        external.current = false;
        instance.panTo(point, { animate: true });
        change.current(point.lat, point.lng);
      });

      map.current = instance;
      marker.current = pin;
      // الحاوية تبدأ داخل نافذة، فالمقاسات تستقر متأخرة.
      setTimeout(() => instance.invalidateSize(), 140);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مزامنة العرض عندما تتغيّر الإحداثيات من الخارج (GPS، بحث، محافظة).
  useEffect(() => {
    const instance = map.current;
    const pin = marker.current;
    if (!instance || !pin) return;
    const current = instance.getCenter();
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;
    external.current = true;
    pin.setLatLng([lat, lng]);
    instance.setView([lat, lng], Math.max(instance.getZoom(), 15), { animate: true });
  }, [lat, lng]);

  // «موقعي الحالي»
  useEffect(() => {
    if (!locateSignal) return;
    onLocate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateSignal]);

  return <div ref={holder} data-testid="map-picker-canvas" className="size-full" />;
}
