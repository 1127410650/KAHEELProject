import { BadgeCheck, ExternalLink } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  licenseBadge,
  licenseDate,
  needsPracticeLicense,
  REGA_AD_LICENSE_INQUIRY,
  type PublicListingLicense,
} from "@/lib/mkt-license";

/**
 * "Real estate licence data" on the ad page: two to four short rows, the
 * authority's own inquiry service, and nothing else. This is not a trust badge —
 * account verification is a separate thing and stays under the advertiser name.
 */
export function ListingLicenseSection({ license }: { license: PublicListingLicense }) {
  const { t } = useI18n();
  if (!license.ad_license_number) return null;

  const badge = licenseBadge(license);
  const tone =
    badge === "expired" || badge === "invalid"
      ? "bg-destructive/10 text-destructive"
      : badge === "expiringSoon" || badge === "pending"
        ? "bg-secondary text-secondary-foreground"
        : "bg-primary/10 text-primary";

  const rows: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: t("market.license.number"), value: license.ad_license_number, ltr: true },
  ];
  if (license.ad_license_expiry)
    rows.push({
      label: t("market.license.expiry"),
      value: licenseDate(license.ad_license_expiry),
      ltr: true,
    });
  if (license.practice_license_number && needsPracticeLicense(license.advertiser_role))
    rows.push({
      label: t("market.license.practiceNumber"),
      value: license.practice_license_number,
      ltr: true,
    });
  rows.push({
    label: t("market.license.advertiserRole"),
    value: t(`market.license.role.${license.advertiser_role}`),
  });

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
          <BadgeCheck className="size-4 text-muted-foreground" aria-hidden />
          {t("market.license.sectionTitle")}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
          {t(`market.license.badge.${badge}`)}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground">{row.label}:</dt>
            <dd className="min-w-0 break-words font-medium text-foreground" {...(row.ltr ? { dir: "ltr" } : {})}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <a
        href={REGA_AD_LICENSE_INQUIRY}
        target="_blank"
        rel="noopener noreferrer"
        title={t("market.license.verifyHint")}
        aria-label={t("market.license.verifyHint")}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary underline"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t("market.license.verify")}
      </a>
    </section>
  );
}
