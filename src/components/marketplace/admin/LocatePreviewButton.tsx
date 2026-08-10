/**
 * زر «معاينة المكان» — يفتح الصفحة الحقيقية داخل إطار بعرض الجوال، مُمرَّرة
 * تلقائيًا إلى الكتلة أو الفتحة المطلوبة مع إطار نابض حولها.
 *
 * لا تعديل هنا: الغرض أن يرى المدير أين يقع العنصر قبل أن يفتح لوحة التحرير.
 * التمييز نفسه ينفّذه `FocusHighlightLayer` داخل الصفحة عبر `?kfocus=`.
 */
import { useState } from "react";
import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type LocateTarget =
  | { kind: "block"; id: string; page: string }
  | { kind: "slot"; slotKey: string; page?: string };

/** مسار المعاينة لكل صفحة يديرها المؤلّف. */
export function composerPagePath(page: string): string {
  if (page === "aqar.home") return "/aqar";
  if (page === "category.world") return "/c/real-estate";
  return "/";
}

/** الصفحة التي تظهر فيها الفتحة، مستنبطة من مفتاحها. */
export function slotPagePath(slotKey: string): string {
  if (slotKey.startsWith("aqar.")) return "/aqar";
  if (slotKey.startsWith("world.")) {
    const slug = slotKey.split(".")[1];
    return slug ? `/c/${slug}` : "/";
  }
  return "/";
}

function targetUrl(target: LocateTarget): string {
  if (target.kind === "block") {
    return `${composerPagePath(target.page)}?kfocus=block:${encodeURIComponent(target.id)}`;
  }
  const path = target.page ?? slotPagePath(target.slotKey);
  return `${path}?kfocus=slot:${encodeURIComponent(target.slotKey)}`;
}

export function LocatePreviewButton({
  target,
  label = "معاينة المكان",
}: {
  target: LocateTarget;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = targetUrl(target);

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 gap-2"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-4" /> : <Eye className="size-4" />}
        <span>{open ? "إغلاق المعاينة" : label}</span>
      </Button>

      {open ? (
        <div className="mt-[var(--sp-3)] rounded-[var(--r-card)] border bg-muted/40 p-[var(--sp-3)]">
          <p className="mb-[var(--sp-2)] text-desc text-muted-foreground">
            الصفحة الحقيقية بعرض الجوال — العنصر المطلوب مُحدَّد بإطار نابض.
          </p>
          <div className="flex justify-center">
            <iframe
              key={url}
              src={url}
              title="معاينة مكان العنصر"
              loading="lazy"
              className="h-[560px] w-[390px] max-w-full rounded-[12px] border bg-background"
            />
          </div>
          <div className="mt-[var(--sp-2)] flex justify-end">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-desc font-semibold text-primary underline"
            >
              فتح في تبويب جديد
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
