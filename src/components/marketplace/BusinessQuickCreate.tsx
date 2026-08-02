import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import {
  ALLOWED_DOC_MIME,
  ENTITY_TYPES,
  ID_TYPES,
  OFFICER_CAPACITIES,
  isOfficialNumberTaken,
  isRealDocument,
  isValidIdentityNumber,
  isValidOfficialNumber,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new tenant id once the business exists. */
  onCreated: (tenantId: string) => void;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const DOC_ORDER: DocKind[] = ["cr", "authorization", "id", "other"];

/**
 * Full "add a business" form opened from the ad form.
 *
 * It never creates a new login: the business is attached to the signed-in user
 * as its owner. Official numbers and the officer's identity number are written
 * to the private tables only and are never kept in local storage.
 */
export function BusinessQuickCreate({ open, onOpenChange, onCreated }: Props) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const country = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", country.data?.id],
    enabled: !!country.data?.id,
    queryFn: () => loadCities(country.data?.id ?? null),
  });

  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // ---- business ----
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState<string>("establishment");
  const [crNumber, setCrNumber] = useState("");
  const [unifiedNumber, setUnifiedNumber] = useState("");
  const [crIssue, setCrIssue] = useState("");
  const [crExpiry, setCrExpiry] = useState("");
  const [mainActivity, setMainActivity] = useState("");
  const [subActivities, setSubActivities] = useState("");
  const [cityId, setCityId] = useState("");
  const [nationalAddress, setNationalAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [about, setAbout] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [serviceCityIds, setServiceCityIds] = useState<string[]>([]);
  const [serviceRegions, setServiceRegions] = useState("");

  // ---- officer ----
  const [officerName, setOfficerName] = useState("");
  const [idType, setIdType] = useState<string>("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [capacity, setCapacity] = useState<string>("owner");
  const [relation, setRelation] = useState("");
  const [officerPhone, setOfficerPhone] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [authExpiry, setAuthExpiry] = useState("");

  // ---- documents ----
  const [docs, setDocs] = useState<Partial<Record<DocKind, File>>>({});
  const [note, setNote] = useState("");

  function businessError(): string | null {
    if (legalName.trim().length < 3) return t("market.biz.legalNameRequired");
    if (tradeName.trim().length < 2) return t("market.biz.nameRequired");
    if (!crNumber.trim() && !unifiedNumber.trim()) return t("market.biz.officialNumberRequired");
    if (crNumber.trim() && !isValidOfficialNumber(crNumber)) return t("market.biz.crInvalid");
    if (unifiedNumber.trim() && !isValidOfficialNumber(unifiedNumber))
      return t("market.biz.unifiedInvalid");
    if (crExpiry && crIssue && crExpiry < crIssue) return t("market.biz.datesInvalid");
    if (mainActivity.trim().length < 2) return t("market.biz.activityRequired");
    if (!cityId) return t("market.geo.pickCity");
    if (!/^[+0-9][0-9 ()-]{6,20}$/.test(phone.trim())) return t("market.biz.phoneInvalid");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return t("market.biz.emailInvalid");
    return null;
  }

  function officerError(): string | null {
    if (officerName.trim().length < 4) return t("market.biz.officerNameRequired");
    if (!isValidIdentityNumber(idNumber)) return t("market.biz.officerIdInvalid");
    if (!/^[+0-9][0-9 ()-]{6,20}$/.test(officerPhone.trim())) return t("market.biz.phoneInvalid");
    if (officerEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(officerEmail.trim()))
      return t("market.biz.emailInvalid");
    if (capacity !== "owner" && authExpiry && authExpiry < new Date().toISOString().slice(0, 10))
      return t("market.biz.authExpired");
    return null;
  }

  async function create() {
    const error = businessError() ?? officerError();
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      if (await isOfficialNumberTaken(crNumber, unifiedNumber)) {
        toast.error(t("market.biz.duplicate"));
        return;
      }

      const city = (cities.data ?? []).find((c) => c.id === cityId);
      const { data: created, error: rpcError } = await supabase.rpc("create_workspace", {
        _tenant_type: "establishment",
        _name_ar: tradeName.trim(),
        _legal_name: legalName.trim(),
        ...(crNumber.trim() ? { _cr_number: crNumber.trim() } : {}),
        ...(city?.name_ar ? { _city: city.name_ar } : {}),
        _phone: phone.trim(),
        _email: email.trim(),
        _activity: mainActivity.trim(),
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
      const tid = created as unknown as string;

      const { error: profileError } = await supabase.from("mkt_business_profiles").insert({
        tenant_id: tid,
        slug: `biz-${tid.slice(0, 8)}`,
        display_name_ar: tradeName.trim(),
        country_id: country.data?.id ?? null,
        city_id: cityId,
        city: city?.name_ar ?? null,
        main_activity: mainActivity.trim(),
        sub_activities: splitList(subActivities),
        service_area_city_ids: serviceCityIds,
        service_area_regions: splitList(serviceRegions),
        about: about.trim() || null,
        public_phone: phone.trim(),
        public_email: email.trim(),
        public_website: website.trim() || null,
        is_published: true,
      });
      if (profileError) throw profileError;

      const { error: registryError } = await supabase.from("mkt_business_registry").insert({
        tenant_id: tid,
        entity_type: entityType,
        legal_name: legalName.trim(),
        cr_number: crNumber.trim() || null,
        unified_number: unifiedNumber.trim() || null,
        cr_issue_date: crIssue || null,
        cr_expiry_date: crExpiry || null,
        main_activity: mainActivity.trim(),
        sub_activities: splitList(subActivities),
        national_address: nationalAddress.trim() || null,
        contact_phone: phone.trim(),
        contact_email: email.trim(),
      });
      if (registryError) {
        toast.error(
          registryError.message.includes("unique") || registryError.code === "23505"
            ? t("market.biz.duplicate")
            : t("market.actions.failed"),
        );
        return;
      }

      const { error: officerError_ } = await supabase.from("mkt_business_officers").insert({
        tenant_id: tid,
        user_id: session?.user.id ?? null,
        full_name: officerName.trim(),
        id_type: idType,
        id_number: idNumber.replace(/[^0-9A-Za-z]/g, "").toUpperCase(),
        capacity,
        relation: relation.trim() || null,
        phone: officerPhone.trim(),
        email: officerEmail.trim() || null,
        authorization_expires_on: capacity === "owner" ? null : authExpiry || null,
      });
      if (officerError_) throw officerError_;

      if (logo) {
        const ext = logo.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `business/${tid}/logo-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from(MKT_BUCKET)
          .upload(path, logo, { contentType: logo.type, upsert: false });
        if (!up.error) {
          await supabase.from("mkt_business_profiles").update({ logo_url: path }).eq("tenant_id", tid);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-businesses"] });
      setTenantId(tid);
      onCreated(tid);
      toast.success(t("market.biz.created"));
      setStage(2);
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification() {
    if (!tenantId || !session) return;
    if (!docs.cr) {
      toast.error(t("market.biz.crDocRequired"));
      return;
    }
    if (capacity !== "owner" && !docs.authorization) {
      toast.error(t("market.biz.authDocRequired"));
      return;
    }
    setBusy(true);
    try {
      const { data: request, error } = await supabase
        .from("mkt_verification_requests")
        .insert({
          tenant_id: tenantId,
          submitted_by: session.user.id,
          status: "pending",
          note: note.trim() || null,
        })
        .select("id")
        .single();
      if (error || !request) throw error ?? new Error("no request");

      const list: DocUpload[] = DOC_ORDER.filter((kind) => docs[kind]).map((kind) => ({
        kind,
        file: docs[kind]!,
      }));
      await uploadVerificationDocs({
        tenantId,
        requestId: request.id,
        userId: session.user.id,
        docs: list,
      });
      toast.success(t("market.biz.verificationSent"));
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message.includes("BUSINESS_DETAILS_INCOMPLETE")
          ? t("market.biz.incomplete")
          : t("market.actions.failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function pickDoc(kind: DocKind, file: File | null) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("market.biz.quickCreate")}</DialogTitle>
          <DialogDescription>
            {stage === 2 ? t("market.biz.verificationHint") : t("market.biz.quickCreateHint")}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-1.5 text-[11px]">
          {(["data", "officer", "verify"] as const).map((name, index) => (
            <li
              key={name}
              className={
                index === stage
                  ? "rounded-full bg-primary px-2 py-1 font-medium text-primary-foreground"
                  : index < stage
                    ? "rounded-full bg-secondary px-2 py-1 text-secondary-foreground"
                    : "rounded-full border border-border px-2 py-1 text-muted-foreground"
              }
            >
              {t(`market.biz.stage.${name}`)}
            </li>
          ))}
        </ol>

        {stage === 0 && (
          <div className="space-y-3">
            <Field id="qc_legal" label={t("market.biz.legalName")}>
              <Input id="qc_legal" value={legalName} maxLength={160} onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field id="qc_trade" label={t("market.biz.tradeName")}>
              <Input id="qc_trade" value={tradeName} maxLength={120} onChange={(e) => setTradeName(e.target.value)} />
            </Field>
            <Field id="qc_entity" label={t("market.biz.entityType")}>
              <select id="qc_entity" className={selectClass} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                {ENTITY_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`market.biz.entity.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="qc_cr" label={t("market.biz.crNumber")}>
                <Input id="qc_cr" dir="ltr" inputMode="numeric" value={crNumber} maxLength={30} onChange={(e) => setCrNumber(e.target.value)} />
              </Field>
              <Field id="qc_unified" label={t("market.biz.unifiedNumber")}>
                <Input id="qc_unified" dir="ltr" inputMode="numeric" value={unifiedNumber} maxLength={30} onChange={(e) => setUnifiedNumber(e.target.value)} />
              </Field>
              <Field id="qc_issue" label={t("market.biz.crIssueDate")}>
                <Input id="qc_issue" type="date" dir="ltr" value={crIssue} onChange={(e) => setCrIssue(e.target.value)} />
              </Field>
              <Field id="qc_expiry" label={t("market.biz.crExpiryDate")}>
                <Input id="qc_expiry" type="date" dir="ltr" value={crExpiry} onChange={(e) => setCrExpiry(e.target.value)} />
              </Field>
            </div>
            <Field id="qc_activity" label={t("market.biz.mainActivity")}>
              <Input id="qc_activity" value={mainActivity} maxLength={120} onChange={(e) => setMainActivity(e.target.value)} />
            </Field>
            <Field id="qc_subact" label={t("market.biz.subActivities")} hint={t("market.biz.listHint")}>
              <Input id="qc_subact" value={subActivities} maxLength={240} onChange={(e) => setSubActivities(e.target.value)} />
            </Field>
            <Field id="qc_country" label={t("market.geo.country")} hint={t("market.loc.countryFromAccount")}>
              <Input id="qc_country" value={geoName(country.data ?? undefined, locale)} readOnly disabled />
            </Field>
            <Field id="qc_city" label={t("market.geo.city")}>
              <select id="qc_city" className={selectClass} value={cityId} onChange={(e) => setCityId(e.target.value)}>
                <option value="">{t("market.geo.pickCity")}</option>
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {geoName(c, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qc_addr" label={t("market.biz.nationalAddress")}>
              <Input id="qc_addr" value={nationalAddress} maxLength={200} onChange={(e) => setNationalAddress(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="qc_phone" label={t("market.biz.contactPhone")}>
                <Input id="qc_phone" dir="ltr" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field id="qc_email" label={t("market.biz.contactEmail")}>
                <Input id="qc_email" dir="ltr" inputMode="email" value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <Field id="qc_site" label={t("market.biz.website")} hint={t("market.biz.optional")}>
              <Input id="qc_site" dir="ltr" value={website} maxLength={200} onChange={(e) => setWebsite(e.target.value)} />
            </Field>
            <Field id="qc_logo" label={t("market.biz.logo")} hint={t("market.biz.optional")}>
              <Input
                id="qc_logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="qc_about" label={t("market.biz.about")}>
              <Textarea id="qc_about" rows={3} value={about} maxLength={600} onChange={(e) => setAbout(e.target.value)} />
            </Field>
            <Field id="qc_areas" label={t("market.biz.serviceCities")} hint={t("market.biz.multiHint")}>
              <select
                id="qc_areas"
                multiple
                size={4}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={serviceCityIds}
                onChange={(e) =>
                  setServiceCityIds(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
              >
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {geoName(c, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qc_regions" label={t("market.biz.serviceRegions")} hint={t("market.biz.listHint")}>
              <Input id="qc_regions" value={serviceRegions} maxLength={240} onChange={(e) => setServiceRegions(e.target.value)} />
            </Field>
          </div>
        )}

        {stage === 1 && (
          <div className="space-y-3">
            <p className="rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("market.biz.officerPrivacy")}
            </p>
            <Field id="qc_oname" label={t("market.biz.officerName")}>
              <Input id="qc_oname" value={officerName} maxLength={160} onChange={(e) => setOfficerName(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="qc_idtype" label={t("market.biz.idType")}>
                <select id="qc_idtype" className={selectClass} value={idType} onChange={(e) => setIdType(e.target.value)}>
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
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </Field>
              <Field id="qc_capacity" label={t("market.biz.capacity")}>
                <select id="qc_capacity" className={selectClass} value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                  {OFFICER_CAPACITIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`market.biz.cap.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="qc_relation" label={t("market.biz.relation")}>
                <Input id="qc_relation" value={relation} maxLength={120} onChange={(e) => setRelation(e.target.value)} />
              </Field>
              <Field id="qc_ophone" label={t("market.biz.officerPhone")}>
                <Input id="qc_ophone" dir="ltr" inputMode="tel" value={officerPhone} maxLength={20} onChange={(e) => setOfficerPhone(e.target.value)} />
              </Field>
              <Field id="qc_oemail" label={t("market.biz.officerEmail")} hint={t("market.biz.optional")}>
                <Input id="qc_oemail" dir="ltr" inputMode="email" value={officerEmail} maxLength={160} onChange={(e) => setOfficerEmail(e.target.value)} />
              </Field>
            </div>
            {capacity !== "owner" && (
              <Field id="qc_authexp" label={t("market.biz.authExpiry")} hint={t("market.biz.optional")}>
                <Input id="qc_authexp" type="date" dir="ltr" value={authExpiry} onChange={(e) => setAuthExpiry(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {stage === 2 && (
          <div className="space-y-3">
            <p className="rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("market.biz.verificationRules")}
            </p>
            {DOC_ORDER.map((kind) => (
              <Field key={kind} id={`qc_doc_${kind}`} label={t(`market.biz.doc.${kind}`)} hint={t("market.biz.fileHint")}>
                <Input
                  id={`qc_doc_${kind}`}
                  type="file"
                  accept={ALLOWED_DOC_MIME.join(",")}
                  onChange={(e) => void pickDoc(kind, e.target.files?.[0] ?? null)}
                />
              </Field>
            ))}
            <Field id="qc_note" label={t("market.biz.verificationNote")} hint={t("market.biz.optional")}>
              <Textarea id="qc_note" rows={2} value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        )}

        <DialogFooter className="flex-row flex-wrap items-center gap-2">
          {stage === 1 && (
            <Button type="button" variant="ghost" onClick={() => setStage(0)}>
              {t("market.form.back")}
            </Button>
          )}
          {stage === 0 && (
            <Button
              type="button"
              onClick={() => {
                const error = businessError();
                if (error) toast.error(error);
                else setStage(1);
              }}
            >
              {t("market.form.next")}
            </Button>
          )}
          {stage === 1 && (
            <Button type="button" disabled={busy} onClick={() => void create()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("market.biz.createBusiness")}
            </Button>
          )}
          {stage === 2 && (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("market.biz.later")}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void submitVerification()}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )}
                {t("market.biz.sendVerification")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function splitList(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);
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
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export { Upload as _BusinessUploadIcon };
