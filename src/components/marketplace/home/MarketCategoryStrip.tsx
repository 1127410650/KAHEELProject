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
    <div className="relative w-full overflow-hidden border-t border-white/14 bg-[radial-gradient(circle_at_18%_-45%,rgb(224_170_255/0.42),transparent_39%),linear-gradient(105deg,#10002b_0%,#3c096c_52%,#7b2cbf_135%)] text-market-navy-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />

      <nav
        aria-label={t("market.home.strip.label")}
        className="mx-auto flex w-full max-w-[1320px] flex-col gap-1.5 pb-2.5 pt-2"
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
      className="w-full overflow-hidden touch-pan-y select-none [mask-image:linear-gradient(to_right,transparent,black_36px,black_calc(100%-36px),transparent)]"
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
    "group flex w-[78px] shrink-0 flex-col items-center gap-1 px-1 text-center outline-none sm:w-[86px] lg:w-[92px]";
  const frameClass =
    "grid size-[58px] place-items-center overflow-hidden rounded-full border-2 transition duration-300 sm:size-[64px] lg:size-[68px]";
  const idleFrame =
    "border-white/75 bg-white shadow-[0_6px_16px_rgb(36_0_70/0.28),inset_0_1px_0_rgb(255_255_255/0.9)] group-hover:-translate-y-0.5";
  const activeFrame =
    "border-white bg-[linear-gradient(145deg,#9d4edd,#5a189a)] shadow-[0_8px_22px_rgb(60_9_108/0.42)]";

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
        className="flex min-h-[26px] w-full items-start justify-center whitespace-normal break-words text-[10px] font-black leading-[1.25] text-market-navy-foreground/95 sm:text-[11px]"
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
