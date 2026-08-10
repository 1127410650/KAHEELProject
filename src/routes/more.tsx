import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  HelpCircle,
  LogIn,
  LogOut,
  Shield,
  Store,
  User,
  UserPlus,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { useSignOut } from "@/lib/auth-signout";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { hasUnsavedChanges } from "@/lib/unsaved-changes";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ProfileCompletionPanel } from "@/components/marketplace/ProfileCompletionPanel";
import { ACTIVITY_LINKS, MANAGE_LINKS, visibleLinks } from "@/lib/more-menu";
import {
  useMyJoinApplications,
  useOperationalAccess,
  type JoinApplication,
  type JoinApplicationKind,
  type JoinApplicationStatus,
} from "@/lib/mkt-provider-onboarding";

const title = "المزيد — كَحيل";
const description =
  "إعدادات حسابك في سوق «كَحيل»، التبديل بين الحسابات، اللغة، السياسات، والتواصل مع إدارة المنصة.";

function AccountTypeIcon({ account, className }: { account: MktAccount; className: string }) {
  const Icon =
    account.classification === "system_admin"
      ? Shield
      : account.classification === "service_provider"
        ? Building2
        : account.classification === "store"
          ? Store
          : User;
  return <Icon className={className} aria-hidden />;
}

export const Route = createFileRoute("/more")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>): { section?: "accounts" } =>
    search["section"] === "accounts" ? { section: "accounts" } : {},

  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      // Account management screen: nothing here is useful in a search result,
      // and its content changes with the caller. Kept public (a visitor may open
      // it to sign in) but excluded from the index.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],

  }),
  component: MorePage,
});

/**
 * `/more` is the single account hub on mobile: active account, account
 * switching, creating a business, activity, account management and sign-out.
 * Home, messages, search and alerts are deliberately absent — they live in the
 * bottom bar. Nothing here points at the admin console for a normal user.
 */
function MorePage() {
  const { t, locale, setLocale, dir } = useI18n();
  const { session } = useSession();
  const { account: active, accounts, can, select, clear } = useActiveAccount();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const centralSignOut = useSignOut();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { section } = Route.useSearch();
  const accountsRef = useRef<HTMLDivElement | null>(null);
  const promotedApplicationRef = useRef<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const applications = useMyJoinApplications(!!session);
  const operational = useOperationalAccess(active?.account_key ?? null);

  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: isPlatformAdmin,
  });

  // Deep link from the header lands directly on the accounts section, without a
  // full reload and without losing the active account.
  useEffect(() => {
    if (section !== "accounts" || !accountsRef.current) return;
    accountsRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [section, active?.account_key]);

  const rowClass =
    "flex min-h-13 items-center gap-3 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent";

  const viewer = {
    signedIn: !!session,
    accountKind: active?.kind ?? null,
    can,
    isPlatformAdmin: admin.data === true,
    providerApproved: active?.kind === "business" && operational.data?.allowed === true,
    providerCapabilities: operational.data?.capabilities ?? [],
  };

  const activity = session && active ? visibleLinks(ACTIVITY_LINKS, viewer) : [];
  const manage = session && active ? visibleLinks(MANAGE_LINKS, viewer) : [];

  const switchList = [...accounts].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "individual" ? -1 : 1,
  );

  const approvedBusiness = applications.data?.find(
    (item) =>
      item.status === "approved" &&
      item.tenant_id &&
      (item.application_kind === "seller" || item.application_kind === "service_provider"),
  );

  // Approval changes the operational identity. The Auth user remains the owner,
  // while the visible session context moves to the newly approved work account.
  useEffect(() => {
    if (
      !approvedBusiness ||
      active?.kind === "business" ||
      switching ||
      promotedApplicationRef.current === approvedBusiness.id
    )
      return;
    promotedApplicationRef.current = approvedBusiness.id;
    const moveToWorkAccount = async () => {
      setSwitching(approvedBusiness.account_key);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
      const ok = await select(approvedBusiness.account_key);
      if (ok) void navigate({ to: "/business", replace: true });
      else promotedApplicationRef.current = null;
      setSwitching(null);
    };
    void moveToWorkAccount();
  }, [active?.kind, approvedBusiness, navigate, queryClient, select, switching]);

  async function switchAccount(accountKey: string) {
    if (accountKey === active?.account_key || switching) return;
    if (hasUnsavedChanges() && !window.confirm(t("market.account.unsavedWarning"))) return;
    setSwitching(accountKey);
    try {
      const ok = await select(accountKey);
      if (!ok) toast.error(t("market.entry.switchFailed"));
      else void navigate({ to: "/go" });
    } finally {
      setSwitching(null);
    }
  }

  async function signOut() {
    if (!window.confirm(t("market.account.signOutConfirm"))) return;
    clear();
    await centralSignOut();
  }

  const legal = [
    { to: "/help", icon: HelpCircle, label: t("market.more.links.support") },
    { to: "/about", icon: Shield, label: t("market.more.links.policies") },
  ];

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-3xl px-[var(--page-x)] pb-6 pt-6">
        <header className="market-page-intro">
          <h1 className="text-page font-black text-foreground">{t("market.more.title")}</h1>
          <p className="mt-1 text-desc text-muted-foreground">{t("market.more.subtitle")}</p>
        </header>

        {session && active ? (
          <>
            {/* Active account card — display only, no sensitive data. */}
            <section ref={accountsRef} className="mt-5 scroll-mt-20">
              <h2 className="text-section mb-2 font-bold text-foreground">{t("market.more.account")}</h2>
              <div className="market-section flex items-center gap-3 p-[var(--sp-4)]">
                {active.avatar_url ? (
                  <img
                    src={active.avatar_url}
                    alt=""
                    className="size-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <AccountTypeIcon account={active} className="size-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {active.name || t("market.account.fallbackName")}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-[var(--sp-2)] text-desc text-muted-foreground">
                    <span>{t(`market.entry.classification.${active.classification}`)}</span>
                    {active.city ? <span>· {active.city}</span> : null}
                    {active.verification_status === "approved" ? (
                      <VerifiedBadge status={active.verification_status} size="xs" />
                    ) : null}
                  </span>
                </span>
              </div>
              <ProfileCompletionPanel />
            </section>

            {active.classification === "customer" ? (
              <JoinSection
                locale={locale}
                rowClass={rowClass}
                applications={applications.data ?? []}
              />
            ) : null}

            {/* Switching: only accounts the server says the user may enter. */}
            <Section title={t("market.account.switchTitle")}>
              {switchList.map((item) => (
                <button
                  key={item.account_key}
                  type="button"
                  disabled={!!switching}
                  onClick={() => void switchAccount(item.account_key)}
                  className={`${rowClass} w-full text-start disabled:opacity-60`}
                >
                  <AccountTypeIcon
                    account={item}
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block text-desc text-muted-foreground">
                      {t(`market.entry.classification.${item.classification}`)}
                    </span>
                  </span>
                  {item.account_key === active.account_key ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              ))}
            </Section>

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
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className={`${rowClass} w-full justify-between`}
          >
            <span className="flex items-center gap-3">
              <Globe className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              {t("market.more.links.language")}
            </span>
            <span className="text-desc font-semibold text-primary">
              {locale === "ar" ? "English" : "العربية"}
            </span>
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
            <button
              type="button"
              onClick={() => void signOut()}
              className={`${rowClass} w-full text-destructive`}
            >
              <LogOut className="size-5 shrink-0" aria-hidden />
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
      <h2 className="text-section mb-2 font-bold text-foreground">{title}</h2>
      <div className="market-section">{children}</div>
    </section>
  );
}

const JOIN_OPTIONS: Array<{
  kind: JoinApplicationKind;
  icon: typeof Store;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
}> = [
  {
    kind: "platform_team",
    icon: UserRoundCog,
    titleAr: "انضم لفريق العمل",
    titleEn: "Join our team",
    hintAr: "التشغيل، الدعم، المبيعات، التسويق والتقنية.",
    hintEn: "Operations, support, sales, marketing and technology.",
  },
  {
    kind: "delivery_team",
    icon: Bike,
    titleAr: "انضم لفريق التوصيل",
    titleEn: "Join the delivery team",
    hintAr: "قدّم بياناتك ووسيلة التوصيل وساعات العمل.",
    hintEn: "Submit your details, vehicle and working hours.",
  },
  {
    kind: "seller",
    icon: Store,
    titleAr: "افتح حساب متجر",
    titleEn: "Open a store account",
    hintAr: "مطاعم، مقاهٍ، نوادٍ، مستشفيات، جامعات وكل نشاط يبيع.",
    hintEn: "Restaurants, cafés, clubs, hospitals, universities and every seller.",
  },
  {
    kind: "service_provider",
    icon: Building2,
    titleAr: "انضم لنا كمقدم خدمة",
    titleEn: "Join as a service provider",
    hintAr: "طبيب، حلاق، نجار، حداد، صيانة، شركات نقل وغيرها.",
    hintEn: "Doctors, barbers, carpenters, maintenance, transport companies and more.",
  },
];

const STATUS_LABELS: Record<JoinApplicationStatus, { ar: string; en: string }> = {
  pending: { ar: "بانتظار المراجعة", en: "Pending review" },
  in_review: { ar: "قيد المراجعة", en: "In review" },
  needs_more: { ar: "يتطلب استكمالًا", en: "More information needed" },
  approved: { ar: "مقبول", en: "Approved" },
  rejected: { ar: "غير مقبول", en: "Not approved" },
  withdrawn: { ar: "مسحوب", en: "Withdrawn" },
};

function JoinSection({
  locale,
  rowClass,
  applications,
}: {
  locale: "ar" | "en";
  rowClass: string;
  applications: JoinApplication[];
}) {
  const Arrow = locale === "ar" ? ChevronLeft : ChevronRight;
  const latest = new Map<JoinApplicationKind, JoinApplication>();
  applications.forEach((application) => {
    if (!latest.has(application.application_kind))
      latest.set(application.application_kind, application);
  });
  const openBusinessApplication = applications.some(
    (application) =>
      (application.application_kind === "seller" ||
        application.application_kind === "service_provider") &&
      ["pending", "in_review", "needs_more", "approved"].includes(application.status),
  );

  return (
    <Section title={locale === "ar" ? "انضم إلى كَحيل" : "Join Kaheel"}>
      {JOIN_OPTIONS.map((option) => {
        const application = latest.get(option.kind);
        const resumable = application?.status === "pending" || application?.status === "needs_more";
        const businessKind = option.kind === "seller" || option.kind === "service_provider";
        const locked =
          application?.status === "in_review" ||
          application?.status === "approved" ||
          (businessKind && openBusinessApplication && !resumable);
        const content = (
          <>
            <option.icon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 text-start">
              <span className="block font-semibold">
                {locale === "ar" ? option.titleAr : option.titleEn}
              </span>
              <span className="mt-0.5 block text-desc leading-5 text-muted-foreground">
                {locale === "ar" ? option.hintAr : option.hintEn}
              </span>
              {application ? (
                <span
                  className={`mt-[var(--sp-2)] inline-flex rounded-full px-2 py-0.5 text-desc font-bold ${
                    application.status === "approved"
                      ? "bg-success-soft text-success-strong"
                      : application.status === "rejected" || application.status === "withdrawn"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-gold-soft text-gold-foreground"
                  }`}
                >
                  {STATUS_LABELS[application.status][locale]}
                </span>
              ) : null}
            </span>
            {!locked ? (
              <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
          </>
        );

        return locked ? (
          <div key={option.kind} className={`${rowClass} bg-secondary/20`} aria-disabled="true">
            {content}
          </div>
        ) : (
          <Link key={option.kind} to="/join" search={{ kind: option.kind }} className={rowClass}>
            {content}
          </Link>
        );
      })}
    </Section>
  );
}
