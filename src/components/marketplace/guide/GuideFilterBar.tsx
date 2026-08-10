/**
 * Syria guide filters — collapsed by default, sequential when opened.
 *
 * The bar itself is one line: a "تصفية" button, chips for what is already
 * chosen, the live result count and a clear button. The panel opens only on
 * demand and walks a fixed order — governorate → sector → category →
 * subcategory (optional) — where each step appears after the previous one is
 * chosen and only lists options that still exist under it. Picking the last
 * meaningful step closes the panel so results are visible immediately.
 */

import { Check, ChevronDown, Filter, X } from "lucide-react";
import { useState } from "react";

import type { GuideFacetOption, GuideFacets, GuideFilters } from "@/lib/mkt-guide-places";

type StepKey = "governorate" | "sector" | "category" | "subcategory";

const STEP_LABELS: Record<StepKey, string> = {
  governorate: "المدينة / المحافظة",
  sector: "القطاع",
  category: "التصنيف",
  subcategory: "التصنيف الفرعي (اختياري)",
};

interface Props {
  filters: GuideFilters;
  facets: GuideFacets;
  total: number;
  loading: boolean;
  onChange: (next: GuideFilters) => void;
}

export function GuideFilterBar({ filters, facets, total, loading, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const chips: { key: StepKey; value: string }[] = (
    ["governorate", "sector", "category", "subcategory"] as StepKey[]
  )
    .filter((key) => filters[key])
    .map((key) => ({ key, value: filters[key] }));

  /** Clearing a step also clears everything that depends on it. */
  const clearFrom = (key: StepKey) => {
    if (key === "governorate")
      onChange({ ...filters, governorate: "", sector: "", category: "", subcategory: "" });
    else if (key === "sector") onChange({ ...filters, sector: "", category: "", subcategory: "" });
    else if (key === "category") onChange({ ...filters, category: "", subcategory: "" });
    else onChange({ ...filters, subcategory: "" });
  };

  const pick = (key: StepKey, value: string) => {
    if (key === "governorate")
      onChange({ ...filters, governorate: value, sector: "", category: "", subcategory: "" });
    else if (key === "sector")
      onChange({ ...filters, sector: value, category: "", subcategory: "" });
    else if (key === "category") onChange({ ...filters, category: value, subcategory: "" });
    else {
      onChange({ ...filters, subcategory: value });
      setOpen(false);
      return;
    }
    // The category step is the last required one: close as soon as it is set.
    if (key === "category") setOpen(false);
  };

  const options: Record<StepKey, GuideFacetOption[]> = {
    governorate: facets.governorates,
    sector: facets.sectors,
    category: facets.categories,
    subcategory: facets.subcategories,
  };

  const visibleSteps: StepKey[] = ["governorate"];
  if (filters.governorate) visibleSteps.push("sector");
  if (filters.governorate && filters.sector) visibleSteps.push("category");
  if (filters.governorate && filters.sector && filters.category) visibleSteps.push("subcategory");

  const hasFilters = chips.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-market-navy/25 bg-market-navy px-3.5 text-desc font-black text-white"
        >
          <Filter className="size-3.5" aria-hidden />
          تصفية
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => clearFrom(chip.key)}
            className="inline-flex h-8 max-w-[46vw] items-center gap-1 truncate rounded-full border border-market-navy/20 bg-market-navy/5 px-2.5 text-desc font-black text-market-navy"
          >
            <span className="truncate">{chip.value}</span>
            <X className="size-3 shrink-0" aria-hidden />
          </button>
        ))}

        <span className="ms-auto shrink-0 rounded-full bg-muted px-2.5 py-1 text-desc font-black text-muted-foreground">
          {loading ? "…" : `${total.toLocaleString("en-US")} نتيجة`}
        </span>

        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, governorate: "", sector: "", category: "", subcategory: "" })
            }
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-desc font-black text-muted-foreground"
          >
            مسح الفلاتر
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <ol className="space-y-3">
            {visibleSteps.map((step, index) => (
              <li key={step}>
                <div className="mb-1.5 flex items-center gap-1.5 text-desc font-black">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-market-navy text-desc text-white">
                    {index + 1}
                  </span>
                  {STEP_LABELS[step]}
                  {filters[step] ? (
                    <Check className="size-3.5 text-success" aria-hidden />
                  ) : null}
                </div>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {options[step].length === 0 ? (
                    <span className="text-desc text-muted-foreground">لا خيارات متاحة</span>
                  ) : (
                    options[step].map((option) => {
                      const active = filters[step] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => (active ? clearFrom(step) : pick(step, option.value))}
                          className={`rounded-full border px-2.5 py-1 text-desc font-bold transition ${
                            active
                              ? "border-market-navy bg-market-navy text-white"
                              : "border-border bg-background hover:border-market-navy/40"
                          }`}
                        >
                          {option.value}
                          <span className="ms-1 opacity-70">
                            ({option.count.toLocaleString("en-US")})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {step === "subcategory" ? (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-2 rounded-full border border-border px-3 py-1 text-desc font-black text-muted-foreground"
                  >
                    تخطّي وعرض النتائج
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
