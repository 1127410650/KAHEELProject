import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Heart, LayoutList, MessageSquare, ReceiptText, Store } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { to: "/dashboard/my-ads", key: "myAds", icon: LayoutList },
  { to: "/dashboard/requests", key: "requests", icon: ReceiptText },
  { to: "/dashboard/messages", key: "messages", icon: MessageSquare },
  { to: "/dashboard/favorites", key: "favorites", icon: Heart },
  { to: "/dashboard/business", key: "business", icon: Store },
] as const;

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ href: loginHref(currentPath()) });
  }, [loading, session, navigate]);

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>

        <nav className="mt-4 -mx-1 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={
                  active
                    ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                }
              >
                <tab.icon className="size-3.5" aria-hidden />
                {t(`market.dash.${tab.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5">
          {loading || !session ? <Skeleton className="h-40 w-full rounded-xl" /> : children}
        </div>
      </div>
    </MarketShell>
  );
}
