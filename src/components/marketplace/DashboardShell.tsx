import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  Flag,
  Heart,
  LayoutList,
  MessageSquare,
  ReceiptText,
  ShieldAlert,
  Store,
  User,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

/** The everyday destinations stay in the bar; everything else lives under "More". */
const TABS = [
  { to: "/dashboard/profile", key: "profile", icon: User },
  { to: "/dashboard/my-ads", key: "myAds", icon: LayoutList },
  { to: "/dashboard/business", key: "business", icon: Store },
  { to: "/dashboard/requests", key: "requests", icon: ReceiptText },
  { to: "/dashboard/messages", key: "messages", icon: MessageSquare },
] as const;

const SECONDARY_TABS = [
  { to: "/dashboard/notifications", key: "notifications", icon: Bell },
  { to: "/dashboard/favorites", key: "favorites", icon: Heart },
  { to: "/dashboard/reports", key: "reports", icon: Flag },
  { to: "/dashboard/violations", key: "violations", icon: ShieldAlert },
] as const;



export function DashboardShell({
  title,
  children,
  narrow = false,
}: {
  title: string;
  children: ReactNode;
  /** Centred, reading-width column (~920px) for form pages. */
  narrow?: boolean;
}) {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ href: loginHref(currentPath()) });
  }, [loading, session, navigate]);

  // Close the overflow menu whenever the route changes.
  useEffect(() => setMoreOpen(false), [pathname]);

  const chip = (active: boolean) =>
    active
      ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent";

  const secondaryActive = SECONDARY_TABS.some((tab) => pathname.startsWith(tab.to));

  return (
    <MarketShell>
      <div
        className={
          narrow
            ? "mx-auto w-full max-w-[920px] px-4 py-6"
            : "mx-auto w-full max-w-7xl px-4 py-6"
        }
      >
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>

        <nav className="mt-4 -mx-1 flex flex-wrap items-center gap-1 pb-1">
          {TABS.map((tab) => (
            <Link key={tab.to} to={tab.to} className={chip(pathname.startsWith(tab.to))}>
              <tab.icon className="size-3.5" aria-hidden />
              {t(`market.dash.${tab.key}`)}
            </Link>
          ))}

          <div className="relative shrink-0">
            <button
              type="button"
              className={chip(secondaryActive)}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              {t("market.dash.more")}
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
            {moreOpen && (
              <div className="absolute z-30 mt-1 min-w-44 rounded-xl border border-border bg-popover p-1 shadow-lg">
                {SECONDARY_TABS.map((tab) => (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    <tab.icon className="size-3.5" aria-hidden />
                    {t(`market.dash.${tab.key}`)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-5">
          {loading || !session ? <Skeleton className="h-40 w-full rounded-xl" /> : children}
        </div>
      </div>
    </MarketShell>
  );

}
