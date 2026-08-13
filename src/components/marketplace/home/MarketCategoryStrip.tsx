import { Link, useRouterState } from "@tanstack/react-router";
import {
  Armchair,
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  Hammer,
  LayoutGrid,
  Leaf,
  Palette,
  PartyPopper,
  Search as SearchIcon,
  Shirt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";

/** أيقونات SVG خطية موحّدة الأسلوب لكل مجال — بديل الصور المولّدة. */
const FIELD_ICONS: Record<string, typeof LayoutGrid> = {
  realestate: Building2,
  cars: Car,
  devices: Smartphone,
  restaurants: UtensilsCrossed,
  furniture: Armchair,
  services: Hammer,
  fashion: Shirt,
  jobs: Briefcase,
  training: GraduationCap,
  schools: GraduationCap,
  events: PartyPopper,
  programming: Sparkles,
  gardens: Leaf,
  arts: Palette,
  lostfound: SearchIcon,
};
import { mascotAsset } from "@/lib/mascot-assets";
import { useMarqueeRail } from "@/components/marketplace/home/useMarqueeRail";

/**
 * صف واحد من دوائر التصنيفات يسير بلا نهاية، وخلفه كَحيل وكحيلان يمشيان
 * مشيًا مضحكًا على خط الشريط.
 *
 * • صف واحد فقط: دوائر 72px بحلقة بيضاء 2px وظل خفيف، والاسم كاملًا تحتها
 *   بمقاس 14px على سطرين كحد أقصى — لا قطع ولا حروف مكسورة.
 * • المسار يعرض القائمة مرّتين ويتحرّك بـ `translate3d` فيلتف عند نصف عرضه
 *   بالضبط ⇒ لا خيط ولا قفزة، ويتوقّف باللمس ويرجع بعد الإفلات.
 * • الشخصيتان طبقة تحت الدوائر (`z-0` مقابل `z-10`) و`pointer-events-none`،
 *   فلا تحجبان أي رابط، وتختفيان تحت `prefers-reduced-motion`.
 * • ارتفاع القسم محجوز (112px) فلا هزّة تخطيط.
 */
const STRIP_FIELDS = PRIMARY_FIELDS.filter((field) => field.kind === "field");

/** Slow and calm: a full tile every few seconds, not a spinning carousel. */
const ROW_SPEED = 16;

/** ارتفاع القسم كاملًا — محجوز مسبقًا. */
export const CATEGORY_STRIP_H = 128;

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
    <div
      className="relative w-full overflow-hidden bg-transparent text-foreground"
      style={{ height: `${CATEGORY_STRIP_H}px` }}
    >
      <WalkingMascots />

      <nav
        aria-label={t("market.home.strip.label")}
        className="relative z-10 mx-auto flex h-full w-full max-w-[1320px] items-center"
      >
        <StripRow
          fields={STRIP_FIELDS}
          direction={-1}
          pathname={pathname}
          current={current}
          kept={kept}
        />
      </nav>
    </div>
  );
}

/** كَحيل يمشي من البداية للنهاية، وكحيلان بالعكس — حركة CSS واحدة لكل منهما. */
function WalkingMascots() {
  const kaheel = mascotAsset("kaheel", "sm");
  const kaheelan = mascotAsset("kaheelan", "sm");
  const height = 48;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <img
        src={kaheel.src}
        alt=""
        width={Math.round((kaheel.width / kaheel.height) * height)}
        height={height}
        loading="lazy"
        decoding="async"
        className="k-mascot-walk k-mascot-walk-ltr absolute bottom-0 opacity-40"
        style={{ height, width: Math.round((kaheel.width / kaheel.height) * height) }}
      />
      <img
        src={kaheelan.src}
        alt=""
        width={Math.round((kaheelan.width / kaheelan.height) * height)}
        height={height}
        loading="lazy"
        decoding="async"
        className="k-mascot-walk k-mascot-walk-rtl absolute bottom-0 opacity-40"
        style={{ height, width: Math.round((kaheelan.width / kaheelan.height) * height) }}
      />
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
  const Icon = FIELD_ICONS[field.id] ?? LayoutGrid;
  const active =
    field.id === "services"
      ? pathname === "/services" || pathname.startsWith("/services/")
      : isFieldActive(field, current);

  // Every tile reserves the same box — round icon plus a two-line label slot —
  // so longer names can never nudge a neighbour.
  const tileClass =
    "group flex w-[84px] shrink-0 flex-col items-center gap-[3px] px-1 text-center outline-none";
  /* دائرة نعناعية بأيقونة خطية بلون الهوية، وعند المرور تنقلب إلى الهوية
     الداكنة بأيقونة بيضاء — نفس الأسلوب لكل التصنيفات بلا صور. */
  const frameClass =
    "grid size-[72px] place-items-center rounded-full transition-colors duration-200";
  const idleFrame =
    "bg-accent text-primary ring-1 ring-inset ring-primary/10 group-hover:bg-primary group-hover:text-primary-foreground";
  const activeFrame = "bg-primary text-primary-foreground";

  const body = (
    <>
      <span className={`${frameClass} ${active ? activeFrame : idleFrame}`}>
        <Icon className="size-7" strokeWidth={1.6} aria-hidden />
      </span>
      {/* Full name, wrapped over at most two lines — never clipped. */}
      <span
        dir={dir}
        className={`flex min-h-[34px] w-full items-start justify-center whitespace-normal text-desc font-black leading-[1.2] ${
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
