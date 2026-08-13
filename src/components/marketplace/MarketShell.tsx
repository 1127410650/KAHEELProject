import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ClipboardList,
  Home,
  LogIn,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Tag,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { addListingHref } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";
import { routeRuleFor } from "@/lib/routes-map";
import { accentForPath } from "@/lib/section-accent";

import { useNearbyOrigin } from "@/lib/mkt-nearby";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";

import { AddListingButton } from "@/components/marketplace/AddListingButton";
import { CollapsingHomeHeader } from "@/components/marketplace/home/noon/CollapsingHomeHeader";




import { LocationSheet } from "@/components/marketplace/LocationSheet";

import { BrandLogo } from "@/components/marketplace/BrandLogo";
import kaheelMascot from "@/assets/characters/kaheel-sm.webp";

/**
 * هيدر المنصة — صار سطحًا واحدًا أبيض معتمدًا (`SiteHeader`) لكل الصفحات،
 * ومعه تنبيه عدم الاتصال وشريط التصنيفات في صفحة البحث فقط. البحث انتقل إلى
 * بنر الرئيسية، فلا صف بحث منفصل أسفل الهيدر بعد اليوم.
 */
export function MarketHeader({

  showCategories = false,
  home: _home = false,
}: {
  showCategories?: boolean;
  home?: boolean;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const offline = useOffline();

  return (
    <>
      <SiteHeader />
      {session && offline ? (
        <div className="border-b border-border bg-secondary px-3 py-1 text-center text-desc font-medium text-foreground">
          {t("market.offlineNotice")}
        </div>
      ) : null}
      {showCategories ? (
        <div className="border-b border-border bg-card">
          <MarketCategoryStrip />
        </div>
      ) : null}
    </>
  );
}


function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return offline;
}

function useMarketSetupGate() {
  const { session } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = useMarketSetupStatus();
  useEffect(() => {
    if (!session || !status.data?.needsSetup || pathname.startsWith("/market-setup")) return;
    void navigate({ to: "/market-setup", replace: true });
  }, [session, status.data?.needsSetup, pathname, navigate]);
}

const BOTTOM_NAV_PATHS = {
  home: "/",
  messages: "/my/messages",
  orders: "/my/orders",
  alerts: "/my/notifications",
  more: "/more",
  offers: "/search?featured=1",
  signIn: "/auth",
} as const;

if (import.meta.env.DEV)
  for (const path of Object.values(BOTTOM_NAV_PATHS))
    if (!routeRuleFor(path.split("?")[0]!)) console.warn("[bottom nav] unregistered path", path);

type BottomKey = "home" | "messages" | "orders" | "alerts" | "more" | "offers" | "signIn";

function activeBottomKey(pathname: string, search: string): BottomKey {
  if (pathname.startsWith(BOTTOM_NAV_PATHS.messages)) return "messages";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.orders)) return "orders";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.alerts)) return "alerts";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.more)) return "more";
  if (pathname.startsWith("/auth")) return "signIn";
  if (pathname.startsWith("/search")) return search.includes("featured=1") ? "offers" : "home";
  return "home";
}

/**
 * Slim mobile tab bar.
 *
 * Two shapes only, decided by the live session status — never by a stale cached
 * flag: a guest sees three tabs (home · offers · sign in), a signed-in user sees
 * five (home · messages · my orders · alerts · more). While the session is still
 * being restored (`status === "loading"`) the guest shape is rendered, because
 * showing private tabs to someone who turns out to be a guest is the bug we are
 * fixing here.
 */
export function MarketBottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchString = useRouterState({ select: (s) => s.location.searchStr });
  const { session, status } = useSession();
  const authenticated = status === "authenticated" && !!session;

  const items: { key: BottomKey; to: string; icon: typeof Home }[] = authenticated
    ? [
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home },
        { key: "messages", to: BOTTOM_NAV_PATHS.messages, icon: MessageCircle },
        { key: "orders", to: BOTTOM_NAV_PATHS.orders, icon: ClipboardList },
        { key: "alerts", to: BOTTOM_NAV_PATHS.alerts, icon: Bell },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: MoreHorizontal },
      ]
    : [
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home },
        { key: "offers", to: BOTTOM_NAV_PATHS.offers, icon: Tag },
        { key: "signIn", to: BOTTOM_NAV_PATHS.signIn, icon: LogIn },
      ];

  const activeKey = activeBottomKey(pathname, searchString ?? "");

  return (
    <nav
      aria-label={t("market.nav.menu")}
      data-testid="mkt-bottom-nav"
      data-auth={authenticated ? "member" : "guest"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/96 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-1px_0_rgb(17_17_17/0.04)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-1">
        {items.map((item) => {
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const className = `k-press flex min-h-[46px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-xl px-1 py-1 text-nav font-bold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-primary/45 min-[360px]:text-nav ${
            active
              ? "text-[var(--kt-bottomnav-active)]"
              : "text-muted-foreground hover:text-foreground"
          }`;
          const inner = (
            <>
              <span
                className={
                  active
                    ? "grid h-[22px] w-9 place-items-center rounded-full bg-accent text-[var(--kt-bottomnav-active)]"
                    : "grid h-[22px] w-9 place-items-center rounded-full"
                }
              >

                <item.icon className="size-[17px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              <span className="max-w-full truncate">{label}</span>
            </>
          );
          const externalLink = item.key === "signIn" || item.key === "offers";
          return (
            <li key={item.key} className="min-w-0 flex-1">
              {externalLink ? (
                <a
                  href={item.to}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  to={item.to}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


export function MarketCompactFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-[var(--page-x)] py-4 text-desc text-muted-foreground">
        {/* شعار التذييل يتبع فتحة `brand.logo.footer` نفسها التي تديرها شاشة المظهر. */}
        <BrandLogo placement="footer" className="size-5 shrink-0 rounded-md" />
        <p>{t("market.footer.rights")}</p>

        {(
          [
            ["/legal/copyright", "market.footer.copyright"],
            ["/legal/terms", "market.footer.terms"],
            ["/legal/privacy", "market.footer.privacy"],
            ["/legal/directory-policy", "market.footer.directoryPolicy"],
          ] as const
        ).map(([to, key]) => (
          <Link
            key={to}
            to={to}
            className="min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {t(key)}
          </Link>
        ))}
      </div>
    </footer>
  );
}

export type FooterVariant = "compact" | "none";
const COPYRIGHT_FOOTER_PATHS = [
  "/",
  "/search",
  "/demo",
  "/guides/syria",
  "/guides/students",
  "/about",
  "/help",
  "/legal/copyright",
];
const COPYRIGHT_FOOTER_PREFIXES = [
  "/ads/",
  "/businesses/",
  "/u/",
  "/categories/",
  "/stores/",
  "/demo-stores/",
];
const NO_FOOTER_PREFIXES = [
  "/admin",
  "/my",
  "/business",
  "/chat",
  "/more",
  "/auth",
  "/register",
  "/go",
];

export function footerVariantForPath(pathname: string): FooterVariant {
  if (NO_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)))
    return "none";
  if (COPYRIGHT_FOOTER_PATHS.includes(pathname)) return "compact";
  if (COPYRIGHT_FOOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "compact";
  return "none";
}

export function MarketShell({
  children,
  footer,
  bottomNav = true,
}: {
  children: React.ReactNode;
  footer?: FooterVariant;
  bottomNav?: boolean;
}) {
  const { dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useMarketSetupGate();
  const variant = footer ?? footerVariantForPath(pathname);
  const home = pathname === "/";
  const showCategories = pathname === "/search";
  /* لمسة لون القسم: تُضبط مرة واحدة هنا فتسري على الرؤوس والبلاطات والحالات
     النشطة داخل القسم، والسطح يبقى محايدًا. */
  const accent = accentForPath(pathname);
  return (
    <div
      dir={dir}
      style={{ "--section-accent": accent } as React.CSSProperties}
      className={
        bottomNav
          ? "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip"
      }
    >

      {/* سطح أبيض نظيف: لا طبقة خلفية مصوّرة خلف المحتوى. */}
      <MarketHeader showCategories={showCategories} home={home} />
      <main className="flex-1">{children}</main>

      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}
