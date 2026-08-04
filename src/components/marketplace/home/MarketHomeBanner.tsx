import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import bannerImage from "@/assets/market/banner-post-listing.jpg";

/**
 * Public marketplace hero banner: brand copy on navy, one real action, one
 * illustrative image. Guests are routed through sign-in so the action never
 * dead-ends on a protected form.
 */
export function MarketHomeBanner() {
  const { t } = useI18n();
  const { session } = useSession();
  const target = "/dashboard/ads/new";

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-4 sm:pt-6">
      <div className="overflow-hidden rounded-2xl bg-market-navy text-market-navy-foreground shadow-panel">
        <div className="grid items-stretch gap-0 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 px-5 py-6 sm:px-8 sm:py-9">
            <h2 className="text-lg font-bold leading-snug tracking-tight sm:text-2xl">
              {t("market.home.banner.title")}
            </h2>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-market-silver sm:text-sm">
              {t("market.home.banner.body")}
            </p>
            {session ? (
              <Link
                to={target}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-market-silver px-4 text-sm font-semibold text-market-navy transition-colors hover:bg-market-navy-foreground"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t("market.home.banner.cta")}
              </Link>
            ) : (
              <a
                href={`/auth?next=${encodeURIComponent(target)}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-market-silver px-4 text-sm font-semibold text-market-navy transition-colors hover:bg-market-navy-foreground"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t("market.home.banner.cta")}
              </a>
            )}
          </div>

          <img
            src={bannerImage}
            alt={t("market.home.banner.imageAlt")}
            width={768}
            height={576}
            className="hidden h-full w-64 object-cover sm:block lg:w-80"
          />
        </div>
      </div>
    </section>
  );
}
