/**
 * عارض كتل الصفحة — يحوّل صفوف `mkt_page_blocks` إلى أقسام حقيقية.
 *
 * الكتل التي لا تحتاج بيانات الصفحة تُركَّب هنا مباشرة، والكتل الخاصة بصفحة
 * معيّنة (بطاقات الأنواع، المدن) تُمرَّر عبر `overrides` من الصفحة نفسها كي لا
 * تُنسخ خطوط بياناتها في مكانين.
 *
 * صفر هزّة تخطيط: كل صورة بنسبة أبعاد ثابتة، وكل قسم متأخر داخل `LazyMount`
 * بارتفاع محجوز، والصفوف تُركَّب بعد جهوز استعلامها الواحد.
 */
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { CampaignMosaic } from "@/components/marketplace/home/noon/CampaignMosaic";
import { CategoryRail, useHomeRails } from "@/components/marketplace/home/noon/CategoryRail";
import { CategoryTileGrid } from "@/components/marketplace/home/noon/CategoryTileGrid";
import { BigSearchField } from "@/components/marketplace/home/noon/BigSearchField";
import { LazyMount } from "@/components/marketplace/home/noon/NoonKit";
import { SponsoredBanner } from "@/components/marketplace/home/noon/SponsoredBanner";
import { QuickTiles } from "@/components/marketplace/home/noon/QuickTiles";
import { SyriaPrideStrip } from "@/components/marketplace/home/noon/SyriaPrideStrip";
import { ExclusiveOffersRail } from "@/components/marketplace/season/ExclusiveOffersRail";
import { useDesignLibrary } from "@/lib/mkt-design-library";
import { shapeDataUri } from "@/lib/mkt-design-library";
import { slotAlt, slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";
import type { ListingFilters } from "@/lib/mkt-queries";
import {
  bool,
  blockLink,
  num,
  str,
  type BlockSettings,
  type BlockType,
  type PageBlock,
} from "@/lib/mkt-page-composer";
import { cn } from "@/lib/utils";

/** كتل تُركّبها الصفحة بنفسها لأنها تحتاج بياناتها الخاصة. */
export type BlockOverrides = Partial<Record<BlockType, (block: PageBlock) => ReactNode>>;

const RATIO_CLASS: Record<string, string> = {
  "16/9": "aspect-[16/9]",
  "16/8": "aspect-[16/8]",
  "4/3": "aspect-[4/3]",
};

const HERO_HEIGHT: Record<string, string> = {
  sm: "min-h-[120px]",
  md: "min-h-[168px]",
  lg: "min-h-[220px]",
};

const SPACER_HEIGHT: Record<string, string> = {
  sm: "h-3",
  md: "h-6",
  lg: "h-10",
};

const TONE_CLASS: Record<string, string> = {
  brand: "bg-primary text-primary-foreground",
  gold: "bg-gold text-gold-foreground",
  muted: "bg-muted text-muted-foreground",
  surface: "bg-card text-card-foreground border border-border",
};

const ANCHOR_CLASS: Record<string, string> = {
  "top-start": "top-0 start-0",
  "top-center": "top-0 start-1/2 -translate-x-1/2",
  "top-end": "top-0 end-0",
  "middle-start": "top-1/2 start-0 -translate-y-1/2",
  "middle-center": "top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2",
  "middle-end": "top-1/2 end-0 -translate-y-1/2",
  "bottom-start": "bottom-0 start-0",
  "bottom-center": "bottom-0 start-1/2 -translate-x-1/2",
  "bottom-end": "bottom-0 end-0",
};

const SHAPE_TONE_HEX: Record<string, string> = {
  brand: "#8a4fff",
  gold: "#f59e0b",
  surface: "#94a3b8",
};

/** رابط الكتلة: داخلي عبر الراوتر، وخارجي بأيقونة خروج واضحة. */
function BlockLinkWrap({
  settings,
  className,
  children,
}: {
  settings: BlockSettings;
  className?: string;
  children: ReactNode;
}) {
  const link = blockLink(settings);
  if (!link) return <div className={className}>{children}</div>;
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn("relative block", className)}
      >
        {children}
        <ArrowUpRight aria-hidden className="absolute end-2 top-2 size-4 opacity-70" />
      </a>
    );
  }
  return (
    <Link to={link.href} className={cn("block", className)}>
      {children}
    </Link>
  );
}

function SectionTitle({ title }: { title: string }) {
  if (!title) return null;
  return <h2 className="mb-3 text-xl font-extrabold text-foreground">{title}</h2>;
}

function HeroImageBlock({ settings }: { settings: BlockSettings }) {
  const slots = useMediaSlots();
  const slotKey = str(settings, "slot_key");
  const url = slotKey ? slotUrl(slots.data, slotKey, "") : "";
  const ratio = RATIO_CLASS[str(settings, "ratio", "16/9")] ?? RATIO_CLASS["16/9"]!;
  const title = str(settings, "title_ar");
  const subtitle = str(settings, "subtitle_ar");

  return (
    <BlockLinkWrap settings={settings}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--r-card)] bg-muted",
          ratio,
          bool(settings, "overlap_header", false) && "-mt-8 shadow-lg",
        )}
      >
        {url ? (
          <img
            src={url}
            alt={slotAlt(slots.data, slotKey, title || "كَحيل")}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-primary to-primary/40" />
        )}
        {(title || subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            {title && <p className="text-lg font-extrabold text-white">{title}</p>}
            {subtitle && <p className="mt-1 text-sm text-white/85">{subtitle}</p>}
          </div>
        )}
      </div>
    </BlockLinkWrap>
  );
}

function HeroGradientBlock({ settings }: { settings: BlockSettings }) {
  const height = HERO_HEIGHT[str(settings, "height", "md")] ?? HERO_HEIGHT["md"]!;
  return (
    <BlockLinkWrap settings={settings}>
      <div
        className={cn(
          "flex flex-col justify-center gap-2 rounded-[var(--r-card)] bg-gradient-to-l from-primary to-primary/70 px-5 py-6",
          height,
        )}
      >
        <p className="text-xl font-extrabold text-primary-foreground">
          {str(settings, "title_ar", "كَحيل")}
        </p>
        {str(settings, "subtitle_ar") && (
          <p className="text-sm text-primary-foreground/85">{str(settings, "subtitle_ar")}</p>
        )}
      </div>
    </BlockLinkWrap>
  );
}

function TextStripBlock({ settings }: { settings: BlockSettings }) {
  const tone = TONE_CLASS[str(settings, "tone", "brand")] ?? TONE_CLASS["brand"]!;
  const text = str(settings, "text_ar");
  if (!text) return null;
  return (
    <BlockLinkWrap settings={settings}>
      <p className={cn("rounded-[var(--r-card)] px-4 py-3 text-center text-base font-bold", tone)}>{text}</p>
    </BlockLinkWrap>
  );
}

function LinkTileBlock({ settings }: { settings: BlockSettings }) {
  const tone = TONE_CLASS[str(settings, "tone", "brand")] ?? TONE_CLASS["brand"]!;
  return (
    <BlockLinkWrap settings={settings}>
      <div className={cn("flex min-h-[56px] flex-col justify-center rounded-[var(--r-card)] px-4 py-3", tone)}>
        <span className="text-base font-extrabold">{str(settings, "title_ar", "اكتشف")}</span>
        {str(settings, "subtitle_ar") && (
          <span className="mt-0.5 text-sm opacity-85">{str(settings, "subtitle_ar")}</span>
        )}
      </div>
    </BlockLinkWrap>
  );
}

function SpacerBlock({ settings }: { settings: BlockSettings }) {
  const height = SPACER_HEIGHT[str(settings, "size", "md")] ?? SPACER_HEIGHT["md"]!;
  return (
    <div className={cn("w-full", height)} aria-hidden>
      {bool(settings, "divider") && <hr className="mt-[inherit] border-border" />}
    </div>
  );
}

function ShapeLayerBlock({ settings }: { settings: BlockSettings }) {
  const lib = useDesignLibrary();
  const shape = lib.data?.shapes.find((s) => s.key === str(settings, "shape_key"));
  if (!shape) return null;
  const tone = SHAPE_TONE_HEX[str(settings, "tone", "brand")] ?? SHAPE_TONE_HEX["brand"]!;
  const uri = shapeDataUri(shape, tone, num(settings, "opacity", 12));
  if (!uri) return null;
  const scale = Math.min(200, Math.max(25, num(settings, "scale", 100)));
  const anchor = ANCHOR_CLASS[str(settings, "anchor", "top-end")] ?? ANCHOR_CLASS["top-end"]!;

  /* الطبقة زخرفية بحتة: بلا تدفّق، بلا لمس، ولا تحجب أي محتوى. */
  return (
    <div className="pointer-events-none relative h-0" aria-hidden>
      <div
        className={cn("absolute size-40", anchor)}
        style={{
          backgroundImage: uri,
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          transform: `rotate(${Math.round(num(settings, "rotation", 0))}deg) scale(${scale / 100})`,
        }}
      />
    </div>
  );
}

function SponsoredBlock({ settings }: { settings: BlockSettings }) {
  /* البانر الممول القائم يقرأ فتحته وحده؛ العنوان ووسم «ممول» جزء منه. */
  void settings;
  return (
    <LazyMount minHeight="150px">
      <SponsoredBanner />
    </LazyMount>
  );
}

/** مرشّح الصف من إعداداته — نفس مفردات `loadListings`. */
function railFilters(settings: BlockSettings): ListingFilters {
  const source = str(settings, "source", "newest");
  const limit = Math.min(20, Math.max(4, num(settings, "limit", 10)));
  const base: ListingFilters = { limit } as ListingFilters;
  if (source === "featured") return { ...base, featuredOnly: true } as ListingFilters;
  if (source === "category") {
    return { ...base, categorySlug: str(settings, "category_slug") } as ListingFilters;
  }
  return { ...base, sort: "newest" } as ListingFilters;
}

export interface PageBlocksProps {
  blocks: PageBlock[];
  overrides?: BlockOverrides;
  className?: string;
}

/**
 * يعرض قائمة الكتل بالترتيب. الصفوف كلها في استعلام واحد (`useHomeRails`) فلا
 * يظهر صف ثم يختفي، والكتل غير المعروفة تُتجاهل بصمت — توسيع المكتبة لاحقًا لا
 * يكسر صفحة منشورة.
 */
export function PageBlocks({ blocks, overrides, className }: PageBlocksProps) {
  const railBlocks = blocks.filter((b) => b.block_type === "listing_rail");
  const railSpecs = railBlocks.map((b) => ({
    id: b.id,
    href: blockLink(b.settings)?.href ?? "/search",
    filters: railFilters(b.settings),
  }));
  const rails = useHomeRails(railSpecs);

  return (
    <div className={cn("space-y-5 sm:space-y-7", className)}>
      {blocks.map((block) => {
        const override = overrides?.[block.block_type];
        if (override) return <div key={block.id}>{override(block)}</div>;
        const { settings } = block;

        switch (block.block_type) {
          case "hero_image":
            return <HeroImageBlock key={block.id} settings={settings} />;
          case "hero_gradient":
            return <HeroGradientBlock key={block.id} settings={settings} />;
          case "search_field":
            return (
              <div key={block.id}>
                <BigSearchField />
              </div>
            );
          case "text_strip":
            return <TextStripBlock key={block.id} settings={settings} />;
          case "campaign_mosaic":
            return <CampaignMosaic key={block.id} />;
          case "sponsored_banner":
            return <SponsoredBlock key={block.id} settings={settings} />;
          case "category_grid":
            return (
              <div key={block.id}>
                <SectionTitle title={str(settings, "title_ar")} />
                <LazyMount minHeight="380px">
                  <CategoryTileGrid />
                </LazyMount>
              </div>
            );
          case "listing_rail":
            return rails.isPending ? null : (
              <CategoryRail
                key={block.id}
                id={block.id}
                title={str(settings, "title_ar", "إعلانات")}
                href={blockLink(settings)?.href ?? "/search"}
                rows={rails.data?.[block.id] ?? []}
              />
            );
          case "link_tile":
            return <LinkTileBlock key={block.id} settings={settings} />;
          case "spacer":
            return <SpacerBlock key={block.id} settings={settings} />;
          case "shape_layer":
            return <ShapeLayerBlock key={block.id} settings={settings} />;
          case "quick_tiles":
            return <QuickTiles key={block.id} />;
          case "pride_strip":
            return <SyriaPrideStrip key={block.id} />;
          case "exclusive_offers":
            return (
              <LazyMount key={block.id} minHeight="220px">
                <ExclusiveOffersRail />
              </LazyMount>
            );
          default:
            /* نوع لا تعرفه هذه النسخة من الواجهة — يُتجاهل بلا خطأ. */
            return null;
        }
      })}
    </div>
  );
}
