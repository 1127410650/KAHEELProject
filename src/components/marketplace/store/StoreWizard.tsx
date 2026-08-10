/**
 * Storefront wizard (batch 2) — 7 short steps instead of one long page.
 *
 * Every step saves through `mkt_store_save`, so a refresh resumes exactly where
 * the merchant stopped (`draft_step` lives in the database, not localStorage).
 * Ownership, country, slug, currency and status are decided server-side.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Loader2, Store, Upload } from "lucide-react";

import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/lib/mkt-account";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { currencyLabel } from "@/lib/mkt";
import {
  STORE_TYPES,
  emptyHours,
  saveStore,
  saveStoreHours,
  saveStoreZones,
  signStorePath,
  submitStore,
  uploadPermitDoc,
  uploadStoreImage,
  useStoreDraft,
  type StoreHourRow,
  type StorePatch,
  type StoreType,
  type StoreZoneRow,
} from "@/lib/mkt-store";
import { saveProviderSetup, useProviderSetup, type ServiceMode } from "@/lib/mkt-services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const TOTAL_STEPS = 7;
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";

interface Form {
  store_type: StoreType;
  cuisine_id: string;
  name_ar: string;
  name_en: string;
  short_description_ar: string;
  short_description_en: string;
  logo_path: string | null;
  cover_path: string | null;
  city_id: string;
  district: string;
  address_text: string;
  latitude: string;
  longitude: string;
  location_precision: "exact" | "approximate";
  contact_phone: string;
  public_phone_enabled: boolean;
  chat_enabled: boolean;
  call_enabled: boolean;
  pickup_enabled: boolean;
  merchant_delivery_enabled: boolean;
  remote_service_enabled: boolean;
  delivery_fee: string;
  minimum_order_amount: string;
  estimated_delivery_minutes_min: string;
  estimated_delivery_minutes_max: string;
  delivery_phone: string;
  delivery_declaration: boolean;
  delivery_permit_number: string;
  delivery_permit_expires_on: string;
  delivery_permit_doc_path: string | null;
}

const EMPTY: Form = {
  store_type: "retail",
  cuisine_id: "",
  name_ar: "",
  name_en: "",
  short_description_ar: "",
  short_description_en: "",
  logo_path: null,
  cover_path: null,
  city_id: "",
  district: "",
  address_text: "",
  latitude: "",
  longitude: "",
  location_precision: "approximate",
  contact_phone: "",
  public_phone_enabled: false,
  chat_enabled: true,
  call_enabled: false,
  pickup_enabled: true,
  merchant_delivery_enabled: false,
  remote_service_enabled: false,
  delivery_fee: "0",
  minimum_order_amount: "0",
  estimated_delivery_minutes_min: "",
  estimated_delivery_minutes_max: "",
  delivery_phone: "",
  delivery_declaration: false,
  delivery_permit_number: "",
  delivery_permit_expires_on: "",
  delivery_permit_doc_path: null,
};

export function StoreWizard() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const draft = useStoreDraft(accountKey);
  const serviceSetup = useProviderSetup(accountKey);
  const country = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", country.data?.id ?? ""],
    enabled: !!country.data?.id,
    queryFn: () => loadCities(country.data?.id ?? null),
  });
  const cuisines = useQuery({
    queryKey: ["mkt", "store-cuisines"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_store_cuisines")
        .select("id, name_ar, name_en")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as { id: string; name_ar: string; name_en: string }[];
    },
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const [hours, setHours] = useState<StoreHourRow[]>(emptyHours());
  const [zones, setZones] = useState<StoreZoneRow[]>([]);
  const [step, setStep] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const hydrated = useRef(false);
  const idemKey = useRef<string>("");
  if (!idemKey.current && typeof crypto !== "undefined") idemKey.current = crypto.randomUUID();

  // Restore the saved draft once: last step, values, images, location.
  useEffect(() => {
    if (
      hydrated.current ||
      draft.isLoading ||
      (draft.data?.store.store_type === "services" && serviceSetup.isLoading)
    )
      return;
    hydrated.current = true;
    const d = draft.data;
    if (!d) return;
    const s = d.store;
    setStoreId(s.id);
    setStep(Math.min(Math.max(s.draft_step || 1, 1), TOTAL_STEPS));
    const savedModes = serviceSetup.data?.settings.service_modes ?? [];
    setForm({
      store_type: s.store_type,
      cuisine_id: s.cuisine_id ?? "",
      name_ar: s.name_ar ?? "",
      name_en: s.name_en ?? "",
      short_description_ar: s.short_description_ar ?? "",
      short_description_en: s.short_description_en ?? "",
      logo_path: s.logo_path,
      cover_path: s.cover_path,
      city_id: s.city_id ?? "",
      district: s.district ?? "",
      address_text: s.address_text ?? "",
      latitude: s.latitude != null ? String(s.latitude) : "",
      longitude: s.longitude != null ? String(s.longitude) : "",
      location_precision: s.location_precision === "exact" ? "exact" : "approximate",
      contact_phone: d.private?.contact_phone ?? "",
      public_phone_enabled: s.public_phone_enabled,
      chat_enabled: s.chat_enabled,
      call_enabled: s.call_enabled,
      pickup_enabled:
        s.store_type === "services" && savedModes.length > 0
          ? savedModes.includes("at_provider")
          : s.pickup_enabled,
      merchant_delivery_enabled:
        s.store_type === "services" && savedModes.length > 0
          ? savedModes.includes("at_customer")
          : s.merchant_delivery_enabled,
      remote_service_enabled: savedModes.includes("remote"),
      delivery_fee: String(s.delivery_fee ?? 0),
      minimum_order_amount: String(s.minimum_order_amount ?? 0),
      estimated_delivery_minutes_min:
        s.estimated_delivery_minutes_min != null ? String(s.estimated_delivery_minutes_min) : "",
      estimated_delivery_minutes_max:
        s.estimated_delivery_minutes_max != null ? String(s.estimated_delivery_minutes_max) : "",
      delivery_phone: d.private?.delivery_phone ?? "",
      delivery_declaration: !!d.private?.delivery_declaration_accepted_at,
      delivery_permit_number: d.private?.delivery_permit_number ?? "",
      delivery_permit_expires_on: d.private?.delivery_permit_expires_on ?? "",
      delivery_permit_doc_path: d.private?.has_permit_doc ? "kept" : null,
    });
    if (d.hours.length > 0) setHours(d.hours);
    if (d.zones.length > 0) setZones(d.zones);
  }, [draft.data, draft.isLoading, serviceSetup.data, serviceSetup.isLoading]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [logo, cover] = await Promise.all([
        signStorePath(form.logo_path),
        signStorePath(form.cover_path),
      ]);
      if (!alive) return;
      setLogoUrl(logo);
      setCoverUrl(cover);
    })();
    return () => {
      alive = false;
    };
  }, [form.logo_path, form.cover_path]);

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patchFor = useCallback(
    (target: number): StorePatch => ({
      store_type: form.store_type,
      cuisine_id: form.store_type === "restaurant" ? form.cuisine_id || null : null,
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      short_description_ar: form.short_description_ar.trim() || null,
      short_description_en: form.short_description_en.trim() || null,
      logo_path: form.logo_path,
      cover_path: form.cover_path,
      city_id: form.city_id || null,
      district: form.district.trim() || null,
      address_text: form.address_text.trim() || null,
      latitude: form.latitude || null,
      longitude: form.longitude || null,
      location_precision: form.location_precision,
      contact_phone: form.contact_phone.trim() || null,
      public_phone_enabled: form.public_phone_enabled,
      chat_enabled: form.chat_enabled,
      call_enabled: form.call_enabled && !!form.contact_phone.trim(),
      pickup_enabled: form.pickup_enabled,
      merchant_delivery_enabled: form.merchant_delivery_enabled,
      delivery_fee: form.merchant_delivery_enabled ? Number(form.delivery_fee || 0) : 0,
      minimum_order_amount: Number(form.minimum_order_amount || 0),
      estimated_delivery_minutes_min: form.merchant_delivery_enabled
        ? form.estimated_delivery_minutes_min || null
        : null,
      estimated_delivery_minutes_max: form.merchant_delivery_enabled
        ? form.estimated_delivery_minutes_max || null
        : null,
      delivery_phone: form.merchant_delivery_enabled ? form.delivery_phone.trim() || null : null,
      delivery_declaration: form.merchant_delivery_enabled && form.delivery_declaration,
      delivery_permit_number: form.merchant_delivery_enabled
        ? form.delivery_permit_number.trim() || null
        : null,
      delivery_permit_expires_on: form.merchant_delivery_enabled
        ? form.delivery_permit_expires_on || null
        : null,
      _step: target,
    }),
    [form],
  );

  const persist = useCallback(
    async (target: number): Promise<string | null> => {
      if (!accountKey) return null;
      setSaving(true);
      try {
        const patch = patchFor(target);
        delete patch["_step"];
        const id = await saveStore(accountKey, patch, target, idemKey.current);
        setStoreId(id);
        if (form.store_type === "services") {
          const modes: ServiceMode[] = [];
          if (form.pickup_enabled) modes.push("at_provider");
          if (form.merchant_delivery_enabled) modes.push("at_customer");
          if (form.remote_service_enabled) modes.push("remote");
          await saveProviderSetup(accountKey, {
            category_code: serviceSetup.data?.settings.category_code ?? "other",
            service_modes: modes,
            professional_name: form.name_ar.trim() || "مقدم الخدمة",
          });
        }
        if (target >= 5 || step === 5) await saveStoreHours(id, hours);
        if (form.merchant_delivery_enabled) await saveStoreZones(id, zones);
        await queryClient.invalidateQueries({ queryKey: ["mkt", "my-storefront"] });
        return id;
      } catch (error) {
        toast.error((error as Error).message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      accountKey,
      form,
      hours,
      patchFor,
      queryClient,
      serviceSetup.data?.settings.category_code,
      step,
      zones,
    ],
  );

  const next = async () => {
    if (step === 2 && !form.name_ar.trim()) {
      toast.error(t("market.store.errors.name"));
      return;
    }
    if (step === 3 && !form.city_id) {
      toast.error(t("market.store.errors.city"));
      return;
    }
    if (
      step === 4 &&
      !form.pickup_enabled &&
      !form.merchant_delivery_enabled &&
      !(form.store_type === "services" && form.remote_service_enabled)
    ) {
      toast.error(t("market.store.errors.fulfilment"));
      return;
    }
    if (
      step === 4 &&
      form.store_type !== "services" &&
      form.merchant_delivery_enabled &&
      !form.delivery_declaration
    ) {
      toast.error(t("market.store.errors.declaration"));
      return;
    }
    const target = Math.min(step + 1, TOTAL_STEPS);
    const id = await persist(target);
    if (id) setStep(target);
  };

  const back = async () => {
    const target = Math.max(step - 1, 1);
    await persist(target);
    setStep(target);
  };

  const finish = async () => {
    const id = (await persist(TOTAL_STEPS)) ?? storeId;
    if (!id) return;
    const result = await submitStore(id);
    if (!result.ok) {
      toast.error(
        `${t("market.store.errors.incomplete")} ${(result.missing ?? [])
          .map((key) => t(`market.store.errors.${key}`))
          .join(" · ")}`,
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["mkt", "my-storefront"] });
    await queryClient.invalidateQueries({ queryKey: ["mkt", "store-draft"] });
    toast.success(t("market.store.submitted"));
    void navigate({ to: "/business/store" });
  };

  const pickImage = async (kind: "logo" | "cover", file: File | null) => {
    if (!file) return;
    let id = storeId;
    if (!id) id = await persist(step);
    if (!id) return;
    setSaving(true);
    const previous = kind === "logo" ? form.logo_path : form.cover_path;
    const result = await uploadStoreImage(id, kind, file, previous);
    setSaving(false);
    if ("error" in result) {
      toast.error(t(`market.media.error.${result.error}`));
      return;
    }
    set(kind === "logo" ? "logo_path" : "cover_path", result.path);
    await saveStore(
      accountKey!,
      { [kind === "logo" ? "logo_path" : "cover_path"]: result.path },
      step,
    );
  };

  const pickPermit = async (file: File | null) => {
    if (!file || !storeId) return;
    setSaving(true);
    const result = await uploadPermitDoc(storeId, file, null);
    setSaving(false);
    if ("error" in result) {
      toast.error(t(`market.media.error.${result.error}`));
      return;
    }
    set("delivery_permit_doc_path", result.path);
    await saveStore(accountKey!, { delivery_permit_doc_path: result.path }, step);
    toast.success(t("market.store.permitUploaded"));
  };

  const cityLabel = useMemo(
    () =>
      geoName(
        (cities.data ?? []).find((c) => c.id === form.city_id),
        locale,
      ),
    [cities.data, form.city_id, locale],
  );

  if (draft.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-desc">
        {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((value) => (
          <li
            key={value}
            className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-medium ${
              value === step
                ? "bg-primary text-primary-foreground"
                : value < step
                  ? "bg-secondary text-foreground"
                  : "border border-input text-muted-foreground"
            }`}
          >
            {value < step ? <Check className="h-3.5 w-3.5" /> : value}
          </li>
        ))}
      </ol>

      <h2 className="text-section font-semibold">
        {step === 4 && form.store_type === "services"
          ? locale === "ar"
            ? "طريقة تقديم الخدمة"
            : "Service modes"
          : t(`market.store.steps.${step}`)}
      </h2>

      <Card>
        <CardContent className="space-y-4 pt-5">
          {step === 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {STORE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set("store_type", type)}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-start ${
                    form.store_type === type ? "border-primary bg-primary/5" : "border-input"
                  }`}
                >
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">
                      {t(`market.store.type.${type}`)}
                    </span>
                    <span className="block text-desc text-muted-foreground">
                      {t(`market.store.typeHint.${type}`)}
                    </span>
                  </span>
                </button>
              ))}
              {form.store_type === "restaurant" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cuisine">{t("market.store.cuisine")}</Label>
                  <select
                    id="cuisine"
                    className={selectClass}
                    value={form.cuisine_id}
                    onChange={(e) => set("cuisine_id", e.target.value)}
                  >
                    <option value="">—</option>
                    {(cuisines.data ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {geoName(row, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name_ar">{t("market.store.nameAr")}</Label>
                <Input
                  id="name_ar"
                  value={form.name_ar}
                  onChange={(e) => set("name_ar", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_en">{t("market.store.nameEn")}</Label>
                <Input
                  id="name_en"
                  dir="ltr"
                  value={form.name_en}
                  onChange={(e) => set("name_en", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc_ar">{t("market.store.descAr")}</Label>
                <Textarea
                  id="desc_ar"
                  rows={3}
                  maxLength={280}
                  value={form.short_description_ar}
                  onChange={(e) => set("short_description_ar", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc_en">{t("market.store.descEn")}</Label>
                <Textarea
                  id="desc_en"
                  dir="ltr"
                  rows={3}
                  maxLength={280}
                  value={form.short_description_en}
                  onChange={(e) => set("short_description_en", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImagePicker
                  label={t("market.store.logo")}
                  url={logoUrl}
                  square
                  onPick={(file) => void pickImage("logo", file)}
                />
                <ImagePicker
                  label={t("market.store.cover")}
                  url={coverUrl}
                  onPick={(file) => void pickImage("cover", file)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="rounded-md bg-secondary/60 p-2 text-desc text-muted-foreground">
                {t("market.store.countryFromAccount")}{" "}
                <span className="font-medium text-foreground">
                  {geoName(country.data ?? undefined, locale)}
                </span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("market.store.city")}</Label>
                <select
                  id="city"
                  className={selectClass}
                  value={form.city_id}
                  onChange={(e) => set("city_id", e.target.value)}
                >
                  <option value="">—</option>
                  {(cities.data ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {geoName(row, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="district">{t("market.store.district")}</Label>
                <Input
                  id="district"
                  value={form.district}
                  onChange={(e) => set("district", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">{t("market.store.address")}</Label>
                <Textarea
                  id="address"
                  rows={2}
                  value={form.address_text}
                  onChange={(e) => set("address_text", e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lat">{t("market.store.latitude")}</Label>
                  <Input
                    id="lat"
                    dir="ltr"
                    inputMode="decimal"
                    value={form.latitude}
                    onChange={(e) => set("latitude", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lng">{t("market.store.longitude")}</Label>
                  <Input
                    id="lng"
                    dir="ltr"
                    inputMode="decimal"
                    value={form.longitude}
                    onChange={(e) => set("longitude", e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof navigator === "undefined" || !navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition((pos) => {
                    set("latitude", pos.coords.latitude.toFixed(6));
                    set("longitude", pos.coords.longitude.toFixed(6));
                    set("location_precision", "exact");
                  });
                }}
              >
                {t("market.store.useMyLocation")}
              </Button>
              <div className="space-y-1.5">
                <Label htmlFor="precision">{t("market.store.precision")}</Label>
                <select
                  id="precision"
                  className={selectClass}
                  value={form.location_precision}
                  onChange={(e) =>
                    set("location_precision", e.target.value as "exact" | "approximate")
                  }
                >
                  <option value="exact">{t("market.store.precisionExact")}</option>
                  <option value="approximate">{t("market.store.precisionApprox")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t("market.store.contactPhone")}</Label>
                <Input
                  id="phone"
                  dir="ltr"
                  placeholder="+9665XXXXXXXX"
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value.replace(/[^\d+]/g, ""))}
                />
                <p className="text-desc text-muted-foreground">{t("market.store.phoneHiddenHint")}</p>
              </div>
              <ToggleRow
                label={t("market.store.publicPhone")}
                checked={form.public_phone_enabled}
                onChange={(v) => {
                  set("public_phone_enabled", v);
                  if (!v) set("call_enabled", false);
                }}
              />
              <ToggleRow
                label={t("market.store.chatEnabled")}
                checked={form.chat_enabled}
                onChange={(v) => set("chat_enabled", v)}
              />
              {form.public_phone_enabled && (
                <ToggleRow
                  label={t("market.store.callEnabled")}
                  checked={form.call_enabled}
                  onChange={(v) => set("call_enabled", v)}
                />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <ToggleRow
                label={
                  form.store_type === "services"
                    ? locale === "ar"
                      ? "في مقر مقدم الخدمة"
                      : "At provider location"
                    : t("market.store.pickup")
                }
                checked={form.pickup_enabled}
                onChange={(v) => set("pickup_enabled", v)}
              />
              <ToggleRow
                label={
                  form.store_type === "services"
                    ? locale === "ar"
                      ? "زيارة موقع العميل"
                      : "At customer location"
                    : t("market.store.merchantDelivery")
                }
                checked={form.merchant_delivery_enabled}
                onChange={(v) => set("merchant_delivery_enabled", v)}
              />
              {form.store_type === "services" ? (
                <>
                  <ToggleRow
                    label={locale === "ar" ? "تقديم الخدمة عن بُعد" : "Remote service"}
                    checked={form.remote_service_enabled}
                    onChange={(value) => set("remote_service_enabled", value)}
                  />
                  <p className="rounded-lg bg-secondary/60 p-3 text-desc leading-5 text-muted-foreground">
                    {locale === "ar"
                      ? "يمكنك ضبط رسوم الزيارة والتأكيد الفوري وفاصل المواعيد لاحقًا من مركز مقدم الخدمة."
                      : "You can set visit fees, instant confirmation and slot intervals later in the provider center."}
                  </p>
                </>
              ) : null}
              {form.store_type !== "services" && form.merchant_delivery_enabled && (
                <div className="space-y-4 rounded-lg border border-input p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fee">
                        {t("market.store.deliveryFee")} ({currencyLabel("SAR", locale)})
                      </Label>
                      <Input
                        id="fee"
                        inputMode="decimal"
                        value={form.delivery_fee}
                        onChange={(e) => set("delivery_fee", e.target.value.replace(/[^\d.]/g, ""))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="min">{t("market.store.minOrder")}</Label>
                      <Input
                        id="min"
                        inputMode="decimal"
                        value={form.minimum_order_amount}
                        onChange={(e) =>
                          set("minimum_order_amount", e.target.value.replace(/[^\d.]/g, ""))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="etamin">{t("market.store.etaMin")}</Label>
                      <Input
                        id="etamin"
                        inputMode="numeric"
                        value={form.estimated_delivery_minutes_min}
                        onChange={(e) =>
                          set("estimated_delivery_minutes_min", e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="etamax">{t("market.store.etaMax")}</Label>
                      <Input
                        id="etamax"
                        inputMode="numeric"
                        value={form.estimated_delivery_minutes_max}
                        onChange={(e) =>
                          set("estimated_delivery_minutes_max", e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dphone">{t("market.store.deliveryPhone")}</Label>
                      <Input
                        id="dphone"
                        dir="ltr"
                        value={form.delivery_phone}
                        onChange={(e) =>
                          set("delivery_phone", e.target.value.replace(/[^\d+]/g, ""))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="permit">{t("market.store.permitNumber")}</Label>
                      <Input
                        id="permit"
                        value={form.delivery_permit_number}
                        onChange={(e) => set("delivery_permit_number", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="permitexp">{t("market.store.permitExpiry")}</Label>
                      <Input
                        id="permitexp"
                        type="date"
                        value={form.delivery_permit_expires_on}
                        onChange={(e) => set("delivery_permit_expires_on", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="permitdoc">{t("market.store.permitDoc")}</Label>
                      <Input
                        id="permitdoc"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => void pickPermit(e.target.files?.[0] ?? null)}
                      />
                      <p className="text-desc text-muted-foreground">
                        {t("market.store.permitPrivate")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("market.store.zones")}</Label>
                    {zones.map((zone, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-4">
                        <Input
                          placeholder={t("market.store.district")}
                          value={zone.district ?? ""}
                          onChange={(e) =>
                            setZones((prev) =>
                              prev.map((z, i) =>
                                i === index ? { ...z, district: e.target.value } : z,
                              ),
                            )
                          }
                        />
                        <Input
                          placeholder={t("market.store.deliveryFee")}
                          inputMode="decimal"
                          value={zone.delivery_fee ?? ""}
                          onChange={(e) =>
                            setZones((prev) =>
                              prev.map((z, i) =>
                                i === index
                                  ? { ...z, delivery_fee: Number(e.target.value || 0) }
                                  : z,
                              ),
                            )
                          }
                        />
                        <Input
                          placeholder={t("market.store.minOrder")}
                          inputMode="decimal"
                          value={zone.minimum_order_amount ?? ""}
                          onChange={(e) =>
                            setZones((prev) =>
                              prev.map((z, i) =>
                                i === index
                                  ? { ...z, minimum_order_amount: Number(e.target.value || 0) }
                                  : z,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setZones((prev) => prev.filter((_, i) => i !== index))}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setZones((prev) => [
                          ...prev,
                          {
                            city_id: form.city_id || null,
                            district: "",
                            radius_km: null,
                            delivery_fee: Number(form.delivery_fee || 0),
                            minimum_order_amount: Number(form.minimum_order_amount || 0),
                            estimated_minutes_min: null,
                            estimated_minutes_max: null,
                            is_active: true,
                          },
                        ])
                      }
                    >
                      {t("market.store.addZone")}
                    </Button>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.delivery_declaration}
                      onChange={(e) => set("delivery_declaration", e.target.checked)}
                    />
                    <span>{t("market.store.declaration")}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              {hours.map((row, index) => (
                <div key={row.weekday} className="space-y-2 rounded-lg border border-input p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {t(`market.store.weekday.${row.weekday}`)}
                    </span>
                    <label className="flex items-center gap-2 text-desc">
                      <Switch
                        checked={!row.is_closed}
                        onCheckedChange={(checked) =>
                          setHours((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, is_closed: !checked } : r)),
                          )
                        }
                      />
                      {row.is_closed ? t("market.store.closed") : t("market.store.open")}
                    </label>
                  </div>
                  {!row.is_closed && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="time"
                        value={row.opens_at ?? ""}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((r, i) =>
                              i === index ? { ...r, opens_at: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <Input
                        type="time"
                        value={row.closes_at ?? ""}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((r, i) =>
                              i === index ? { ...r, closes_at: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setHours((prev) =>
                    prev.map((r) => ({
                      ...r,
                      is_closed: prev[0]!.is_closed,
                      opens_at: prev[0]!.opens_at,
                      closes_at: prev[0]!.closes_at,
                    })),
                  )
                }
              >
                {t("market.store.copyHours")}
              </Button>
              <ToggleRow
                label={t("market.store.acceptsOrders")}
                checked={
                  form.pickup_enabled ||
                  form.merchant_delivery_enabled ||
                  (form.store_type === "services" && form.remote_service_enabled)
                }
                onChange={() => undefined}
                readOnly
              />
            </div>
          )}

          {step === 6 && (
            <dl className="space-y-2 text-sm">
              <Row
                label={t("market.store.type.label")}
                value={t(`market.store.type.${form.store_type}`)}
              />
              <Row label={t("market.store.nameAr")} value={form.name_ar} />
              <Row label={t("market.store.city")} value={cityLabel} />
              <Row label={t("market.store.district")} value={form.district} />
              <Row
                label={
                  form.store_type === "services"
                    ? locale === "ar"
                      ? "طريقة تقديم الخدمة"
                      : "Service modes"
                    : t("market.store.fulfilment")
                }
                value={[
                  form.pickup_enabled
                    ? form.store_type === "services"
                      ? locale === "ar"
                        ? "في مقر مقدم الخدمة"
                        : "At provider"
                      : t("market.store.pickup")
                    : null,
                  form.merchant_delivery_enabled
                    ? form.store_type === "services"
                      ? locale === "ar"
                        ? "زيارة العميل"
                        : "At customer"
                      : t("market.store.merchantDelivery")
                    : null,
                  form.store_type === "services" && form.remote_service_enabled
                    ? locale === "ar"
                      ? "عن بُعد"
                      : "Remote"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Row
                label={t("market.store.publicPhone")}
                value={form.public_phone_enabled ? t("common.yes") : t("common.no")}
              />
              <Row
                label={t("market.store.workingDays")}
                value={String(hours.filter((h) => !h.is_closed).length)}
              />
            </dl>
          )}

          {step === 7 && (
            <div className="space-y-3 text-sm">
              <p>{t("market.store.reviewNote")}</p>
              <p className="text-desc text-muted-foreground">{t("market.store.freeLaunch")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => void back()} disabled={saving}>
            {t("common.back")}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => void persist(step)} disabled={saving}>
          {t("market.store.saveDraft")}
        </Button>
        <span className="flex-1" />
        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={() => void next()} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.next")}
          </Button>
        ) : (
          <Button type="button" onClick={() => void finish()} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("market.store.submitReview")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value || "—"}</dd>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  readOnly,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={readOnly ?? false} />
    </div>
  );
}

function ImagePicker({
  label,
  url,
  square,
  onPick,
}: {
  label: string;
  url: string | null;
  square?: boolean;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className={`overflow-hidden rounded-lg border border-input bg-secondary/40 ${
          square ? "aspect-square max-w-40" : "aspect-[16/9]"
        }`}
      >
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
        )}
      </div>
      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
