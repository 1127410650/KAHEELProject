import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Info,
  LogIn,
  LogOut,
  Mail,
  Shield,
  User,
  UserPlus,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { useSignOut } from "@/lib/auth-signout";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ACTIVITY_LINKS, MANAGE_LINKS, visibleLinks } from "@/lib/more-menu";

const title = "المزيد — كحلي";
const description = "إعدادات حسابك ومتجرك واللغة والسياسات والتواصل مع إدارة المنصة.";

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

function MorePage() {
  const { t, locale, setLocale, dir } = useI18n();
  const { session } = useSession();
  const { account: active, can, clear } = useActiveAccount();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const centralSignOut = useSignOut();

  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: isPlatformAdmin,
  });

  const rowClass =
    "flex min-h-13 items-center gap-3 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent";

  const viewer = {
    signedIn: !!session,
    accountKind: active?.kind ?? null,
    can,
    isPlatformAdmin: admin.data === true,
  };

  const activity = session && active ? visibleLinks(ACTIVITY_LINKS, viewer) : [];
  const manage = session && active ? visibleLinks(MANAGE_LINKS, viewer) : [];

  async function signOut() {
    if (!window.confirm(t("market.account.signOutConfirm"))) return;
    clear();
    await centralSignOut();
  }

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
        <p className="mt-1 text-xs text-muted-foreground">{t("market.more.subtitle")}</p>

        {session && active ? (
          <>
            <section className="mt-5">
              <h2 className="mb-2 text-sm font-bold text-foreground">{t("market.more.account")}</h2>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                {active.avatar_url ? (
                  <img src={active.avatar_url} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <User className="size-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {active.name || t("market.account.fallbackName")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{t("market.entry.kind.individual")}</span>
                    {active.verification_status === "approved" ? (
                      <VerifiedBadge status={active.verification_status} size="xs" />
                    ) : null}
                  </span>
                </span>
              </div>
            </section>

            {activity.length ? (
              <Section title={t("market.account.activityTitle")}>
                {activity.map((link) => (
                  <Link key={link.key} to={link.to} className={rowClass}>
                    <link.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t(link.labelKey)}</span>
                    <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ))}
              </Section>
            ) : null}

            {manage.length ? (
              <Section title={t("market.account.manageTitle")}>
                {manage.map((link) => (
                  <Link key={link.key} to={link.to} className={rowClass}>
                    <link.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t(link.labelKey)}</span>
                    <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ))}
              </Section>
            ) : null}
          </>
        ) : null}

        {!session ? (
          <Section title={t("market.more.accessTitle")}>
            <Link to="/auth" className={rowClass}>
              <LogIn className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t("market.signIn")}</span>
              <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <Link to="/register" className={rowClass}>
              <UserPlus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t("market.signUp")}</span>
              <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </Section>
        ) : null}

        <Section title={t("market.more.app")}>
          <button type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} className={`${rowClass} w-full justify-between`}>
            <span className="flex items-center gap-3">
              <Globe className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              {t("market.more.links.language")}
            </span>
            <span className="text-xs font-semibold text-primary">{locale === "ar" ? "English" : "العربية"}</span>
          </button>
        </Section>

        <Section title={t("market.more.legal")}>
          {legal.map((row) => (
            <Link key={row.to} to={row.to} className={rowClass}>
              <row.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </Section>

        {session ? (
          <Section title={t("market.more.session")}>
            <button type="button" onClick={() => void signOut()} className={`${rowClass} w-full text-destructive`}>
              <LogOut className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-start">{t("market.more.links.signOut")}</span>
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
