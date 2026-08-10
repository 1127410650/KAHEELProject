/**
 * هيدر الرئيسية المنكمش — صفّان فقط داخل شريط تدرّج واحد:
 *
 *   الصف ١ (44px): الشعار (البداية) + زر الموقع (الوسط) + كبسولة «إنشاء إعلان» (النهاية).
 *   الصف ٢ (44px): حقل البحث الأبيض باستدارة 12px.
 *
 * الارتفاع الكامل ثابت (96px + حاشية شريط حالة iOS) وتحته مساحة محجوزة بنفس
 * القيمة بالضبط ⇒ الشريط التالي (شريط التصنيفات) لا يُغطّى أبدًا وCLS = 0.
 *
 * الانكماش: متغيّر واحد `--p` (0 → 1) من `useHeaderProgress` يحرّك الحاوية
 * بـ `transform` فقط (بلا أي تغيير ارتفاع على الحاوية الخارجية) فينزلق الصف
 * الأول خارج الشاشة ويتلاشى، ويبقى صف البحث وحده كشريط رقيق لاصق. أي سحب
 * لأعلى في منتصف الصفحة يعيد الهيدر كاملًا فورًا، والنقر على الشريط الرقيق
 * يعيد الصفحة إلى الأعلى.
 */
import { Link } from "@tanstack/react-router";
import { MapPin, Search } from "lucide-react";

import { AddListingButton } from "@/components/marketplace/AddListingButton";
import { useI18n } from "@/i18n";
import { useHeaderProgress } from "@/lib/use-header-progress";

import kaheelLogo from "@/assets/kaheel-logo.png";

/** ارتفاع الصف الواحد، والارتفاع الكامل الثابت للهيدر (بلا حاشية شريط الحالة). */
const ROW_H = 44;
export const HOME_HEADER_FULL_H = ROW_H + ROW_H + 8; // 96

/** ارتفاع المساحة المحجوزة: ثابت ولا يُقاس أبدًا في وقت التشغيل. */
const SPACER_H = `calc(${HOME_HEADER_FULL_H}px + env(safe-area-inset-top, 0px))`;

export function CollapsingHomeHeader({
  locationLabel,
  locationKnown,
  onLocation,
  addHref,
  extra,
}: {
  locationLabel: string;
  locationKnown: boolean;
  onLocation: () => void;
  addHref: string;
  /** الجرس والتنبيهات يعيشان في الشريط السفلي؛ لا يزاحمان صف الهوية. */
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
          position: "fixed",
          // التدرّج المعتمد نهائيًا — بلا أي طبقة تعتيم فوقه.
          backgroundImage: "linear-gradient(90deg, #8A4FFF 0%, #C3ABFF 100%)",
          // حاشية شريط حالة iOS داخل التدرّج نفسه.
          paddingTop: "env(safe-area-inset-top, 0px)",
          height: SPACER_H,
          // حركة الانكماش: إزاحة فقط — لا ارتفاع ولا تخطيط.
          transform: `translate3d(0, calc(-${ROW_H}px * var(--p)), 0)`,
          willChange: "transform",
        } as React.CSSProperties}
        className="inset-x-0 top-0 z-40 rounded-b-[16px] text-primary-foreground shadow-[0_10px_28px_-22px_rgb(138_79_255/0.55)]"
        onClick={
          collapsed
            ? () => window.scrollTo({ top: 0, behavior: "smooth" })
            : undefined
        }
      >
        {/* صف الهوية — ينزلق خارج الشاشة ويتلاشى مع التمرير لأسفل. */}
        <div
          className="mx-auto grid w-full max-w-[1240px] grid-cols-[auto_1fr_auto] items-center gap-[var(--sp-2)] px-[var(--page-x)]"
          style={{
            height: `${ROW_H}px`,
            opacity: "calc(1 - var(--p) * 1.6)",
          }}
          aria-hidden={collapsed}
        >
          <Link
            to="/"
            className="flex min-h-[44px] shrink-0 items-center gap-[var(--sp-2)]"
            aria-label={t("market.brand")}
            tabIndex={collapsed ? -1 : 0}
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

          <button
            type="button"
            onClick={onLocation}
            className="mx-auto flex min-h-[44px] min-w-0 items-center justify-center gap-[var(--sp-1)] rounded-xl px-[var(--sp-1)] text-start outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
            aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
            tabIndex={collapsed ? -1 : 0}
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            <strong
              className={
                locationKnown
                  ? "min-w-0 max-w-[9.5rem] truncate whitespace-nowrap text-desc font-black leading-tight"
                  : "min-w-0 max-w-[9.5rem] truncate whitespace-nowrap text-desc font-black leading-tight underline decoration-dotted underline-offset-2"
              }
            >
              {locationLabel}
            </strong>
          </button>

          <AddListingButton href={addHref} className="justify-self-end" />
        </div>

        {/* صف البحث — يبقى ظاهرًا وقابلًا للنقر في كل الحالات. */}
        <div className="mx-auto w-full max-w-[1240px] px-[var(--page-x)] pb-[var(--sp-1)]">
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
