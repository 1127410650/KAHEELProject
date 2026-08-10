/**
 * تحكم «التدوير التلقائي» لفتحة واحدة داخل وضع التحرير.
 *
 * المدير يختار عدة تصاميم من مكتبة «تصاميمي» وفترة التبديل (يومي/أسبوعي/شهري)،
 * فيبدّل النظام بينها بترتيب دائري. التصميم النشط يُحسب حسابيًا من لحظة البدء
 * (`src/lib/mkt-slot-rotation.ts`) فلا حاجة لمهمة مجدولة، والسجل أدناه يظهر
 * أي تصميم نشط الآن وموعد التبديل القادم.
 *
 * لا إدخال حر: القائمة اختيار من تصاميم مسجّلة، والفترة من ثلاث قيم، والحفظ
 * يمرّ بدالة المسوّدة SECURITY DEFINER التي تُنقّي القيم مرة أخرى.
 */
import { useState } from "react";
import { Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useDesignTemplates } from "@/lib/mkt-design-library";
import type { SlotPatch } from "@/lib/mkt-live-edit";
import type { MediaSlot } from "@/lib/mkt-media-slots";
import {
  ROTATION_PERIODS,
  activeRotationTemplateId,
  nextRotationAt,
  periodLabel,
} from "@/lib/mkt-slot-rotation";

interface SlotRotationControlsProps {
  slot: MediaSlot;
  /** القيم المعروضة حاليًا (المسوّدة إن وُجدت، وإلا المنشور). */
  current: SlotPatch;
  busy: boolean;
  onSave: (patch: SlotPatch, done: string) => void;
}

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function SlotRotationControls({ slot, current, busy, onSave }: SlotRotationControlsProps) {
  const templates = useDesignTemplates(true);
  const [enabled, setEnabled] = useState(Boolean(current.rotate_enabled ?? slot.rotate_enabled));
  const [period, setPeriod] = useState(
    String(current.rotate_period ?? slot.rotate_period ?? "weekly"),
  );
  const [ids, setIds] = useState<string[]>(
    asIds(current.rotate_template_ids ?? slot.rotate_template_ids),
  );

  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const config = {
    rotate_enabled: enabled,
    rotate_period: period,
    rotate_template_ids: ids,
    rotate_started_at: slot.rotate_started_at,
  };
  const activeId = activeRotationTemplateId(config);
  const activeName = templates.data?.find((item) => item.id === activeId)?.name_ar ?? null;
  const nextAt = nextRotationAt(config);

  return (
    <section className="mt-4 space-y-3 border-t border-border pt-3">
      <h3 className="flex items-center gap-1.5 text-desc font-extrabold text-foreground">
        <Repeat className="size-4 text-primary" aria-hidden />
        التدوير التلقائي
      </h3>

      <label className="flex items-center gap-2 text-desc font-bold text-foreground" style={{ minHeight: 44 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-5 accent-primary"
        />
        بدّل التصاميم على هذه الفتحة تلقائيًا
      </label>

      {enabled ? (
        <>
          <label className="block text-desc font-bold text-foreground">
            فترة التبديل
            <select
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground"
              style={{ minHeight: 44 }}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {ROTATION_PERIODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="rounded-xl border border-border p-2.5">
            <legend className="px-1 text-desc font-bold text-foreground">
              التصاميم في الدورة <span className="num">{ids.length.toLocaleString("en-US")}</span>
            </legend>
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {(templates.data ?? [])
                .filter((item) => item.is_active)
                .map((item) => (
                  <li key={item.id}>
                    <label
                      className="flex items-center gap-2 text-desc font-bold text-foreground"
                      style={{ minHeight: 44 }}
                    >
                      <input
                        type="checkbox"
                        checked={ids.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        className="size-5 accent-primary"
                      />
                      <span className="min-w-0 truncate">{item.name_ar}</span>
                    </label>
                  </li>
                ))}
              {(templates.data ?? []).length === 0 ? (
                <li className="text-desc text-muted-foreground">
                  لا تصاميم في المكتبة بعد — ابنِ تصميمًا من «بانِ العروض».
                </li>
              ) : null}
            </ul>
            <p className="mt-1 text-desc text-muted-foreground">
              التدوير يحتاج تصميمين على الأقل، وإلا يبقى التصميم المربوط يدويًا.
            </p>
          </fieldset>

          <div className="rounded-xl border border-primary/25 bg-primary/8 p-2.5 text-desc text-foreground">
            <strong className="block font-extrabold">سجل التدوير</strong>
            <span className="block">
              النشط الآن: {activeName ?? "—"} · الفترة {periodLabel(period)}
            </span>
            {nextAt ? <span className="block">التبديل القادم: {formatDateTime(nextAt.toISOString())}</span> : null}
          </div>
        </>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          onSave(
            {
              rotate_enabled: enabled,
              rotate_period: enabled ? period : null,
              rotate_template_ids: enabled ? ids : null,
            },
            enabled ? "حُفظ التدوير كمسوّدة." : "أُوقف التدوير في المسوّدة.",
          )
        }
      >
        حفظ التدوير كمسوّدة
      </Button>
    </section>
  );
}
