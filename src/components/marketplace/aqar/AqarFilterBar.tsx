/**
 * فلاتر أفقية: المدينة، الحي، ومدى السعر.
 * كبسولات قابلة للتمرير — الفلترة نفسها تُطبَّق في المسار عبر معاملات البحث.
 */

import { X } from "lucide-react";

const PRICE_STEPS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "any", label: "كل الأسعار" },
  { key: "u100", label: "أقل من 100", max: 100 },
  { key: "100-300", label: "100 – 300", min: 100, max: 300 },
  { key: "300-800", label: "300 – 800", min: 300, max: 800 },
  { key: "o800", label: "أكثر من 800", min: 800 },
];

export function priceRangeFor(key: string): { min?: number; max?: number } {
  const step = PRICE_STEPS.find((item) => item.key === key);
  if (!step) return {};
  const range: { min?: number; max?: number } = {};
  if (typeof step.min === "number") range.min = step.min;
  if (typeof step.max === "number") range.max = step.max;
  return range;
}

function Pills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-desc font-bold text-muted-foreground">{label}</span>
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => {
          const active = option.key === value;
          return (
            <li key={option.key} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.key)}
                className={`rounded-full border px-3 text-desc font-bold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                }`}
                style={{ minHeight: 44 }}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AqarFilterBar({
  cities,
  districts,
  city,
  district,
  priceKey,
  onChange,
  onReset,
  hasFilters,
}: {
  cities: string[];
  districts: string[];
  city: string;
  district: string;
  priceKey: string;
  onChange: (patch: { city?: string; district?: string; price?: string }) => void;
  onReset: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <Pills
        label="المدينة"
        value={city}
        onChange={(key) => onChange({ city: key === "all" ? "" : key, district: "" })}
        options={[{ key: "all", label: "الكل" }, ...cities.map((c) => ({ key: c, label: c }))]}
      />
      {districts.length > 0 ? (
        <Pills
          label="الحي"
          value={district}
          onChange={(key) => onChange({ district: key === "all" ? "" : key })}
          options={[{ key: "all", label: "الكل" }, ...districts.map((d) => ({ key: d, label: d }))]}
        />
      ) : null}
      <Pills
        label="السعر"
        value={priceKey}
        onChange={(key) => onChange({ price: key })}
        options={PRICE_STEPS.map(({ key, label }) => ({ key, label }))}
      />
      {hasFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex w-fit items-center gap-1 text-desc font-bold text-primary"
          style={{ minHeight: 44 }}
        >
          <X className="size-4" aria-hidden />
          إزالة الفلاتر
        </button>
      ) : null}
    </div>
  );
}
