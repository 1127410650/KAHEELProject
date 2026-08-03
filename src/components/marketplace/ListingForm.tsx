import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { type MktListing } from "@/lib/mkt";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { loadCategories, loadListingTypes } from "@/lib/mkt-queries";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyUserProfile } from "@/lib/mkt-identity";
import {
  dealKindFor,
  isValidTitle,
  isWantedType,
  purposesFor,
  specFieldsFor,
  splitSpecFields,
  TITLE_MAX,
  TITLE_MIN,
  type SpecField,
} from "@/lib/mkt-taxonomy";
import { clearDraft, loadDraft, saveDraft, type ListingDraft } from "@/lib/mkt-listing-draft";
import {
  DEFAULT_LISTING_DURATION,
  LISTING_DURATIONS,
  isListingDuration,
  submitListing,
  type ListingDuration,
} from "@/lib/mkt-listing-ops";
import {
  LICENSE_BLOCK_FIELD,
  licenseBlockers,
  loadOwnerLicense,
  RE_ROOT_SLUG,
  saveListingLicense,
} from "@/lib/mkt-license";
import { imagesRequired, MAX_LISTING_IMAGES } from "@/lib/mkt-listing-media";
import { useListingImages } from "@/lib/use-listing-images";
import { CategoryPicker } from "@/components/marketplace/CategoryPicker";
import { ListingImages } from "@/components/marketplace/ListingImages";
import {
  EMPTY_LICENSE,
  RealEstateLicenseFields,
  type LicenseFormValue,
} from "@/components/marketplace/RealEstateLicenseFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";


interface Props {
  listing?: MktListing | undefined;
}

const selectClass = "h-11 w-full rounded-md border border-input bg-background px-2 text-sm sm:h-9";
const STEPS = ["basics", "media", "reviewPublish"] as const;
type SpecValue = string | number | boolean;
type PriceKind = "fixed" | "from" | "on_request";
type FieldKey = "path" | "title" | "price" | "city" | "images";

/** Short summary used on cards when the advertiser did not write one. */
function autoSummary(description: string): string | null {
  const text = description.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= 120 ? text : `${text.slice(0, 117)}…`;
}

export function ListingForm({ listing }: Props) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [errors, setErrors] = useState<{ [K in FieldKey]?: string | undefined }>({});
  const [draftNote, setDraftNote] = useState<"saved" | "failed" | null>(null);
  const restored = useRef(false);

  const storedSpecs = (listing?.specs as Record<string, SpecValue> | null) ?? {};
  const [typeCode, setTypeCode] = useState(listing?.type_code ?? "");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(listing?.subcategory_id ?? "");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [summary, setSummary] = useState(listing?.summary ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [priceKind, setPriceKind] = useState<PriceKind>(
    listing?.price_on_request
      ? "on_request"
      : storedSpecs["price_kind"] === "from"
        ? "from"
        : "fixed",
  );
  const [priceUnit, setPriceUnit] = useState(listing?.price_unit ?? "");
  const [quantity, setQuantity] = useState(
    listing?.quantity != null ? String(listing.quantity) : "",
  );
  const [unit, setUnit] = useState(listing?.unit ?? "");
  const [itemCondition, setItemCondition] = useState(listing?.item_condition ?? "used");
  const [keywords, setKeywords] = useState((listing?.keywords ?? []).join("، "));
  const [specs, setSpecs] = useState<Record<string, SpecValue>>(storedSpecs);
  // Photos live in a private staging folder identified by this id, so a refresh
  // finds them again and a deleted draft can be swept clean.
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [durationDays, setDurationDays] = useState<ListingDuration>(
    isListingDuration(listing?.duration_days)
      ? (listing!.duration_days as ListingDuration)
      : DEFAULT_LISTING_DURATION,
  );

  // Licence data of a real estate ad, kept out of the local draft on purpose.
  const [license, setLicense] = useState<LicenseFormValue>(EMPTY_LICENSE);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseFocus, setLicenseFocus] = useState<string | null>(null);

  const [cityId, setCityId] = useState(listing?.city_id ?? "");
  const [district, setDistrict] = useState(listing?.district ?? "");
  const [addressText, setAddressText] = useState(listing?.address_text ?? "");
  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    source: "device" | "account" | "manual" | null;
  }>({
    latitude: listing?.latitude ?? null,
    longitude: listing?.longitude ?? null,
    accuracy: listing?.location_accuracy ?? null,
    source: (listing?.location_source as "device" | "account" | "manual" | null) ?? null,
  });
  const visibility = (listing?.location_visibility as "approximate" | "exact") ?? "approximate";
  const [locating, setLocating] = useState(false);

  // One quick retry, then the form shows its own retry button instead of an
  // endless skeleton.
  const categories = useQuery({
    queryKey: ["mkt", "categories"],
    queryFn: loadCategories,
    retry: 1,
  });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes, retry: 1 });

  const accountCountry = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", accountCountry.data?.id],
    enabled: !!accountCountry.data?.id,
    queryFn: () => loadCities(accountCountry.data?.id ?? null),
  });

  const { account } = useActiveAccount();
  const myProfile = useMyUserProfile();
  const tenantId = listing ? (listing.tenant_id ?? null) : (account?.tenant_id ?? null);
  const scope = listing ? `edit:${listing.id}` : `new:${account?.account_key ?? "pending"}`;
  const canPublish = !!listing || !account || account.can_publish;
  const media = useListingImages({
    userId: session?.user.id ?? null,
    draftId,
    listingId: listing?.id,
  });

  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;

  const rootSlug = useMemo(() => {
    const all = categories.data ?? [];
    const chosen = all.find((c) => c.id === categoryId);
    return chosen?.slug ?? null;
  }, [categories.data, categoryId]);
  const subSlug = useMemo(
    () => (categories.data ?? []).find((c) => c.id === subcategoryId)?.slug ?? null,
    [categories.data, subcategoryId],
  );
  const fields = useMemo(
    () => specFieldsFor({ rootSlug, subSlug, typeCode }),
    [rootSlug, subSlug, typeCode],
  );
  const { primary, extra } = useMemo(() => splitSpecFields(fields), [fields]);
  const isEquipment = rootSlug === "equipment";
  const isRealEstate = rootSlug === RE_ROOT_SLUG;
  const showQuantity =
    rootSlug === "building-materials" || rootSlug === "factories" || typeCode === "product";

  const purposeOptions = useMemo(() => {
    const codes = purposesFor(rootSlug);
    return codes
      .map((code) => (types.data ?? []).find((tp) => tp.code === code))
      .filter((tp): tp is NonNullable<typeof tp> => !!tp);
  }, [rootSlug, types.data]);

  // A purpose that no longer fits the chosen field is dropped; a single option
  // is selected silently so the advertiser never picks the obvious.
  useEffect(() => {
    if (purposeOptions.length === 0) return;
    if (!purposeOptions.some((tp) => tp.code === typeCode)) {
      setTypeCode(purposeOptions.length === 1 ? purposeOptions[0]!.code : "");
    }
  }, [purposeOptions, typeCode]);

  useEffect(() => {
    if (!listing?.id) return;
    let alive = true;
    void loadOwnerLicense(listing.id).then((row) => {
      if (!alive || !row) return;
      setLicense({
        advertiserRole: row.advertiser_role,
        adLicenseNumber: row.ad_license_number ?? "",
        adLicenseExpiry: row.ad_license_expiry ?? "",
        practiceLicenseNumber: row.practice_license_number ?? "",
        licenseDocPath: row.license_doc_path ?? null,
        exemptionRequested: row.exemption_requested,
        exemptionReason: row.exemption_reason ?? "",
        exemptionDocPath: row.exemption_doc_path ?? null,
        exemptionApproved: row.exemption_approved,
        verificationStatus: row.verification_status,
      });
    });
    return () => {
      alive = false;
    };
  }, [listing?.id]);

  // ---------- draft: restore once per scope, then autosave ----------
  const restoredScope = useRef<string | null>(null);
  useEffect(() => {
    // Wait for the active account: the draft scope contains its key, so
    // restoring earlier would read (and later write) the wrong draft.
    if (!listing && !account) return;
    if (restoredScope.current === scope) return;
    restoredScope.current = scope;
    restored.current = true;
    const draft = loadDraft(scope);
    if (!draft) return;
    if (draft.typeCode) setTypeCode(draft.typeCode);
    if (draft.categoryId) setCategoryId(draft.categoryId);
    if (draft.subcategoryId !== undefined) setSubcategoryId(draft.subcategoryId ?? "");
    if (draft.title !== undefined) setTitle(draft.title ?? "");
    if (draft.summary !== undefined) setSummary(draft.summary ?? "");
    if (draft.description !== undefined) setDescription(draft.description ?? "");
    if (draft.price !== undefined) setPrice(draft.price ?? "");
    if (draft.priceKind) setPriceKind(draft.priceKind);
    else if (draft.priceOnRequest) setPriceKind("on_request");
    if (draft.priceUnit !== undefined) setPriceUnit(draft.priceUnit ?? "");
    if (draft.quantity !== undefined) setQuantity(draft.quantity ?? "");
    if (draft.unit !== undefined) setUnit(draft.unit ?? "");
    if (draft.itemCondition) setItemCondition(draft.itemCondition);
    if (draft.keywords !== undefined) setKeywords(draft.keywords ?? "");
    if (isListingDuration(draft.durationDays)) setDurationDays(draft.durationDays);
    if (draft.specs) setSpecs(draft.specs as Record<string, SpecValue>);
    if (typeof draft.step === "number") setStep(Math.min(draft.step, STEPS.length - 1));
    if (draft.cityId) setCityId(draft.cityId);
    if (draft.district) setDistrict(draft.district);
    if (draft.addressText) setAddressText(draft.addressText);
    if (draft.draftId) setDraftId(draft.draftId);
    if (draft.images?.length) media.restore(draft.images, draft.coverId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, account]);


  const snapshot = useCallback((): Partial<ListingDraft> => {
    // Coordinates and accuracy stay out of local storage on purpose.
    return {
      typeCode,
      categoryId,
      subcategoryId,
      title,
      summary,
      description,
      price,
      priceKind,
      priceUnit,
      priceOnRequest: priceKind === "on_request",
      quantity,
      unit,
      itemCondition,
      keywords,
      durationDays,
      cityId,
      district,
      addressText,
      locationVisibility: visibility,
      accountKey: account?.account_key ?? "individual",
      specs,
      step,
      draftId,
      images: media.metas,
      coverId: media.coverId,
    };
  }, [
    typeCode,
    categoryId,
    subcategoryId,
    title,
    summary,
    description,
    price,
    priceKind,
    priceUnit,
    quantity,
    unit,
    itemCondition,
    keywords,
    durationDays,
    cityId,
    district,
    addressText,
    visibility,
    account?.account_key,
    specs,
    step,
    draftId,
    media.metas,
    media.coverId,
  ]);

  // Autosave is silent: only a small line under the form reports the result.
  useEffect(() => {
    if (!restored.current) return;
    const ok = saveDraft(scope, snapshot());
    setDraftNote(ok ? "saved" : "failed");
  }, [scope, snapshot]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setDirty(true);
      setter(value);
    };
  }

  // The account city seeds a new ad.
  const accountCityId = listing ? null : (myProfile.data?.city_id ?? null);
  useEffect(() => {
    if (!cityId && accountCityId) setCityId(accountCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCityId]);

  // ---------- validation ----------
  function fieldError(key: FieldKey): string | null {
    if (key === "path") {
      // Two different mistakes, two different messages.
      if (!categoryId) return t("market.form.pathRequired");
      if (!typeCode) return t("market.form.typeRequired");
      return null;
    }

    if (key === "title") {
      if (!title.trim()) return t("market.form.titleRequired");
      if (!isValidTitle(title)) return t("market.form.titleInvalid");
      return null;
    }
    if (key === "price") {
      if (priceKind !== "on_request" && !price.trim()) return t("market.form.priceRequired");
      return null;
    }
    if (key === "images") {
      if (imagesRequired(rootSlug, isWantedType(typeCode)) && media.readyCount === 0)
        return t("market.media.required");
      return null;
    }
    if (key === "city") {
      if (!cityId) return t("market.form.cityRequired");
      if ((cities.data ?? []).length > 0 && !(cities.data ?? []).some((c) => c.id === cityId))
        return t("market.geo.cityMismatch");
      return null;
    }
    return null;
  }

  /** Validate one field when it loses focus, without shouting about the rest. */
  function blur(key: FieldKey) {
    setErrors((prev) => ({ ...prev, [key]: fieldError(key) ?? undefined }));
  }

  const STEP_FIELDS: Record<number, FieldKey[]> = {
    0: ["path", "title", "price", "city"],
    1: ["city", "images"],
    2: [],
  };

  function focusField(key: FieldKey) {
    const id =
      key === "path"
        ? "field-path"
        : key === "title"
          ? "title"
          : key === "price"
            ? "price"
            : "city";
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.focus();
  }

  /** Returns the first failing field of a step, marking only that one. */
  function validateStep(index: number): FieldKey | null {
    for (const key of STEP_FIELDS[index] ?? []) {
      const error = fieldError(key);
      if (error) {
        setErrors((prev) => ({ ...prev, [key]: error }));
        return key;
      }
    }
    return null;
  }

  function next() {
    const bad = validateStep(step);
    if (bad) {
      focusField(bad);
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setDirty(true);
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: "device",
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function submit(publish: boolean) {
    // A second tap while the first request is in flight must never create a
    // second ad: the ref flips synchronously, unlike React state.
    if (submitting.current) {
      toast.message(t("market.dash.submitBusy"));
      return;
    }

    for (let i = 0; i < STEPS.length; i += 1) {
      const bad = validateStep(i);
      if (bad) {
        setStep(i);
        window.setTimeout(() => focusField(bad), 50);
        return;
      }
    }

    // Photos still uploading or failed would be dropped by the server guard, so
    // they are caught here with an actionable message.
    if (media.items.some((i) => i.status === "uploading")) {
      toast.error(t("market.media.stillUploading"));
      setStep(1);
      return;
    }
    if (media.items.some((i) => i.status === "failed")) {
      toast.error(t("market.media.someFailed"));
      setStep(1);
      return;
    }
    if (media.readyCount > MAX_LISTING_IMAGES) {
      toast.error(t("market.media.imagesTooMany"));
      setStep(1);
      return;
    }

    if (publish && isRealEstate) {
      const blocks = licenseBlockers(license);
      if (blocks.length > 0) {
        toast.error(t(`market.license.block.${blocks[0]}`));
        setStep(0);
        setLicenseOpen(true);
        setLicenseFocus(LICENSE_BLOCK_FIELD[blocks[0]!]);
        return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      saveDraft(scope, snapshot());
      toast.error(t("market.dash.submitOffline"));
      return;
    }

    submitting.current = true;
    setBusy(true);
    try {
      const cityName = (cities.data ?? []).find((c) => c.id === cityId)?.name_ar ?? null;
      const onRequest = priceKind === "on_request";
      const payload = {
        type_code: typeCode,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        title: title.trim(),
        summary: summary.trim() || autoSummary(description),
        description: description.trim() || null,
        specs: { ...specs, price_kind: priceKind },
        price: onRequest || !price ? null : Number(price),
        price_on_request: onRequest,
        price_unit: priceUnit || null,
        keywords: keywords
          .split(/[,،]/)
          .map((k) => k.trim())
          .filter(Boolean),
        quantity: quantity ? Number(quantity) : null,
        unit: unit || null,
        item_condition: isEquipment || showQuantity ? itemCondition || null : null,
        deal_kind: dealKindFor(typeCode),
        country_id: accountCountry.data?.id ?? null,
        city_id: cityId,
        city: cityName,
        district: district.trim() || null,
        address_text: addressText.trim() || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        location_accuracy: coords.accuracy,
        location_source: coords.source,
        location_visibility: visibility,
        duration_days: durationDays,
      };

      // The row is created exactly once. A retry after a failed attach or a
      // failed submit reuses the id kept here instead of inserting again.
      let listingId = listing?.id ?? createdId.current;
      if (listingId) {
        const { error } = await supabase.from("mkt_listings").update(payload).eq("id", listingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("mkt_listings")
          .insert({
            ...payload,
            status: "draft",
            owner_user_id: session!.user.id,
            tenant_id: tenantId,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("insert failed");
        listingId = data.id;
        createdId.current = data.id;
      }

      const cover = await media.persist(listingId);
      if (cover)
        await supabase.from("mkt_listings").update({ cover_image_url: cover }).eq("id", listingId);

      if (isRealEstate) await saveListingLicense(listingId, license);
      if (publish) await submitListing(listingId);

      await media.discardStaged();
      clearDraft(scope);
      setDirty(false);
      toast.success(publish ? t("market.dash.submitted") : t("market.dash.savedDraft"));
      void navigate({ to: "/dashboard/my-ads" });
    } catch (error) {
      // Nothing is thrown away on failure: the draft (and its photos) stay put
      // so the advertiser can simply press the button again.
      saveDraft(scope, snapshot());
      const message = error instanceof Error ? error.message : "";
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline || message.includes("Failed to fetch") || message.includes("NetworkError"))
        toast.error(t("market.dash.submitOffline"));
      else if (message.includes("TITLE_")) toast.error(t("market.form.titleInvalid"));
      else if (message.includes("CITY_COUNTRY_MISMATCH")) toast.error(t("market.geo.cityMismatch"));
      else if (message.includes("CATEGORY_")) toast.error(t("market.form.pathRequired"));
      else if (message.includes("BUSINESS_NOT_ALLOWED"))
        toast.error(t("market.form.businessDenied"));
      else if (message === "attach_failed") toast.error(t("market.media.attachFailed"));
      else if (message === "forbidden") toast.error(t("market.dash.submitNotAllowed"));
      else if (message === "invalid_state") toast.error(t("market.dash.submitInvalidState"));
      else if (message === "image_required") toast.error(t("market.media.required"));
      else if (message === "images_incomplete") toast.error(t("market.media.imagesIncomplete"));
      else if (message === "images_too_many") toast.error(t("market.media.imagesTooMany"));
      else toast.error(t("market.actions.failed"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }


  function specInput(field: SpecField) {
    const value = specs[field.key];
    const set = (nextValue: SpecValue) => {
      setDirty(true);
      setSpecs((prev) => ({ ...prev, [field.key]: nextValue }));
    };
    if (field.kind === "bool") {
      return (
        <label key={field.key} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={value === true}
            onChange={(e) => set(e.target.checked)}
          />
          {t(field.labelKey)}
        </label>
      );
    }
    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={`spec_${field.key}`}>
          {t(field.labelKey)}
          {field.unitKey ? ` (${t(field.unitKey)})` : ""}
        </Label>
        {field.kind === "select" ? (
          <select
            id={`spec_${field.key}`}
            className={selectClass}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">{t("market.filters.all")}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {t(`market.spec.opt.${option}`)}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={`spec_${field.key}`}
            className="h-11 sm:h-9"
            {...(field.kind === "number" ? { inputMode: "decimal" as const, dir: "ltr" } : {})}
            value={value == null || typeof value === "boolean" ? "" : String(value)}
            onChange={(e) => set(e.target.value)}
          />
        )}
      </div>
    );
  }

  const cityField = (id: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("market.geo.city")}</Label>
      <select
        id={id}
        className={selectClass}
        value={cityId}
        onChange={(e) => {
          touch(setCityId)(e.target.value);
          setErrors((prev) => ({ ...prev, city: undefined }));
        }}
        onBlur={() => blur("city")}
      >
        <option value="">{t("market.geo.pickCity")}</option>
        {(cities.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {geoName(c, locale)}
          </option>
        ))}
      </select>
      {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
    </div>
  );

  const pathLabel = [
    (categories.data ?? []).find((c) => c.id === categoryId),
    (categories.data ?? []).find((c) => c.id === subcategoryId),
  ]
    .filter(Boolean)
    .map((c) => label(c!))
    .concat((types.data ?? []).filter((tp) => tp.code === typeCode).map((tp) => label(tp)))
    .join(" ← ");

  // The form needs the category tree and the purposes; anything else can arrive
  // later. A failed read shows one message with a retry, never a blank page.
  const shellLoading = categories.isPending || types.isPending;
  const shellError = categories.isError || types.isError;

  if (shellError) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">{t("market.form.loadFailed")}</p>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            void categories.refetch();
            void types.refetch();
          }}
        >
          {t("market.form.retry")}
        </Button>
      </div>
    );
  }

  if (shellLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-11 w-2/3 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-40 sm:pb-4">

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0">
          {t("market.form.publishingAs", {
            name: (listing ? listing.tenant_id : account?.tenant_id)
              ? account?.name || t("market.entry.kind.business")
              : account?.name || t("market.entry.kind.individual"),
          })}
        </span>
        {!listing && (
          <Link
            to="/choose-account"
            search={{ next: "/dashboard/ads/new" }}
            onClick={() => saveDraft(scope, snapshot())}
            className="font-semibold text-primary underline"
          >
            {t("market.entry.change")}
          </Link>
        )}
      </p>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          {t(`market.form.step.${STEPS[step]}`)}
        </h2>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          {t("market.form.stepOf", { n: step + 1, total: STEPS.length })}
        </span>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div id="field-path">
            <CategoryPicker
              categories={categories.data ?? []}
              categoryId={categoryId}
              subcategoryId={subcategoryId}
              onChange={(nextPath) => {
                setDirty(true);
                setCategoryId(nextPath.categoryId);
                setSubcategoryId(nextPath.subcategoryId);
                setErrors((prev) => ({ ...prev, path: undefined }));
              }}
            />
            {purposeOptions.length > 1 && (
              <div className="mt-3 space-y-1.5">
                <span className="text-sm font-medium text-foreground">
                  {t("market.form.purpose")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {purposeOptions.map((tp) => (
                    <button
                      key={tp.code}
                      type="button"
                      onClick={() => {
                        setDirty(true);
                        setTypeCode(tp.code);
                        setErrors((prev) => ({ ...prev, path: undefined }));
                      }}
                      className={
                        tp.code === typeCode
                          ? "min-h-11 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
                          : "min-h-11 rounded-full border border-border px-3 text-sm text-foreground"
                      }
                    >
                      {label(tp)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {errors.path && <p className="mt-1 text-xs text-destructive">{errors.path}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">{t("market.dash.listingTitle")}</Label>
            <Input
              id="title"
              className="h-11 sm:h-9"
              value={title}
              minLength={TITLE_MIN}
              maxLength={TITLE_MAX}
              onChange={(e) => {
                touch(setTitle)(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              onBlur={() => blur("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("market.form.titleHint", { min: TITLE_MIN, max: TITLE_MAX })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("market.form.adDescription")}</Label>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => touch(setDescription)(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price_kind">{t("market.form.priceKind")}</Label>
              <select
                id="price_kind"
                className={selectClass}
                value={priceKind}
                onChange={(e) => {
                  touch(setPriceKind)(e.target.value as PriceKind);
                  setErrors((prev) => ({ ...prev, price: undefined }));
                }}
              >
                <option value="fixed">{t("market.form.priceFixed")}</option>
                <option value="from">{t("market.form.priceFrom")}</option>
                <option value="on_request">{t("market.form.priceRequest")}</option>
              </select>
            </div>
            {priceKind !== "on_request" && (
              <div className="space-y-1.5">
                <Label htmlFor="price">
                  {isWantedType(typeCode) ? t("market.form.budget") : t("market.form.priceValue")}
                </Label>
                {/* The currency follows the account country, so it is shown, not edited. */}
                <div className="flex items-center gap-2">
                  <Input
                    id="price"
                    className="h-11 sm:h-9"
                    dir="ltr"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => {
                      touch(setPrice)(e.target.value);
                      setErrors((prev) => ({ ...prev, price: undefined }));
                    }}
                    onBlur={() => blur("price")}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground" dir="ltr">
                    {listing?.currency ?? "SAR"}
                  </span>
                </div>
                {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
              </div>
            )}
          </div>



          {cityField("city")}

          <div className="space-y-1.5">
            <Label htmlFor="duration_days">{t("market.ops.duration")}</Label>
            <select
              id="duration_days"
              className={selectClass}
              value={durationDays}
              onChange={(e) => {
                setDirty(true);
                const value = Number(e.target.value);
                if (isListingDuration(value)) setDurationDays(value);
              }}
            >
              {LISTING_DURATIONS.map((days) => (
                <option key={days} value={days}>
                  {t("market.ops.durationDays").replace("{n}", String(days))}
                </option>
              ))}
            </select>
          </div>

          {primary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">{primary.map((f) => specInput(f))}</div>
          )}

          {showQuantity && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">{t("market.quote.quantity")}</Label>
                <Input
                  id="quantity"
                  className="h-11 sm:h-9"
                  dir="ltr"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => touch(setQuantity)(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item_condition">{t("market.dash.condition")}</Label>
                <select
                  id="item_condition"
                  className={selectClass}
                  value={itemCondition}
                  onChange={(e) => touch(setItemCondition)(e.target.value)}
                >
                  <option value="new">{t("market.condition.new")}</option>
                  <option value="used">{t("market.condition.used")}</option>
                </select>
              </div>
            </div>
          )}

          {isEquipment && !showQuantity && (
            <div className="space-y-1.5">
              <Label htmlFor="item_condition">{t("market.dash.condition")}</Label>
              <select
                id="item_condition"
                className={selectClass}
                value={itemCondition}
                onChange={(e) => touch(setItemCondition)(e.target.value)}
              >
                <option value="new">{t("market.condition.new")}</option>
                <option value="used">{t("market.condition.used")}</option>
              </select>
            </div>
          )}

          <section className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setExtraOpen((prev) => !prev)}
              aria-expanded={extraOpen}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground"
            >
              {t("market.form.moreDetails")}
              <ChevronDown
                className={`size-4 transition-transform ${extraOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {extraOpen && (
              <div className="space-y-3 border-t border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {extra.filter((f) => f.kind !== "bool").map((f) => specInput(f))}
                  <div className="space-y-1.5">
                    <Label htmlFor="price_unit">{t("market.dash.priceUnit")}</Label>
                    <Input
                      id="price_unit"
                      className="h-11 sm:h-9"
                      value={priceUnit}
                      onChange={(e) => touch(setPriceUnit)(e.target.value)}
                    />
                  </div>
                  {showQuantity && (
                    <div className="space-y-1.5">
                      <Label htmlFor="unit">{t("market.quote.unit")}</Label>
                      <Input
                        id="unit"
                        className="h-11 sm:h-9"
                        value={unit}
                        onChange={(e) => touch(setUnit)(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {extra.filter((f) => f.kind === "bool").map((f) => specInput(f))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="summary">{t("market.form.summaryOverride")}</Label>
                  <Input
                    id="summary"
                    className="h-11 sm:h-9"
                    value={summary}
                    maxLength={240}
                    onChange={(e) => touch(setSummary)(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("market.form.summaryAuto")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="keywords">{t("market.form.keywords")}</Label>
                  <Input
                    id="keywords"
                    className="h-11 sm:h-9"
                    value={keywords}
                    onChange={(e) => touch(setKeywords)(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("market.form.keywordsHint")}
                  </p>
                </div>
              </div>
            )}
          </section>

          {isRealEstate && session?.user.id && (
            <RealEstateLicenseFields
              value={license}
              userId={session.user.id}
              open={licenseOpen}
              onOpenChange={setLicenseOpen}
              focusField={licenseFocus}
              onFocusHandled={() => setLicenseFocus(null)}
              onChange={(nextLicense) => {
                setDirty(true);
                setLicense(nextLicense);
              }}
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t("market.dash.images")}</span>
            <div id="images-block">
              <ListingImages api={media} />
            </div>
            {errors.images && <p className="text-xs text-destructive">{errors.images}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {cityField("city_step2")}
            <div className="space-y-1.5">
              <Label htmlFor="district">{t("market.form.districtOptional")}</Label>
              <Input
                id="district"
                className="h-11 sm:h-9"
                value={district}
                maxLength={120}
                onChange={(e) => touch(setDistrict)(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="size-4" aria-hidden />
            )}
            {t("market.loc.useMyLocation")}
          </Button>
          <p className="text-[11px] text-muted-foreground">{t("market.form.locationHint")}</p>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.form.categoryPath")}</dt>
            <dd className="min-w-0 break-words text-foreground">{pathLabel || "—"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.listingTitle")}</dt>
            <dd className="min-w-0 break-words text-foreground">{title}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.price")}</dt>
            <dd className="text-foreground" dir="ltr">
              {priceKind === "on_request"
                ? t("market.priceOnRequest")
                : `${priceKind === "from" ? "≥ " : ""}${price || "—"} ${listing?.currency ?? "SAR"}`}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.geo.city")}</dt>
            <dd className="text-foreground">
              {geoName((cities.data ?? []).find((c) => c.id === cityId) ?? undefined, locale)}
              {district ? ` — ${district}` : ""}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.images")}</dt>
            <dd className="text-foreground" dir="ltr">
              {media.readyCount}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.ops.duration")}</dt>
            <dd className="text-foreground">
              {t("market.ops.durationDays").replace("{n}", String(durationDays))}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.publishAs")}</dt>
            <dd className="text-foreground">
              {account?.name || t(`market.entry.kind.${account?.kind ?? "individual"}`)}
            </dd>
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">{t("market.form.reviewHint")}</p>
        </dl>
      )}

      {!canPublish && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {t("market.form.noPublishPermission")}
        </p>
      )}

      {draftNote && (
        <p
          className={
            draftNote === "saved"
              ? "text-[11px] text-muted-foreground"
              : "text-[11px] text-destructive"
          }
        >
          {draftNote === "saved" ? t("market.form.draftSaved") : t("market.form.draftSaveFailed")}
        </p>
      )}

      {/* Mobile: one clear primary button per row, above the bottom nav. */}
      <div className="fixed inset-x-0 bottom-16 z-30 flex flex-col gap-2 border-t border-border bg-background px-3 py-2 sm:static sm:bottom-auto sm:z-auto sm:flex-row sm:items-center sm:bg-transparent sm:px-0 sm:pt-3">
        {step < STEPS.length - 1 ? (
          <Button type="button" className="min-h-11 w-full sm:w-auto sm:min-w-32" onClick={next}>
            {t("market.form.next")}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto sm:min-w-32"
            disabled={busy || !canPublish}
            onClick={() => void submit(true)}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("market.dash.submitForReview")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:order-3 sm:ms-auto sm:w-auto"
          disabled={busy}
          onClick={() => void submit(false)}
        >
          {t("market.dash.saveDraft")}
        </Button>
        {step > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full text-muted-foreground sm:order-1 sm:w-auto"
            onClick={() => setStep((prev) => prev - 1)}
          >
            {t("market.form.back")}
          </Button>
        )}
      </div>

    </div>
  );
}
