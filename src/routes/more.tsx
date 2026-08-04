import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  Mail,
  Repeat,
  Shield,
  User,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { useSignOut } from "@/lib/auth-signout";
import { MarketShell } from "@/components/marketplace/MarketShell";
const title = "المزيد — كحلي";
const description =
  "إعدادات حسابك في سوق «كحلي»، اللغة، السياسات، والتواصل مع إدارة المنصة.";

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
 * `/more` holds only what the header and the bottom bar do NOT already offer:
 * account management, language, policies and support. Browsing, search,
 * sign-in/registration, messages, alerts and "add listing" live in the chrome,
 * so they are deliberately absent here. Nothing points at the admin console.
 */
function MorePage() {
  const { t, locale, setLocale, dir } = useI18n();
  const { session } = useSession();
  const { account: active } = useActiveAccount();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const signOut = useSignOut();

  const rowClass =
    "flex min-h-12 items-center gap-3 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent";

  const accountRows = [
    { to: "/dashboard/profile", icon: User, label: t("market.more.links.manageAccount") },
    { to: "/choose-account", icon: Repeat, label: t("market.more.links.switchAccount") },
    { to: "/dashboard/business", icon: Building2, label: t("market.more.links.business") },
  ];

  const legal = [
    { to: "/about", icon: Info, label: t("market.more.links.about") },
    { to: "/help", icon: HelpCircle, label: t("market.more.links.help") },
    { to: "/terms", icon: FileText, label: t("market.more.links.terms") },
    { to: "/privacy", icon: Shield, label: t("market.more.links.privacy") },
    { to: "/contact", icon: Mail, label: t("market.more.links.contact") },
  ];

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6">
        <h1 className="text-xl font-bold text-foreground">{t("market.more.title")}</h1>

        {session && active ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("market.more.usingAccount", {
              name: active.name || t("market.account.fallbackName"),
            })}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("market.more.subtitle")}</p>
        )}

        {session ? (
          <Section title={t("market.more.account")}>
            {accountRows.map((row) => (
              <Link key={row.to} to={row.to} className={rowClass}>
                <row.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </Section>
        ) : null}

        <Section title={t("market.more.app")}>
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
        </Section>

        <Section title={t("market.more.legal")}>
          {legal.map((row) => (
            <Link key={row.to} to={row.to} className={rowClass}>
              <row.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </Section>

        {session ? (
          <Section title={t("market.more.session")}>
            <button
              type="button"
              onClick={() => void signOut()}
              className={`${rowClass} w-full text-destructive`}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-start">
                {t("market.more.links.signOut")}
              </span>
            </button>
          </Section>
        ) : null}
      </div>
    </MarketShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-bold text-foreground">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

