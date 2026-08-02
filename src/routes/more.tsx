import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Globe, LogIn, UserPlus } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { MarketShell } from "@/components/marketplace/MarketShell";

const title = "المزيد — سوق تحقّق";
const description =
  "الروابط العامة في سوق تحقّق: عن المنصة، المساعدة، التواصل، السياسات، واختيار اللغة.";

export const Route = createFileRoute("/more")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MorePage,
});

/**
 * `/more` holds public, secondary links only. Everything personal — activity,
 * account management, switching accounts, sign-out — lives in the bottom bar or
 * the unified account menu and is deliberately absent here.
 *
 * Sections whose destination page does not exist yet (about, help, contact,
 * terms, privacy) are simply not rendered: this page never links to a dead path.
 */
function MorePage() {
  const { t, locale, setLocale, dir } = useI18n();
  const { session } = useSession();
  const { account: active } = useActiveAccount();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;

  const rowClass =
    "flex items-center gap-3 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent";

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <h1 className="text-xl font-bold text-foreground">{t("market.more.title")}</h1>

        {session && active ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("market.more.usingAccount", {
              name: active.name || t("market.account.fallbackName"),
            })}
          </p>
        ) : null}

        {/* App section: language is always available here — on mobile this page is
            the full language switcher. */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-foreground">{t("market.more.app")}</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className={`${rowClass} w-full justify-between`}
            >
              <span className="flex items-center gap-3">
                <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t("market.more.links.language")}
              </span>
              <span className="text-xs font-semibold text-primary">
                {locale === "ar" ? "English" : "العربية"}
              </span>
            </button>
          </div>
        </section>

        {!session ? (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {t("market.more.accessTitle")}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Link to="/auth" className={rowClass}>
                <LogIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{t("market.signIn")}</span>
                <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
              <Link to="/register" className={rowClass}>
                <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{t("market.signUp")}</span>
                <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </div>
          </section>
        ) : null}

        <p className="mt-5 text-xs text-muted-foreground">{t("market.more.pagesSoon")}</p>
      </div>
    </MarketShell>
  );
}
