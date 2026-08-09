// The location panel behind the header badge: switch the browsing city (used by
// search to sort/filter nearby results), pick it up from the device, and keep a
// small book of saved addresses for delivery.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LocateFixed, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { geoName, loadCities, useAccountCountry, useMarketPreference } from "@/lib/mkt-geo";
import {
  addressInputError,
  deleteMyAddress,
  loadMyAddresses,
  requestDeviceLocation,
  saveMyAddress,
  setDefaultAddress,
  type DeviceCoords,
} from "@/lib/mkt-addresses";

export function LocationSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { locale, dir } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const queryClient = useQueryClient();
  const country = useAccountCountry();
  const { preference, setPreference } = useMarketPreference();
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<DeviceCoords | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", cityId: "", district: "", details: "" });

  const cities = useQuery({
    queryKey: ["mkt", "cities", country.data?.id ?? null],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: () => loadCities(country.data?.id ?? null),
  });

  const addresses = useQuery({
    queryKey: ["mkt", "my-addresses", session?.user.id ?? null],
    enabled: open && !!session,
    queryFn: loadMyAddresses,
  });

  async function useDevice() {
    setLocating(true);
    try {
      const position = await requestDeviceLocation();
      setCoords(position);
      toast.success(ar ? "تم تحديد موقعك من الجهاز." : "Location captured from your device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تحديد الموقع.");
    } finally {
      setLocating(false);
    }
  }

  async function chooseCity(cityId: string) {
    // الدولة من التفضيل/الإعداد، لا قيمة ثابتة.
    await setPreference({ countryIso2: preference.countryIso2, cityId });
    await queryClient.invalidateQueries({ queryKey: ["mkt"] });
    toast.success(ar ? "تم تحديث منطقتك." : "Your area was updated.");
  }

  async function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      label: form.label,
      countryId: country.data?.id ?? null,
      cityId: form.cityId || null,
      district: form.district,
      details: form.details,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      source: coords ? ("device" as const) : ("manual" as const),
      isDefault: (addresses.data?.length ?? 0) === 0,
    };
    const problem = addressInputError(payload);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await saveMyAddress(payload);
      setForm({ label: "", cityId: "", district: "", details: "" });
      setShowForm(false);
      await addresses.refetch();
      toast.success(ar ? "تم حفظ العنوان." : "Address saved.");
    } catch {
      toast.error(ar ? "تعذّر حفظ العنوان — حاول مرة أخرى." : "Could not save the address.");
    } finally {
      setSaving(false);
    }
  }

  const cityName = (id: string | null) =>
    geoName(cities.data?.find((city) => city.id === id), locale);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" dir={dir} className="max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-start">
          <SheetTitle>{ar ? "موقعك" : "Your location"}</SheetTitle>
          <SheetDescription>
            {ar
              ? "نستخدم موقعك لترتيب النتائج القريبة منك، ولعنوان التوصيل."
              : "We use your location to surface nearby results and for delivery."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={useDevice}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LocateFixed className="size-4" aria-hidden />
            )}
            {ar ? "تحديد موقعي تلقائيًا" : "Detect my location"}
          </Button>
          {coords && (
            <p className="num text-xs text-muted-foreground" dir="ltr">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">
              {ar ? "اختر المحافظة / المدينة" : "Pick your city"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(cities.data ?? []).map((city) => {
                const active = preference.cityId === city.id;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => void chooseCity(city.id)}
                    aria-pressed={active}
                    className={
                      active
                        ? "inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground"
                        : "inline-flex min-h-9 items-center rounded-full border border-border px-3.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                    }
                  >
                    {geoName(city, locale)}
                  </button>
                );
              })}
              {cities.isLoading && (
                <span className="text-xs text-muted-foreground">
                  {ar ? "جارٍ التحميل…" : "Loading…"}
                </span>
              )}
            </div>
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {ar ? "عناويني" : "My addresses"}
              </h3>
              {session && !showForm && (
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
                  <Plus className="size-4" aria-hidden />
                  {ar ? "إضافة عنوان" : "Add address"}
                </Button>
              )}
            </div>

            {!session && (
              <p className="rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
                {ar
                  ? "سجّل الدخول لحفظ عناوينك واستخدامها في التوصيل."
                  : "Sign in to save addresses for delivery."}
              </p>
            )}

            {session &&
              (addresses.data ?? []).map((address) => (
                <div
                  key={address.id}
                  className="flex items-start gap-2 rounded-xl border border-border p-2.5"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {address.label}
                      {address.is_default && (
                        <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                          {ar ? "الافتراضي" : "Default"}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[cityName(address.city_id), address.district, address.details]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  </div>
                  {!address.is_default && (
                    <button
                      type="button"
                      aria-label={ar ? "تعيين كافتراضي" : "Set as default"}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"
                      onClick={async () => {
                        await setDefaultAddress(address.id);
                        await addresses.refetch();
                      }}
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={ar ? "حذف العنوان" : "Delete address"}
                    className="grid size-8 place-items-center rounded-lg text-destructive transition hover:bg-destructive/10"
                    onClick={async () => {
                      await deleteMyAddress(address.id);
                      await addresses.refetch();
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}

            {session && showForm && (
              <form onSubmit={submitAddress} className="space-y-2.5 rounded-xl bg-secondary p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="addr_label">{ar ? "اسم مختصر" : "Short name"}</Label>
                  <Input
                    id="addr_label"
                    value={form.label}
                    maxLength={40}
                    placeholder={ar ? "البيت" : "Home"}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, label: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr_city">{ar ? "المحافظة / المدينة" : "City"}</Label>
                  <select
                    id="addr_city"
                    value={form.cityId}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, cityId: event.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">{ar ? "اختر…" : "Choose…"}</option>
                    {(cities.data ?? []).map((city) => (
                      <option key={city.id} value={city.id}>
                        {geoName(city, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr_district">{ar ? "الحي" : "District"}</Label>
                  <Input
                    id="addr_district"
                    value={form.district}
                    maxLength={60}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, district: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr_details">{ar ? "وصف العنوان" : "Details"}</Label>
                  <Textarea
                    id="addr_details"
                    value={form.details}
                    maxLength={300}
                    rows={2}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, details: event.target.value }))
                    }
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {coords
                    ? ar
                      ? "سيتم حفظ الإحداثيات مع العنوان."
                      : "Coordinates will be saved with this address."
                    : ar
                      ? "الإحداثيات اختيارية — اضغط «تحديد موقعي تلقائيًا» لإضافتها."
                      : "Coordinates are optional."}
                </p>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {ar ? "حفظ العنوان" : "Save address"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    {ar ? "إلغاء" : "Cancel"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
