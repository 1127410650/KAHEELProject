import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * The marketplace opens with one compact search action only. Category shortcuts,
 * promotional copy and animated rails live elsewhere so the first screen stays
 * calm and the same navigation is never repeated around the search control.
 */
export function MarketStorefrontHero() {
  const { locale, t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pb-1 pt-2.5 sm:px-5 sm:pt-3 lg:px-8">
      <Link
        to="/search"
        search={{}}
        aria-label={t("market.nav.search")}
        data-testid="mkt-home-search"
        className="group mx-auto flex min-h-10 w-full max-w-[430px] items-center gap-2 rounded-xl border border-market-silver-line bg-white px-3 text-start text-[11px] font-bold text-market-navy shadow-[0_5px_16px_rgb(8_35_70/0.10)] transition hover:border-market-blue/40 hover:bg-market-blue-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-blue sm:min-h-11 sm:text-xs"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-market-navy/8 text-market-navy transition group-hover:bg-market-navy group-hover:text-white">
          <Search className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {locale === "ar" ? "البحث في كَحيل" : "Search Kaheel"}
        </span>
      </Link>
    </section>
  );
}
