import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { MKT_BUCKET, type MktListing } from "@/lib/mkt";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { loadCategories, loadListingTypes } from "@/lib/mkt-queries";
import { useActiveAccount } from "@/lib/mkt-account";
import { useMyUserProfile } from "@/lib/mkt-identity";
import {
  dealKindFor,
  isValidTitle,
  isWantedType,
  specFieldsFor,
  TITLE_MAX,
  TITLE_MIN,
  type SpecField,
} from "@/lib/mkt-taxonomy";
import { clearDraft, loadDraft, saveDraft, type ListingDraft } from "@/lib/mkt-listing-draft";
import {
  licenseBlockers,
  loadOwnerLicense,
  RE_ROOT_SLUG,
  saveListingLicense,
} from "@/lib/mkt-license";
import { CategoryPicker } from "@/components/marketplace/CategoryPicker";
import {
  ListingLocationPicker,
  type ListingLocationValue,
} from "@/components/marketplace/ListingLocationPicker";
import {
  EMPTY_LICENSE,
  RealEstateLicenseFields,
  type LicenseFormValue,
} from "@/components/marketplace/RealEstateLicenseFields";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  listing?: MktListing | undefined;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const STEPS = ["category", "details", "location", "review"] as const;
type SpecValue = string | number | boolean;

export function ListingForm({ listing }: Props) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();

  // The active account is part of the draft scope, so a draft never crosses
  // from one entity to another: switching account starts a fresh copy and the
  // original stays inside its own account.
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const restored = useRef(false);

  const [typeCode, setTypeCode] = useState(listing?.type_code ?? "");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(listing?.subcategory_id ?? "");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [summary, setSummary] = useState(listing?.summary ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [priceUnit, setPriceUnit] = useState(listing?.price_unit ?? "");
  const [priceOnRequest, setPriceOnRequest] = useState(listing?.price_on_request ?? false);
  const [quantity, setQuantity] = useState(listing?.quantity != null ? String(listing.quantity) : "");
  const [unit, setUnit] = useState(listing?.unit ?? "");
  const [itemCondition, setItemCondition] = useState(listing?.item_condition ?? "used");
  const [specs, setSpecs] = useState<Record<string, SpecValue>>(
    (listing?.specs as Record<string, SpecValue> | null) ?? {},
  );
  const [files, setFiles] = useState<File[]>([]);
  // Licence data of a real estate ad. It is never kept in a local draft: the
  // numbers are legal identifiers, so they only live in the database row.
  const [license, setLicense] = useState<LicenseFormValue>(EMPTY_LICENSE);
  // The licence section is collapsed until the advertiser opens it — or until a
  // failed submit forces it open on the first missing field.
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseFocus, setLicenseFocus] = useState<string | null>(null);



  const [location, setLocation] = useState<ListingLocationValue>({
    cityId: listing?.city_id ?? "",
    district: listing?.district ?? "",
    addressText: listing?.address_text ?? "",
    latitude: listing?.latitude ?? null,
    longitude: listing?.longitude ?? null,
    accuracy: listing?.location_accuracy ?? null,
    source: (listing?.location_source as ListingLocationValue["source"]) ?? null,
    visibility: (listing?.location_visibility as "approximate" | "exact") ?? "approximate",
  });

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes });
  const accountCountry = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", accountCountry.data?.id],
    enabled: !!accountCountry.data?.id,
    queryFn: () => loadCities(accountCountry.data?.id ?? null),
  });

  const { account } = useActiveAccount();
  const myProfile = useMyUserProfile();
  // Identity is never chosen inside the form: an ad always belongs to the
  // account the user entered, and the database re-derives ownership on write.
  const tenantId = listing ? (listing.tenant_id ?? null) : (account?.tenant_id ?? null);
  const scope = listing ? `edit:${listing.id}` : `new:${account?.account_key ?? "pending"}`;
  const canPublish = !!listing || !account || account.can_publish;

  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;

  const rootSlug = useMemo(
    () => (categories.data ?? []).find((c) => c.id === categoryId)?.slug ?? null,
    [categories.data, categoryId],
  );
  const subSlug = useMemo(
    () => (categories.data ?? []).find((c) => c.id === subcategoryId)?.slug ?? null,
    [categories.data, subcategoryId],
  );
  const fields = useMemo(
    () => specFieldsFor({ rootSlug, subSlug, typeCode }),
    [rootSlug, subSlug, typeCode],
  );
  const isEquipment = rootSlug === "equipment";
  const isRealEstate = rootSlug === RE_ROOT_SLUG;

  // Load the licence row of an ad being edited, once the ad is known.
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


  // ---------- draft: restore once, then autosave ----------
  useEffect(() => {
    if (restored.current) return;
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
    if (draft.priceUnit !== undefined) setPriceUnit(draft.priceUnit ?? "");
    if (draft.priceOnRequest !== undefined) setPriceOnRequest(!!draft.priceOnRequest);
    if (draft.quantity !== undefined) setQuantity(draft.quantity ?? "");
    if (draft.unit !== undefined) setUnit(draft.unit ?? "");
    if (draft.itemCondition) setItemCondition(draft.itemCondition);
    if (draft.specs) setSpecs(draft.specs as Record<string, SpecValue>);
    if (typeof draft.step === "number") setStep(Math.min(draft.step, STEPS.length - 1));
    setLocation((prev) => ({
      ...prev,
      cityId: draft.cityId || prev.cityId,
      district: draft.district ?? prev.district,
      addressText: draft.addressText ?? prev.addressText,
      visibility: draft.locationVisibility ?? prev.visibility,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

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
      priceUnit,
      priceOnRequest,
      quantity,
      unit,
      itemCondition,
      cityId: location.cityId,
      district: location.district,
      addressText: location.addressText,
      locationVisibility: location.visibility,
      accountKey: account?.account_key ?? "individual",
      specs,
      step,
    };
  }, [
    typeCode,
    categoryId,
    subcategoryId,
    title,
    summary,
    description,
    price,
    priceUnit,
    priceOnRequest,
    quantity,
    unit,
    itemCondition,
    location,
    account?.account_key,
    specs,
    step,
  ]);

  useEffect(() => {
    if (!restored.current) return;
    saveDraft(scope, snapshot());
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

  // The account city seeds a new ad's location.
  const accountCityId = listing ? null : (myProfile.data?.city_id ?? null);

  // ---------- images ----------
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function uploadImages(listingId: string): Promise<string | null> {
    let cover: string | null = null;
    for (const [index, file] of files.entries()) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `listings/${session!.user.id}/${listingId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (error) continue;
      await supabase.from("mkt_listing_images").insert({
        listing_id: listingId,
        url: path,
        sort_order: index,
        is_cover: index === 0,
      });
      if (index === 0) cover = path;
    }
    return cover;
  }

  // ---------- validation per step ----------
  function stepError(index: number): string | null {
    if (index === 0) {
      if (!categoryId || !typeCode) return t("market.form.pathRequired");
      return null;
    }
    if (index === 1) {
      if (!title.trim()) return t("market.form.titleRequired");
      if (!isValidTitle(title)) return t("market.form.titleInvalid");
      return null;
    }
    if (index === 2) {
      if (!location.cityId) return t("market.geo.locationRequired");
      if (!(cities.data ?? []).some((c) => c.id === location.cityId))
        return t("market.geo.cityMismatch");
      return null;
    }
    return null;
  }

  function next() {
    const error = stepError(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  async function submit(publish: boolean) {
    for (let i = 0; i < STEPS.length; i += 1) {
      const error = stepError(i);
      if (error) {
        toast.error(error);
        setStep(i);
        return;
      }
    }

    // A real estate ad may be kept as a draft while incomplete, but it cannot
    // go to review without a valid licence, or with an exemption still pending.
    if (publish && isRealEstate) {
      const blocks = licenseBlockers(license);
      if (blocks.length > 0) {
        toast.error(t(`market.license.block.${blocks[0]}`));
        setStep(1);
        setLicenseOpen(true);
        setLicenseFocus(LICENSE_BLOCK_FIELD[blocks[0]!]);
        return;
      }
    }



    setBusy(true);
    try {
      const cityName = (cities.data ?? []).find((c) => c.id === location.cityId)?.name_ar ?? null;
      const payload = {
        type_code: typeCode,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        title: title.trim(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        specs,
        price: priceOnRequest || !price ? null : Number(price),
        price_on_request: priceOnRequest,
        price_unit: priceUnit || null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit || null,
        item_condition: isEquipment ? itemCondition || null : null,
        deal_kind: dealKindFor(typeCode),
        // The server forces the country from the account; sending it only keeps
        // the insert-time NOT NULL check happy.
        country_id: accountCountry.data?.id ?? null,
        city_id: location.cityId,
        city: cityName,
        district: location.district.trim() || null,
        address_text: location.addressText.trim() || null,
        latitude: location.latitude,
        longitude: location.longitude,
        location_accuracy: location.accuracy,
        location_source: location.source,
        location_visibility: location.visibility,
        // A real estate ad is saved as a draft first, its licence row written,
        // and only then sent to review — the database refuses to accept a real
        // estate ad for review while its licence is missing.
        status: publish && !isRealEstate ? "pending" : "draft",
      };

      let listingId = listing?.id ?? null;
      if (listing) {
        const { error } = await supabase.from("mkt_listings").update(payload).eq("id", listing.id);
        if (error) throw error;
        if (files.length > 0) {
          const cover = await uploadImages(listing.id);
          if (cover)
            await supabase
              .from("mkt_listings")
              .update({ cover_image_url: cover })
              .eq("id", listing.id);
        }
      } else {
        const { data, error } = await supabase
          .from("mkt_listings")
          .insert({ ...payload, owner_user_id: session!.user.id, tenant_id: tenantId })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("insert failed");
        listingId = data.id;
        const cover = await uploadImages(data.id);
        if (cover)
          await supabase.from("mkt_listings").update({ cover_image_url: cover }).eq("id", data.id);
      }

      if (isRealEstate && listingId) {
        await saveListingLicense(listingId, license);
        if (publish) {
          const { error } = await supabase
            .from("mkt_listings")
            .update({ status: "pending" })
            .eq("id", listingId);
          if (error) throw error;
        }
      }


      clearDraft(scope);
      setDirty(false);
      toast.success(publish ? t("market.dash.submitted") : t("market.dash.savedDraft"));
      void navigate({ to: "/dashboard/my-ads" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("TITLE_")) toast.error(t("market.form.titleInvalid"));
      else if (message.includes("CITY_COUNTRY_MISMATCH")) toast.error(t("market.geo.cityMismatch"));
      else if (message.includes("CATEGORY_")) toast.error(t("market.form.pathRequired"));
      else if (message.includes("BUSINESS_NOT_ALLOWED")) toast.error(t("market.form.businessDenied"));
      else toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  function specInput(field: SpecField) {
    const value = specs[field.key];
    const set = (next: SpecValue) => {
      setDirty(true);
      setSpecs((prev) => ({ ...prev, [field.key]: next }));
    };
    if (field.kind === "bool") {
      return (
        <label key={field.key} className="flex items-center gap-2 text-sm text-foreground">
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
            {...(field.kind === "number" ? { inputMode: "decimal" as const, dir: "ltr" } : {})}
            value={value == null || typeof value === "boolean" ? "" : String(value)}
            onChange={(e) => set(e.target.value)}
          />
        )}
      </div>
    );
  }

  const stepTitle = t(`market.form.step.${STEPS[step]}`);

  return (
    <div className="max-w-2xl space-y-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0">
          {t("market.form.publishingAs", {
            name:
              (listing ? listing.tenant_id : account?.tenant_id)
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
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {STEPS.map((name, index) => (
          <li
            key={name}
            className={
              index === step
                ? "rounded-full bg-primary px-2 py-1 font-medium text-primary-foreground"
                : index < step
                  ? "rounded-full bg-secondary px-2 py-1 text-secondary-foreground"
                  : "rounded-full border border-border px-2 py-1 text-muted-foreground"
            }
          >
            {t(`market.form.step.${name}`)}
          </li>
        ))}
      </ol>
      <h2 className="text-base font-semibold text-foreground">{stepTitle}</h2>

      {step === 0 && (
        <div className="space-y-4">
          <CategoryPicker
            categories={categories.data ?? []}
            types={types.data ?? []}
            value={{ categoryId, subcategoryId, typeCode }}
            onChange={(next) => {
              setDirty(true);
              setCategoryId(next.categoryId);
              setSubcategoryId(next.subcategoryId);
              setTypeCode(next.typeCode);
            }}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("market.dash.listingTitle")}</Label>
            <Input
              id="title"
              value={title}
              minLength={TITLE_MIN}
              maxLength={TITLE_MAX}
              onChange={(e) => touch(setTitle)(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("market.form.titleHint", { min: TITLE_MIN, max: TITLE_MAX })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">{t("market.dash.summary")}</Label>
            <Input
              id="summary"
              value={summary}
              maxLength={240}
              onChange={(e) => touch(setSummary)(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("market.dash.description")}</Label>
            <Textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => touch(setDescription)(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">
                {isWantedType(typeCode) ? t("market.form.budget") : t("market.dash.price")}
              </Label>
              <Input
                id="price"
                dir="ltr"
                inputMode="decimal"
                disabled={priceOnRequest}
                value={price}
                onChange={(e) => touch(setPrice)(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price_unit">{t("market.dash.priceUnit")}</Label>
              <Input
                id="price_unit"
                value={priceUnit}
                onChange={(e) => touch(setPriceUnit)(e.target.value)}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4"
                checked={priceOnRequest}
                onChange={(e) => touch(setPriceOnRequest)(e.target.checked)}
              />
              {t("market.priceOnRequest")}
            </label>
          </div>

          {(rootSlug === "building-materials" || rootSlug === "factories" || typeCode === "product") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">{t("market.quote.quantity")}</Label>
                <Input
                  id="quantity"
                  dir="ltr"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => touch(setQuantity)(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">{t("market.quote.unit")}</Label>
                <Input id="unit" value={unit} onChange={(e) => touch(setUnit)(e.target.value)} />
              </div>
            </div>
          )}

          {isEquipment && (
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

          {fields.length > 0 && (
            <fieldset className="space-y-3 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold text-foreground">
                {t("market.form.specs")}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.filter((f) => f.kind !== "bool").map((f) => specInput(f))}
              </div>
              <div className="space-y-2">
                {fields.filter((f) => f.kind === "bool").map((f) => specInput(f))}
              </div>
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="images">{t("market.dash.images")}</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground">
              <ImagePlus className="size-4" aria-hidden />
              {t("market.dash.addImages")}
              <input
                id="images"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setDirty(true);
                  setFiles((prev) => [...prev, ...picked].slice(0, 8));
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, index) => (
                  <li key={`${f.name}-${f.size}-${index}`} className="relative">
                    <img
                      src={previews[index]}
                      alt={f.name}
                      className="size-20 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={t("market.actions.remove")}
                      className="absolute top-1 end-1 rounded bg-background/90 p-0.5 text-foreground shadow"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isRealEstate && session?.user.id && (
            <RealEstateLicenseFields
              value={license}
              userId={session.user.id}
              open={licenseOpen}
              onOpenChange={setLicenseOpen}
              focusField={licenseFocus}
              onFocusHandled={() => setLicenseFocus(null)}
              onChange={(next) => {
                setDirty(true);
                setLicense(next);
              }}
            />
          )}

        </div>
      )}


      {step === 2 && (
        <ListingLocationPicker
          value={location}
          accountCityId={accountCityId}
          onChange={(next) => {
            setDirty(true);
            setLocation(next);
          }}
        />
      )}

      {step === 3 && (
        <dl className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.form.categoryPath")}</dt>
            <dd className="min-w-0 break-words text-foreground">
              {[
                (categories.data ?? []).find((c) => c.id === categoryId),
                (categories.data ?? []).find((c) => c.id === subcategoryId),
              ]
                .filter(Boolean)
                .map((c) => label(c!))
                .concat(
                  (types.data ?? []).filter((tp) => tp.code === typeCode).map((tp) => label(tp)),
                )
                .join(" ← ")}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.listingTitle")}</dt>
            <dd className="min-w-0 break-words text-foreground">{title}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.dash.publishAs")}</dt>
            <dd className="text-foreground">
              {account?.name || t(`market.entry.kind.${account?.kind ?? "individual"}`)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.geo.city")}</dt>
            <dd className="text-foreground">
              {geoName(
                (cities.data ?? []).find((c) => c.id === location.cityId) ?? undefined,
                locale,
              )}
              {location.district ? ` — ${location.district}` : ""}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("market.loc.visibility")}</dt>
            <dd className="text-foreground">{t(`market.loc.${location.visibility}`)}</dd>
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">{t("market.dash.reviewNote")}</p>
        </dl>
      )}

      {!canPublish && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {t("market.form.noPublishPermission")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {step > 0 && (
          <Button type="button" variant="ghost" onClick={() => setStep((prev) => prev - 1)}>
            {t("market.form.back")}
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="min-w-32" onClick={next}>
            {t("market.form.next")}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-w-32"
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
          disabled={busy}
          onClick={() => void submit(false)}
          className="ms-auto"
        >
          {t("market.dash.saveDraft")}
        </Button>
      </div>
    </div>
  );
}
