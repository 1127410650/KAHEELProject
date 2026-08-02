import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { MKT_BUCKET, type MktListing } from "@/lib/mkt";
import { geoName, loadCities, loadCountries, useMarketPreference } from "@/lib/mkt-geo";
import { loadCategories, loadListingTypes } from "@/lib/mkt-queries";
import { useActiveIdentity } from "@/lib/mkt-identity";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  listing?: MktListing | undefined;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function ListingForm({ listing }: Props) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [typeCode, setTypeCode] = useState(listing?.type_code ?? "service");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [priceOnRequest, setPriceOnRequest] = useState(listing?.price_on_request ?? false);
  const [files, setFiles] = useState<File[]>([]);

  // Object URLs are created once per selected file and revoked on change so
  // previews survive re-renders without leaking memory.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  const previewKeys = useMemo(
    () => files.map((f, i) => `${f.name}-${f.size}-${f.lastModified}-${i}`),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  /** Reorder a selected image; index 0 is always the cover. */
  function move(from: number, to: number) {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  }

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes });
  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const { preference } = useMarketPreference();
  const [countryId, setCountryId] = useState<string>(listing?.country_id ?? "");
  const [cityId, setCityId] = useState<string>(listing?.city_id ?? "");
  const cities = useQuery({
    queryKey: ["mkt", "cities", countryId],
    enabled: !!countryId,
    queryFn: () => loadCities(countryId),
  });
  // A new ad defaults to the market the advertiser is browsing.
  useEffect(() => {
    if (countryId || !countries.data) return;
    const fallback = countries.data.find((c) => c.iso2 === preference.countryIso2);
    if (fallback) setCountryId(fallback.id);
  }, [countries.data, countryId, preference.countryIso2]);

  // Every registered user can publish. The identity only decides the name the ad
  // carries; verification is a trust badge, not a permission.
  const { identities, active, select } = useActiveIdentity();
  // The identity of an existing ad is fixed and cannot be switched afterwards.
  const lockedIdentity = !!listing;
  const tenantId = lockedIdentity ? (listing?.tenant_id ?? null) : (active?.tenantId ?? null);

  const roots = (categories.data ?? []).filter((c) => !c.parent_id);
  const subs = (categories.data ?? []).filter((c) => c.parent_id === categoryId);
  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;
  const isEquipment = typeCode === "equipment_sale" || typeCode === "equipment_rent";

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (!categoryId) {
      toast.error(t("market.dash.pickCategory"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        type_code: typeCode,
        category_id: categoryId,
        subcategory_id: (fd.get("subcategory_id") as string) || null,
        title: String(fd.get("title") ?? "").trim(),
        summary: (fd.get("summary") as string) || null,
        description: (fd.get("description") as string) || null,
        price: priceOnRequest || !fd.get("price") ? null : Number(fd.get("price")),
        price_on_request: priceOnRequest,
        price_unit: (fd.get("price_unit") as string) || null,
        quantity: fd.get("quantity") ? Number(fd.get("quantity")) : null,
        unit: (fd.get("unit") as string) || null,
        item_condition: isEquipment ? (fd.get("item_condition") as string) || null : null,
        deal_kind:
          typeCode === "equipment_rent" ? "rent" : typeCode === "equipment_sale" ? "sale" : null,
        country_id: countryId || null,
        city_id: cityId || null,
        city: (cities.data ?? []).find((c) => c.id === cityId)?.name_ar ?? null,
        region: (fd.get("region") as string) || null,
        status: publish ? "pending" : "draft",
      };

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
        const cover = await uploadImages(data.id);
        if (cover)
          await supabase.from("mkt_listings").update({ cover_image_url: cover }).eq("id", data.id);
      }

      toast.success(publish ? t("market.dash.submitted") : t("market.dash.savedDraft"));
      void navigate({ to: "/dashboard/my-ads" });
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => void onSubmit(e, true)}>
      <fieldset className="space-y-2 rounded-xl border border-border bg-card p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          {t("market.dash.publishAs")}
        </legend>
        {lockedIdentity ? (
          <p className="text-xs text-muted-foreground">{t("market.dash.identityLocked")}</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {identities.map((identity) => (
                <button
                  key={identity.key}
                  type="button"
                  onClick={() => select(identity.key)}
                  aria-pressed={identity.key === active?.key}
                  className={
                    identity.key === active?.key
                      ? "flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 p-2.5 text-start"
                      : "flex items-center gap-2 rounded-lg border border-border p-2.5 text-start hover:border-primary/40"
                  }
                >
                  {identity.kind === "business" ? (
                    <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {identity.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {t(`market.identity.${identity.kind}`)}
                    </span>
                  </span>
                  <VerifiedBadge status={identity.verificationStatus} size="xs" />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("market.dash.identityHint")}</p>
          </>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="type_code">{t("market.filters.type")}</Label>
          <select
            id="type_code"
            className={selectClass}
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
          >
            {(types.data ?? []).map((tp) => (
              <option key={tp.code} value={tp.code}>
                {label(tp)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category_id">{t("market.filters.category")}</Label>
          <select
            id="category_id"
            className={selectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">{t("market.dash.pickCategory")}</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {subs.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="subcategory_id">{t("market.filters.subcategory")}</Label>
          <select
            id="subcategory_id"
            name="subcategory_id"
            className={selectClass}
            defaultValue={listing?.subcategory_id ?? ""}
          >
            <option value="">{t("market.filters.all")}</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("market.dash.listingTitle")}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={160}
          defaultValue={listing?.title ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="summary">{t("market.dash.summary")}</Label>
        <Input id="summary" name="summary" maxLength={240} defaultValue={listing?.summary ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("market.dash.description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={listing?.description ?? ""}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">{t("market.dash.price")}</Label>
          <Input
            id="price"
            name="price"
            dir="ltr"
            inputMode="decimal"
            disabled={priceOnRequest}
            defaultValue={listing?.price ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price_unit">{t("market.dash.priceUnit")}</Label>
          <Input id="price_unit" name="price_unit" defaultValue={listing?.price_unit ?? ""} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={priceOnRequest}
            onChange={(e) => setPriceOnRequest(e.target.checked)}
          />
          {t("market.priceOnRequest")}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">{t("market.quote.quantity")}</Label>
          <Input
            id="quantity"
            name="quantity"
            dir="ltr"
            inputMode="decimal"
            defaultValue={listing?.quantity ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">{t("market.quote.unit")}</Label>
          <Input id="unit" name="unit" defaultValue={listing?.unit ?? ""} />
        </div>
        {isEquipment && (
          <div className="space-y-1.5">
            <Label htmlFor="item_condition">{t("market.dash.condition")}</Label>
            <select
              id="item_condition"
              name="item_condition"
              className={selectClass}
              defaultValue={listing?.item_condition ?? "used"}
            >
              <option value="new">{t("market.condition.new")}</option>
              <option value="used">{t("market.condition.used")}</option>
              <option value="refurbished">{t("market.condition.refurbished")}</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country_id">{t("market.geo.country")}</Label>
          <select
            id="country_id"
            className={selectClass}
            required
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              setCityId("");
            }}
          >
            <option value="">{t("market.geo.pick")}</option>
            {(countries.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {geoName(c, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city_id">{t("market.filters.city")}</Label>
          <select
            id="city_id"
            name="city_id"
            className={selectClass}
            required
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            disabled={!countryId}
          >
            <option value="">{t("market.geo.pickCity")}</option>
            {(cities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {geoName(c, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">{t("market.dash.region")}</Label>
          <Input id="region" name="region" defaultValue={listing?.region ?? ""} />
        </div>
      </div>

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
              // Appending keeps earlier picks instead of replacing them.
              setFiles((prev) => [...prev, ...picked].slice(0, 8));
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground">{t("market.dash.coverHint")}</p>
            <ul className="flex flex-wrap gap-2">
              {files.map((f, index) => (
                <li key={previewKeys[index] ?? `${f.name}-${index}`} className="relative">
                  <img
                    src={previews[index]}
                    alt={f.name}
                    className="size-20 rounded-lg border border-border object-cover"
                  />
                  {index === 0 ? (
                    <span className="absolute bottom-1 start-1 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                      {t("market.dash.cover")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="absolute bottom-1 start-1 rounded bg-background/90 px-1 text-[9px] font-semibold text-foreground shadow"
                      onClick={() => move(index, 0)}
                    >
                      {t("market.dash.makeCover")}
                    </button>
                  )}
                  <span className="absolute bottom-1 end-1 flex gap-0.5">
                    <button
                      type="button"
                      aria-label={t("market.dash.moveEarlier")}
                      disabled={index === 0}
                      className="rounded bg-background/90 p-0.5 text-foreground shadow disabled:opacity-40"
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUp className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("market.dash.moveLater")}
                      disabled={index === files.length - 1}
                      className="rounded bg-background/90 p-0.5 text-foreground shadow disabled:opacity-40"
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDown className="size-3" aria-hidden />
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    className="absolute -top-1.5 -end-1.5 rounded-full bg-background p-0.5 text-muted-foreground shadow"
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t("market.dash.submitForReview")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={(e) => {
            const form = (e.currentTarget as HTMLElement).closest("form") as HTMLFormElement;
            if (form.reportValidity())
              void onSubmit(
                {
                  preventDefault() {},
                  currentTarget: form,
                } as unknown as React.FormEvent<HTMLFormElement>,
                false,
              );
          }}
        >
          {t("market.dash.saveDraft")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("market.dash.reviewNote")}</p>
    </form>
  );
}
