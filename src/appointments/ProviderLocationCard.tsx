import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, LocateFixed, MapPin, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { appointmentErrorMessage, type ProviderDashboard } from "./api";
import {
  providerTypeLabel,
  providerTypes,
  saveProviderLocation,
  type ProviderType,
} from "./directory-api";
import { Card } from "./ui";

interface SelectedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function ProviderLocationCard({
  locale,
  dashboard,
  onRefresh,
}: {
  locale: "ar" | "en";
  dashboard: ProviderDashboard;
  onRefresh: () => Promise<void>;
}) {
  const provider = dashboard.provider;
  const isAr = locale === "ar";
  const [providerType, setProviderType] = useState<ProviderType>(
    (provider.provider_type as ProviderType) || "other",
  );
  const [city, setCity] = useState(provider.city ?? "");
  const [district, setDistrict] = useState(provider.district ?? "");
  const [address, setAddress] = useState(provider.address_text ?? "");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [clearLocation, setClearLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProviderType((provider.provider_type as ProviderType) || "other");
    setCity(provider.city ?? "");
    setDistrict(provider.district ?? "");
    setAddress(provider.address_text ?? "");
    setSelectedLocation(null);
    setClearLocation(false);
  }, [
    provider.id,
    provider.provider_type,
    provider.city,
    provider.district,
    provider.address_text,
  ]);

  const text = useMemo(
    () =>
      isAr
        ? {
            title: "الظهور في كَحيل دليل",
            body: "حدد نوع الجهة وموقع المنشأة ليتمكن العملاء من العثور عليك بالقرب منهم. يُحفظ موقع المنشأة فقط بعد تأكيدك، ولا يؤثر على بيانات سوق كَحيل.",
            type: "نوع الجهة",
            city: "المدينة",
            district: "الحي",
            address: "العنوان المختصر",
            capture: "تأكيد موقع المنشأة من هذا الجهاز",
            captureHint: "نفّذ هذه الخطوة وأنت داخل موقع المنشأة أو استخدم جهازًا موجودًا فيها.",
            confirmed: "موقع المنشأة مؤكد",
            accuracy: "دقة الموقع التقريبية",
            meters: "متر",
            clear: "إزالة الموقع",
            save: "حفظ بيانات الدليل",
            saved: "تم حفظ بيانات كَحيل دليل",
            unsupported: "تحديد الموقع غير مدعوم في هذا المتصفح.",
            denied: "لم يتم السماح بتحديد الموقع. فعّل الإذن من إعدادات المتصفح.",
            unavailable: "تعذر تحديد موقع المنشأة. حاول مرة أخرى.",
          }
        : {
            title: "KAHEEL Directory visibility",
            body: "Set the provider type and confirmed business location so customers can discover you nearby. The business location is stored only after your confirmation and does not modify KAHEEL Market data.",
            type: "Provider type",
            city: "City",
            district: "District",
            address: "Short address",
            capture: "Confirm business location from this device",
            captureHint: "Use this while physically at the business location, or from a device located there.",
            confirmed: "Business location confirmed",
            accuracy: "Approximate accuracy",
            meters: "m",
            clear: "Remove location",
            save: "Save directory details",
            saved: "KAHEEL Directory details saved",
            unsupported: "Location is not supported by this browser.",
            denied: "Location permission was not granted. Enable it in browser settings.",
            unavailable: "The business location could not be determined. Try again.",
          },
    [isAr],
  );

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error(text.unsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setClearLocation(false);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        toast.error(error.code === error.PERMISSION_DENIED ? text.denied : text.unavailable);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  async function save() {
    setSaving(true);
    try {
      await saveProviderLocation({
        providerId: provider.id,
        providerType,
        city,
        district,
        addressText: address,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        accuracyMeters: selectedLocation?.accuracy,
        clearLocation,
      });
      toast.success(text.saved);
      await onRefresh();
    } catch (error) {
      toast.error(appointmentErrorMessage(error, locale));
    } finally {
      setSaving(false);
    }
  }

  const shownLocation =
    selectedLocation ??
    (provider.latitude != null && provider.longitude != null && !clearLocation
      ? {
          latitude: provider.latitude,
          longitude: provider.longitude,
          accuracy: provider.location_accuracy_meters ?? 0,
        }
      : null);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className="max-w-xl xl:w-[34%]">
            <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
              <MapPin className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-black">{text.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{text.body}</p>
          </div>

          <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="directory-provider-type">{text.type}</Label>
              <select
                id="directory-provider-type"
                value={providerType}
                onChange={(event) => setProviderType(event.target.value as ProviderType)}
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {providerTypes.map((type) => (
                  <option key={type} value={type}>
                    {providerTypeLabel(type, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="directory-city">{text.city}</Label>
              <Input
                id="directory-city"
                className="mt-2 h-11"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="directory-district">{text.district}</Label>
              <Input
                id="directory-district"
                className="mt-2 h-11"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="directory-address">{text.address}</Label>
              <Input
                id="directory-address"
                className="mt-2 h-11"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              {shownLocation ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <strong className="block text-sm">{text.confirmed}</strong>
                    <p dir="ltr" className="mt-1 text-start text-xs text-muted-foreground">
                      {shownLocation.latitude.toFixed(6)}, {shownLocation.longitude.toFixed(6)}
                    </p>
                    {shownLocation.accuracy > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {text.accuracy}: {Math.round(shownLocation.accuracy)} {text.meters}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div>
                  <strong className="block text-sm">{text.capture}</strong>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {text.captureHint}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={locate}
                disabled={locating || saving}
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
                {text.capture}
              </Button>
              {shownLocation ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedLocation(null);
                    setClearLocation(true);
                  }}
                  disabled={saving}
                >
                  <Trash2 className="size-4" />
                  {text.clear}
                </Button>
              ) : null}
              <Button type="button" onClick={() => void save()} disabled={saving || locating}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {text.save}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
