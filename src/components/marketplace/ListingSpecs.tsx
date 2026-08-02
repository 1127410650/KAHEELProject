import { useI18n } from "@/i18n";
import { specFieldByKey } from "@/lib/mkt-taxonomy";
import type { MktListing } from "@/lib/mkt";

interface Row {
  label: string;
  value: string;
}

/** Turns a stored spec value into readable text, or null when it carries nothing. */
function specRow(
  key: string,
  raw: unknown,
  t: (k: string) => string,
): Row | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const field = specFieldByKey(key);
  if (!field) return null; // never surface unknown technical keys
  const label = t(field.labelKey);

  if (field.kind === "bool") {
    if (raw !== true && raw !== "true") return null; // only show what is true
    return { label, value: t("common.yes") };
  }
  if (field.kind === "select") {
    return { label, value: t(`market.spec.opt.${String(raw)}`) };
  }
  const unit = field.unitKey ? ` ${t(field.unitKey)}` : "";
  return { label, value: `${String(raw)}${unit}` };
}

/**
 * Ad details: only fields that actually carry a value, labelled in the active
 * language. Database column names and technical values never appear.
 */
export function ListingSpecs({ listing }: { listing: MktListing }) {
  const { t } = useI18n();
  const specs = (listing.specs && typeof listing.specs === "object" ? listing.specs : {}) as Record<
    string,
    unknown
  >;

  const rows: Row[] = [];

  if (listing.quantity !== null && listing.quantity !== undefined) {
    rows.push({
      label: t("market.form.quantity"),
      value: `${listing.quantity}${listing.unit ? ` ${listing.unit}` : ""}`,
    });
  }
  if (listing.item_condition) {
    rows.push({
      label: t("market.ad.conditionLabel"),
      value: t(`market.condition.${listing.item_condition}`),
    });
  }
  if (listing.price_on_request) {
    rows.push({ label: t("market.ad.priceLabel"), value: t("market.priceOnRequest") });
  } else if (listing.price_unit) {
    rows.push({ label: t("market.ad.priceUnit"), value: listing.price_unit });
  }

  for (const [key, value] of Object.entries(specs)) {
    const row = specRow(key, value, t);
    if (row) rows.push(row);
  }

  if (rows.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">{t("market.ad.specs")}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0"
          >
            <dt className="min-w-0 shrink text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-end font-medium text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
