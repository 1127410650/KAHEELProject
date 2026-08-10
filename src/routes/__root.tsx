import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import { useEffect, type ReactNode } from "react";

import { useAnalyticsInstrumentation } from "@/hooks/use-analytics";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, useI18n } from "@/i18n";
import { SessionProvider } from "@/lib/session";
import { canonicalUrl } from "@/lib/share-links";
import { Toaster } from "@/components/ui/sonner";
import { CallCenterProvider } from "@/lib/mkt-call-center";
import { PromoPopupHost } from "@/components/marketplace/campaign/PromoPopupHost";
import { MascotRoam } from "@/components/marketplace/campaign/MascotRoam";
import { CallOverlay } from "@/components/marketplace/CallOverlay";
import { recoverStaleAssetOnce } from "@/lib/runtime-recovery";

/**
 * `notFoundComponent` / `errorComponent` of the ROOT route render INSTEAD of
 * `RootComponent`, so they sit outside its provider tree. Each therefore has to
 * mount its own `I18nProvider`, otherwise `useI18n` runs with no provider.
 *
 * Colour identity: every public/marketplace route wears the "كَحيل" (navy)
 * palette, so these standalone screens carry `market-surface` too — otherwise
 * `bg-primary` falls back to the internal system's petrol colour. Admin URLs
 * keep the internal identity untouched, so the scope is decided from the path.
 */
function useShellScope() {
  // The path must come from the router, not `window`: reading `window` here is a
  // server/client branch inside render, so SSR emitted `market-surface` for an
  // `/admin/*` URL (empty pathname never starts with `/admin`) while hydration
  // computed `""` — a real `className` hydration mismatch on the admin 404 and
  // error screens. `useRouterState` returns the same pathname on both sides.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.startsWith("/admin") ? "" : "market-surface";
}


function NotFoundComponent() {
  return (
    <I18nProvider>
      <NotFoundView />
    </I18nProvider>
  );
}

function NotFoundView() {
  const { t, dir } = useI18n();
  const scope = useShellScope();
  return (
    <div
      dir={dir}
      className={`${scope} flex min-h-dvh items-center justify-center bg-background px-4 py-10`}
    >
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="text-section mt-4 font-semibold text-foreground">
          {t("routeError.notFoundTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("routeError.notFoundBody")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("routeError.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  return (
    <I18nProvider>
      <ErrorView error={error} />
    </I18nProvider>
  );
}

function ErrorView({ error }: { error: Error }) {
  console.error(error);
  const { t, dir } = useI18n();
  const scope = useShellScope();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    recoverStaleAssetOnce(error);
  }, [error]);

  return (
    <div
      dir={dir}
      className={`${scope} flex min-h-dvh items-center justify-center bg-background px-4 py-10`}
    >
      <div className="max-w-md text-center">
        <h1 className="text-page font-semibold tracking-tight text-foreground">
          {t("routeError.errorTitle")}
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              // A root failure often comes from an old deployment chunk or an
              // initialization error. A real page reload fetches the latest
              // asset manifest and restarts providers cleanly on the same URL.
              window.location.reload();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("routeError.retry")}
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("routeError.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "كَحيل — Kaheel" },
      {
        name: "description",
        content: "منصة كَحيل للسوق والخدمات والحجوزات — Kaheel marketplace",
      },
      { property: "og:title", content: "كَحيل — Kaheel" },
      {
        property: "og:description",
        content: "منصة كَحيل للسوق والخدمات والحجوزات — Kaheel marketplace",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
      { name: "twitter:title", content: "كَحيل — Kaheel" },
      {
        name: "twitter:description",
        content: "منصة كَحيل للسوق والخدمات والحجوزات — Kaheel marketplace",
      },
      { property: "og:image", content: canonicalUrl("/og-gohail.png") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "كَحيل — Kaheel" },
      { name: "twitter:image", content: canonicalUrl("/og-gohail.png") },
      { name: "twitter:image:alt", content: "كَحيل — Kaheel" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Real product analytics for every route: page views, timings, client errors.
  useAnalyticsInstrumentation();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionProvider>
          <CallCenterProvider>
            {/* Required: nested routes render here. */}
            <Outlet />
            <CallOverlay />
            <PromoPopupHost />
            <MascotRoam />
            <Toaster position="top-center" />
          </CallCenterProvider>
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
