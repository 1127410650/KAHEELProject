import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  Flag,
  Heart,
  LayoutList,
  MessageSquare,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { canSeeLink } from "@/lib/routes-map";
import { useActiveAccount } from "@/lib/mkt-account";
import { MarketShell } from "@/components/marketplace/MarketShell";

const title = "المزيد — سوق تحقّق";
const description =
  "كل أقسام سوق تحقّق في مكان واحد: التصفح والبحث، إعلاناتي، الطلبات، الرسائل، المفضلة، ملف المنشأة والحساب الشخصي.";

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

const GROUPS = [
  {
    key: "browse",
    items: [
      { to: "/", key: "marketplace", icon: Store },
      { to: "/search", key: "search", icon: Search },
      
    ],
  },
  {
    key: "selling",
    items: [
      { to: "/dashboard/ads/new", key: "addListing", icon: Plus },
      { to: "/dashboard/my-ads", key: "myAds", icon: LayoutList },
      { to: "/dashboard/requests", key: "requests", icon: ReceiptText },
      { to: "/dashboard/business", key: "business", icon: Building2 },
    ],
  },
  {
    key: "account",
    items: [
      { to: "/dashboard/profile", key: "profile", icon: User },
      { to: "/dashboard/messages", key: "messages", icon: MessageSquare },
      { to: "/dashboard/notifications", key: "notifications", icon: Bell },
      { to: "/dashboard/favorites", key: "favorites", icon: Heart },
    ],
  },
  {
    key: "safety",
    items: [
      { to: "/dashboard/reports", key: "reports", icon: Flag },
      { to: "/dashboard/violations", key: "violations", icon: ShieldAlert },
    ],
  },
] as const;

function MorePage() {
  const { t, locale, setLocale } = useI18n();
  const { session } = useSession();
  const { account: active, can } = useActiveAccount();

  // Links are filtered through the central route map so this page never offers a
  // destination the current account would be blocked from opening.
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canSeeLink(item.to, {
        signedIn: !!session,
        accountKind: active?.kind ?? null,
        can,
      }),
    ),
  })).filter((group) => group.items.length > 0);


  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold text-foreground">{t("market.more.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("market.more.subtitle")}</p>

        {session && active && (
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">
              {t("market.entry.workingUnder", {
                name: active.name || t("market.account.fallbackName"),
              })}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-primary">
              <Link to="/choose-account" className="underline">
                {t("market.entry.change")}
              </Link>
              <Link to="/choose-account" className="underline">
                {t("market.biz.addBusiness")}
              </Link>
            </div>
          </div>
        )}


        {groups.map((group) => (
          <section key={group.key} className="mt-5">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {t(`market.more.${group.key}`)}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  {...("search" in item ? { search: item.search } : {})}
                  className="flex items-center gap-3 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent"
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t(`market.more.links.${item.key}`)}
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-foreground">{t("market.more.settings")}</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="flex w-full items-center justify-between px-3 py-3 text-sm text-foreground hover:bg-accent"
            >
              {t("market.more.links.language")}
              <span className="text-xs font-semibold text-primary">
                {locale === "ar" ? "English" : "العربية"}
              </span>
            </button>
            {!session && (
              <Link
                to="/login"
                className="flex items-center gap-3 border-t border-border px-3 py-3 text-sm text-foreground hover:bg-accent"
              >
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                {t("market.signIn")}
              </Link>
            )}
          </div>
        </section>
      </div>
    </MarketShell>
  );
}
