/**
 * هيدر الرئيسية المنكمش (نمط نون): ثلاث طبقات بقواعد انكماش مختلفة يقودها
 * متغيّر CSS واحد `--p` القادم من `useHeaderProgress`.
 *
 * - صف الهوية: يبقى (شعار + تنبيهات + إعلان).
 * - صف الموقع: يُغلق تدريجيًا حتى ارتفاع صفر.
 * - صف الكبسولات: يبقى، وتتحوّل الكبسولات إلى دوائر.
 * - صف البحث: يبقى دائمًا قابلًا للنقر.
 *
 * المساحة المحجوزة أسفل الهيدر ثابتة على ارتفاع الحالة الكاملة ⇒ صفر CLS.
 */
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Car,
  Building2,
  MapPin,
  Search,
  ShoppingBasket,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

import { AddListingButton } from "@/components/marketplace/AddListingButton";
import {
  HeaderChip,
  HeaderChipsRow,
  HeaderShapes,
} from "@/components/marketplace/home/noon/CollapsingHeaderParts";
import { useI18n } from "@/i18n";
import { useHeaderProgress } from "@/lib/use-header-progress";

import kaheelLogo from "@/assets/kaheel-logo.png";

/** ارتفاع الهيدر الكامل — ثابت ويُستعمل للمساحة المحجوزة. */
export const HOME_HEADER_FULL_H = 44 + 44 + 48 + 54;

export function CollapsingHomeHeader({
  locationLabel,
  locationKnown,
  onLocation,
  addHref,
  unreadCount,
  notificationsHref,
  extra,
}: {
  locationLabel: string;
  locationKnown: boolean;
  onLocation: () => void;
  addHref: string;
  unreadCount: number;
  notificationsHref: string;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const p = useHeaderProgress();
  const style = { "--p": p } as React.CSSProperties;
  const searchPlaceholder = t("market.homeV2.searchPlaceholder" as "market.brand");

  const chips = [
    {
      label: t("market.homeV2.fields.restaurants.title"),
      href: "/search?category=restaurants",
      icon: <UtensilsCrossed className="size-[18px]" />,
    },
    {
      label: t("market.homeV2.fields.groceries.title"),
      href: "/search?domain=product",
      icon: <ShoppingBasket className="size-[18px]" />,
    },
    {
      label: t("market.homeV2.fields.realEstate.title"),
      href: "/search?category=real-estate",
      icon: <Building2 className="size-[18px]" />,
    },
    {
      label: t("market.homeV2.fields.cars.title"),
      href: "/search?category=cars",
      icon: <Car className="size-[18px]" />,
    },
    {
      label: t("market.homeV2.filters.services"),
      href: "/services",
      icon: <Wrench className="size-[18px]" />,
    },
  ];

  return (
    <>
      <header
        data-kslot="home.header"
        style={{
          ...style,
          // تُفرض هنا لأن `.k-header-hero` تعرّف position/الاستدارة خارج طبقات الأدوات.
          position: "fixed",
          borderBottomLeftRadius: "calc(28px*(1 - var(--p)) + 14px*var(--p))",
          borderBottomRightRadius: "calc(28px*(1 - var(--p)) + 14px*var(--p))",
        }}
        className="k-header-hero inset-x-0 top-0 z-40 overflow-hidden text-foreground [height:calc(190px-44px*var(--p))] shadow-[0_10px_28px_-22px_rgb(138_79_255/0.55)]"
      >

        <HeaderShapes />

        {/* صف الهوية — يبقى (فوق كل شيء وبخلفية الهيدر نفسها) */}
        <div className="k-header-hero relative z-20 mx-auto flex h-11 w-full max-w-[1240px] items-center justify-between gap-2 px-[var(--page-x)]">
          <Link
            to="/"
            className="flex min-h-[44px] items-center gap-[var(--sp-2)]"
            aria-label={t("market.brand")}
          >
            <img
              src={kaheelLogo}
              alt=""
              width={1024}
              height={1024}
              loading="lazy"
              className="size-6 shrink-0 rounded-lg bg-background p-0.5 sm:size-7"
              aria-hidden
            />
            <span className="text-lg font-black leading-none sm:text-xl">{t("market.brand")}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-[var(--sp-2)]">
            <a
              href={notificationsHref}
              className="relative grid size-11 place-items-center rounded-full outline-none transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary/45"
              aria-label={t("market.bottomNav.alerts")}
            >
              <Bell className="size-[18px]" aria-hidden />
              {unreadCount > 0 && (
                <span className="num absolute end-1 top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-desc font-bold leading-5 text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </a>
            <AddListingButton href={addHref} />
          </div>
        </div>

        {/* الطبقات السفلى تتحرّك بـ transform فقط — بلا أي إعادة تخطيط ⇒ صفر CLS */}
        <div style={{ transform: "translateY(calc(-44px * var(--p)))" }}>
        {/* صف الموقع — يُغلق (ينزلق تحت صف الهوية) مع التمرير لأسفل */}
        <div
          className="relative z-0 h-11 overflow-hidden px-[var(--page-x)]"
          style={{ opacity: "calc(1 - var(--p)*1.6)" }}
        >
          <button
            type="button"
            onClick={onLocation}
            className="flex h-11 min-h-[44px] min-w-0 items-center gap-[var(--sp-2)] rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
            tabIndex={p > 0.6 ? -1 : 0}
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            <strong
              className={
                locationKnown
                  ? "min-w-0 truncate whitespace-nowrap text-desc font-black leading-tight"
                  : "min-w-0 truncate whitespace-nowrap text-desc font-black leading-tight text-primary underline decoration-dotted underline-offset-2"
              }
            >
              {locationLabel}
            </strong>
          </button>
        </div>

        {/* صف الكبسولات — يبقى ويتحوّل إلى دوائر */}
        <HeaderChipsRow>
          {chips.map((chip) => (
            <HeaderChip key={chip.href} href={chip.href} label={chip.label} icon={chip.icon} />
          ))}
        </HeaderChipsRow>

        {/* صف البحث — يبقى دائمًا قابلًا للنقر */}
        <div className="relative z-10 mx-auto w-full max-w-[1240px] px-3 pb-[var(--sp-3)] ">
          <a
            href="/search"
            onClick={(event) => {
              if (p > 0.6) {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-muted-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            aria-label={searchPlaceholder}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate text-sm font-semibold">{searchPlaceholder}</span>
          </a>
        </div>
        </div>
        {extra}
      </header>
      <div aria-hidden style={{ height: `${HOME_HEADER_FULL_H}px` }} />
    </>
  );
}
