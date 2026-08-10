/**
 * هيدر الرئيسية المنكمش — ثلاثة صفوف مضغوطة داخل شريط تدرّج واحد:
 *
 *   الصف ١ (48px): الشعار (البداية) · زر الموقع داخل الصف نفسه (وسط، سطر واحد
 *                  مقصوص) · الجرس · كبسولة «إنشاء إعلان» (النهاية).
 *   الصف ٢ (44px): كبسولات الأقسام السريعة — تتحوّل من كبسولة إلى دائرة مع
 *                  تقدّم التمرير.
 *   الصف ٣ (44px + 8px أسفل): حقل البحث الأبيض.
 *
 * الارتفاع الكامل ثابت 150px + حاشية شريط حالة iOS، وتحته مساحة محجوزة بنفس
 * القيمة بالضبط ⇒ الشريط التالي لا يُغطّى أبدًا وCLS ≈ 0.
 *
 * الانكماش: متغيّر واحد `--p` (0 → 1) من `useHeaderProgress` يطوي الصفّين
 * الأول والثاني (ارتفاع + شفافية على الصفوف الداخلية فقط) فيبقى صف البحث
 * وحده كشريط رقيق مثبّت أعلى الشاشة. أي سحب لأعلى يعيد الهيدر كاملًا فورًا،
 * والنقر على الشريط الرقيق يعيد الصفحة إلى الأعلى.
 */
import { Link } from "@tanstack/react-router";
import { Bell, Car, Building2, MapPin, Search, ShoppingBasket, UtensilsCrossed } from "lucide-react";

import { AddListingButton } from "@/components/marketplace/AddListingButton";
import { useI18n } from "@/i18n";
import { useHeaderProgress } from "@/lib/use-header-progress";

import kaheelLogo from "@/assets/kaheel-logo.png";

/** ارتفاعات الصفوف — ثابتة ومصدرها الوحيد هذا الملف. */
const PT = 6;
const ROW1_H = 48;
const ROW2_H = 44;
const ROW3_H = 44;
const PB = 8;
/** ارتفاع الجزء القابل للطي (الصفّان الأول والثاني). */
const COLLAPSIBLE_H = ROW1_H + ROW2_H;
export const HOME_HEADER_FULL_H = PT + COLLAPSIBLE_H + ROW3_H + PB; // 150

/** ارتفاع المساحة المحجوزة: ثابت ولا يُقاس أبدًا في وقت التشغيل. */
const SPACER_H = `calc(${HOME_HEADER_FULL_H}px + env(safe-area-inset-top, 0px))`;

/** كبسولات الأقسام السريعة في الصف الثاني. */
const CHIPS = [
  { href: "/c/restaurants", label: "المطاعم", Icon: UtensilsCrossed },
  { href: "/errands", label: "المقاضي", Icon: ShoppingBasket },
  { href: "/aqar", label: "العقار", Icon: Building2 },
  { href: "/c/cars", label: "السيارات", Icon: Car },
];

export function CollapsingHomeHeader({
  locationLabel,
  locationKnown,
  onLocation,
  addHref,
  notificationsHref = "/my/notifications",
  extra,
}: {
  locationLabel: string;
  locationKnown: boolean;
  onLocation: () => void;
  addHref: string;
  unreadCount?: number;
  notificationsHref?: string;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const p = useHeaderProgress();
  const collapsed = p > 0.6;
  const searchPlaceholder = t("market.homeV2.searchPlaceholder" as "market.brand");

  return (
    <>
      <header
        data-kslot="home.header"
        data-p={p.toFixed(2)}
        style={{
          "--p": p,
          // التدرّج المعتمد نهائيًا — بلا أي طبقة تعتيم فوقه.
          backgroundImage: "linear-gradient(90deg, #8A4FFF 0%, #C3ABFF 100%)",
          // حاشية شريط حالة iOS داخل التدرّج نفسه.
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${PT}px)`,
          paddingBottom: `${PB}px`,
        } as React.CSSProperties}
        className="fixed inset-x-0 top-0 z-40 rounded-b-[16px] text-primary-foreground shadow-[0_10px_28px_-22px_rgb(138_79_255/0.55)]"
        onClick={
          collapsed
            ? () => window.scrollTo({ top: 0, behavior: "smooth" })
            : undefined
        }
      >
        {/* الصفّان القابلان للطي — ارتفاع وشفافية فقط، بلا أي حركة تخطيط خارجية. */}
        <div
          className="overflow-hidden"
          style={{
            height: `calc(${COLLAPSIBLE_H}px * (1 - var(--p)))`,
            opacity: "calc(1 - var(--p) * 1.6)",
          }}
          aria-hidden={collapsed}
        >
          {/* الصف ١ — الهوية والموقع والجرس وزر الإعلان. */}
          <div
            className="mx-auto grid w-full max-w-[1240px] grid-cols-[auto_1fr_auto_auto] items-center gap-1.5 px-[var(--page-x)]"
            style={{ height: `${ROW1_H}px` }}
          >
            <Link
              to="/"
              className="flex shrink-0 items-center gap-1.5"
              aria-label={t("market.brand")}
              tabIndex={collapsed ? -1 : 0}
            >
              <img
                src={kaheelLogo}
                alt=""
                width={1024}
                height={1024}
                className="size-6 shrink-0 rounded-lg bg-background p-0.5"
                aria-hidden
              />
              <span className="text-base font-black leading-none sm:text-lg">{t("market.brand")}</span>
            </Link>

            <button
              type="button"
              onClick={onLocation}
              className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-xl px-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
              aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              tabIndex={collapsed ? -1 : 0}
            >
              <MapPin className="size-4 shrink-0" aria-hidden />
              <strong className="min-w-0 truncate whitespace-nowrap text-desc font-bold leading-none">
                {locationLabel}
              </strong>
            </button>

            <a
              href={notificationsHref}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
              aria-label={t("market.nav.alerts" as "market.brand")}
              tabIndex={collapsed ? -1 : 0}
            >
              <Bell className="size-5" aria-hidden />
            </a>

            <AddListingButton href={addHref} className="justify-self-end" />
          </div>

          {/* الصف ٢ — كبسولات الأقسام: كبسولة ⇢ دائرة مع التمرير. */}
          <nav
            aria-label={t("market.categories" as "market.brand")}
            className="mx-auto flex w-full max-w-[1240px] items-center gap-1.5 overflow-x-auto px-[var(--page-x)] [scrollbar-width:none]"
            style={{ height: `${ROW2_H}px` }}
          >
            {CHIPS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-background/20 px-2.5 text-desc font-bold text-primary-foreground outline-none ring-1 ring-inset ring-white/30 focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                tabIndex={collapsed ? -1 : 0}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span
                  className="overflow-hidden whitespace-nowrap"
                  style={{
                    maxWidth: "calc(7rem * (1 - var(--p)))",
                    opacity: "calc(1 - var(--p) * 1.6)",
                  }}
                >
                  {label}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {/* الصف ٣ — البحث: يبقى ظاهرًا وقابلًا للنقر في كل الحالات. */}
        <div className="mx-auto w-full max-w-[1240px] px-[var(--page-x)]">
          <a
            href="/search"
            onClick={(event) => {
              if (collapsed) {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex h-11 w-full items-center gap-[var(--sp-2)] rounded-[12px] bg-card px-[var(--sp-4)] text-muted-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
            aria-label={searchPlaceholder}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate text-sm font-semibold">{searchPlaceholder}</span>
          </a>
        </div>
        {extra}
      </header>
      {/* المساحة المحجوزة: قيمة ثابتة تساوي الارتفاع الكامل دائمًا. */}
      <div aria-hidden style={{ height: SPACER_H }} />
    </>
  );
}
