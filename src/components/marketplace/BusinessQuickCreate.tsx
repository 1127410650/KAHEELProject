import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { geoName, loadCities, toE164, useAccountCountry } from "@/lib/mkt-geo";
import {
  ALLOWED_DOC_MIME,
  ENTITY_TYPES,
  ID_TYPES,
  OFFICER_CAPACITIES,
  isOfficialNumberTaken,
  isRealDocument,
  isValidIdentityNumber,
  isValidOfficialNumber,
  maskLast4,
  normalizeOfficialNumber,
  uploadVerificationDocs,
  type DocKind,
  type DocUpload,
} from "@/lib/mkt-business";
import { MKT_BUCKET } from "@/lib/mkt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityPicker, type ActivityValue } from "@/components/marketplace/ActivityPicker";
import { setEntityActivities } from "@/lib/mkt-activities";
import { saveProviderProfile, useProviderCategories } from "@/lib/mkt-provider-network";
import {
  finalizeJoinApplication,
  joinErrorMessage,
  markJoinApplicationIncomplete,
  prepareJoinWorkspace,
  submitJoinApplication,
  uploadJoinDocument,
} from "@/lib/mkt-provider-onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new tenant id once the business exists. */
  onCreated: (tenantId: string) => void;
  /**
   * "dialog" keeps the historical modal used by the ad form; "page" renders the
   * exact same wizard inline for the standalone /business/new screen, so account
   * creation is never a modal inside the account picker.
   */
  variant?: "dialog" | "page";
  /** Called while the wizard holds data the user has not submitted yet. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Reviewed operator flow. Omitted only for legacy/admin-created workspaces. */
  joinKind?: "seller" | "service_provider";
}

const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm sm:h-10";
const DOC_ORDER: DocKind[] = ["cr", "authorization", "id", "other"];
type Stage = 0 | 1 | 2;

/**
 * "Create a new business" wizard — three short stages: business data, the
 * responsible officer plus documents, then review and create.
 *
 * It never creates a new login: the business is attached to the signed-in user
 * as its owner, and the client never sends ownership, tenant or verification
 * fields. Official numbers and the officer's identity number go to the private
 * tables only and are never written to local storage.
 */
export function BusinessQuickCreate({
  open,
  onOpenChange,
  onCreated,
  variant = "dialog",
  onDirtyChange,
  joinKind,
}: Props) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const country = useAccountCountry();
  const providerCategories = useProviderCategories();
  const cities = useQuery({
    queryKey: ["mkt", "cities", country.data?.id],
    enabled: !!country.data?.id,
    queryFn: () => loadCities(country.data?.id ?? null),
  });

  const [stage, setStage] = useState<Stage>(0);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // ---- stage 1: business ----
  const [tradeName, setTradeName] = useState("");
  const [tradeNameEn, setTradeNameEn] = useState("");
  const [entityType, setEntityType] = useState<string>("sole_proprietorship");
  const [providerCategoryCode, setProviderCategoryCode] = useState("marketplace_seller");
  // The activity always comes from the reference taxonomy: the user picks it,
  // nothing is matched or approved automatically, and an unlisted activity can
  // only be sent as a suggestion for staff review.
  const [activity, setActivity] = useState<ActivityValue>({ main: null, subs: [] });
  const [cityId, setCityId] = useState("");
  const [about, setAbout] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<File | null>(null);

  // ---- stage 2: officer, official data, documents ----
  const [legalName, setLegalName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [unifiedNumber, setUnifiedNumber] = useState("");
  const [crExpiry, setCrExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [idType, setIdType] = useState<string>("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [capacity, setCapacity] = useState<string>("owner");
  const [relation, setRelation] = useState("");
  const [officerPhone, setOfficerPhone] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [authExpiry, setAuthExpiry] = useState("");
  const [docs, setDocs] = useState<Partial<Record<DocKind, File>>>({});
  const [note, setNote] = useState("");

  const availableProviderCategories = useMemo(() => {
    const rows = providerCategories.data ?? [];
    if (joinKind === "seller") {
      return rows.filter(
        (row) =>
          row.capabilities.includes("catalog.products") ||
          row.capabilities.includes("orders.receive"),
      );
    }
    if (joinKind === "service_provider") {
      return rows.filter(
        (row) =>
          row.capabilities.includes("catalog.services") ||
          row.capabilities.includes("bookings.receive") ||
          row.capabilities.includes("jobs.receive") ||
          row.capabilities.includes("quotes.receive"),
      );
    }
    return rows;
  }, [joinKind, providerCategories.data]);

  useEffect(() => {
    const first = availableProviderCategories[0];
    if (first && !availableProviderCategories.some((row) => row.code === providerCategoryCode)) {
      setProviderCategoryCode(first.code);
    }
  }, [availableProviderCategories, providerCategoryCode]);

  const iso2 = country.data?.iso2 ?? "SA";
  const city = (cities.data ?? []).find((c) => c.id === cityId);
  const mainActivityText = activity.main?.name_ar.trim() ?? "";
  const subActivityNames = activity.subs.map((s) => s.name_ar.trim()).filter(Boolean);

  function touch() {
    onDirtyChange?.(true);
  }

  function set<T>(setter: (value: T) => void) {
    return (value: T) => {
      touch();
      setter(value);
    };
  }

  function e164(value: string): string | null {
    return toE164(iso2, value);
  }

  function businessError(): string | null {
    if (tradeName.trim().length < 2) return t("market.biz.nameRequired");
    if (!providerCategoryCode) return t("market.biz.providerCategoryRequired");
    if (!activity.main) return t("market.biz.activityRequired");
    if (!cityId) return t("market.geo.pickCity");
    return null;
  }

  function officerError(): string | null {
    if (legalName.trim().length < 3) return t("market.biz.legalNameRequired");
    if (!crNumber.trim() && !unifiedNumber.trim()) return t("market.biz.officialNumberRequired");
    if (crNumber.trim() && !isValidOfficialNumber(crNumber)) return t("market.biz.crInvalid");
    if (unifiedNumber.trim() && !isValidOfficialNumber(unifiedNumber))
      return t("market.biz.unifiedInvalid");
    const today = new Date().toISOString().slice(0, 10);
    if (crExpiry && crExpiry < today) return t("market.biz.crExpired");
    if (!e164(phone)) return t("market.biz.phoneInvalid");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return t("market.biz.emailInvalid");
    if (officerName.trim().length < 4) return t("market.biz.officerNameRequired");
    if (!isValidIdentityNumber(idNumber)) return t("market.biz.officerIdInvalid");
    if (!e164(officerPhone)) return t("market.biz.phoneInvalid");
    if (officerEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(officerEmail.trim()))
      return t("market.biz.emailInvalid");
    if (capacity !== "owner" && authExpiry && authExpiry < today)
      return t("market.biz.authExpired");
    if (!docs.cr) return t("market.biz.crDocRequired");
    if (capacity !== "owner" && !docs.authorization) return t("market.biz.authDocRequired");
    return null;
  }

  async function pickDoc(kind: DocKind, file: File | null) {
    touch();
    if (!file) {
      setDocs((prev) => ({ ...prev, [kind]: undefined }));
      return;
    }
    if (!(await isRealDocument(file))) {
      toast.error(t("market.biz.fileRejected"));
      return;
    }
    setDocs((prev) => ({ ...prev, [kind]: file }));
  }

  /** Creates the business, its first membership (server side) and the
   * verification request with its documents. Verification state itself is never
   * sent from the client. */
  async function create() {
    const error = businessError() ?? officerError();
    if (error) {
      toast.error(error);
      return;
    }
    if (!confirmed) {
      toast.error(t("market.biz.confirmRequired"));
      return;
    }
    if (busy) return;
    setBusy(true);
    let joinApplicationId: string | null = null;
    try {
      if (!joinKind && (await isOfficialNumberTaken(crNumber, unifiedNumber))) {
        toast.error(t("market.biz.duplicate"));
        return;
      }

      const businessPhone = e164(phone) ?? phone.trim();
      let tid: string;
      if (joinKind) {
        tid = await prepareJoinWorkspace({
          kind: joinKind,
          providerCategoryCode,
          nameAr: tradeName.trim(),
          nameEn: tradeNameEn.trim() || null,
          legalName: legalName.trim(),
          crNumber: normalizeOfficialNumber(crNumber) || null,
          unifiedNumber: normalizeOfficialNumber(unifiedNumber) || null,
          city: city?.name_ar ?? null,
          phone: businessPhone,
          email: email.trim(),
          activity: mainActivityText,
        });
      } else {
        const { data: created, error: rpcError } = await supabase.rpc("create_workspace", {
          _tenant_type: "store",
          _name_ar: tradeName.trim(),
          ...(tradeNameEn.trim() ? { _name_en: tradeNameEn.trim() } : {}),
          _legal_name: legalName.trim(),
          ...(crNumber.trim() ? { _cr_number: normalizeOfficialNumber(crNumber) } : {}),
          ...(city?.name_ar ? { _city: city.name_ar } : {}),
          _phone: businessPhone,
          _email: email.trim(),
          _activity: mainActivityText,
          _provider_type: providerCategoryCode,
          _contact_info: {},
          _confirm_duplicate: false,
        });
        if (rpcError || !created) {
          toast.error(
            (rpcError?.message ?? "").includes("WORKSPACE_LIMIT_REACHED")
              ? t("market.biz.limitReached")
              : t("market.actions.failed"),
          );
          return;
        }
        tid = created as unknown as string;
      }

      const profileValues = {
        tenant_id: tid,
        slug: `biz-${tid.slice(0, 8)}`,
        display_name_ar: tradeName.trim(),
        display_name_en: tradeNameEn.trim() || null,
        // Country always comes from the authorised account, never from the form.
        country_id: country.data?.id ?? null,
        city_id: cityId,
        city: city?.name_ar ?? null,
        main_activity: mainActivityText,
        sub_activities: subActivityNames,
        about: about.trim() || null,
        public_phone: businessPhone,
        public_email: email.trim(),
        public_website: website.trim() || null,
        is_published: !joinKind,
      };
      const profileWrite = joinKind
        ? supabase.from("mkt_business_profiles").upsert(profileValues, { onConflict: "tenant_id" })
        : supabase.from("mkt_business_profiles").insert(profileValues);
      const { error: profileError } = await profileWrite;
      if (profileError) throw profileError;

      const registryValues = {
        tenant_id: tid,
        entity_type: entityType,
        legal_name: legalName.trim(),
        cr_number: normalizeOfficialNumber(crNumber) || null,
        unified_number: normalizeOfficialNumber(unifiedNumber) || null,
        cr_expiry_date: crExpiry || null,
        main_activity: mainActivityText,
        sub_activities: subActivityNames,
        contact_phone: businessPhone,
        contact_email: email.trim(),
      };
      const registryWrite = joinKind
        ? supabase.from("mkt_business_registry").upsert(registryValues, { onConflict: "tenant_id" })
        : supabase.from("mkt_business_registry").insert(registryValues);
      const { error: registryError } = await registryWrite;
      if (registryError) {
        toast.error(
          registryError.message.includes("unique") || registryError.code === "23505"
            ? t("market.biz.duplicate")
            : t("market.actions.failed"),
        );
        return;
      }

      const officerValues = {
        tenant_id: tid,
        user_id: session?.user.id ?? null,
        full_name: officerName.trim(),
        id_type: idType,
        id_number: normalizeOfficialNumber(idNumber),
        capacity,
        relation: relation.trim() || null,
        phone: e164(officerPhone) ?? officerPhone.trim(),
        email: officerEmail.trim() || null,
        authorization_expires_on: capacity === "owner" ? null : authExpiry || null,
      };
      if (joinKind) {
        const { data: existingOfficer, error: officerLookupError } = await supabase
          .from("mkt_business_officers")
          .select("id")
          .eq("tenant_id", tid)
          .eq("is_primary", true)
          .limit(1)
          .maybeSingle();
        if (officerLookupError) throw officerLookupError;
        const officerWrite = existingOfficer
          ? supabase
              .from("mkt_business_officers")
              .update(officerValues)
              .eq("id", existingOfficer.id)
          : supabase.from("mkt_business_officers").insert(officerValues);
        const { error: officerWriteError } = await officerWrite;
        if (officerWriteError) throw officerWriteError;
      } else {
        const { error: officerInsertError } = await supabase
          .from("mkt_business_officers")
          .insert(officerValues);
        if (officerInsertError) throw officerInsertError;
      }

      if (logo) {
        const ext = logo.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `business/${tid}/logo-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from(MKT_BUCKET)
          .upload(path, logo, { contentType: logo.type, upsert: false });
        if (!up.error) {
          await supabase
            .from("mkt_business_profiles")
            .update({ logo_url: path })
            .eq("tenant_id", tid);
        }
      }

      // Documents always travel with a verification request; the review outcome
      // belongs to the marketplace staff, not to this form.
      if (session && !joinKind) {
        const { data: request } = await supabase
          .from("mkt_verification_requests")
          .insert({
            tenant_id: tid,
            submitted_by: session.user.id,
            status: "pending",
            note: note.trim() || null,
          })
          .select("id")
          .single();
        if (request) {
          const list: DocUpload[] = DOC_ORDER.filter((kind) => docs[kind]).map((kind) => ({
            kind,
            file: docs[kind]!,
          }));
          await uploadVerificationDocs({
            tenantId: tid,
            requestId: request.id,
            userId: session.user.id,
            docs: list,
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-businesses"] });
      onDirtyChange?.(false);
      // Reference activities are linked through the guarded RPC (ownership,
      // one main activity, same sector). A failure here never blocks creation.
      if (activity.main) {
        try {
          await setEntityActivities({
            tenantId: tid,
            mainActivityId: activity.main.id,
            subActivityIds: activity.subs.map((s) => s.id),
          });
        } catch {
          // The business exists; activities can be set again from its profile.
        }
      }

      if (joinKind) {
        // The reviewed onboarding RPC bootstraps the storefront/profile in a
        // locked draft state. The work account is not exposed until approval.
        const payload = {
          full_name: officerName.trim(),
          phone: e164(officerPhone) ?? officerPhone.trim(),
          email: officerEmail.trim() || email.trim(),
          headline_ar: about.trim() || null,
          activity: mainActivityText,
          note: note.trim() || null,
        };
        joinApplicationId = await submitJoinApplication({
          kind: joinKind,
          tenantId: tid,
          providerCategoryCode,
          payload,
        });
        if (!session) throw new Error("auth_required");
        const joinDocumentKinds = {
          cr: "commercial_registration",
          authorization: "authorization",
          id: "identity",
          other: "other",
        } as const;
        for (const kind of DOC_ORDER) {
          const file = docs[kind];
          if (!file) continue;
          await uploadJoinDocument({
            applicationId: joinApplicationId,
            userId: session.user.id,
            kind: joinDocumentKinds[kind],
            file,
          });
        }
        await finalizeJoinApplication({
          applicationId: joinApplicationId,
          providerCategoryCode,
          payload,
        });
        await queryClient.invalidateQueries({ queryKey: ["mkt", "join-applications"] });
        toast.success(
          locale === "ar"
            ? "تم إرسال طلب الانضمام للمراجعة."
            : "Your join application was sent for review.",
        );
      } else {
        // Legacy/admin-created businesses keep the original immediate bootstrap.
        try {
          await saveProviderProfile({
            accountKey: `business:${tid}`,
            categoryCode: providerCategoryCode,
            headlineAr: about,
            acceptsPartnerRequests: true,
          });
        } catch {
          // The business exists; its profile can be completed from the network page.
        }
        toast.success(t("market.biz.created"));
      }

      onCreated(tid);
    } catch (error) {
      if (joinApplicationId) {
        try {
          await markJoinApplicationIncomplete(joinApplicationId);
        } catch {
          // The application remains locked server-side and can be resumed later.
        }
      }
      toast.error(joinKind ? joinErrorMessage(error, locale) : t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  const asPage = variant === "page";

  return (
    <Shell
      asPage={asPage}
      open={open}
      onOpenChange={onOpenChange}
      title={t("market.biz.quickCreate")}
      description={t("market.biz.quickCreateHint")}
    >
      <p className="text-desc font-medium text-muted-foreground">
        {t("market.biz.stepOf")
          .replace("{n}", String(stage + 1))
          .replace("{total}", "3")}{" "}
        · {t(`market.biz.stage.${(["data", "officer", "review"] as const)[stage]}`)}
      </p>

      {stage === 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="qc_trade" label={t("market.biz.nameAr")}>
              <Input
                id="qc_trade"
                value={tradeName}
                maxLength={120}
                onChange={(e) => set(setTradeName)(e.target.value)}
              />
            </Field>
            <Field id="qc_trade_en" label={t("market.biz.nameEn")} hint={t("market.biz.optional")}>
              <Input
                id="qc_trade_en"
                dir="ltr"
                value={tradeNameEn}
                maxLength={120}
                onChange={(e) => set(setTradeNameEn)(e.target.value)}
              />
            </Field>
            <Field id="qc_entity" label={t("market.biz.entityType")}>
              <select
                id="qc_entity"
                className={selectClass}
                value={entityType}
                onChange={(e) => set(setEntityType)(e.target.value)}
              >
                {ENTITY_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`market.biz.entity.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qc_provider_category" label={t("market.biz.providerCategory")}>
              <select
                id="qc_provider_category"
                className={selectClass}
                value={providerCategoryCode}
                onChange={(e) => set(setProviderCategoryCode)(e.target.value)}
              >
                {availableProviderCategories.map((value) => (
                  <option key={value.code} value={value.code}>
                    {locale === "ar" ? value.name_ar : value.name_en}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="qc_city"
              label={t("market.geo.city")}
              hint={t("market.loc.countryFromAccount")}
            >
              <select
                id="qc_city"
                className={selectClass}
                value={cityId}
                onChange={(e) => set(setCityId)(e.target.value)}
              >
                <option value="">{t("market.geo.pickCity")}</option>
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {geoName(c, locale)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="min-w-0">
            <ActivityPicker
              value={activity}
              onChange={(next) => {
                touch();
                setActivity(next);
              }}
            />
          </div>

          <Field id="qc_site" label={t("market.biz.website")} hint={t("market.biz.optional")}>
            <Input
              id="qc_site"
              dir="ltr"
              value={website}
              maxLength={200}
              onChange={(e) => set(setWebsite)(e.target.value)}
            />
          </Field>
          <Field id="qc_about" label={t("market.biz.about")} hint={t("market.biz.optional")}>
            <Textarea
              id="qc_about"
              rows={3}
              value={about}
              maxLength={600}
              onChange={(e) => set(setAbout)(e.target.value)}
            />
          </Field>
          <Field id="qc_logo" label={t("market.biz.logo")} hint={t("market.biz.logoHint")}>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {logo && (
                <img
                  src={URL.createObjectURL(logo)}
                  alt=""
                  className="size-14 shrink-0 rounded-lg border border-border object-contain p-1"
                />
              )}
              <Input
                id="qc_logo"
                type="file"
                className="min-w-0 flex-1"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => set(setLogo)(e.target.files?.[0] ?? null)}
              />
              {logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set(setLogo)(null)}>
                  {t("market.form.remove")}
                </Button>
              )}
            </div>
          </Field>
        </div>
      )}

      {stage === 1 && (
        <div className="space-y-3">
          <p className="rounded-lg bg-secondary/50 p-2.5 text-desc leading-relaxed text-muted-foreground">
            {t("market.biz.officerPrivacy")}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="qc_legal" label={t("market.biz.legalName")}>
              <Input
                id="qc_legal"
                value={legalName}
                maxLength={160}
                onChange={(e) => set(setLegalName)(e.target.value)}
              />
            </Field>
            <Field id="qc_cr" label={t("market.biz.crNumber")}>
              <Input
                id="qc_cr"
                dir="ltr"
                inputMode="numeric"
                value={crNumber}
                maxLength={30}
                onChange={(e) => set(setCrNumber)(e.target.value)}
              />
            </Field>
            <Field
              id="qc_unified"
              label={t("market.biz.unifiedNumber")}
              hint={t("market.biz.optional")}
            >
              <Input
                id="qc_unified"
                dir="ltr"
                inputMode="numeric"
                value={unifiedNumber}
                maxLength={30}
                onChange={(e) => set(setUnifiedNumber)(e.target.value)}
              />
            </Field>
            <Field id="qc_expiry" label={t("market.biz.crExpiryDate")}>
              <Input
                id="qc_expiry"
                type="date"
                dir="ltr"
                className="min-w-0"
                value={crExpiry}
                onChange={(e) => set(setCrExpiry)(e.target.value)}
              />
            </Field>
            <Field
              id="qc_phone"
              label={t("market.biz.contactPhone")}
              hint={t("market.biz.privateByDefault")}
            >
              <Input
                id="qc_phone"
                dir="ltr"
                inputMode="tel"
                value={phone}
                maxLength={20}
                onChange={(e) => set(setPhone)(e.target.value)}
              />
            </Field>
            <Field
              id="qc_email"
              label={t("market.biz.contactEmail")}
              hint={t("market.biz.privateByDefault")}
            >
              <Input
                id="qc_email"
                dir="ltr"
                inputMode="email"
                value={email}
                maxLength={160}
                onChange={(e) => set(setEmail)(e.target.value)}
              />
            </Field>
            <Field id="qc_oname" label={t("market.biz.officerName")}>
              <Input
                id="qc_oname"
                value={officerName}
                maxLength={160}
                onChange={(e) => set(setOfficerName)(e.target.value)}
              />
            </Field>
            <Field id="qc_capacity" label={t("market.biz.capacity")}>
              <select
                id="qc_capacity"
                className={selectClass}
                value={capacity}
                onChange={(e) => set(setCapacity)(e.target.value)}
              >
                {OFFICER_CAPACITIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`market.biz.cap.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qc_idtype" label={t("market.biz.idType")}>
              <select
                id="qc_idtype"
                className={selectClass}
                value={idType}
                onChange={(e) => set(setIdType)(e.target.value)}
              >
                {ID_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`market.biz.idKind.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qc_idnum" label={t("market.biz.officerId")} hint={t("market.biz.idPrivate")}>
              <Input
                id="qc_idnum"
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                value={idNumber}
                maxLength={20}
                onChange={(e) => set(setIdNumber)(e.target.value)}
              />
            </Field>
            <Field
              id="qc_ophone"
              label={t("market.biz.officerPhone")}
              hint={t("market.biz.privateByDefault")}
            >
              <Input
                id="qc_ophone"
                dir="ltr"
                inputMode="tel"
                value={officerPhone}
                maxLength={20}
                onChange={(e) => set(setOfficerPhone)(e.target.value)}
              />
            </Field>
            <Field
              id="qc_oemail"
              label={t("market.biz.officerEmail")}
              hint={t("market.biz.optional")}
            >
              <Input
                id="qc_oemail"
                dir="ltr"
                inputMode="email"
                value={officerEmail}
                maxLength={160}
                onChange={(e) => set(setOfficerEmail)(e.target.value)}
              />
            </Field>
            {capacity !== "owner" && (
              <>
                <Field
                  id="qc_relation"
                  label={t("market.biz.relation")}
                  hint={t("market.biz.optional")}
                >
                  <Input
                    id="qc_relation"
                    value={relation}
                    maxLength={120}
                    onChange={(e) => set(setRelation)(e.target.value)}
                  />
                </Field>
                <Field
                  id="qc_authexp"
                  label={t("market.biz.authExpiry")}
                  hint={t("market.biz.optional")}
                >
                  <Input
                    id="qc_authexp"
                    type="date"
                    dir="ltr"
                    className="min-w-0"
                    value={authExpiry}
                    onChange={(e) => set(setAuthExpiry)(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          <p className="rounded-lg bg-secondary/50 p-2.5 text-desc leading-relaxed text-muted-foreground">
            {t("market.biz.verificationRules")}
          </p>
          {DOC_ORDER.filter((kind) => kind !== "authorization" || capacity !== "owner").map(
            (kind) => (
              <Field
                key={kind}
                id={`qc_doc_${kind}`}
                label={t(`market.biz.doc.${kind}`)}
                hint={docs[kind] ? docs[kind]!.name : t("market.biz.fileHint")}
              >
                <Input
                  id={`qc_doc_${kind}`}
                  type="file"
                  accept={ALLOWED_DOC_MIME.join(",")}
                  onChange={(e) => void pickDoc(kind, e.target.files?.[0] ?? null)}
                />
              </Field>
            ),
          )}
          <Field
            id="qc_note"
            label={t("market.biz.verificationNote")}
            hint={t("market.biz.optional")}
          >
            <Textarea
              id="qc_note"
              rows={2}
              value={note}
              maxLength={400}
              onChange={(e) => set(setNote)(e.target.value)}
            />
          </Field>
        </div>
      )}

      {stage === 2 && (
        <div className="space-y-3">
          <ReviewGroup title={t("market.biz.stage.data")} onEdit={() => setStage(0)}>
            <Row label={t("market.biz.nameAr")} value={tradeName.trim()} />
            {tradeNameEn.trim() ? (
              <Row label={t("market.biz.nameEn")} value={tradeNameEn.trim()} />
            ) : null}
            <Row label={t("market.biz.entityType")} value={t(`market.biz.entity.${entityType}`)} />
            <Row
              label={t("market.biz.providerCategory")}
              value={(() => {
                const category = providerCategories.data?.find(
                  (item) => item.code === providerCategoryCode,
                );
                return category ? (locale === "ar" ? category.name_ar : category.name_en) : "—";
              })()}
            />
            <Row label={t("market.biz.mainActivity")} value={mainActivityText || "—"} />
            <Row
              label={t("market.biz.subActivities")}
              value={subActivityNames.join(" · ") || "—"}
            />
            <Row label={t("market.geo.city")} value={city ? geoName(city, locale) : "—"} />
          </ReviewGroup>

          <ReviewGroup title={t("market.biz.stage.officer")} onEdit={() => setStage(1)}>
            <Row label={t("market.biz.legalName")} value={legalName.trim()} />
            <Row label={t("market.biz.crNumber")} value={maskLast4(crNumber || unifiedNumber)} />
            <Row label={t("market.biz.officerName")} value={officerName.trim()} />
            <Row label={t("market.biz.capacity")} value={t(`market.biz.cap.${capacity}`)} />
            <Row label={t("market.biz.officerId")} value={maskLast4(idNumber)} />
            <Row
              label={t("market.biz.verificationDocs")}
              value={
                DOC_ORDER.filter((kind) => docs[kind])
                  .map((kind) => docs[kind]!.name)
                  .join(" · ") || "—"
              }
            />
          </ReviewGroup>

          <p className="rounded-lg bg-secondary/50 p-2.5 text-desc leading-relaxed text-muted-foreground">
            {t("market.biz.verificationLocked")}
          </p>

          <label className="flex min-w-0 items-start gap-2 text-desc leading-snug text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="wrap-anywhere">{t("market.biz.confirmData")}</span>
          </label>
        </div>
      )}

      <Footer asPage={asPage}>
        {stage > 0 && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => setStage((stage - 1) as Stage)}
          >
            {t("market.form.back")}
          </Button>
        )}
        {stage < 2 && (
          <Button
            type="button"
            onClick={() => {
              const error = stage === 0 ? businessError() : officerError();
              if (error) toast.error(error);
              else setStage((stage + 1) as Stage);
            }}
          >
            {t("market.form.next")}
          </Button>
        )}
        {stage === 2 && (
          <Button type="button" disabled={busy || !confirmed} onClick={() => void create()}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("market.biz.createBusiness")}
          </Button>
        )}
      </Footer>
    </Shell>
  );
}

/**
 * Layout wrapper. Declared at module scope on purpose: an inline component would
 * get a new identity on every render and remount the whole form (losing focus).
 */
function Shell({
  asPage,
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  asPage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  if (asPage) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0">
          <h1 className="text-page wrap-anywhere font-bold leading-tight">{title}</h1>
          <p className="wrap-anywhere mt-1 text-desc leading-snug text-muted-foreground sm:text-sm">
            {description}
          </p>
        </div>
        {children}
      </div>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Footer({ asPage, children }: { asPage: boolean; children: React.ReactNode }) {
  if (asPage)
    return (
      <div className="flex flex-row flex-wrap items-center gap-2 pt-1 [&>button]:min-h-11 sm:[&>button]:min-h-10">
        {children}
      </div>
    );
  return <DialogFooter className="flex-row flex-wrap items-center gap-2">{children}</DialogFooter>;
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-section wrap-anywhere font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
          {t("market.form.edit")}
        </Button>
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-2 text-desc sm:text-desc">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="wrap-anywhere min-w-0 font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="wrap-anywhere text-desc text-muted-foreground">{hint}</p>}
    </div>
  );
}
