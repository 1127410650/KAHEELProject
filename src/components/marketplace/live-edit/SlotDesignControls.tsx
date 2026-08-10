/**
 * أدوات التصميم المشتركة لكل فتحة في وضع التحرير: الشكل الزخرفي، الحركة، حجم
 * البلاطة، وجهة الضغط، وقالب «تصاميمي» للفتحات الإعلانية.
 *
 * كل القوائم تُقرأ من جداول المكتبة، فأي شكل أو حركة أو قالب يُضاف لاحقًا يظهر
 * هنا تلقائيًا بلا تعديل هذه الشاشة. لا حقل نصّي حر: الوجهة اختيار من مسارات
 * مسجّلة، واللون منتقي سداسي، والشفافية والسرعة قيم مقيّدة.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  SHAPE_POSITIONS,
  SIZE_OPTIONS,
  SPEED_OPTIONS,
  useDesignLibrary,
  useDesignTemplates,
} from "@/lib/mkt-design-library";
import type { MediaSlot } from "@/lib/mkt-media-slots";
import type { SlotPatch } from "@/lib/mkt-live-edit";

const SELECT =
  "mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground";

export function SlotDesignControls({
  slot,
  current,
  busy,
  onSave,
}: {
  slot: MediaSlot;
  current: SlotPatch;
  busy: boolean;
  onSave: (patch: SlotPatch, done: string) => void;
}) {
  const lib = useDesignLibrary();
  const templates = useDesignTemplates(slot.edit_kind === "ad");

  const [shape, setShape] = useState(current.shape_key ?? "");
  const [shapeColor, setShapeColor] = useState(current.shape_color ?? "#8a4fff");
  const [opacity, setOpacity] = useState(current.shape_opacity ?? 18);
  const [shapeSize, setShapeSize] = useState(current.shape_size ?? "md");
  const [shapePos, setShapePos] = useState(current.shape_pos ?? "corner-tr");
  const [motion, setMotion] = useState(current.motion_key ?? "");
  const [animated, setAnimated] = useState(current.motion_state === "animated");
  const [speed, setSpeed] = useState(current.motion_speed ?? "slow");
  const [tileSize, setTileSize] = useState(current.tile_size ?? "sm");
  const [link, setLink] = useState(current.link_path ?? "");
  const [template, setTemplate] = useState(current.template_id ?? "");

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-3">
      <fieldset className="rounded-[var(--r-card)] border border-border p-[var(--sp-3)]">
        <legend className="px-1 text-desc font-bold text-foreground">الشكل الزخرفي</legend>
        <select className={SELECT} style={{ minHeight: 44 }} value={shape} onChange={(e) => setShape(e.target.value)}>
          <option value="">بلا شكل</option>
          {(lib.data?.shapes ?? []).map((item) => (
            <option key={item.key} value={item.key}>
              {item.label_ar}
            </option>
          ))}
        </select>
        {shape ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shapeColor}
                onChange={(e) => setShapeColor(e.target.value)}
                className="size-11 shrink-0 rounded-xl border border-border"
                aria-label="لون الشكل"
              />
              <label className="min-w-0 flex-1 text-desc font-bold text-foreground">
                الشفافية <span className="num">{opacity}%</span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="mt-1 w-full accent-primary"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-desc font-bold text-foreground">
                الحجم
                <select className={SELECT} style={{ minHeight: 44 }} value={shapeSize} onChange={(e) => setShapeSize(e.target.value)}>
                  {SIZE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-desc font-bold text-foreground">
                الموضع
                <select className={SELECT} style={{ minHeight: 44 }} value={shapePos} onChange={(e) => setShapePos(e.target.value)}>
                  {SHAPE_POSITIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="rounded-[var(--r-card)] border border-border p-[var(--sp-3)]">
        <legend className="px-1 text-desc font-bold text-foreground">الحركة</legend>
        <label className="flex items-center gap-2 text-desc font-bold text-foreground">
          <input
            type="checkbox"
            checked={animated}
            onChange={(e) => setAnimated(e.target.checked)}
            className="size-5 accent-primary"
          />
          متحرك (بلا تحديد = ثابت)
        </label>
        {animated ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-desc font-bold text-foreground">
              نوع الحركة
              <select className={SELECT} style={{ minHeight: 44 }} value={motion} onChange={(e) => setMotion(e.target.value)}>
                <option value="">اختر…</option>
                {(lib.data?.motions ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label_ar}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-desc font-bold text-foreground">
              السرعة
              <select className={SELECT} style={{ minHeight: 44 }} value={speed} onChange={(e) => setSpeed(e.target.value)}>
                {SPEED_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <p className="mt-2 text-desc text-muted-foreground">
          الحركات CSS خفيفة، ولا يتحرك أكثر من ثلاثة عناصر في الشاشة، ومن فعّل «تقليل الحركة» في
          جهازه يرى كل شيء ثابتًا.
        </p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-desc font-bold text-foreground">
          حجم البلاطة
          <select className={SELECT} style={{ minHeight: 44 }} value={tileSize} onChange={(e) => setTileSize(e.target.value)}>
            {SIZE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-desc font-bold text-foreground">
          وجهة الضغط
          <select className={SELECT} style={{ minHeight: 44 }} value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">الوجهة الافتراضية</option>
            {(lib.data?.routes ?? []).map((item) => (
              <option key={item.path} value={item.path}>
                {item.label_ar}
              </option>
            ))}
          </select>
        </label>
      </div>

      {slot.edit_kind === "ad" ? (
        <label className="block text-desc font-bold text-foreground">
          بطاقة من «تصاميمي»
          <select className={SELECT} style={{ minHeight: 44 }} value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="">بلا بطاقة جاهزة</option>
            {(templates.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name_ar} — {item.kind === "offer" ? "عرض" : "ترويج"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          onSave(
            {
              shape_key: shape || null,
              shape_color: shape ? shapeColor : null,
              shape_opacity: shape ? Math.round(opacity) : null,
              shape_size: shapeSize,
              shape_pos: shapePos,
              motion_key: animated ? motion || null : null,
              motion_state: animated && motion ? "animated" : "static",
              motion_speed: speed,
              tile_size: tileSize,
              link_path: link || null,
              ...(slot.edit_kind === "ad" ? { template_id: template || null } : {}),
            },
            "تصميم الفتحة محفوظ كمسوّدة — اضغط «نشر التغيير» لإظهاره.",
          )
        }
      >
        حفظ التصميم كمسوّدة
      </Button>
    </div>
  );
}
