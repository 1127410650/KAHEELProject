import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import { pick } from "@/lib/property";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type FieldType = "text" | "number" | "date" | "textarea" | "select";

export interface FieldDef {
  name: string;
  label: [string, string];
  type?: FieldType;
  options?: Record<string, [string, string]>;
  required?: boolean;
  /** full row width on desktop */
  wide?: boolean;
}

export type FormValues = Record<string, string>;

function toFormValues(fields: FieldDef[], initial?: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const raw = initial?.[f.name];
    out[f.name] = raw === null || raw === undefined ? "" : String(raw);
  }
  return out;
}

/** Compact schema-driven dialog form used by every property section. */
export function PropertyFormDialog({
  open,
  onOpenChange,
  title,
  fields,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldDef[];
  initial?: Record<string, unknown> | undefined;
  submitting?: boolean | undefined;
  onSubmit: (values: Record<string, string | number | null>) => void;
}) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState<FormValues>(() => toFormValues(fields, initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(toFormValues(fields, initial));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit() {
    const missing = fields.find((f) => f.required && !values[f.name]?.trim());
    if (missing) {
      setError(
        locale === "ar"
          ? `الحقل «${pick(locale, missing.label)}» مطلوب`
          : `"${pick(locale, missing.label)}" is required`,
      );
      return;
    }
    const payload: Record<string, string | number | null> = {};
    for (const f of fields) {
      const raw = values[f.name]?.trim() ?? "";
      if (raw === "") {
        payload[f.name] = null;
      } else if (f.type === "number") {
        const n = Number(raw);
        payload[f.name] = Number.isFinite(n) ? n : null;
      } else {
        payload[f.name] = raw;
      }
    }
    onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(96vw,44rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.wide || f.type === "textarea" ? "sm:col-span-2" : ""}>
              <Label htmlFor={f.name} className="mb-1 block text-xs text-muted-foreground">
                {pick(locale, f.label)}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>

              {f.type === "select" ? (
                <Select
                  value={values[f.name] || ""}
                  onValueChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                >
                  <SelectTrigger id={f.name} className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(f.options ?? {}).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {pick(locale, label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  rows={3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              ) : (
                <Input
                  id={f.name}
                  className="h-9"
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" disabled={submitting} onClick={submit}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
