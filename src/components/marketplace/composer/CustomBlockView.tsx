/**
 * الكتلة المخصصة على الواجهة العامة — صورة التصميم المصدّرة + طبقة روابط شفافة.
 *
 * النسبة محجوزة من اللوح ⇒ صفر هزّة تخطيط. كل منطقة نقر مستطيل بنِسَب مئوية،
 * فتبقى في موضعها الصحيح على أي عرض شاشة، وهدف اللمس ≥44px بحكم حد المقاس.
 */
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { artboard } from "@/lib/mkt-canvas";
import { isExternalHref, useCustomBlocks, type BlockZone } from "@/lib/mkt-custom-blocks";

function ZoneLink({ zone }: { zone: BlockZone }) {
  const style = {
    position: "absolute" as const,
    insetInlineStart: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.w}%`,
    height: `${zone.h}%`,
  };

  if (isExternalHref(zone.href)) {
    return (
      <a
        href={zone.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={zone.label}
        style={style}
        className="grid place-items-end rounded-[10px] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowUpRight aria-hidden className="size-4 text-primary-foreground opacity-80" />
      </a>
    );
  }

  return (
    <Link
      to={zone.href}
      aria-label={zone.label}
      style={style}
      className="block rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    />
  );
}

export function CustomBlockView({ blockId, alt }: { blockId: string; alt?: string }) {
  const blocks = useCustomBlocks();
  const block = blocks.data?.find((b) => b.id === blockId);
  const board = artboard(block?.ratio ?? "16/5");

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--r-card)] border border-border bg-card"
      style={{ aspectRatio: `${board.w} / ${board.h}` }}
    >
      {block?.previewUrl ? (
        <img
          src={block.previewUrl}
          alt={alt || block.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : null}
      {(block?.zones ?? []).map((zone) => (
        <ZoneLink key={zone.id} zone={zone} />
      ))}
    </div>
  );
}
