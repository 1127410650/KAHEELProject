/**
 * محرّر حقل واحد من تعريف الكتلة — المكوّن الوحيد لكل نماذج الكتل في المنصة.
 *
 * كان هذا المحرّر محصورًا داخل `/admin/composer`؛ نُقل إلى هنا كي يستخدمه
 * استوديو المحتوى الجديد أيضًا بلا أي سجل مكوّنات ثانٍ ولا نموذج حقول موازٍ.
 *
 * حدود مقصودة كما هي: لا HTML ولا CSS حر، كل نص عادي بحد ١٢٠ حرفًا مع إزالة
 * `<` و`>`، والوجهات إمّا من خريطة المسارات الداخلية أو https صريح.
 */
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomBlocks } from "@/lib/mkt-custom-blocks";
import { useDesignLibrary } from "@/lib/mkt-design-library";
import { useMediaSlots } from "@/lib/mkt-media-slots";
import { ANCHOR_OPTIONS, type BlockField } from "@/lib/mkt-page-composer";
import { ROUTE_MAP } from "@/lib/routes-map";

export function BlockFieldEditor({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const slots = useMediaSlots();
  const lib = useDesignLibrary(field.type === "shape");
  const customBlocks = useCustomBlocks();

  const internalRoutes = useMemo(
    () => ROUTE_MAP.filter((r) => r.is_public && !r.path.includes("$")).map((r) => r.path),
    [],
  );

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
        <Label className="text-desc">{field.label_ar}</Label>
        <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }

  const options: { value: string; label_ar: string }[] =
    field.type === "select"
      ? (field.options ?? [])
      : field.type === "anchor"
        ? ANCHOR_OPTIONS
        : field.type === "slot"
          ? (slots.data ?? []).map((s) => ({ value: s.slot_key, label_ar: s.slot_key }))
          : field.type === "shape"
            ? (lib.data?.shapes ?? []).map((s) => ({ value: s.key, label_ar: s.label_ar }))
            : field.type === "link"
              ? internalRoutes.map((p) => ({ value: p, label_ar: p }))
              : field.type === "custom_block"
                ? (customBlocks.data ?? []).map((b) => ({ value: b.id, label_ar: b.name }))
                : [];

  return (
    <div className="space-y-1">
      <Label className="text-desc">{field.label_ar}</Label>

      {options.length > 0 && field.type !== "link" ? (
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger style={{ minHeight: 44 }}>
            <SelectValue placeholder="اختر" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "link" ? (
        <div className="space-y-1">
          <Select value="" onValueChange={onChange}>
            <SelectTrigger style={{ minHeight: 44 }}>
              <SelectValue placeholder="وجهة داخلية من خريطة المسارات" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            dir="ltr"
            value={typeof value === "string" ? value : ""}
            placeholder="/search أو https://..."
            onChange={(event) => onChange(event.target.value.trim())}
            style={{ minHeight: 44 }}
          />
          <p className="text-nav text-muted-foreground">
            الروابط الخارجية تبدأ بـ https:// وتُفتح بأيقونة خروج.
          </p>
        </div>
      ) : field.type === "number" ? (
        <Input
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ minHeight: 44 }}
        />
      ) : (
        <Input
          value={typeof value === "string" ? value : ""}
          maxLength={120}
          onChange={(event) => onChange(event.target.value.replace(/[<>]/g, ""))}
          style={{ minHeight: 44 }}
        />
      )}

      {field.hint_ar && <p className="text-nav text-muted-foreground">{field.hint_ar}</p>}
    </div>
  );
}
