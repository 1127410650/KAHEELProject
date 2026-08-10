import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";
import { CATEGORY_IMAGE_SIZE, categoryImage } from "@/lib/market-category-images";
import { useMarqueeRail } from "@/components/marketplace/home/useMarqueeRail";

/**
 * Two circular tile rows that drift in opposite directions: the top row travels
 * to the right, the bottom row to the left. Each row is its own marquee track
 * that renders its field list twice and moves with `translate3d`, wrapping at
 * exactly one group width, so the loop never shows a seam or a jump.
 *
 * Tiles are round with the label underneath on up to two wrapped lines — never
 * truncated — and each row fades out at both edges instead of being cut.
 */
const STRIP_FIELDS = PRIMARY_FIELDS.filter((field) => field.kind === "field");

/** Alternating split keeps both rows equal in length and visually varied. */
const TOP_ROW = STRIP_FIELDS.filter((_, index) => index % 2 === 0);
const BOTTOM_ROW = STRIP_FIELDS.filter((_, index) => index % 2 === 1);

/** Slow and calm: a full tile every few seconds, not a spinning carousel. */
const ROW_SPEED = 16;

type Field = (typeof STRIP_FIELDS)[number];

export function MarketCategoryStrip() {
  const { t } = useI18n();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string | undefined>,
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = { category: search["category"], sub: search["sub"] };
  const kept: Record<string, string> = {};

  for (const key of ["cityId", "sort", "img", "min", "max"]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept[key] = value;
  }

  return (
    <div className="relative w-full overflow-hidden bg-transparent text-foreground">


      <nav
        aria-label={t("market.home.strip.label")}
        className="mx-auto flex w-full max-w-[1320px] flex-col gap-1 pb-1.5 pt-1.5"
      >
        <StripRow fields={TOP_ROW} direction={-1} pathname={pathname} current={current} kept={kept} />
        <StripRow fields={BOTTOM_ROW} direction={1} pathname={pathname} current={current} kept={kept} />
      </nav>
    </div>
  );
}

function StripRow({
  fields,
  direction,
  pathname,
  current,
  kept,
}: {
  fields: Field[];
  /** -1 drifts the row to the right, 1 drifts it to the left. */
  direction: -1 | 1;
  pathname: string;
  current: { category: string | undefined; sub: string | undefined };
  kept: Record<string, string>;
}) {
  const { trackRef, interactionProps } = useMarqueeRail<HTMLDivElement>(direction, ROW_SPEED);

  return (
    <div
      dir="ltr"
      className="w-full overflow-hidden touch-pan-y select-none [mask-image:linear-gradient(to_right,transparent,black_56px,black_calc(100%-56px),transparent)]"
    >
      <div
        ref={trackRef}
        {...interactionProps}
        className="flex w-max items-start will-change-transform"
      >
        {[0, 1].map((groupIndex) => (
          <div key={groupIndex} className="flex shrink-0 items-start">
            {fields.map((field) => (
              <StripTile
                key={`${field.id}-${groupIndex}`}
                field={field}
                copy={groupIndex > 0}
                pathname={pathname}
                current={current}
                kept={kept}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StripTile({
  field,
  copy,
  pathname,
  current,
  kept,
}: {
  field: Field;
  copy: boolean;
  pathname: string;
  current: { category: string | undefined; sub: string | undefined };
  kept: Record<string, string>;
}) {
  const { t, locale, dir } = useI18n();
  const label = t(`market.fields.${field.id}`);
  const photo = categoryImage(field.id);
  const active =
    field.id === "services"
      ? pathname === "/services" || pathname.startsWith("/services/")
      : isFieldActive(field, current);

  // Every tile reserves the same box — round photo plus a two-line label slot —
  // so decoding images and longer names can never nudge a neighbour.
  const tileClass =
    "group flex w-[64px] shrink-0 flex-col items-center gap-[3px] px-1 text-center outline-none sm:w-[72px] lg:w-[78px]";
  const frameClass =
    "grid size-[44px] place-items-center overflow-hidden rounded-full border-2 transition duration-300 sm:size-[50px] lg:size-[54px]";
  const idleFrame =
    "border-border bg-background shadow-panel group-hover:-translate-y-0.5";
  const activeFrame = "border-primary bg-accent shadow-panel";


  const body = (
    <>
      <span className={`${frameClass} ${active ? activeFrame : idleFrame}`}>
        {photo ? (
          <img
            src={photo}
            alt=""
            width={CATEGORY_IMAGE_SIZE}
            height={CATEGORY_IMAGE_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full rounded-full object-cover"
            style={{ aspectRatio: "1 / 1" }}
          />
        ) : (
          <LayoutGrid className="size-5 text-market-blue" aria-hidden />
        )}
      </span>
      {/* Full name, wrapped over at most two lines — never clipped. */}
      <span
        dir={dir}
        className={`flex min-h-[24px] w-full items-start justify-center whitespace-normal break-words text-desc font-black leading-[1.2] sm:text-desc ${
          active ? "text-primary" : "text-foreground"
        }`}

      >
        {label}
      </span>
    </>
  );

  const accessibility = copy ? ({ "aria-hidden": true, tabIndex: -1 } as const) : {};

  if (field.id === "services") {
    return (
      <Link
        to="/services"
        aria-current={active ? "page" : undefined}
        className={tileClass}
        lang={locale}
        {...accessibility}
      >
        {body}
      </Link>
    );
  }

  return (
    <Link
      to="/search"
      search={{ ...kept, ...fieldSearchParams(field) }}
      aria-current={active ? "page" : undefined}
      className={tileClass}
      lang={locale}
      {...accessibility}
    >
      {body}
    </Link>
  );
}
