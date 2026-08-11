/**
 * بطاقة رموز التصميم داخل شاشة «المظهر» — امتداد لمحرك ألوان المنصة نفسه:
 * نفس اللوحة المفعّلة ونفس جدول الرموز، مع دورة مسودة → معاينة → اعتماد.
 *
 * المعاينة محلية في هذه الشاشة فقط: لا يرى الزوّار شيئًا حتى الاعتماد.
 */
import { useEffect, useMemo, useState } from "react";

import { Check, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { AdminCard } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyDesignTokenDrafts,
  discardDesignTokenDrafts,
  setDesignTokenDraft,
  useRefreshThemeTokens,
  useThemeTokenRows,
} from "@/lib/mkt-theme";
import {
  DEFAULT_DESIGN_TOKENS,
  DESIGN_TOKENS,
  DESIGN_TOKEN_CATEGORY_LABELS,
  designTokensCss,
  isValidDesignValue,
  type DesignTokenCategory,
  type DesignTokenMap,
} from "@/lib/theme-tokens";

const CATEGORIES: DesignTokenCategory[] = ["font", "type", "radius", "shadow", "space"];

export function DesignTokensCard() {
  const rows = useThemeTokenRows(true);
  const refresh = useRefreshThemeTokens();
  const [values, setValues] = useState<DesignTokenMap>(DEFAULT_DESIGN_TOKENS);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  /** القيم المعروضة = المسودة إن وُجدت، وإلا القيمة الفعلية، وإلا الافتراضي. */
  useEffect(() => {
    if (!rows.data) return;
    const next = { ...DEFAULT_DESIGN_TOKENS };
    for (const row of rows.data) {
      const value = row.draft_value ?? row.value;
      if (value && isValidDesignValue(row.token_key, value)) next[row.token_key] = value;
    }
    setValues(next);
  }, [rows.data]);

  const dirty = useMemo(
    () => DESIGN_TOKENS.some((def) => values[def.key] !== DEFAULT_DESIGN_TOKENS[def.key]),
    [values],
  );
  const pendingDrafts = (rows.data ?? []).filter((row) => row.draft_value !== null).length;

  const save = async (key: string, value: string) => {
    const def = DESIGN_TOKENS.find((token) => token.key === key);
    if (!def) return;
    if (!isValidDesignValue(key, value)) {
      toast.error("قيمة غير صالحة لهذا الرمز");
      return;
    }
    setValues((prev) => ({ ...prev, [key]: value }));
    try {
      await setDesignTokenDraft({ tokenKey: key, category: def.category, draft: value });
      refresh();
    } catch {
      toast.error("تعذّر حفظ المسودة");
    }
  };

  return (
    <AdminCard
      title="رموز التصميم"
      description="الخطوط والأحجام والاستدارات والظلال والتباعد — امتداد لمحرك ألوان المنصة، بمسودة قبل الاعتماد."
      accent={pendingDrafts > 0}
    >
      {/* معاينة محلية: تُطبّق الرموز على هذه الشاشة فقط. */}
      {preview && <style>{designTokensCss(values, "[data-kt-preview]")}</style>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={preview ? "default" : "outline"}
          style={{ minHeight: 44 }}
          onClick={() => setPreview((p) => !p)}
        >
          <Eye aria-hidden className="size-4" />
          {preview ? "إيقاف المعاينة" : "معاينة داخل هذه البطاقة"}
        </Button>
        <Button
          size="sm"
          disabled={busy || pendingDrafts === 0}
          style={{ minHeight: 44 }}
          onClick={async () => {
            setBusy(true);
            try {
              const n = await applyDesignTokenDrafts();
              toast.success(`اعتُمد ${n.toLocaleString("en-US")} رمزًا على كل المنصة`);
              refresh();
            } catch {
              toast.error("تعذّر الاعتماد");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check aria-hidden className="size-4" />
          اعتماد المسودات
          {pendingDrafts > 0 ? ` (${pendingDrafts.toLocaleString("en-US")})` : ""}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (pendingDrafts === 0 && !dirty)}
          style={{ minHeight: 44 }}
          onClick={async () => {
            setBusy(true);
            try {
              await discardDesignTokenDrafts();
              setValues(DEFAULT_DESIGN_TOKENS);
              toast.success("أُلغيت المسودات — القيم المعتمدة كما هي");
              refresh();
            } catch {
              toast.error("تعذّر الإلغاء");
            } finally {
              setBusy(false);
            }
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
          إلغاء المسودات
        </Button>
      </div>

      <div data-kt-preview className="space-y-[var(--sp-4)]">
        {CATEGORIES.map((category) => (
          <section key={category}>
            <h3 className="mb-2 text-section font-extrabold text-foreground">
              {DESIGN_TOKEN_CATEGORY_LABELS[category]}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {DESIGN_TOKENS.filter((def) => def.category === category).map((def) => (
                <div key={def.key} className="rounded-[var(--r-card)] border border-border p-3">
                  <Label htmlFor={`kt-${def.key}`} className="text-body font-bold">
                    {def.label}
                  </Label>
                  <Input
                    id={`kt-${def.key}`}
                    dir="ltr"
                    className="mt-1"
                    value={values[def.key] ?? def.default}
                    onChange={(e) => setValues((prev) => ({ ...prev, [def.key]: e.target.value }))}
                    onBlur={(e) => void save(def.key, e.target.value)}
                  />
                  {def.hint ? (
                    <p className="mt-1 text-nav text-muted-foreground">{def.hint}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {def.presets.map((preset) => (
                      <Button
                        key={preset}
                        size="sm"
                        variant={values[def.key] === preset ? "default" : "outline"}
                        className="h-9"
                        onClick={() => void save(def.key, preset)}
                      >
                        <span dir="ltr">{preset}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="rounded-[var(--r-card)] border border-border bg-secondary/40 p-3 text-desc text-foreground">
          نموذج المعاينة: هذا النص يستخدم الخط والأحجام والتباعد والاستدارة الحالية.
        </p>
      </div>
    </AdminCard>
  );
}
