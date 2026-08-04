/**
 * Route-level fallbacks for the ad form pages.
 *
 * A client-only route (`ssr: false`) shows nothing at all while its component
 * chunk loads, which reads as a blank screen. These two small components make
 * that moment visible: a short skeleton while loading, and a message with a
 * retry when the chunk or the data behind it fails.
 */

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FormRoutePending() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6" aria-busy="true">
      <Skeleton className="h-6 w-40 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-11 w-2/3 rounded-lg" />
    </div>
  );
}

export function FormRouteError() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">{t("market.form.loadFailed")}</p>
        <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>
          {t("market.form.retry")}
        </Button>
      </div>
    </div>
  );
}
