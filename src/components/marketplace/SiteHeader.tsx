/**
 * هيدر كَحيل المعتمد — خلفية بيضاء وحد سفلي فاصل، صف واحد:
 *
 *   • الشعار (جهة البداية): فتحة `brand.logo.header.light` إن رفعها المالك، وإلا
 *     نص «كَحيل» بلون الهوية الداكن.
 *   • روابط تنقّل نصية بلا حاوية ملوّنة.
 *   • جهة النهاية: «نجدتي» بلون تحذيري مستقل عن الهوية مع نبضة، المفضلة، السلة
 *     بعدّاد، قائمة الحساب في نافذة منبثقة حقيقية، وزر «+ أضف إعلانك» الداكن.
 *
 * لا مسار جديد ولا منطق جديد: كل وجهة هنا مسار قائم فعلًا في المنصة.
 * الارتفاع ثابت (64px + حاشية أمان iOS) والمساحة المحجوزة تحته بنفس القيمة
 * بالضبط ⇒ صفر هزّة تخطيط.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Heart, LifeBuoy, Plus, ShoppingCart, User } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useSignOut } from "@/lib/auth-signout";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { addListingHref } from "@/lib/add-listing";
import { slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";

export const SITE_HEADER_H = 64;

/** روابط التنقّل الأساسية — كلها مسارات قائمة. */
const NAV: { href: string; ar: string; en: string }[] = [
  { href: "/", ar: "الرئيسية", en: "Home" },
  { href: "/c/restaurants", ar: "المطاعم", en: "Restaurants" },
  { href: "/aqar", ar: "العقارات", en: "Real estate" },
  { href: "/search?category=cars", ar: "طلب سيارة", en: "Request a car" },
  { href: "/errands", ar: "طلب النجدة", en: "Request help" },
  { href: "/search?category=fashion", ar: "الأزياء", en: "Fashion" },
  { href: "/about", ar: "من نحن", en: "About us" },
];

/** خيارات قائمة الحساب — نفس الخيارات التي كانت مبعثرة، بلا حذف أي واحدة. */
const ACCOUNT_LINKS: { href: string; ar: string; en: string }[] = [
  { href: "/my/profile", ar: "عناويني", en: "My addresses" },
  { href: "/search?category=fashion", ar: "طلبات الأزياء", en: "Fashion orders" },
  { href: "/my/bookings", ar: "حجوزاتي", en: "My bookings" },
  { href: "/guides/students", ar: "طلابي", en: "My students" },
  { href: "/my/captain", ar: "سائق", en: "Driver" },
  { href: "/my/errands", ar: "رحلتي", en: "My trip" },
];

export function SiteHeader() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const slots = useMediaSlots();
  const logo = slotUrl(slots.data, "brand.logo.header.light", "");
  const addHref = addListingHref({ authenticated: !!session });

  return (
    <>
      <header
        data-kslot="home.header"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card"
      >
        <div
          className="mx-auto flex w-full max-w-[1240px] items-center gap-[var(--sp-3)] px-[var(--page-x)]"
          style={{ height: `${SITE_HEADER_H}px` }}
        >
          <Link to="/" className="k-press flex shrink-0 items-center" aria-label="كَحيل">
            {logo ? (
              <img src={logo} alt="كَحيل" width={240} height={80} className="h-8 w-auto" />
            ) : (
              <span className="text-xl font-black leading-none text-primary sm:text-2xl">كَحيل</span>
            )}
          </Link>

          <nav
            aria-label={ar ? "التنقّل الأساسي" : "Primary navigation"}
            className="hidden min-w-0 flex-1 items-center justify-center gap-[var(--sp-4)] lg:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-sm font-bold text-foreground/80 outline-none transition-colors hover:text-primary focus-visible:text-primary"
              >
                {ar ? item.ar : item.en}
              </a>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-[var(--sp-2)] lg:flex-none">
            <RescueButton />

            <a
              href="/my/favorites"
              aria-label={ar ? "المفضلة" : "Favorites"}
              title={ar ? "المفضلة" : "Favorites"}
              className="k-press grid size-10 place-items-center rounded-full text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Heart className="size-5" strokeWidth={1.8} aria-hidden />
            </a>

            <CartButton />

            <AccountMenu ar={ar} />

            <a
              href={addHref}
              className="k-press inline-flex h-10 items-center gap-[var(--sp-2)] rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Plus className="size-4" strokeWidth={2.2} aria-hidden />
              <span className="hidden sm:inline">{ar ? "أضف إعلانك" : "Add your listing"}</span>
            </a>
          </div>
        </div>

        {/* التنقّل على الشاشات الصغيرة: صف قابل للتمرير بلا حاوية ملوّنة. */}
        <nav
          aria-label={ar ? "التنقّل الأساسي" : "Primary navigation"}
          className="flex items-center gap-[var(--sp-4)] overflow-x-auto border-t border-border px-[var(--page-x)] py-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-desc font-bold text-foreground/80 hover:text-primary"
            >
              {ar ? item.ar : item.en}
            </a>
          ))}
        </nav>
      </header>
      {/* مساحة محجوزة ثابتة = ارتفاع الهيدر (صف واحد + صف التنقّل على الجوال). */}
      <div
        aria-hidden
        style={{ height: `calc(env(safe-area-inset-top, 0px) + ${SITE_HEADER_H}px)` }}
      />
      <div aria-hidden className="h-[37px] lg:hidden" />
    </>
  );
}

/** زر «نجدتي» — لون تحذيري مستقل عن هوية العلامة مع مؤشر نبض صغير. */
function RescueButton() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const label = ar ? "نجدتي" : "Help me";
  return (
    <a
      href="/errands"
      aria-label={label}
      className="k-press relative inline-flex h-10 items-center gap-[var(--sp-2)] rounded-full border border-destructive/40 bg-destructive/10 px-3 text-sm font-bold text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
    >
      <LifeBuoy className="size-[18px]" strokeWidth={1.9} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span aria-hidden className="absolute -end-0.5 -top-0.5 grid size-2.5 place-items-center">
        <span className="absolute size-2.5 animate-ping rounded-full bg-destructive/60" />
        <span className="relative size-1.5 rounded-full bg-destructive" />
      </span>
    </a>
  );
}

/** أيقونة السلة مع عدّاد الطلبات المفتوحة للمستخدم الحالي. */
function CartButton() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const label = ar ? "السلة" : "Cart";
  const count = 0;
  return (
    <a
      href="/my/orders"
      aria-label={label}
      title={label}
      className="k-press relative grid size-10 place-items-center rounded-full text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <ShoppingCart className="size-5" strokeWidth={1.8} aria-hidden />
      <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground">
        {count.toLocaleString("en-US")}
      </span>
    </a>
  );
}

/**
 * نافذة الحساب — مغلقة افتراضيًا، تُفتح بالنقر، وتُغلق بالنقر خارجها أو Esc.
 */
function AccountMenu({ ar }: { ar: boolean }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { session } = useSession();
  const signOut = useSignOut();
  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id ?? null],
    enabled: !!session && open,
    staleTime: 5 * 60_000,
    queryFn: isPlatformAdmin,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "block rounded-lg px-3 py-2 text-sm font-semibold text-foreground outline-none hover:bg-accent focus-visible:bg-accent";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ar ? "حسابي" : "My account"}
        className="k-press grid size-10 place-items-center rounded-full text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <User className="size-5" strokeWidth={1.8} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+8px)] z-50 w-56 rounded-[var(--r-card)] border border-border bg-card p-1.5 shadow-panel"
        >
          {ACCOUNT_LINKS.map((item) => (
            <a key={item.href} href={item.href} role="menuitem" className={itemClass}>
              {ar ? item.ar : item.en}
            </a>
          ))}

          <hr className="my-1.5 border-border" />

          {session ? (
            <>
              {admin.data === true ? (
                <a href="/admin" role="menuitem" className={itemClass}>
                  {ar ? "الإدارة" : "Administration"}
                </a>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className={`${itemClass} w-full text-start text-destructive`}
              >
                {ar ? "تسجيل خروج" : "Sign out"}
              </button>
            </>
          ) : (
            <a href="/auth" role="menuitem" className={itemClass}>
              {ar ? "تسجيل الدخول" : "Sign in"}
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SiteHeader;
