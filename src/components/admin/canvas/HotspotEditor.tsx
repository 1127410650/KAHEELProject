/**
 * محرّر مناطق النقر — يحوّل تصميمًا مصدَّرًا إلى كتلة قابلة للنقر.
 *
 * كل منطقة مستطيل بالنسبة المئوية فوق المعاينة، وحدّها الأدنى ١٢٪ ليبقى هدف
 * اللمس ≥44px على شاشة 390px. الوجهة إما مسار عام من خريطة المسارات أو رابط
 * https خارجي — لا شيء غير ذلك يُحفظ.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_ZONES,
  MIN_ZONE_PCT,
  isAllowedHref,
  isExternalHref,
  type BlockZone,
} from "@/lib/mkt-custom-blocks";
import { ROUTE_MAP } from "@/lib/routes-map";
import { artboard } from "@/lib/mkt-canvas";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function HotspotEditor({
  ratio,
  previewUrl,
  zones,
  onChange,
}: {
  ratio: string;
  previewUrl: string | null;
  zones: BlockZone[];
  onChange: (next: BlockZone[]) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const board = artboard(ratio);
  const internal = ROUTE_MAP.filter((r) => r.is_public && !r.path.includes("$")).map((r) => r.path);

  function patch(id: string, next: Partial<BlockZone>) {
    onChange(zones.map((zone) => (zone.id === id ? { ...zone, ...next } : zone)));
  }

  function add() {
    if (zones.length >= MAX_ZONES) return;
    onChange([
      ...zones,
      {
        id: `zone-${Date.now()}`,
        x: 8,
        y: 8 + zones.length * 6,
        w: 30,
        h: MIN_ZONE_PCT,
        href: internal[0] ?? "/",
        label: `منطقة ${zones.length + 1}`,
      },
    ]);
  }

  return (
    <div className="space-y-[var(--sp-3)]">
      <div
        className="relative w-full overflow-hidden rounded-[var(--r-card)] border border-border bg-secondary/40"
        style={{ aspectRatio: `${board.w} / ${board.h}` }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <p className="absolute inset-0 grid place-items-center p-4 text-center text-[14px] text-muted-foreground">
            صدّر التصميم أولًا لتظهر المعاينة هنا.
          </p>
        )}
        {zones.map((zone, index) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => setActive(zone.id)}
            aria-label={`تحديد ${zone.label}`}
            className={
              "absolute grid place-items-center rounded-[10px] border-2 text-[14px] font-bold " +
              (active === zone.id
                ? "border-primary bg-primary/25 text-foreground"
                : "border-primary/60 bg-primary/10 text-foreground")
            }
            style={{
              insetInlineStart: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.w}%`,
              height: `${zone.h}%`,
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[14px] text-muted-foreground">
          {zones.length} / {MAX_ZONES} منطقة نقر
        </p>
        <Button type="button" variant="outline" className="min-h-11" onClick={add} disabled={zones.length >= MAX_ZONES}>
          <Plus aria-hidden className="me-1 size-4" /> منطقة نقر
        </Button>
      </div>

      <ul className="space-y-[var(--sp-3)]">
        {zones.map((zone, index) => {
          const valid = isAllowedHref(zone.href);
          return (
            <li key={zone.id} className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-3)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[16px] font-bold text-foreground">المنطقة {index + 1}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-11 text-destructive"
                  aria-label="حذف المنطقة"
                  onClick={() => onChange(zones.filter((z) => z.id !== zone.id))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>

              <div className="grid gap-[var(--sp-3)] sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${zone.id}-label`}>وصف المنطقة للقارئ الصوتي</Label>
                  <Input
                    id={`${zone.id}-label`}
                    value={zone.label}
                    maxLength={80}
                    onChange={(event) => patch(zone.id, { label: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${zone.id}-href`}>الوجهة</Label>
                  <Input
                    id={`${zone.id}-href`}
                    value={zone.href}
                    list={`${zone.id}-routes`}
                    inputMode="url"
                    aria-invalid={!valid}
                    onChange={(event) => patch(zone.id, { href: event.target.value })}
                  />
                  <datalist id={`${zone.id}-routes`}>
                    {internal.map((path) => (
                      <option key={path} value={path} />
                    ))}
                  </datalist>
                  <p className={"mt-1 text-[14px] " + (valid ? "text-muted-foreground" : "text-destructive")}>
                    {valid
                      ? isExternalHref(zone.href)
                        ? "رابط خارجي — يُفتح في تبويب جديد."
                        : "مسار داخلي معروف."
                      : "الوجهة غير مسموحة: اختر مسارًا من القائمة أو رابط https."}
                  </p>
                </div>
              </div>

              <div className="mt-[var(--sp-3)] grid grid-cols-2 gap-[var(--sp-3)] sm:grid-cols-4">
                {(
                  [
                    ["x", "الإزاحة الأفقية %", 0, 100 - MIN_ZONE_PCT],
                    ["y", "الإزاحة الرأسية %", 0, 100 - MIN_ZONE_PCT],
                    ["w", "العرض %", MIN_ZONE_PCT, 100],
                    ["h", "الارتفاع %", MIN_ZONE_PCT, 100],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <div key={key}>
                    <Label htmlFor={`${zone.id}-${key}`}>{label}</Label>
                    <Input
                      id={`${zone.id}-${key}`}
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={max}
                      value={zone[key]}
                      onChange={(event) =>
                        patch(zone.id, { [key]: clamp(Number(event.target.value) || min, min, max) } as Partial<BlockZone>)
                      }
                    />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
