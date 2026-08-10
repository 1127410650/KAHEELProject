// The location panel behind the header badge: switch the browsing city (used by
// search to sort/filter nearby results), pick a precise point on an
// OpenStreetMap map, and keep a small book of saved addresses for delivery.
// الخصوصية: لا يُخزَّن الموقع الحيّ إطلاقًا — فقط العناوين التي يحفظها المستخدم،
// والإذن يُطلب عند الضغط على الزر لا عند فتح التطبيق.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe2,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
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
import { countryCenter } from "@/lib/geo-centers";
import { reverseGeocode } from "@/lib/geo-reverse.functions";
import {
  MapPickerDialog,
  type PickedPlace,
} from "@/components/marketplace/MapPickerDialog";
import {
  accuracyLabel,
  addressInputError,
  deleteMyAddress,
  loadMyAddresses,
  requestDeviceLocation,
  saveMyAddress,
  setDefaultAddress,
} from "@/lib/mkt-addresses";

interface Picked {
  lat: number;
  lng: number;
  accuracyM: number | null;
  placeLabel: string | null;
  district: string | null;
  city: string | null;
  countryIso2: string | null;
  source: "device" | "map";
}

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
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
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

  const marketIso2 = (preference.countryIso2 || "SY").toUpperCase();
  const marketName = ar ? country.data?.name_ar : country.data?.name_en;
  const outsideMarket =
    !!picked?.countryIso2 && picked.countryIso2.toUpperCase() !== marketIso2;

  const mapStart = useMemo(
    () =>
      picked
        ? { lat: picked.lat, lng: picked.lng }
        : countryCenter(marketIso2),
    [picked, marketIso2],
  );

  function applyPicked(next: Picked) {
    setPicked(next);
    setForm((previous) => ({
      ...previous,
      district: previous.district || next.district || "",
      details: previous.details || next.placeLabel || "",
    }));
  }

  /** الموقع الحقيقي من الجهاز أيًّا كان البلد — بلا افتراض جغرافي. */
  async function useDevice() {
    setLocating(true);
    try {
      const position = await requestDeviceLocation();
      let inferred: Omit<Picked, "lat" | "lng" | "accuracyM" | "source"> = {
        placeLabel: null,
        district: null,
        city: null,
        countryIso2: null,
      };
      try {
        const result = await reverseGeocode({
          data: { lat: position.lat, lng: position.lng, locale },
        });
        inferred = {
          placeLabel: result.label || null,
          district: result.district,
          city: result.city,
          countryIso2: result.countryIso2,
        };
      } catch {
        // تعذّر استنتاج العنوان — الإحداثيات تبقى صحيحة.
      }
      applyPicked({
        lat: position.lat,
        lng: position.lng,
        accuracyM: position.accuracy ?? null,
        source: "device",
        ...inferred,
      });
      toast.success(ar ? "تم تحديد موقعك من الجهاز." : "Location captured from your device.");
    } catch (error) {
      const denied = error instanceof Error && error.message === "PERMISSION_DENIED";
      if (denied) {
        toast.error(
          ar
            ? "إذن الموقع مرفوض — اختر موقعك على الخريطة أو من قائمة المحافظات."
            : "Permission denied — pick your location on the map or from the list.",
        );
      } else {
        toast.error(error instanceof Error ? error.message : "تعذّر تحديد الموقع.");
      }
    } finally {
      setLocating(false);
    }
  }

  function confirmFromMap(place: PickedPlace) {
    applyPicked({ ...place, source: "map" });
    toast.success(ar ? "تم تأكيد الموقع من الخريطة." : "Location confirmed from the map.");
    if (session) setShowForm(true);
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
      lat: picked?.lat ?? null,
      lng: picked?.lng ?? null,
      accuracyM: picked?.source === "device" ? picked.accuracyM : null,
      placeLabel: picked?.placeLabel ?? null,
      source: picked ? picked.source : ("manual" as const),
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

  const accuracyText = picked?.source === "device" ? accuracyLabel(picked.accuracyM) : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" dir={dir} className="max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>{ar ? "موقعك" : "Your location"}</SheetTitle>
            <SheetDescription>
              {ar
                ? "نستخدم موقعك لترتيب النتائج القريبة منك، ولعنوان التوصيل. لا نخزّن موقعك الحيّ — فقط العناوين التي تحفظها."
                : "We use your location to surface nearby results and for delivery. Live location is never stored."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 pb-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                onClick={useDevice}
                disabled={locating}
                data-testid="detect-location"
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <LocateFixed className="size-4" aria-hidden />
                )}
                {ar ? "تحديد موقعي تلقائيًا" : "Detect my location"}
              </Button>
              <Button
                type="button"
                onClick={() => setMapOpen(true)}
                data-testid="open-map-picker"
              >
                <MapIcon className="size-4" aria-hidden />
                {ar ? "اختر على الخريطة" : "Pick on map"}
              </Button>
            </div>

            {picked && (
              <div
                className="space-y-1 rounded-xl border border-border bg-secondary/60 p-3"
                data-testid="picked-location"
              >
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">
                    {picked.placeLabel ||
                      picked.city ||
                      (ar ? "نقطة محدّدة على الخريطة" : "Picked point")}
                  </span>
                </p>
                <p className="num text-[11px] text-muted-foreground" dir="ltr">
                  {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                  {accuracyText ? ` · ${accuracyText}` : ""}
                </p>
                {picked.city && (
                  <p className="text-xs text-muted-foreground">
                    {ar ? "المنطقة المستنتجة: " : "Detected area: "}
                    {[picked.district, picked.city].filter(Boolean).join(" — ")}
                    {" — "}
                    {ar ? "يمكنك تصحيحها بالأسفل." : "you can correct it below."}
                  </p>
                )}
              </div>
            )}

            {outsideMarket && (
              <div
                className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"
                data-testid="outside-market"
              >
                <Globe2 className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <p className="text-xs leading-relaxed text-foreground">
                  {ar
                    ? `يبدو أنك خارج ${marketName || "سوريا"}${
                        picked?.countryIso2 ? ` (${picked.countryIso2})` : ""
                      }. حفظنا إحداثياتك كما هي بلا تغيير — ويمكنك اختيار محافظة سورية بالأسفل للتصفح فقط.`
                    : `You appear to be outside ${marketName || "Syria"}. Your exact coordinates are kept as-is; pick a Syrian governorate below just for browsing.`}
                </p>
              </div>
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowForm(true)}
                  >
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
                      {address.lat != null && address.lng != null && (
                        <p className="num text-[10px] text-muted-foreground" dir="ltr">
                          {address.lat.toFixed(5)}, {address.lng.toFixed(5)}
                        </p>
                      )}
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
                      placeholder={ar ? "المنزل" : "Home"}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, label: event.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(ar
                        ? ["المنزل", "العمل", "عند الأهل"]
                        : ["Home", "Work", "Family"]
                      ).map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          onClick={() => setForm((previous) => ({ ...previous, label: quick }))}
                          className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary"
                        >
                          {quick}
                        </button>
                      ))}
                    </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {picked
                        ? ar
                          ? `سيتم حفظ الإحداثيات الدقيقة${accuracyText ? ` (${accuracyText})` : ""}.`
                          : "Exact coordinates will be saved with this address."
                        : ar
                          ? "لا إحداثيات بعد — اختر على الخريطة لحفظ نقطة دقيقة."
                          : "No coordinates yet — pick on the map."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMapOpen(true)}
                    >
                      <MapIcon className="size-4" aria-hidden />
                      {ar ? "الخريطة" : "Map"}
                    </Button>
                  </div>
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

      <MapPickerDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        initial={mapStart}
        onConfirm={confirmFromMap}
      />
    </>
  );
}
