/**
 * The single country-key + national-number field of the platform.
 *
 * Before this component there were two parallel implementations (the sign-up
 * form and the easy sign-in panel) with their own dial `<select>` markup and
 * their own tolerance rules. They are now one field: the dial code is picked
 * from `DIAL_CODES`, the local box accepts a leading zero or none, and
 * normalisation to E.164 stays where it belongs — `normalizePhone()` at submit.
 */
import { DIAL_CODES } from "@/lib/phone-normalize";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";

export function DialPhoneField({
  id,
  dial,
  onDialChange,
  value,
  onChange,
  label,
  dialLabel,
  note,
  size = "md",
  showCountryNames = true,
  required = false,
}: {
  id: string;
  dial: string;
  onDialChange: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** When set, the dial select gets its own visible label instead of an aria-label. */
  dialLabel?: string;
  note?: string;
  size?: "md" | "lg";
  showCountryNames?: boolean;
  required?: boolean;
}) {
  const { t, locale } = useI18n();
  const height = size === "lg" ? "h-12" : "h-10";
  const selectClass = `num ${height} w-[7.5rem] shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground`;
  const dialTitle = dialLabel ?? (locale === "ar" ? "مفتاح الدولة" : "Country code");

  return (
    <div className="min-w-0 space-y-[var(--sp-2)]">
      <div className="flex items-end gap-2" dir="ltr">
        <div className="shrink-0 space-y-[var(--sp-2)]">
          {dialLabel && <Label htmlFor={`${id}-dial`}>{dialLabel}</Label>}
          <select
            id={`${id}-dial`}
            dir="ltr"
            aria-label={dialTitle}
            value={dial}
            onChange={(event) => onDialChange(event.target.value)}
            className={selectClass}
          >
            {DIAL_CODES.map((row) => (
              <option key={row.iso2} value={row.dial}>
                +{row.dial}
                {showCountryNames ? ` ${locale === "ar" ? row.name_ar : row.name_en}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1 space-y-[var(--sp-2)]">
          <Label htmlFor={id}>{label ?? t("signup.phone")}</Label>
          <Input
            id={id}
            required={required}
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09XXXXXXXX"
            className={`num ${height} min-w-0`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      {note && <p className="text-desc leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
