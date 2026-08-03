import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, LogOut, Plus, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";

interface ChooseSearch {
  next?: string | undefined;
}

/**
 * Active-account selection for the public marketplace.
 *
 * Canonical marketplace route. `/select-account` is a different screen: it picks
 * the administrative workspace (tenant) of the internal ERP. Here the choice is
 * "personal account or one of my businesses", and it is always re-verified
 * server-side (`mkt_account_context`) before it becomes active — localStorage
 * only remembers the last key.
 */
export const Route = createFileRoute("/choose-account")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ChooseSearch => {
    const raw = search["next"];
    // Only internal, non protocol-relative paths survive: no open redirect.
    return typeof raw === "string" &&
      raw.startsWith("/") &&
      !raw.startsWith("//") &&
      !raw.startsWith("/\\")
      ? { next: raw }
      : {};
  },
  head: () => ({
    meta: [
      { title: "اختر الحساب — سوق تحقّق" },
      {
        name: "description",
        content:
          "اختر الحساب الذي تريد استخدامه في سوق تحقّق: حسابك الشخصي أو إحدى منشآتك، وتعمل المنصة تحت هذا الحساب فقط.",
      },
      { property: "og:title", content: "اختر الحساب — سوق تحقّق" },
      { property: "og:description", content: "الدخول إلى السوق تحت حساب واحد بعزل كامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseAccountPage,
});

function AccountAvatar({ account }: { account: MktAccount }) {
  const Icon = account.kind === "business" ? Building2 : User;
  if (account.avatar_url) {
    return (
      <img
        src={account.avatar_url}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover sm:size-11"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground sm:size-11">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/**
 * One selectable account. A real <button> so Enter/Space work and focus is
 * visible; the whole card is the touch target (≥44px on phones).
 */
function AccountCard({
  account,
  current,
  pending,
  disabled,
  onSelect,
}: {
  account: MktAccount;
  current: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const name = account.name || t("market.account.fallbackName");
  const meta = [
    t(`market.entry.kind.${account.kind}`),
    account.activity ?? null,
    account.city ?? null,
    account.kind === "business" && account.role ? t(`team.roles.${account.role}`) : null,
  ].filter(Boolean) as string[];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={t("market.entry.selectAria").replace("{name}", name)}
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      className="flex h-full w-full min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 sm:p-3.5"
    >
      <AccountAvatar account={account} />
      <span className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
        <span className="wrap-anywhere block text-sm font-semibold leading-snug text-foreground">
          {name}
        </span>
        <VerifiedBadge status={account.verification_status} size="xs" />
        <span className="wrap-anywhere mt-0.5 block text-[11px] leading-snug text-muted-foreground sm:text-xs">
          {meta.join(" · ")}
        </span>
        {current && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <Check className="size-3.5" aria-hidden />
            {t("market.entry.current")}
          </span>
        )}
      </span>
      {pending ? (
        <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-primary" aria-hidden />
      ) : null}
    </button>
  );
}

function ChooseAccountPage() {
  const { t } = useI18n();
  const { session, loading: sessionLoading } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { accounts, account: activeAccount, loading, select } = useActiveAccount();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [sessionLoading, session, navigate]);

  const personal = useMemo(() => accounts.filter((a) => a.kind === "individual"), [accounts]);
  const businesses = useMemo(() => accounts.filter((a) => a.kind === "business"), [accounts]);

  async function enter(account: MktAccount) {
    if (pending) return; // rapid double clicks pick one account only
    if (activeAccount?.account_key === account.account_key) {
      void navigate({ to: next ?? "/", replace: true });
      return;
    }
    setPending(account.account_key);
    const ok = await select(account.account_key);
    setPending(null);
    if (!ok) {
      toast.error(t("market.entry.revoked"));
      return;
    }
    void navigate({ to: next ?? "/", replace: true });
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const grid =
    "mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:py-10 lg:max-w-4xl xl:max-w-5xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="wrap-anywhere text-lg font-bold leading-tight sm:text-2xl">
            {t("market.entry.title")}
          </h1>
          <p className="wrap-anywhere mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
            {t("market.entry.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void signOut()}
          className="shrink-0 gap-1.5"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("nav.signOut")}</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="acc-personal">
            <h2
              id="acc-personal"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
            >
              {t("market.entry.personalSection")}
            </h2>
            <ul className={grid}>
              {personal.map((account) => (
                <li key={account.account_key} className="min-w-0">
                  <AccountCard
                    account={account}
                    current={activeAccount?.account_key === account.account_key}
                    pending={pending === account.account_key}
                    disabled={!!pending}
                    onSelect={() => void enter(account)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="acc-business">
            <h2
              id="acc-business"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
            >
              {t("market.entry.businessSection")}
            </h2>
            {businesses.length === 0 ? (
              <p className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                {t("market.entry.noBusinesses")}
              </p>
            ) : (
              <ul className={grid}>
                {businesses.map((account) => (
                  <li key={account.account_key} className="min-w-0">
                    <AccountCard
                      account={account}
                      current={activeAccount?.account_key === account.account_key}
                      pending={pending === account.account_key}
                      disabled={!!pending}
                      onSelect={() => void enter(account)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-1">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/business/new" search={{ ...(next ? { next } : {}) }}>
                <Plus className="size-4" aria-hidden />
                {t("market.entry.newBusiness")}
              </Link>
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("market.entry.newBusinessHint")}
            </p>
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        <Link to="/" className="underline">
          {t("market.entry.browsePublic")}
        </Link>
      </p>
    </div>
  );
}
