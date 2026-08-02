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
import { useActiveIdentity } from "@/lib/mkt-identity";
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
      { to: "/marketplace", key: "marketplace", icon: Store },
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
  const { active } = useActiveIdentity();

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold text-foreground">{t("market.more.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("market.more.subtitle")}</p>

        {session && active && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("market.identity.actingAs")}:{" "}
            <span className="font-semibold text-foreground">
              {active.name || t("market.account.fallbackName")}
            </span>
          </p>
        )}


        {GROUPS.map((group) => (
          <section key={group.key} className="mt-5">
            <h2 className="mb-2 text-sm font-bold text-foreground">
              {t(`market.more.${group.key}`)}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  search={"search" in item ? item.search : {}}
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
