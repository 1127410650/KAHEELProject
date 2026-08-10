/**
 * لوح الرسم — العارض المشترك بين المحرّر والمعاينة.
 *
 * كل عنصر مربّع مطلق بنِسَب مئوية من اللوح، والنص يُقاس بـ `cqw` فيكبر ويصغر مع
 * عرض اللوح بلا أي حساب في جافاسكربت. النسبة محجوزة دائمًا ⇒ صفر هزّة تخطيط.
 */
import type { CSSProperties } from "react";

import {
  TEXT_REF_WIDTH,
  artboard,
  colorCss,
  type CanvasElement,
} from "@/lib/mkt-canvas";
import { shapeDataUri, type DesignShape } from "@/lib/mkt-design-library";
import { mascotAsset } from "@/lib/mascot-assets";

export function elementBoxStyle(element: CanvasElement): CSSProperties {
  return {
    position: "absolute",
    insetInlineStart: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.w}%`,
    height: `${element.h}%`,
    transform: `rotate(${element.rot}deg)`,
  };
}

function ElementView({
  element,
  shapes,
  slotUrls,
}: {
  element: CanvasElement;
  shapes: DesignShape[];
  slotUrls: Record<string, string>;
}) {
  if (element.kind === "text") {
    return (
      <span
        className="flex h-full w-full items-center leading-tight"
        style={{
          justifyContent:
            element.align === "center" ? "center" : element.align === "start" ? "flex-start" : "flex-end",
          fontSize: `${(element.size / TEXT_REF_WIDTH) * 100}cqw`,
          fontWeight: element.weight,
          color: colorCss(element.color),
          textAlign: element.align,
        }}
      >
        {element.text}
      </span>
    );
  }

  if (element.kind === "shape") {
    const shape = shapes.find((s) => s.key === element.shape_key);
    const image = shape ? shapeDataUri(shape, "#000000", 100) : null;
    if (!image) return null;
    return (
      <span
        aria-hidden
        className="block h-full w-full"
        style={{
          backgroundColor: colorCss(element.color),
          opacity: element.opacity / 100,
          maskImage: image,
          WebkitMaskImage: image,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      />
    );
  }

  if (element.kind === "image") {
    const url = slotUrls[element.slot_key];
    if (!url) {
      return (
        <span className="grid h-full w-full place-items-center rounded-[8px] border border-dashed border-border bg-secondary/60 text-[12px] text-muted-foreground">
          {element.slot_key}
        </span>
      );
    }
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full"
        style={{ objectFit: element.fit, borderRadius: `${element.radius}%` }}
      />
    );
  }

  const asset = mascotAsset(element.name, "full");
  return (
    <img
      src={asset.src}
      alt=""
      loading="lazy"
      className="h-full w-full object-contain"
      style={element.flip ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

export function CanvasArtboard({
  ratio,
  elements,
  shapes,
  slotUrls,
  className = "",
  children,
}: {
  ratio: string;
  elements: CanvasElement[];
  shapes: DesignShape[];
  slotUrls: Record<string, string>;
  className?: string;
  /** طبقة المحرّر (مقابض، مناطق نقر) فوق العناصر. */
  children?: React.ReactNode;
}) {
  const board = artboard(ratio);
  return (
    <div
      className={
        "relative w-full overflow-hidden rounded-[var(--r-card)] border border-border bg-card " + className
      }
      style={{ aspectRatio: `${board.w} / ${board.h}`, containerType: "inline-size" }}
    >
      {elements.filter((element) => !element.hidden).map((element) => (
        <div key={element.id} style={elementBoxStyle(element)}>
          <ElementView element={element} shapes={shapes} slotUrls={slotUrls} />
        </div>
      ))}
      {children}
    </div>
  );
}
