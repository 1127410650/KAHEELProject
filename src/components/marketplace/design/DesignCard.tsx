/**
 * بطاقة تصميم مبنية من اللوحة (عرض أو ترويج).
 *
 * كل ما تعرضه البطاقة يأتي من قالب في «تصاميمي»: نص وعنوان ونسبة خصم وخلفية
 * (لون أو تدرّج أو صورة) وشكل زخرفي وحركة ووجهة. لا HTML ولا CSS حر: الألوان
 * سُداسية مفحوصة، والشكل مسار SVG من المكتبة، والحركة اسم keyframes مسمّى، ومن
 * فعّل «تقليل الحركة» يراها ثابتة (`.k-slot-anim` في صفحة الأنماط).
 */
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import {
  decorStyle,
  motionStyle,
  surfaceStyle,
  type DesignLibrary,
  type DesignTemplate,
} from "@/lib/mkt-design-library";

interface DesignCardProps {
  template: DesignTemplate;
  library: DesignLibrary | undefined;
  /** رابط الصورة الموقّع إن كانت خلفية القالب صورة. */
  imageUrl?: string | null;
  /** `promo` عريض منخفض، و`offer` بطاقة مربّعة. */
  className?: string;
}

export function DesignCard({ template, library, imageUrl, className }: DesignCardProps) {
  const shapes = library?.shapes ?? [];
  const motions = library?.motions ?? [];
  const decor = decorStyle(template, shapes);
  const promo = template.kind === "promo";

  const surface: CSSProperties = {
    ...surfaceStyle(template),
    ...motionStyle(template, motions),
  };
  if (imageUrl) {
    surface.backgroundImage = `linear-gradient(0deg, rgb(0 0 0 / 45%), rgb(0 0 0 / 15%)), url("${imageUrl}")`;
    surface.backgroundSize = "cover";
    surface.backgroundPosition = "center";
  }

  // التخطيط من ثلاث قيم مسجّلة فقط — مواضع محددة مسبقًا بلا أنماط حرة.
  const layout =
    template.layout_key === "centered"
      ? "items-center justify-center text-center"
      : template.layout_key === "split"
        ? "flex-row items-center justify-between gap-3"
        : "flex-col justify-between gap-2";

  const body: ReactNode = (
    <div
      className={`k-slot-anim relative isolate flex min-w-0 overflow-hidden rounded-2xl ring-1 ring-border ${
        promo
          ? "min-h-[104px] flex-row items-center justify-between gap-3 px-4 py-3"
          : `min-h-[132px] p-3 ${layout}`
      } ${className ?? ""}`}
      style={surface}
    >
      {decor ? <span aria-hidden className="absolute inset-0 -z-10" style={decor} /> : null}
      <div className="min-w-0">
        {template.title_ar ? (
          <p className="truncate text-title font-black text-white drop-shadow-[0_1px_3px_rgb(0_0_0/45%)]">
            {template.title_ar}
          </p>
        ) : null}
        {template.body_ar ? (
          <p className="mt-1 line-clamp-2 text-desc font-bold text-white/90">{template.body_ar}</p>
        ) : null}
      </div>
      {template.discount_pct != null ? (
        <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-gold px-2.5 py-1 text-desc font-black text-gold-foreground">
          {template.discount_pct}%
          <span className="font-bold">خصم</span>
        </span>
      ) : null}
      {template.brand_stamp ? (
        <span className="pointer-events-none absolute bottom-1.5 left-2 rounded-full bg-black/35 px-2 py-0.5 text-nav font-black text-white/95">
          كَحيل · KAHEEL
        </span>
      ) : null}
    </div>
  );


  if (!template.link_path) return body;
  return (
    <Link to={template.link_path} className="block min-w-0 outline-none">
      {body}
    </Link>
  );
}
