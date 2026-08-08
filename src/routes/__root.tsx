import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
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
import { CallOverlay } from "@/components/marketplace/CallOverlay";

/**
 * `notFoundComponent` / `errorComponent` of the ROOT route render INSTEAD of
 * `RootComponent`, so they sit outside its provider tree. Each therefore has to
 * mount its own `I18nProvider`, otherwise `useI18n` runs with no provider.
 *
 * Colour identity: every public/marketplace route wears the "گحيل" (navy)
 * palette, so these standalone screens carry `market-surface` too — otherwise
 * `bg-primary` falls back to the internal system's petrol colour. Admin URLs
 * keep the internal identity untouched, so the scope is decided from the path.
 */
function useShellScope() {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
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
        <h2 className="mt-4 text-xl font-semibold text-foreground">
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <I18nProvider>
      <ErrorView error={error} reset={reset} />
    </I18nProvider>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t, dir } = useI18n();
  const scope = useShellScope();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div
      dir={dir}
      className={`${scope} flex min-h-dvh items-center justify-center bg-background px-4 py-10`}
    >
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("routeError.errorTitle")}
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
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
      { title: "گحيل — Gohail" },
      {
        name: "description",
        content: "منصة گحيل للسوق والخدمات والحجوزات — Gohail marketplace",
      },
      { property: "og:title", content: "گحيل — Gohail" },
      {
        property: "og:description",
        content: "منصة گحيل للسوق والخدمات والحجوزات — Gohail marketplace",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
      { name: "twitter:title", content: "گحيل — Gohail" },
      {
        name: "twitter:description",
        content: "منصة گحيل للسوق والخدمات والحجوزات — Gohail marketplace",
      },
      { property: "og:image", content: canonicalUrl("/og-gohail.png") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "گحيل — Gohail" },
      { name: "twitter:image", content: canonicalUrl("/og-gohail.png") },
      { name: "twitter:image:alt", content: "گحيل — Gohail" },
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
            <Toaster position="top-center" />
          </CallCenterProvider>
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
