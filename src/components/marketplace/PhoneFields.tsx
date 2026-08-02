import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { useI18n } from "@/i18n";
import { geoName, loadCountries, type PhoneVisibility } from "@/lib/mkt-geo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground";

/**
 * National number input tied to the selected country: the calling code is shown
 * (never typed twice) and the value is normalised to E.164 on save.
 */
export function PhoneField({
  countryId,
  value,
  onChange,
  status,
  invalid,
}: {
  countryId: string | null;
  value: string;
  onChange: (next: string) => void;
  status?: "unverified" | "verified" | undefined;
  invalid?: boolean;
}) {
  const { t, locale } = useI18n();
  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const country = (countries.data ?? []).find((c) => c.id === countryId);

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor="phone_national">{t("market.phone.label")}</Label>
      <div className="flex min-w-0 items-center gap-2" dir="ltr">
        <span className="shrink-0 rounded-md border border-input bg-secondary px-2 py-2 text-sm text-foreground">
          {country?.calling_code ?? "+—"}
        </span>
        <Input
          id="phone_national"
          inputMode="numeric"
          autoComplete="tel-national"
          className="min-w-0 flex-1"
          placeholder="5XXXXXXXX"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d+]/g, ""))}
          aria-invalid={invalid ?? false}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {country ? `${geoName(country, locale)} · ` : ""}
        {status === "verified" ? t("market.phone.verified") : t("market.phone.unverified")}
      </p>
      {invalid && <p className="text-xs font-medium text-destructive">{t("market.phone.invalid")}</p>}
    </div>
  );
}

/** Hidden by default; going public shows an explicit warning first. */
export function PhoneVisibilityField({
  value,
  onChange,
}: {
  value: PhoneVisibility;
  onChange: (next: PhoneVisibility) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor="phone_visibility">{t("market.phone.visibility")}</Label>
      <select
        id="phone_visibility"
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value as PhoneVisibility)}
      >
        <option value="hidden">{t("market.phone.hidden")}</option>
        <option value="on_request">{t("market.phone.onRequest")}</option>
        <option value="public">{t("market.phone.public")}</option>
      </select>
      {value === "public" && (
        <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("market.phone.publicWarning")}
        </p>
      )}
    </div>
  );
}
