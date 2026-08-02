import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account pages share only a title and a reading column. Navigation between them
 * lives in one place — the unified account menu in the header — so no page
 * repeats a tab bar on top of it.
 */
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
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ href: loginHref(currentPath()) });
  }, [loading, session, navigate]);

  return (
    <MarketShell footer="none">
      <div
        className={
          narrow
            ? "mx-auto w-full max-w-[920px] px-4 py-6"
            : "mx-auto w-full max-w-7xl px-4 py-6"
        }
      >
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>

        <div className="mt-5">
          {loading || !session ? <Skeleton className="h-40 w-full rounded-xl" /> : children}
        </div>
      </div>
    </MarketShell>
  );
}
