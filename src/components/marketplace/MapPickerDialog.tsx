// نافذة اختيار الموقع على خريطة OpenStreetMap بملء الشاشة.
// الخريطة (Leaflet ‎≈145KB) تُحمَّل كسولًا هنا فقط — لا شيء منها في الصفحة الرئيسية.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Check, Crosshair, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { accuracyLabel, requestDeviceLocation } from "@/lib/mkt-addresses";
import { reverseGeocode } from "@/lib/geo-reverse.functions";

const MapPickerCanvas = lazy(() => import("./MapPickerCanvas"));

export interface PickedPlace {
  lat: number;
  lng: number;
  accuracyM: number | null;
  placeLabel: string | null;
  district: string | null;
  city: string | null;
  countryIso2: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  /** نقطة البداية — مركز المحافظة المختارة أو موقع الجهاز إن توفر. */
  initial: { lat: number; lng: number };
  onConfirm: (place: PickedPlace) => void;
}

export function MapPickerDialog({ open, onOpenChange, initial, onConfirm }: Props) {
  const { locale, dir } = useI18n();
  const ar = locale === "ar";
  const [point, setPoint] = useState(initial);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [place, setPlace] = useState<Omit<PickedPlace, "lat" | "lng" | "accuracyM"> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // إعادة التمركز عند كل فتح، مع تفريغ أي عنوان قديم.
  useEffect(() => {
    if (!open) return;
    setPoint(initial);
    setPlace(null);
    setAccuracy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.lat, initial.lng]);

  // العنوان الحيّ: يُحدَّث بعد سكون قصير لكل تحريك للدبوس.
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    setResolving(true);
    timer.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await reverseGeocode({
            data: { lat: point.lat, lng: point.lng, locale },
          });
          setPlace({
            placeLabel: result.label || null,
            district: result.district,
            city: result.city,
            countryIso2: result.countryIso2,
          });
        } catch {
          setPlace(null);
        } finally {
          setResolving(false);
        }
      })();
    }, 550);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, point.lat, point.lng, locale]);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const position = await requestDeviceLocation();
      setPoint({ lat: position.lat, lng: position.lng });
      setAccuracy(position.accuracy ?? null);
    } catch (error) {
      const denied = error instanceof Error && error.message === "PERMISSION_DENIED";
      toast.error(
        denied
          ? ar
            ? "إذن الموقع مرفوض — حدّد النقطة على الخريطة يدويًا."
            : "Location permission denied — pick the point manually."
          : error instanceof Error
            ? error.message
            : "تعذّر تحديد الموقع.",
      );
    } finally {
      setLocating(false);
    }
  }, [ar]);

  if (!open) return null;

  const accuracyText = accuracyLabel(accuracy);

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "اختيار الموقع على الخريطة" : "Pick location on map"}
      className="fixed inset-0 z-[70] flex flex-col bg-background"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <p className="truncate text-sm font-bold text-foreground">
            {ar ? "اختر موقعك على الخريطة" : "Pick your location"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={ar ? "إغلاق" : "Close"}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <ClientOnly
          fallback={
            <div className="grid size-full place-items-center bg-secondary">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="grid size-full place-items-center bg-secondary">
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              </div>
            }
          >
            <MapPickerCanvas
              lat={point.lat}
              lng={point.lng}
              onChange={(lat, lng) => {
                setPoint({ lat, lng });
                setAccuracy(null);
              }}
            />
          </Suspense>
        </ClientOnly>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void locate()}
          disabled={locating}
          className="absolute bottom-3 end-3 z-[500] shadow-lg"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-4" aria-hidden />
          )}
          {ar ? "موقعي الحالي" : "My location"}
        </Button>
      </div>

      <footer className="shrink-0 space-y-2.5 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-h-[42px] rounded-xl bg-secondary px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            {resolving && <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />}
            <span className="truncate">
              {place?.placeLabel ||
                (resolving
                  ? ar
                    ? "جارٍ قراءة العنوان…"
                    : "Reading address…"
                  : ar
                    ? "نقطة على الخريطة"
                    : "Point on map")}
            </span>
          </p>
          <p className="num mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            {accuracyText ? ` · ${accuracyText}` : ""}
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            onConfirm({
              lat: point.lat,
              lng: point.lng,
              accuracyM: accuracy,
              placeLabel: place?.placeLabel ?? null,
              district: place?.district ?? null,
              city: place?.city ?? null,
              countryIso2: place?.countryIso2 ?? null,
            });
            onOpenChange(false);
          }}
        >
          <Check className="size-4" aria-hidden />
          {ar ? "تأكيد هذا الموقع" : "Confirm this location"}
        </Button>
      </footer>
    </div>
  );
}
