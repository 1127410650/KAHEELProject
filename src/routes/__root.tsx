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

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, useI18n } from "@/i18n";
import { SessionProvider } from "@/lib/session";
import { Toaster } from "@/components/ui/sonner";
import { CallCenterProvider } from "@/lib/mkt-call-center";
import { CallOverlay } from "@/components/marketplace/CallOverlay";

/**
 * `notFoundComponent` / `errorComponent` of the ROOT route render INSTEAD of
 * `RootComponent`, so they sit outside its provider tree. Each therefore has to
 * mount its own `I18nProvider`, otherwise `useI18n` runs with no provider.
 */
function NotFoundComponent() {
  return (
    <I18nProvider>
      <NotFoundView />
    </I18nProvider>
  );
}

function NotFoundView() {
  const { t, dir } = useI18n();
  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("routeError.notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("routeError.notFoundBody")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-background px-4">
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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("routeError.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
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
      { title: "تحقّق — Tahqaq" },
      {
        name: "description",
        content:
          "إدارة المشاريع — Projects, invoices",
      },
      { property: "og:title", content: "تحقّق — Tahqaq" },
      {
        property: "og:description",
        content: "إدارة المشاريع — Projects, invoices",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
      { name: "twitter:title", content: "تحقّق — Tahqaq" },
      { name: "twitter:description", content: "إدارة المشاريع — Projects, invoices" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fb09ea2d-c4ed-441d-b8ab-d06367838354/id-preview-7340c000--e4af4416-92f0-4e72-9296-39a81d60b485.lovable.app-1785492854791.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fb09ea2d-c4ed-441d-b8ab-d06367838354/id-preview-7340c000--e4af4416-92f0-4e72-9296-39a81d60b485.lovable.app-1785492854791.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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
