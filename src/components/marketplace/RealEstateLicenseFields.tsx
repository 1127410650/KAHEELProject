import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, FileUp, Loader2, ScrollText, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { MKT_BUCKET } from "@/lib/mkt";
import {
  ADVERTISER_ROLES,
  daysUntil,
  licenseDate,
  licenseSummary,
  needsPracticeLicense,
  REGA_AD_LICENSE_INQUIRY,
  REGA_BROKER_LICENSE_INQUIRY,
  type AdvertiserRole,
  type LicenseVerificationStatus,
} from "@/lib/mkt-license";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


export interface LicenseFormValue {
  advertiserRole: AdvertiserRole;
  adLicenseNumber: string;
  adLicenseExpiry: string;
  practiceLicenseNumber: string;
  licenseDocPath: string | null;
  exemptionRequested: boolean;
  exemptionReason: string;
  exemptionDocPath: string | null;
  exemptionApproved: boolean;
  verificationStatus: LicenseVerificationStatus;
}

export const EMPTY_LICENSE: LicenseFormValue = {
  advertiserRole: "owner",
  adLicenseNumber: "",
  adLicenseExpiry: "",
  practiceLicenseNumber: "",
  licenseDocPath: null,
  exemptionRequested: false,
  exemptionReason: "",
  exemptionDocPath: null,
  exemptionApproved: false,
  verificationStatus: "not_entered",
};

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * "Real estate advertising licence" — shown only for real estate ads.
 *
 * The advertiser fills in what the authority requires them to publish. Nothing
 * here marks the licence as valid: the status is decided by the platform after
 * review, and a legal exemption is a request, never a checkbox the user ticks
 * to skip the rules.
 */
export function RealEstateLicenseFields({
  value,
  userId,
  onChange,
  open,
  onOpenChange,
  focusField,
  onFocusHandled,
}: {
  value: LicenseFormValue;
  userId: string;
  onChange: (next: LicenseFormValue) => void;
  /** Controlled accordion state; closed when the form opens. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Input id to focus after a failed submit. */
  focusField?: string | null;
  onFocusHandled?: () => void;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState<"license" | "exemption" | null>(null);
  const licenseInput = useRef<HTMLInputElement>(null);
  const exemptionInput = useRef<HTMLInputElement>(null);
  const summary = licenseSummary(value);

  useEffect(() => {
    if (!open || !focusField) return;
    const el = document.getElementById(focusField) as HTMLElement | null;
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    onFocusHandled?.();
  }, [open, focusField, onFocusHandled]);


  const set = <K extends keyof LicenseFormValue>(key: K, next: LicenseFormValue[K]) =>
    onChange({ ...value, [key]: next });

  const expiryNote = useMemo(() => {
    if (!value.adLicenseExpiry) return null;
    const left = daysUntil(value.adLicenseExpiry);
    if (left < 0) return { tone: "error" as const, text: t("market.license.expiredWarning") };
    if (left <= 30)
      return { tone: "warn" as const, text: t("market.license.expiringSoonWarning", { days: left }) };
    return null;
  }, [value.adLicenseExpiry, t]);

  async function upload(kind: "license" | "exemption", file: File) {
    if (!DOC_TYPES.includes(file.type)) {
      toast.error(t("market.license.docTypeError"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t("market.license.docSizeError"));
      return;
    }
    setUploading(kind);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    // Private folder: only the uploader and platform reviewers can read it.
    const path = `licenses/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    setUploading(null);
    if (error) {
      toast.error(t("market.license.docFailed"));
      return;
    }
    onChange({ ...value, [kind === "license" ? "licenseDocPath" : "exemptionDocPath"]: path });
    toast.success(t("market.license.docUploaded"));
  }

  function docRow(kind: "license" | "exemption") {
    const path = kind === "license" ? value.licenseDocPath : value.exemptionDocPath;
    const ref = kind === "license" ? licenseInput : exemptionInput;
    return (
      <div className="space-y-[var(--sp-2)]">
        <Label htmlFor={`${kind}_doc`}>
          {kind === "license" ? t("market.license.doc") : t("market.license.exemptionDoc")}
        </Label>
        <input
          id={`${kind}_doc`}
          ref={ref}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(kind, file);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading !== null}
            onClick={() => ref.current?.click()}
          >
            {uploading === kind ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileUp className="size-4" aria-hidden />
            )}
            {t("market.license.uploadDoc")}
          </Button>
          {path && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-desc text-secondary-foreground">
              {t("market.license.docAttached")}
              <button
                type="button"
                aria-label={t("market.actions.remove")}
                onClick={() =>
                  set(kind === "license" ? "licenseDocPath" : "exemptionDocPath", null)
                }
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          )}
        </div>
        <p className="text-desc text-muted-foreground">{t("market.license.docHint")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="license-panel"
        className="flex min-h-11 w-full items-center gap-2 p-3 text-start"
      >
        <ScrollText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {t("market.license.sectionTitle")}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-desc font-medium ${
            summary === "complete"
              ? "bg-primary/10 text-primary"
              : summary === "expired"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-secondary-foreground"
          }`}
        >
          {summary === "complete" && <CheckCircle2 className="size-3.5" aria-hidden />}
          {t(`market.license.summary.${summary}`)}
        </span>
        <ChevronDown
          className={open ? "size-4 shrink-0 rotate-180 transition" : "size-4 shrink-0 transition"}
          aria-hidden
        />
      </button>

      {!open && (
        <p className="px-3 pb-3 text-desc text-muted-foreground">
          {t("market.license.completeNote")}
        </p>
      )}

      <fieldset id="license-panel" hidden={!open} className="space-y-4 border-t border-border p-3">
      <p className="text-desc text-muted-foreground">{t("market.license.formIntro")}</p>


      <div className="space-y-[var(--sp-2)]">
        <Label htmlFor="advertiser_role">{t("market.license.advertiserRole")}</Label>
        <select
          id="advertiser_role"
          className={selectClass}
          value={value.advertiserRole}
          onChange={(event) => set("advertiserRole", event.target.value as AdvertiserRole)}
        >
          {ADVERTISER_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`market.license.role.${role}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="ad_license_number">{t("market.license.number")}</Label>
          <Input
            id="ad_license_number"
            dir="ltr"
            value={value.adLicenseNumber}
            onChange={(event) => set("adLicenseNumber", event.target.value)}
          />
          <a
            href={REGA_AD_LICENSE_INQUIRY}
            target="_blank"
            rel="noopener noreferrer"
            title={t("market.license.verifyHint")}
            aria-label={t("market.license.verifyHint")}
            className="inline-flex min-h-11 items-center gap-[var(--sp-2)] text-desc font-semibold text-primary underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t("market.license.verify")}
          </a>
        </div>

        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="ad_license_expiry">{t("market.license.expiry")}</Label>
          <Input
            id="ad_license_expiry"
            type="date"
            dir="ltr"
            value={value.adLicenseExpiry}
            onChange={(event) => set("adLicenseExpiry", event.target.value)}
          />
          <p className="text-desc text-muted-foreground" dir="ltr">
            {value.adLicenseExpiry ? licenseDate(value.adLicenseExpiry) : "DD/MM/YYYY"}
          </p>
        </div>
      </div>

      {expiryNote && (
        <p
          className={
            expiryNote.tone === "error"
              ? "rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-desc text-destructive"
              : "rounded-lg border border-border bg-secondary px-3 py-2 text-desc text-secondary-foreground"
          }
        >
          {expiryNote.text}
        </p>
      )}

      {needsPracticeLicense(value.advertiserRole) && (
        <div className="space-y-[var(--sp-2)]">
          <Label htmlFor="practice_license_number">{t("market.license.practiceNumber")}</Label>
          <Input
            id="practice_license_number"
            dir="ltr"
            value={value.practiceLicenseNumber}
            onChange={(event) => set("practiceLicenseNumber", event.target.value)}
          />
          <a
            href={REGA_BROKER_LICENSE_INQUIRY}
            target="_blank"
            rel="noopener noreferrer"
            title={t("market.license.verifyBrokerHint")}
            aria-label={t("market.license.verifyBrokerHint")}
            className="inline-flex min-h-11 items-center gap-[var(--sp-2)] text-desc font-semibold text-primary underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t("market.license.verifyBroker")}
          </a>
        </div>
      )}

      {docRow("license")}

      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={value.exemptionRequested}
            onChange={(event) => set("exemptionRequested", event.target.checked)}
          />
          <span>
            {t("market.license.exemptionRequest")}
            <span className="block text-desc font-normal text-muted-foreground">
              {t("market.license.exemptionHint")}
            </span>
          </span>
        </label>
        {value.exemptionRequested && (
          <>
            <div className="space-y-[var(--sp-2)]">
              <Label htmlFor="exemption_reason">{t("market.license.exemptionReason")}</Label>
              <Textarea
                id="exemption_reason"
                rows={3}
                value={value.exemptionReason}
                onChange={(event) => set("exemptionReason", event.target.value)}
              />
            </div>
            {docRow("exemption")}
          </>
        )}
        {value.exemptionRequested && !value.exemptionApproved && (
          <p className="text-desc text-muted-foreground">
            {t("market.license.exemptionPendingNote")}
          </p>
        )}
      </div>

      <p className="rounded-lg border border-border bg-secondary px-3 py-2 text-desc text-secondary-foreground">
        {t(`market.license.status.${value.verificationStatus}`)} — {t("market.license.statusNote")}
      </p>
      </fieldset>
    </div>

  );
}
