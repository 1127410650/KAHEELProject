import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";
import { CATEGORY_IMAGE_SIZE, categoryImage } from "@/lib/market-category-images";
import { useMarqueeRail } from "@/components/marketplace/home/useMarqueeRail";

/**
 * Two stacked rows of photo tiles that drift as one marquee. The track renders
 * the field list twice and moves with a GPU-composited transform, so the motion
 * is perfectly smooth and touch can drag or pause it.
 */
/**
 * The rail carries real fields only: the "home" and "more" tiles were removed
 * because the header and the bottom bar already own those destinations.
 */
const STRIP_FIELDS = PRIMARY_FIELDS.filter((field) => field.kind === "field");

export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const { trackRef, interactionProps } = useMarqueeRail<HTMLDivElement>(1, 20);
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

  // Every tile reserves the same box: a square photo plus two label lines, so
  // no photo or label length can move a neighbour while images decode.
  const tileClass =
    "group flex w-[68px] shrink-0 flex-col items-center gap-1 text-center outline-none sm:w-[76px] lg:w-[82px]";
  const frameClass =
    "grid size-[56px] place-items-center overflow-hidden rounded-[18px] border transition duration-300 sm:size-[62px] lg:size-[66px]";
  const idleFrame =
    "border-white/70 bg-white shadow-[0_6px_16px_rgb(36_0_70/0.26),inset_0_1px_0_rgb(255_255_255/0.9)] group-hover:-translate-y-0.5";
  const activeFrame =
    "border-white bg-[linear-gradient(145deg,#9d4edd,#5a189a)] shadow-[0_8px_22px_rgb(60_9_108/0.4),inset_0_1px_0_rgb(255_255_255/0.3)]";
  const labelClass =
    "line-clamp-2 h-[24px] w-full overflow-hidden text-[9px] font-black leading-[1.2] text-market-navy-foreground/95 sm:h-[26px] sm:text-[10px]";

  const renderTile = (field: (typeof STRIP_FIELDS)[number], groupIndex: number) => {
    const label = t(`market.fields.${field.id}`);
    const key = `${field.id}-${groupIndex}`;
    const photo = categoryImage(field.id);
    // Only the first group is real content; the copy exists for the loop.
    const accessibilityProps =
      groupIndex === 0 ? {} : ({ "aria-hidden": true, tabIndex: -1 } as const);

    const frame = (on: boolean) => (
      <span className={`${frameClass} ${on ? activeFrame : idleFrame}`}>
        {photo ? (
          <img
            src={photo}
            alt=""
            width={CATEGORY_IMAGE_SIZE}
            height={CATEGORY_IMAGE_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
            style={{ aspectRatio: "1 / 1" }}
          />
        ) : field.kind === "home" ? (
          <Home className="size-5 text-market-blue" aria-hidden />
        ) : (
          <LayoutGrid className="size-5 text-market-blue" aria-hidden />
        )}
      </span>
    );

    const body = (on: boolean) => (
      <>
        {frame(on)}
        <span className={labelClass} dir={dir}>
          {label}
        </span>
      </>
    );

    if (field.kind === "home" || field.kind === "more") {
      return (
        <Link
          key={key}
          to={field.kind === "home" ? "/" : "/more"}
          className={tileClass}
          lang={locale}
          {...accessibilityProps}
        >
          {body(false)}
        </Link>
      );
    }

    // Services have a real booking marketplace, not only classified ads.
    if (field.id === "services") {
      const on = pathname === "/services" || pathname.startsWith("/services/");
      return (
        <Link
          key={key}
          to="/services"
          aria-current={on ? "page" : undefined}
          className={tileClass}
          lang={locale}
          {...accessibilityProps}
        >
          {body(on)}
        </Link>
      );
    }

    const on = isFieldActive(field, current);
    return (
      <Link
        key={key}
        to="/search"
        search={{ ...kept, ...fieldSearchParams(field) }}
        aria-current={on ? "page" : undefined}
        className={tileClass}
        lang={locale}
        {...accessibilityProps}
      >
        {body(on)}
      </Link>
    );
  };

  return (
    <div className="relative w-full overflow-hidden border-t border-white/14 bg-[radial-gradient(circle_at_18%_-45%,rgb(224_170_255/0.42),transparent_39%),linear-gradient(105deg,#10002b_0%,#3c096c_52%,#7b2cbf_135%)] text-market-navy-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />

      <div className="mx-auto w-full max-w-[1320px] px-0 pb-2.5 pt-2">
        <nav
          dir="ltr"
          aria-label={t("market.home.strip.label")}
          className="w-full overflow-hidden px-2 touch-pan-y select-none sm:px-3 lg:px-5"
        >
          <div
            ref={trackRef}
            {...interactionProps}
            className="flex w-max items-start gap-2 will-change-transform sm:gap-2.5"
          >
            {[0, 1].map((groupIndex) => (
              <div
                key={groupIndex}
                className="grid shrink-0 grid-flow-col grid-rows-2 gap-2 sm:gap-2.5"
              >
                {STRIP_FIELDS.map((field) => renderTile(field, groupIndex))}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
